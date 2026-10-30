#!/usr/bin/env python3
"""
End-to-end test for scripts/sync-take.py, on synthetic recordings with known truth.

  scripts/test-sync-take.py [--work DIR] [--keep]

It builds fake Keylight takes (testsrc2 2560x1300 @ 60 fps, clean piano-like audio, a .json
sidecar with outputLatencyMs 24) in the three layouts a take's file can have, and fake phone
clips made from the same sound after realistic damage (speaker band limits, room echoes, noise
20 dB down, clicks only the phone heard, talking, 44.1 vs 48 kHz, AAC, long lead-ins, longer than
the take, a variable frame rate, one 10-bit HEVC HLG clip turned 90 degrees with a second audio
stream, one that also holds an earlier attempt at the same notes, one where the Mac's speakers
fell 8 ms behind halfway through), plus two clips that must be refused: unrelated audio, and only
that earlier attempt.  Then it runs the real tool and checks its offsets (+/-5 ms of the truth),
its refusals and its renders (size, fps, duration, streams, picture sync measured from white
flashes, square pixels after rotation, HDR tone mapping, sound placement, --max-mb, --preview).

The room is modelled first, then each recording is made from it: a key lights up in the take's
picture at take time t (a white flash), the Mac's speakers play its sound at t + 24 ms, and the
phone, which started `offset` s before the take, sees the flash at t + offset and hears the sound
at t + offset + 24 ms.  The take's own file holds the sound at t + S, where S depends on how the
file was made:
  legacy  S = 0        the first sidecars' contract: sound captured with the picture, no "sync"
  rec     S = 24 ms    Keylight's recorder (sync.applied, edit list): each sound where the speakers played it
  raw     S = 50.8 ms  the recorder's raw .webm (sync.applied false): pipelineMs 45.4 + first frame
                       5.4 ms late; written as a stream, so like MediaRecorder's it has no duration
The truth is the picture offset in every case, and the renders are checked against the flashes.

Nothing is imported from the tool: the notes and the damage are made here, and the truth comes
from how the clips were built.  Prints PASS/FAIL per check and a summary; exit 0 only if all pass.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
TOOL = os.path.join(HERE, 'sync-take.py')
FF = shutil.which('ffmpeg') or '/opt/homebrew/bin/ffmpeg'
FP = shutil.which('ffprobe') or '/opt/homebrew/bin/ffprobe'

SR = 48000
TAKE_DUR = 30.0
LAT_MS = 24.0
LAT = LAT_MS / 1000.0
FLASHES = [4.0, 7.5, 11.0, 15.5, 20.0, 26.0]   # key presses shown as white flashes (take time)
FLASH_LEN = 0.2
TOL_OFFSET = 0.005
SAME_FRAME = 0.5 / 60.0     # two flashes in the same 60 fps output frame
GLITCH = (15.0, 0.008)      # camera G: at take 15 s the Mac's speakers fall 8 ms behind

# How each kind of take file holds a sound against its picture (see the docstring).
PIPE_MS, FIRST_MS = 45.4, 5.4
TAKES = {
    'legacy': dict(file='keylight-take-20261030-120000.mp4', delay=0.0, sync=None),
    'rec': dict(file='keylight-take-20261030-120100.mp4', delay=LAT,
                sync={'applied': True, 'method': 'edit list', 'lateMs': round(PIPE_MS + FIRST_MS - LAT_MS, 1),
                      'firstFrameMs': FIRST_MS, 'pipelineMs': PIPE_MS, 'measuredRate': True,
                      'audioDelayMs': 17.2, 'audioSkipSamples': 2112, 'primingSamples': 2112, 'fragments': 30}),
    'raw': dict(file='keylight-take-20261030-120200.webm', delay=(PIPE_MS + FIRST_MS) / 1000.0,
                sync={'applied': False, 'videoShiftMs': 0, 'audioShiftMs': 0, 'firstFrameMs': FIRST_MS,
                      'pipelineMs': PIPE_MS, 'measuredRate': True}),
}

# name: true picture offset (camera time = take time + offset), camera fps, duration, audio rate, kind
CAMS = {
    'A': dict(offset=2.345, fps=30, dur=2.345 + TAKE_DUR + 6.0, rate=48000, kind='sdr', file='IMG_A.MOV'),
    'B': dict(offset=-1.5, fps=60, dur=TAKE_DUR - 1.5 + 4.0, rate=44100, kind='hlg-rot', file='IMG_B.MOV'),
    'C': dict(offset=11.0, fps=30, dur=11.0 + TAKE_DUR + 10.0, rate=48000, kind='sdr-talk', file='IMG_C.mp4'),
    'D': dict(offset=3.0, fps=30, dur=35.0, rate=48000, kind='unrelated', file='IMG_D.MOV'),
    # The phone kept rolling through an earlier attempt at the same piece (same notes, human
    # timing, different sound) before the real take.
    'E': dict(offset=36.0, fps=30, dur=36.0 + TAKE_DUR + 3.0, rate=48000, kind='two-attempts', file='IMG_E.MOV'),
    # Only that earlier attempt, not the take: the notes match, the recording does not.
    'F': dict(offset=4.0, fps=30, dur=36.0, rate=48000, kind='attempt-only', file='IMG_F.MOV'),
    # The Mac's sound output glitched halfway: from then on the phone hears it 8 ms later.
    'G': dict(offset=1.25, fps=30, dur=1.25 + TAKE_DUR + 3.0, rate=48000, kind='glitch', file='IMG_G.MOV'),
}

results = []


def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f'  [{detail}]' if detail else ''), flush=True)
    return ok


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, **kw)


def ff(args, what):
    p = subprocess.run([FF, '-nostdin', '-hide_banner', '-v', 'error', '-y'] + args, capture_output=True, text=True)
    if p.returncode != 0:
        sys.exit(f'test setup failed ({what}): {p.stderr[-800:]}')


# ---------------------------------------------------------------- synthesis (independent of the tool)

def note_events(rng, t0, t1, forced):
    scale = [0, 2, 4, 5, 7, 9, 11]
    iois = [0.16, 0.22, 0.31, 0.38, 0.47, 0.6, 0.83]
    ev, t, deg = [], t0, 14
    while t < t1:
        deg = int(np.clip(deg + rng.choice([-4, -3, -2, -1, 1, 2, 3, 4]), 0, 30))
        midi = 48 + 12 * (deg // 7) + scale[deg % 7]
        vel = rng.uniform(0.45, 1.0)
        dur = rng.uniform(0.25, 1.1)
        ev.append((t, midi, vel, dur))
        if rng.random() < 0.2:                       # a chord now and then
            ev.append((t, midi + int(rng.choice([3, 4])), vel * 0.8, dur))
            ev.append((t, midi + 7, vel * 0.7, dur))
        t += float(rng.choice(iois)) * rng.uniform(0.85, 1.2)   # uneven timing
    for k, f in enumerate(forced):
        ev.append((f, 72 + [0, 2, 4, 7, 9, 12][k % 6], 0.95, 0.5))
    return sorted(ev)


def piano(events, dur, rng):
    """Decaying, slightly inharmonic harmonic tones with a hammer tick: piano-ish."""
    y = np.zeros(int(dur * SR) + 2 * SR)
    for t, midi, vel, nd in events:
        f0 = 440.0 * 2 ** ((midi - 69) / 12.0)
        n = int((nd + 1.0) * SR)
        tt = np.arange(n) / SR
        tau = 1.4 * (261.6 / f0) ** 0.5
        sig = np.zeros(n)
        for k in range(1, 11):
            fk = k * f0 * np.sqrt(1 + 0.0004 * k * k)
            if fk > 0.45 * SR:
                break
            sig += (1.0 / k ** 1.1) * np.exp(-tt / (tau / (1 + 0.35 * (k - 1)))) * \
                np.sin(2 * np.pi * fk * tt + rng.uniform(0, 2 * np.pi))
        env = np.minimum(1.0, tt / 0.002)
        env *= np.where(tt > nd, np.exp(-(tt - nd) / 0.08), 1.0)
        tick = np.zeros(n)
        m = int(0.006 * SR)
        tick[:m] = rng.standard_normal(m) * np.exp(-np.arange(m) / (0.0015 * SR)) * 0.08
        i0 = int(round(t * SR))
        y[i0:i0 + n] += vel * (sig * env + tick)
    y = y[:int(dur * SR)]
    return y * (0.5 / np.max(np.abs(y)))


def pink(rng, n):
    w = rng.standard_normal(n)
    X = np.fft.rfft(w)
    f = np.fft.rfftfreq(n, 1.0 / SR)
    X[1:] /= np.sqrt(f[1:] / 100.0)
    X[0] = 0
    p = np.fft.irfft(X, n)
    return p / np.sqrt(np.mean(p ** 2))


def speechy(rng, n_seconds):
    """Talking-like noise: voice-band noise in syllable bursts."""
    n = int(n_seconds * SR)
    X = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1.0 / SR)
    X[(f < 250) | (f > 3500)] = 0
    v = np.fft.irfft(X, n)
    t = np.arange(n) / SR
    syl = np.abs(np.sin(2 * np.pi * rng.uniform(3.5, 5.5) * t)) ** 2
    gate = (np.sin(2 * np.pi * 0.7 * t + rng.uniform(0, 6)) > -0.3).astype(float)
    v *= syl * gate
    return v / (np.sqrt(np.mean(v ** 2)) + 1e-12)


def write_wav(path, x, rate=SR):
    i16 = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(i16.tobytes())


def read_wav(path):
    with wave.open(path, 'rb') as w:
        return np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float64) / 32767


def flash_expr(times, eps=0.001):
    return '+'.join(f'gte(t,{t - eps:.4f})*lt(t,{t + FLASH_LEN - eps:.4f})' for t in times)


def take_sound(music, key):
    """The take file's sound track: the app's sound, S after the picture of the same moment."""
    d = int(round(TAKES[key]['delay'] * SR))
    return np.concatenate([np.zeros(d), music])[:len(music)]


def make_take(work, music, key, events, legacy=None):
    tk = TAKES[key]
    wav = os.path.join(work, f'take-{key}.wav')
    write_wav(wav, take_sound(music, key))
    take = os.path.join(work, tk['file'])
    flash = f"drawbox=x=0:y=0:w=iw:h=ih:color=white:t=fill:enable='{flash_expr(FLASHES)}'"
    if take.endswith('.webm'):
        # Like the browser's MediaRecorder: VP9 and Opus written as a stream, so the file says
        # nothing about how long it is (no duration in the header or the streams, no tags, no cues).
        # (No -t: with it ffmpeg writes the duration it was told into the header.)
        cmd = [FF, '-nostdin', '-hide_banner', '-v', 'error', '-f', 'lavfi', '-i',
               f'testsrc2=s=1280x650:r=60:d={TAKE_DUR}', '-i', wav, '-vf', flash,
               '-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', '8', '-b:v', '3M',
               '-c:a', 'libopus', '-b:a', '160k', '-ac', '2', '-f', 'webm', 'pipe:1']
        with open(take, 'wb') as fh:
            p = subprocess.run(cmd, stdout=fh, stderr=subprocess.PIPE, text=True)
        if p.returncode != 0:
            sys.exit(f'test setup failed (webm take): {p.stderr[-800:]}')
    elif legacy:
        # The same picture as the legacy take, with this take's sound track.
        ff(['-i', legacy, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
            '-c:a', 'aac', '-b:a', '192k', '-ac', '2', '-t', str(TAKE_DUR), take], f'take {key}')
    else:
        ff(['-f', 'lavfi', '-i', f'testsrc2=s=2560x1300:r=60:d={TAKE_DUR}', '-i', wav, '-vf', flash,
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-pix_fmt', 'yuv420p',
            '-c:a', 'aac', '-b:a', '192k', '-ac', '2', '-t', str(TAKE_DUR), take], 'take')
    side = {'outputLatencyMs': LAT_MS, 'fps': 60, 'width': 1280 if take.endswith('.webm') else 2560,
            'height': 650 if take.endswith('.webm') else 1300,
            'song': {'title': 'Synthetic Etude'}, 'mode': 'play',
            'midi': [{'t': round(t, 4), 'note': n, 'vel': round(v, 3), 'dur': round(d, 3)}
                     for t, n, v, d in events]}
    if tk['sync'] is not None:
        side['sync'] = tk['sync']
    with open(os.path.splitext(take)[0] + '.json', 'w') as fh:
        json.dump(side, fh)
    return take


def make_camera(work, key, music, rng, unrelated, attempt):
    c = CAMS[key]
    n = int(round(c['dur'] * SR))
    y = np.zeros(n)
    src = {'unrelated': unrelated, 'attempt-only': attempt}.get(c['kind'], music)
    # The phone hears take sample i at camera sample i + d: picture offset plus speaker latency.
    d = int(round((c['offset'] + LAT) * SR))
    lo, dst = max(0, -d), max(0, d)
    m = min(len(src) - lo, n - dst)
    y[dst:dst + m] = src[lo:lo + m]
    if c['kind'] == 'two-attempts':
        y[int(2.0 * SR):int(2.0 * SR) + len(attempt)] += attempt[:n - int(2.0 * SR)]
    if c['kind'] == 'glitch':
        # The speakers fall behind at take time GLITCH[0]: everything after it reaches the phone
        # GLITCH[1] later.  The phone's picture is not affected, so the truth stays `offset`.
        i = int(round((GLITCH[0] + c['offset'] + LAT) * SR))
        y = np.concatenate([y[:i], np.zeros(int(round(GLITCH[1] * SR))), y[i:]])[:n]
    placed = os.path.join(work, f'{key}-placed.wav')
    roomed = os.path.join(work, f'{key}-room.wav')
    write_wav(placed, y)
    # Speaker band limits and room echoes, through ffmpeg filters.
    ff(['-i', placed, '-af', 'highpass=f=180,highpass=f=180,lowpass=f=8000,lowpass=f=8000,'
        'aecho=0.85:0.8:23|47|89|140:0.35|0.25|0.18|0.1,volume=0.8', '-c:a', 'pcm_s16le', roomed], 'room')
    z = read_wav(roomed)[:n]
    z = np.pad(z, (0, n - len(z)))
    active = np.abs(z) > 1e-4
    music_rms = np.sqrt(np.mean(z[active] ** 2)) if active.any() else 0.05
    z += pink(rng, n) * music_rms * 10 ** (-20 / 20)                    # noise 20 dB down
    for t in rng.uniform(1.0, c['dur'] - 1.0, 5):                        # clicks only the phone heard
        i = int(t * SR)
        k = int(0.004 * SR)
        z[i:i + k] += rng.standard_normal(k) * np.exp(-np.arange(k) / (0.001 * SR)) * 0.9
    if c['kind'] == 'sdr-talk':                                          # talking in the lead-in and once later
        for t0, ln in ((1.0, 4.0), (6.0, 3.5), (20.0, 2.5)):
            i = int(t0 * SR)
            s = speechy(rng, ln) * music_rms * 1.2
            z[i:i + len(s)] += s[:max(0, n - i)]
    final = os.path.join(work, f'{key}-mic.wav')
    write_wav(final, z * 0.9)
    flashes = [f + c['offset'] for f in FLASHES if 0 < f + c['offset'] < c['dur'] - FLASH_LEN]
    vf = (f"drawbox=x=(iw-120)/2:y=ih*0.55-60:w=120:h=120:color=white:t=fill,"
          f"drawbox=x=0:y=0:w=iw:h=ih:color=white:t=fill:enable='{flash_expr(flashes)}'")
    # The HDR clip gets a light grey background, so its tone mapping shows (mid-tones get darker).
    grey = '0xA0A0A0' if c['kind'] == 'hlg-rot' else '0x303030'
    src_v = ['-f', 'lavfi', '-i', f"color=c={grey}:s=1280x720:r={c['fps']}:d={c['dur']}"]
    aenc = ['-c:a', 'aac', '-b:a', '160k', '-ar', str(c['rate'])]
    out = os.path.join(work, c['file'])
    if c['kind'] == 'hlg-rot':
        other = os.path.join(work, 'B-second-stream.wav')
        write_wav(other, np.pad(unrelated, (0, max(0, n - len(unrelated))))[:n] * 0.8)
        raw = os.path.join(work, 'B-unrotated.mov')
        ff(src_v + ['-i', final, '-i', other, '-map', '0:v', '-map', '1:a', '-map', '2:a',
                    '-vf', vf + ',format=yuv420p10le', '-c:v', 'libx265', '-preset', 'ultrafast',
                    '-x265-params', 'log-level=error:colorprim=bt2020:transfer=arib-std-b67:colormatrix=bt2020nc',
                    '-color_primaries', 'bt2020', '-color_trc', 'arib-std-b67', '-colorspace', 'bt2020nc',
                    '-tag:v', 'hvc1'] + aenc + ['-t', str(c['dur']), raw], 'camera B')
        ff(['-display_rotation:v:0', '90', '-i', raw, '-map', '0', '-c', 'copy', out], 'rotate B')
    else:
        vfr = []
        if c['kind'] == 'sdr-talk':
            # Variable frame rate, as iPhones write: frame times wobble by up to +/-6 ms.
            vf += ",settb=1/90000,setpts='(N/30+0.006*sin(N*1.7))/TB'"
            vfr = ['-fps_mode', 'passthrough', '-enc_time_base:v', '1:90000']
        ff(src_v + ['-i', final, '-vf', vf, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
                    '-pix_fmt', 'yuv420p'] + vfr + aenc + ['-t', str(c['dur']), out], f'camera {key}')
    return out


def frame_intervals(path):
    p = run([FP, '-v', 'error', '-select_streams', 'v', '-show_entries', 'packet=pts_time', '-of', 'csv=p=0', path],
            text=True)
    ts = sorted(float(x) for x in p.stdout.split() if x.strip() not in ('', 'N/A'))
    return np.diff(ts)


# ---------------------------------------------------------------- measuring outputs

def probe(path):
    p = run([FP, '-v', 'error', '-show_format', '-show_streams', '-of', 'json', path], text=True)
    return json.loads(p.stdout or '{}')


def rate(s):
    n, d = s.split('/')
    return float(n) / float(d)


def check_streams(tag, path, W, H, dur, fps=60.0):
    j = probe(path)
    st = j.get('streams', [])
    v = [s for s in st if s['codec_type'] == 'video']
    a = [s for s in st if s['codec_type'] == 'audio']
    d = float(j.get('format', {}).get('duration', 0))
    ok = (len(v) == 1 and len(a) == 1 and len(st) == 2 and v[0]['codec_name'] == 'h264'
          and v[0].get('profile') == 'High' and v[0]['pix_fmt'] == 'yuv420p'
          and (v[0]['width'], v[0]['height']) == (W, H) and abs(rate(v[0]['avg_frame_rate']) - fps) < 0.01
          and a[0]['codec_name'] == 'aac' and int(a[0]['sample_rate']) == 48000 and abs(d - dur) <= 0.05)
    det = (f"{v[0]['width']}x{v[0]['height']} {v[0]['avg_frame_rate']} {v[0].get('profile')} {v[0]['pix_fmt']}, "
           f"audio {a[0]['codec_name']} {a[0]['sample_rate']}, {len(st)} streams, {d:.3f} s (want {dur:.3f})"
           if v and a else f'streams: {[s["codec_type"] for s in st]}')
    return check(f'{tag}: size/fps/duration/streams', ok, det)


def gray_frames(path, w, h):
    p = run([FF, '-v', 'error', '-i', path, '-vf', f'scale={w}:{h}:flags=area,format=gray',
             '-f', 'rawvideo', '-'])
    return np.frombuffer(p.stdout, np.uint8).reshape(-1, h, w).astype(np.float64) / 255.0


def onsets(series, fps):
    base, peak = np.median(series), series.max()
    if peak - base < 0.2:
        return np.array([])
    on = series >= base + 0.5 * (peak - base)
    idx = list(np.nonzero(on[1:] & ~on[:-1])[0] + 1)
    if on[0]:
        idx = [0] + idx
    return np.array(idx) / fps


def check_flashes(tag, path, regions, start, end, cam_fps, small, pair_tol=None):
    """White flashes mark key presses: the take panel must flash at take time F, and the camera
    panel (its picture of the same press) at the same output time, within one frame of each.
    pair_tol=SAME_FRAME for a 60 fps camera whose offset is a whole number of frames: then the
    two panels must flash in the very same output frame (a 24 ms error moves it by one or two)."""
    fr = gray_frames(path, *small)
    top = fr[:, regions['app'][0]:regions['app'][1], regions['app'][2]:regions['app'][3]].mean(axis=(1, 2))
    bot = fr[:, regions['cam'][0]:regions['cam'][1], regions['cam'][2]:regions['cam'][3]].mean(axis=(1, 2))
    t_app, t_cam = onsets(top, 60.0), onsets(bot, 60.0)
    want = [f - start for f in FLASHES if start + 0.05 < f < end - FLASH_LEN - 0.05]
    worst_app, worst_pair, ok = 0.0, 0.0, len(t_app) == len(want) and len(t_cam) == len(want)
    for w in want:
        if not len(t_app) or not len(t_cam):
            ok = False
            break
        a = t_app[np.argmin(np.abs(t_app - w))]
        c = t_cam[np.argmin(np.abs(t_cam - a))]
        worst_app = max(worst_app, abs(a - w))
        worst_pair = max(worst_pair, abs(c - a))
    tol_app = 1 / 60.0 + 0.002
    tol_pair = pair_tol if pair_tol is not None else 1 / cam_fps + 1 / 60.0 + 0.002
    ok = ok and worst_app <= tol_app and worst_pair <= tol_pair
    return check(f'{tag}: key-press flashes line up', ok,
                 f'{len(want)} flashes; take panel within {worst_app * 1000:.1f} ms of truth (tol {tol_app * 1000:.0f}), '
                 f'camera panel within {worst_pair * 1000:.1f} ms of it (tol {tol_pair * 1000:.0f}); '
                 f'seen {len(t_app)}/{len(t_cam)}')


def luma_plane(path, t, ten_bit=False):
    """Y plane of one decoded frame, normalised from limited range to 0..1 (no conversions)."""
    v = [s for s in probe(path)['streams'] if s['codec_type'] == 'video'][0]
    W, H = v['width'], v['height']
    rot = 0
    for sd in v.get('side_data_list') or []:
        rot = int(sd.get('rotation', rot))
    if abs(rot) % 180 == 90:
        W, H = H, W
    fmt = 'yuv420p10le' if ten_bit else 'yuv420p'
    p = run([FF, '-v', 'error', '-ss', str(t), '-i', path, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', fmt, '-'])
    if ten_bit:
        y = np.frombuffer(p.stdout, '<u2')[:W * H].astype(np.float64)
        return ((y - 64) / 876).reshape(H, W)
    y = np.frombuffer(p.stdout, np.uint8)[:W * H].astype(np.float64)
    return ((y - 16) / 219).reshape(H, W)


def check_tonemap(tag, out, src, region, t, path):
    """The HDR clip's light-grey background must come out darker than a plain, un-tone-mapped
    conversion would show it (what HLG -> SDR tone mapping does to mid-tones), but not crushed."""
    src_level = float(np.median(luma_plane(src, 0.5, ten_bit=True)))
    y0, y1, x0, x1 = region
    out_level = float(np.median(luma_plane(out, t)[y0:y1, x0:x1]))
    if path in (None, 'none'):
        ok = abs(out_level - src_level) < 0.03
    else:
        ok = 0.25 <= out_level <= src_level - 0.03
    return check(f'{tag}: HDR camera tone-mapped ({path})', ok,
                 f'grey: source HLG signal {src_level:.3f}, output SDR {out_level:.3f}')


def check_square(tag, path, region, t, side):
    """The phone's white square must stay square (rotation and scaling use the turned size)."""
    img = luma_plane(path, t)
    y0, y1, x0, x1 = region
    sub = img[y0:y1, x0:x1] > 0.85
    if not sub.any():
        return check(f'{tag}: camera square keeps its shape', False, 'square not found')
    ys, xs = np.nonzero(sub)
    w, h = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
    ok = 0.92 <= w / h <= 1.08 and abs(w - side) <= 0.08 * side
    return check(f'{tag}: camera square keeps its shape', ok, f'{w}x{h} px, want {side}x{side}')


def decode16(path):
    p = run([FF, '-v', 'error', '-i', path, '-map', '0:a:0', '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'])
    return np.frombuffer(p.stdout, '<f4').astype(np.float64)


def to16k(x48):
    n = len(x48)
    X = np.fft.rfft(x48)
    X[np.fft.rfftfreq(n, 1.0 / SR) > 7500] = 0
    return np.fft.irfft(X, n)[::3]


def check_sound(tag, path, ref16, start, search=0.25):
    """The output's sound must be the take's music from take time `start` on (+/-5 ms)."""
    out = decode16(path)[:16000 * 12]
    lo = int(round((start - search) * 16000))
    pad = max(0, -lo)
    ref = np.concatenate([np.zeros(pad), ref16[max(0, lo):max(0, lo) + len(out) + int(2 * search * 16000)]])
    n = 1 << int(np.ceil(np.log2(len(ref) + len(out))))
    f = np.fft.rfftfreq(n, 1 / 16000.0)
    G = np.conj(np.fft.rfft(out, n)) * np.fft.rfft(ref, n)
    G = np.where((f > 200) & (f < 4000), G / (np.abs(G) + 1e-12), 0)
    c = np.fft.irfft(G, n)[:int(2 * search * 16000) + 1]
    k = int(np.argmax(np.abs(c)))
    lag = (lo + k) / 16000.0          # out[i] matches ref16[i + lag*16000]
    err = lag - start
    return check(f'{tag}: sound placed at take {start:.3f} s', abs(err) <= TOL_OFFSET, f'error {err * 1000:+.2f} ms')


def tool(args, timeout=900):
    t = time.time()
    p = subprocess.run([sys.executable, TOOL] + args, capture_output=True, text=True, timeout=timeout)
    return p, time.time() - t


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description='End-to-end test of sync-take.py on synthetic clips.')
    ap.add_argument('--work', help='work folder (default: a new temporary folder)')
    ap.add_argument('--keep', action='store_true', help='keep the work folder')
    a = ap.parse_args()
    work = a.work or tempfile.mkdtemp(prefix='sync-take-test-')
    os.makedirs(work, exist_ok=True)
    print(f'work folder: {work}')
    t_start = time.time()

    rng = np.random.default_rng(20261030)
    events = note_events(rng, 3.0, TAKE_DUR - 2.5, FLASHES)
    music = piano(events, TAKE_DUR, rng)
    unrelated = piano(note_events(np.random.default_rng(777), 4.0, TAKE_DUR - 2.0, []), TAKE_DUR, rng)
    take = make_take(work, music, 'legacy', events)
    takes = {'legacy': take, 'rec': make_take(work, music, 'rec', events, legacy=take),
             'raw': make_take(work, music, 'raw', events)}
    # An earlier attempt: the same notes with +/-25 ms human timing and new levels and phases.
    jrng = np.random.default_rng(4242)
    attempt = piano([(t + jrng.normal(0, 0.025), n, v * jrng.uniform(0.8, 1.15), d) for t, n, v, d in events],
                    TAKE_DUR, jrng)
    clips = {k: make_camera(work, k, music, rng, unrelated, attempt) for k in CAMS}
    nosidecar = os.path.join(work, 'screen-recording.mp4')
    try:
        os.link(take, nosidecar)          # same file, no sidecar next to it
    except OSError:
        shutil.copyfile(take, nosidecar)
    ref16 = to16k(music)
    refs = {k: to16k(take_sound(music, k)) for k in TAKES}
    print(f'synthetic inputs ready in {time.time() - t_start:.0f} s', flush=True)
    iv = frame_intervals(clips['C']) * 1000
    check('camera C really has a variable frame rate', len(iv) > 100 and iv.max() - iv.min() > 10,
          f'frame intervals {iv.min():.1f}-{iv.max():.1f} ms')

    # ---- help
    p, _ = tool(['--help'])
    check('--help explains the options and the offset sign', p.returncode == 0 and all(
        s in p.stdout for s in ('--offset', '--max-mb', '--trim', '--split', '--app-focus', '--camera-focus',
                                '--preview', '--analyze-only', 'camera time - take time', 'started recording before')))

    # ---- analysis: four cameras in one run
    p, dt = tool(['--app', take, '--camera', clips['A'], '--camera', clips['B'], '--camera', clips['C'],
                  '--camera', clips['E'], '--analyze-only'])
    try:
        doc = json.loads(p.stdout)
    except ValueError:
        doc = {'cameras': []}
        print(p.stdout, p.stderr)
    check('analysis of 4 cameras exits 0', p.returncode == 0 and len(doc.get('cameras', [])) == 4,
          f'rc {p.returncode}, {dt:.1f} s')
    for key, r in zip('ABCE', doc.get('cameras', [])):
        truth = CAMS[key]['offset']
        err = r.get('offset', 1e9) - truth
        check(f'camera {key} ({CAMS[key]["kind"]}, truth {truth:+.3f} s): offset within 5 ms', abs(err) <= TOL_OFFSET,
              f"found {r.get('offset', float('nan')):+.5f} s, error {err * 1000:+.2f} ms, confidence "
              f"{r.get('confidence')}, z {r.get('zscore')}, lock {r.get('lock')} ({r.get('lock_ratio')}x), "
              f"accepted on {r.get('decided_by')}; candidates (offset/confidence/lock): "
              + ' '.join(f"{c['offset']:+.3f}/{c['confidence']}/{c['lock']}" for c in r.get('candidates', [])))
        ov = r.get('overlap', {})
        t0, t1 = max(0.0, -truth), min(TAKE_DUR, CAMS[key]['dur'] - truth)
        check(f'camera {key}: overlap', abs(ov.get('take_start', -9) - t0) < 0.01 and abs(ov.get('take_end', -9) - t1) < 0.01,
              f"{ov.get('take_start')}-{ov.get('take_end')} s, want {t0:.3f}-{t1:.3f}")
    hdr = (doc.get('cameras') or [{}, {}])[1].get('video', {})
    check('camera B seen as HDR HLG, turned 90 deg, 720x1280', hdr.get('hdr') == 'hlg' and abs(hdr.get('rotation', 0)) == 90
          and (hdr.get('width'), hdr.get('height')) == (720, 1280), f"{hdr}")
    tonemap = hdr.get('tonemap')

    # ---- the latency correction's sign: without the sidecar the answer is the raw sound match
    p, _ = tool(['--app', nosidecar, '--camera', clips['A'], '--analyze-only'])
    try:
        r_ns = json.loads(p.stdout)['cameras'][0]
        r_sc = doc['cameras'][0]
        raw_truth = CAMS['A']['offset'] + LAT
        err = r_ns['offset'] - raw_truth
        diff = r_ns['offset'] - r_sc['offset']
        check('no sidecar: offset = sound match (truth + 24 ms) within 5 ms', abs(err) <= TOL_OFFSET,
              f"found {r_ns['offset']:+.5f} s, error {err * 1000:+.2f} ms")
        check('sidecar latency moves the answer 24 ms earlier (sign)', abs(diff - LAT) <= 0.001,
              f'no-sidecar minus sidecar = {diff * 1000:+.2f} ms')
    except (ValueError, KeyError, IndexError):
        check('no sidecar analysis', False, p.stderr[-300:])

    # ---- the take's own layout of sound against picture (its sidecar's sync block)
    p, _ = tool(['--app', takes['rec'], '--camera', clips['A'], '--camera', clips['B'], '--analyze-only'])
    try:
        doc_rec = json.loads(p.stdout)
    except ValueError:
        doc_rec = {'cameras': []}
    for key, r in zip('AB', doc_rec.get('cameras', [])):
        truth = CAMS[key]['offset']
        err = r.get('offset', 1e9) - truth
        check(f'recorder take (sound where the speakers played it), camera {key}: offset within 5 ms',
              p.returncode == 0 and abs(err) <= TOL_OFFSET,
              f"found {r.get('offset', float('nan')):+.5f} s, error {err * 1000:+.2f} ms; sound matched at "
              f"{r.get('audio_offset', float('nan')):+.5f}, take sound {r.get('take_sound_delay_ms')} ms after its "
              f"picture, correction {r.get('correction_ms')} ms, confidence {r.get('confidence')}")
    if len(doc_rec.get('cameras', [])) != 2:
        check('recorder take analysis', False, f'rc {p.returncode} ' + p.stderr[-300:])

    j = probe(takes['raw'])
    nodur = ('duration' not in j.get('format', {}) and all('duration' not in s and 'DURATION' not in (s.get('tags') or {})
                                                            for s in j.get('streams', [])))
    check('raw .webm take says nothing about its duration (like MediaRecorder)', nodur,
          f"format duration {j.get('format', {}).get('duration')}, streams "
          f"{[(s.get('codec_name'), s.get('duration')) for s in j.get('streams', [])]}")
    p, _ = tool(['--app', takes['raw'], '--camera', clips['A'], '--analyze-only'])
    try:
        doc_raw = json.loads(p.stdout)
        r = doc_raw['cameras'][0]
        dur = doc_raw['app']['duration']
        check('raw .webm take: its length found from its packets', abs(dur - TAKE_DUR) <= 0.05,
              f'{dur:.3f} s, want {TAKE_DUR:.3f}')
        err = r.get('offset', 1e9) - CAMS['A']['offset']
        check('raw .webm take (sound pipeline + first frame late), camera A: offset within 5 ms',
              p.returncode == 0 and abs(err) <= TOL_OFFSET,
              f"found {r.get('offset', float('nan')):+.5f} s, error {err * 1000:+.2f} ms; sound matched at "
              f"{r.get('audio_offset', float('nan')):+.5f}, take sound {r.get('take_sound_delay_ms')} ms after its "
              f"picture, correction {r.get('correction_ms')} ms, overlap {r.get('overlap')}")
    except (ValueError, KeyError, IndexError):
        check('raw .webm take analysis', False, f'rc {p.returncode} ' + p.stderr[-300:])

    # ---- the Mac's sound output glitched: the phone's sound jumps 8 ms, its picture does not
    p, _ = tool(['--app', take, '--camera', clips['G'], '--analyze-only'])
    try:
        rg = json.loads(p.stdout)['cameras'][0]
    except (ValueError, KeyError, IndexError):
        rg = {}
    err = rg.get('offset', 1e9) - CAMS['G']['offset']
    check('speaker glitch (+8 ms at take 15 s): accepted, offset within 5 ms', p.returncode == 0 and rg.get('ok')
          and abs(err) <= TOL_OFFSET,
          f"rc {p.returncode}, found {rg.get('offset', float('nan')):+.5f} s, error {err * 1000:+.2f} ms, "
          f"agree {rg.get('agree')}, windows {rg.get('windows')}/{rg.get('windows_with_sound')}; {rg.get('why')}")
    steps = rg.get('steps') or []
    check('speaker glitch: the 8 ms jump is reported near take 15 s',
          any(abs(s['ms'] - GLITCH[1] * 1000) <= 1.0 and abs(s['take_time'] - GLITCH[0]) <= 3.5 for s in steps),
          f'steps {steps}')

    # ---- unrelated audio must be refused
    p, _ = tool(['--app', take, '--camera', clips['D'], '--analyze-only'])
    try:
        rd = json.loads(p.stdout)['cameras'][0]
    except (ValueError, KeyError, IndexError):
        rd = {}
    check('unrelated audio: refused with exit 3 and a hint to use --offset',
          p.returncode == 3 and rd.get('ok') is False and '--offset' in p.stderr,
          f"rc {p.returncode}, confidence {rd.get('confidence')}, z {rd.get('zscore')}, lock {rd.get('lock')}")
    bad_out = os.path.join(work, 'refused.mp4')
    p, _ = tool(['--app', take, '--camera', clips['D'], '--out', bad_out])
    check('unrelated audio: render refused, nothing written', p.returncode == 3 and not os.path.exists(bad_out),
          f'rc {p.returncode}')

    # ---- a clip of a different attempt at the same notes (not the take) must be refused too
    p, _ = tool(['--app', take, '--camera', clips['F'], '--analyze-only'])
    try:
        rf = json.loads(p.stdout)['cameras'][0]
    except (ValueError, KeyError, IndexError):
        rf = {}
    check('different attempt at the same notes: refused with exit 3', p.returncode == 3 and rf.get('ok') is False,
          f"rc {p.returncode}, confidence {rf.get('confidence')}, lock {rf.get('lock')}, "
          f"agree {rf.get('agree')}; {rf.get('why')}")

    # ---- manual offset skips the analysis
    p, dt = tool(['--app', take, '--camera', clips['A'], '--offset', '2.5', '--analyze-only'])
    try:
        rm = json.loads(p.stdout)['cameras'][0]
    except (ValueError, KeyError, IndexError):
        rm = {}
    check('--offset is used as given', p.returncode == 0 and rm.get('method') == 'manual' and rm.get('offset') == 2.5,
          f'{rm.get("method")} {rm.get("offset")}, {dt:.1f} s')

    # ---- renders
    # stack, camera A, app sound: Keylight 1920x594 on top, camera 1920x486 below
    out = os.path.join(work, 'out-stack.mp4')
    p, dt = tool(['--app', take, '--camera', clips['A'], '--out', out])
    if check('render stack (camera A)', p.returncode == 0 and os.path.exists(out), f'{dt:.0f} s ' + p.stderr[-300:]):
        check_streams('stack', out, 1920, 1080, 30.0)
        check_flashes('stack', out, {'app': (5, 55, 0, 192), 'cam': (64, 104, 0, 192)}, 0.0, 30.0, 30, (192, 108))
        check_square('stack', out, (594, 1080, 0, 1920), 1.0, 180)
        check_sound('stack, app sound', out, ref16, 0.0)

    # vertical, recorder take, camera B (HDR, turned, 60 fps), mix sound: Keylight 1080x548 on top,
    # camera fills 1080x1372.  Camera B's offset is a whole number of 60 fps frames, so each flash
    # must show in both panels in the same output frame.
    out = os.path.join(work, 'out-vertical.mp4')
    p, dt = tool(['--app', takes['rec'], '--camera', clips['B'], '--out', out, '--layout', 'vertical',
                  '--audio', 'mix'])
    if check('render vertical (recorder take, camera B, HDR + rotation)', p.returncode == 0 and os.path.exists(out),
             f'{dt:.0f} s ' + p.stderr[-300:]):
        check_streams('vertical', out, 1080, 1920, 28.5)
        check_flashes('vertical', out, {'app': (4, 50, 0, 108), 'cam': (60, 188, 0, 108)}, 1.5, 30.0, 60, (108, 192),
                      pair_tol=SAME_FRAME)
        check_square('vertical', out, (548, 1920, 0, 1080), 1.0, 180)
        check_tonemap('vertical', out, clips['B'], (548, 1920, 0, 1080), 1.0, tonemap)
        check_sound('vertical, mixed sound', out, refs['rec'], 1.5)

    # the raw .webm take, camera B, phone sound, preview: the phone's sound goes where it matched
    # the take's (26.8 ms before the take's picture offset here, so it is delayed at the start)
    out = os.path.join(work, 'out-webm.mp4')
    p, dt = tool(['--app', takes['raw'], '--camera', clips['B'], '--out', out, '--preview', '--audio', 'camera'])
    f = os.path.join(work, 'out-webm-preview.mp4')
    if check('render --preview from the raw .webm take (camera B, phone sound)', p.returncode == 0 and os.path.exists(f),
             f'{dt:.0f} s ' + p.stderr[-300:]):
        check_streams('webm preview', f, 960, 540, 10.0)
        check_flashes('webm preview', f, {'app': (5, 55, 0, 192), 'cam': (64, 104, 0, 192)}, 1.5, 11.5, 60, (192, 108),
                      pair_tol=SAME_FRAME)
        check_sound('webm preview, phone sound', f, refs['raw'], 1.5)

    # pip, camera C, trimmed, camera sound: camera full frame, Keylight 806x410 inset at the top
    out = os.path.join(work, 'out-pip.mp4')
    p, dt = tool(['--app', take, '--camera', clips['C'], '--out', out, '--layout', 'pip', '--trim', '5:20',
                  '--audio', 'camera'])
    if check('render pip (camera C, --trim 5:20)', p.returncode == 0 and os.path.exists(out),
             f'{dt:.0f} s ' + p.stderr[-300:]):
        check_streams('pip', out, 1920, 1080, 15.0)
        check_flashes('pip', out, {'app': (8, 40, 60, 131), 'cam': (60, 106, 0, 192)}, 5.0, 20.0, 30, (192, 108))
        check_square('pip', out, (460, 1080, 0, 1920), 1.0, 180)
        check_sound('pip, phone sound', out, ref16, 5.0)

    # --max-mb 10 (Discord)
    out = os.path.join(work, 'out-discord.mp4')
    p, dt = tool(['--app', take, '--camera', clips['A'], '--out', out, '--max-mb', '10'])
    if check('render --max-mb 10', p.returncode == 0 and os.path.exists(out), f'{dt:.0f} s ' + p.stderr[-300:]):
        size = os.path.getsize(out)
        check('--max-mb 10: file under 10 MB', size < 10_000_000, f'{size / 1e6:.2f} MB')
        v = [s for s in probe(out)['streams'] if s['codec_type'] == 'video'][0]
        check_streams('--max-mb 10', out, v['width'], v['height'], 30.0)
        check('--max-mb 10: 1920x1080 or 1280x720', (v['width'], v['height']) in ((1920, 1080), (1280, 720)),
              f"{v['width']}x{v['height']}")

    # --preview with two cameras: OUT-1-preview.mp4, OUT-2-preview.mp4, 10 s each
    out = os.path.join(work, 'out-two.mp4')
    p, dt = tool(['--app', take, '--camera', clips['A'], '--camera', clips['B'], '--out', out, '--preview'])
    ok = p.returncode == 0
    for i in (1, 2):
        f = os.path.join(work, f'out-two-{i}-preview.mp4')
        if check(f'--preview, two cameras: out-two-{i}-preview.mp4 written', ok and os.path.exists(f), f'{dt:.0f} s'):
            check_streams(f'preview {i}', f, 960, 540, 10.0)

    print()
    failed = [r for r in results if not r[1]]
    print(f'HDR tone mapping path used by this ffmpeg: {tonemap}')
    print(f"{'PASS' if not failed else 'FAIL'}: {len(results) - len(failed)}/{len(results)} checks passed "
          f'in {time.time() - t_start:.0f} s')
    for name, _, det in failed:
        print(f'  failed: {name}  [{det}]')
    if not a.keep and not a.work and not failed:
        shutil.rmtree(work, ignore_errors=True)
    return 0 if not failed else 1


if __name__ == '__main__':
    sys.exit(main())
