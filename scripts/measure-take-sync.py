#!/usr/bin/python3
"""Sound/picture sync of a Keylight take or clip (needs ffmpeg, numpy and scipy):

  scripts/measure-take-sync.py <video> [--midi take.json] [--calibrate] [--bias ms]

  scripts/record-clip.sh 'demo=twinkle&pos=0' /tmp/twinkle.mp4 8
  scripts/measure-take-sync.py /tmp/twinkle.mp4

Picture: the lower part of the drawn white keys (below the black keys, CASCADE view)
is cut into 14 key columns; a key is lit when its colour is saturated (lit keys are
blue or orange, unlit ones grey-white). A key's visual onset is the first frame it
is lit; the frame is drawn at some moment after the note's time, so it is 0..1 frame
late; "midpoint" takes the middle between that frame and the one before instead.

Sound: spectral flux (the rise of the log spectrum above 300 Hz between 256-sample
frames 1 ms apart); a note's onset is the strongest rise from 80 ms before to 150 ms
after the moment looked at, plus --bias (default 2 ms: the flux peak comes that much
before a sound's first sample, measured on count-in clicks; --calibrate measures it
on a take that starts with the count-in).

Prints audio onset - visual onset per key onset (positive: the sound comes after the
picture). With --midi <sidecar.json>, also audio onset - note-on time for each key
the player pressed (the sidecar's t is in seconds into the video): about the output
latency in a take, as the sound left the speakers that much after the press.
recorder.js's AUDIO_PIPELINE_MS was measured this way (and with a draw-time barcode).
"""
import json, shutil, subprocess, sys
import numpy as np

FFMPEG = shutil.which('ffmpeg') or '/opt/homebrew/bin/ffmpeg'
FFPROBE = shutil.which('ffprobe') or '/opt/homebrew/bin/ffprobe'

args = sys.argv[1:]
if not args or args[0].startswith('-'):
    sys.exit(__doc__)
video = args[0]
opt = lambda name: args[args.index(name) + 1] if name in args else None
BIAS = float(opt('--bias') or 2) / 1000

def probe(*entries):
    return subprocess.run([FFPROBE, '-v', 'error', *entries, '-of', 'csv=p=0', video], capture_output=True, text=True).stdout

W, H = (int(v) for v in probe('-select_streams', 'v:0', '-show_entries', 'stream=width,height').strip().strip(',').split(',')[:2])
start = lambda s: float(probe('-select_streams', s, '-show_entries', 'stream=start_time').strip().strip(',') or 0)
vstart, astart = start('v:0'), start('a:0')

# picture: 14 white keys between 3 % and 97 % of the width, 92.5-96.5 % of the height
NK = 14
x0, x1, y0, y1 = int(W * 0.031), int(W * 0.969), int(H * 0.925), int(H * 0.965)
pts = np.array([float(p.strip(',')) for p in probe('-select_streams', 'v:0', '-show_entries', 'frame=pts_time').split()
                if p.strip(',') and 'N/A' not in p])
raw = subprocess.run([FFMPEG, '-v', 'error', '-i', video, '-map', '0:v:0', '-fps_mode', 'passthrough',
                      '-vf', f'format=rgb24,crop={x1 - x0}:{y1 - y0}:{x0}:{y0},scale={NK}:1:flags=area',
                      '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'], capture_output=True).stdout
frames = np.frombuffer(raw, np.uint8).reshape(-1, NK, 3).astype(float)
n = min(len(frames), len(pts))
order = np.argsort(pts[:n])
frames, pts = frames[:n][order], pts[:n][order]
lit = (frames.max(axis=2) - frames.min(axis=2)) > 75
vis = sorted((pts[i], k, pts[i - 1]) for k in range(NK) for i in np.flatnonzero(lit[1:, k] & ~lit[:-1, k]) + 1)

# sound: spectral flux
sr = 48000
pcm = subprocess.run([FFMPEG, '-v', 'error', '-i', video, '-map', '0:a:0', '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'],
                     capture_output=True).stdout
a = np.frombuffer(pcm, np.float32).astype(float)
win, hop = 256, sr // 1000
nfr = (len(a) - win) // hop
idx = np.arange(win)[None, :] + hop * np.arange(nfr)[:, None]
spec = np.abs(np.fft.rfft(a[idx] * np.hanning(win)[None, :], axis=1))[:, int(300 * win / sr):]
flux = np.maximum(0, np.diff(np.log1p(1000 * spec), axis=0)).sum(axis=1)
ftime = astart + (np.arange(1, nfr) * hop + win / 2) / sr
floor = 8 * (np.median(flux) + 1e-9)

def onset_near(t):
    m = (ftime >= t - 0.08) & (ftime <= t + 0.15)
    if not m.any():
        return None
    j = np.flatnonzero(m)[np.argmax(flux[m])]
    return ftime[j] + BIAS if flux[j] > floor else None

def report(times, label):
    d = np.array([o - t for t in times for o in [onset_near(t)] if o is not None]) * 1000
    if not len(d):
        print(f'{label}: nothing matched')
        return
    q = np.percentile(d, [0, 10, 50, 90, 100])
    print(f'{label}: {len(d)} of {len(times)} matched, audio - {label.split()[0]} (ms): median {q[2]:+.1f}, '
          f'p10..p90 {q[1]:+.1f}..{q[3]:+.1f}, min..max {q[0]:+.1f}..{q[4]:+.1f}, sd {d.std():.1f}')
    print('  each (ms): ' + ' '.join(f'{x:+.0f}' for x in d))

print(f'{video}: {W}x{H}, {n} frames, video starts {vstart:.3f}s, audio {astart:.3f}s')
if '--calibrate' in args:
    seg = np.abs(a[: int(0.3 * sr)])
    first = astart + np.flatnonzero(seg > 0.3 * seg.max())[0] / sr
    m = (ftime >= first - 0.03) & (ftime <= first + 0.03)
    peak = ftime[np.flatnonzero(m)[np.argmax(flux[m])]]
    print(f'calibrate: the first click starts at {first:.4f}s, its flux peak is at {peak:.4f}s: --bias {1000 * (first - peak):.1f}')
report([t for t, _, _ in vis], 'visual onsets (first lit frame)')
report([(t + p) / 2 for t, _, p in vis], 'visual onsets (midpoint)')
if opt('--midi'):
    side = json.load(open(opt('--midi')))
    report([e['t'] for e in side.get('midi', []) if e.get('type') == 'on'], 'note-ons from the sidecar')
