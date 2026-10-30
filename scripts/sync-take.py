#!/usr/bin/env python3
"""
sync-take.py: put the phone video of your hands next to a Keylight take, in sync.

  scripts/sync-take.py --app keylight-take-20261030-201500.mp4 --camera IMG_4521.MOV --out duet.mp4

It listens to both recordings, finds the take's piano sound inside the phone's
audio, and renders one video: Keylight's note view on top, your hands below,
with the take's clean piano sound.

Common uses
  --max-mb 10           fit under Discord's free 10 MB upload limit
  --layout vertical     1080x1920 for phones (Keylight on top, hands below)
  --layout pip          hands full screen, Keylight as an inset at the top
  --preview             quick, low-quality look at the first 10 seconds
  --analyze-only        only print the offsets (JSON), render nothing
  --offset 2.35         skip the listening: camera time = take time + 2.35 s
  --trim 12:75          keep only take seconds 12 to 75
  several --camera      one output per clip: duet-1.mp4, duet-2.mp4, ...

Sign of the offset
  offset = camera time - take time for the same moment, in seconds.
  +2.35 means the phone started recording 2.35 s BEFORE the take (the take's
  first frame is 2.35 s into the phone clip); -1.5 means the phone started
  1.5 s AFTER the take.

What to record on the phone
  Start the phone first and stop it after the take. Keep the Mac's speakers on
  and loud enough for the phone to hear the piano (no headphones). Landscape,
  keyboard filling the frame, 30 or 60 fps; HDR is fine (it is tone-mapped).

Needs python3 with numpy, and ffmpeg/ffprobe (on PATH or in /opt/homebrew/bin).
Tested end to end by scripts/test-sync-take.py (synthetic clips, a few minutes).
"""

import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
from fractions import Fraction


def _load_numpy():
    try:
        import numpy
        return numpy
    except ImportError:
        # The macOS system python ships numpy; a Homebrew python3 first on PATH may not.
        alt = '/usr/bin/python3'
        if (os.environ.get('SYNC_TAKE_REEXEC') != '1' and os.path.exists(alt)
                and os.path.realpath(sys.executable) != os.path.realpath(alt)):
            os.environ['SYNC_TAKE_REEXEC'] = '1'
            try:
                os.execv(alt, [alt] + sys.argv)
            except OSError:
                pass
        sys.stderr.write('sync-take: this tool needs numpy, and this python3 does not have it.\n'
                         '  Install it with:  python3 -m pip install --user numpy\n')
        sys.exit(1)


np = _load_numpy()

# ---------------------------------------------------------------- constants

SR = 16000             # analysis sample rate (Hz)
NFFT = 1024            # STFT size for the onset envelope (64 ms)
HOP = 80               # 5 ms hop: the envelope runs at 200 frames per second
ENV_RATE = SR / HOP
BAND_LO, BAND_HI, N_BANDS = 150.0, 7000.0, 40
GUARD_S = 0.150        # "elsewhere" for the confidence ratio: further than this from the best match
FINE_SEARCH_S = 0.030  # sample-accurate refinement searches +/- this around the coarse match
FINE_WIN_S = 15.0      # longest refinement window (one offset estimate per window)
FINE_MIN_WIN_S = 3.0   # shortest refinement window
FINE_TARGET_WINDOWS = 10  # aim for this many windows: enough to tell a true match from a look-alike
AGREE_MS = 1.0         # windows agree when within this of each other (after any clock drift)
AGREE_SHARE = 0.6      # ...and that much of the lock strength must agree
MAX_DRIFT_PPM = 100.0  # real clocks drift less than this (typically 10-50 ppm)
MAX_STEP_SPAN_MS = 25.0  # the sound may jump between stretches (a glitch in the Mac's output) this much in all
FINE_MAX_WINDOWS = 40
FINE_BAND = (150.0, 6000.0)
PHAT_BETA = 0.85       # partial phase transform: whiten the spectrum, but keep a little level weighting
FINE_MIN_Q = 8.0       # a refinement window counts when its peak is this many times the background
MIN_CONFIDENCE = 1.5   # default refusal threshold for the confidence ratio
MIN_Z = 6.0            # ...and the best match must stand this far out of the whole correlation
LOCK_RATIO = 3.0       # ...or the waveform must lock this much better than at any other candidate
N_CANDIDATES = 5       # envelope matches whose waveform lock is checked

BG = '0x151245'        # Keylight's background colour, for any padding
AUDIO_RATE = 48000
AUDIO_KBPS = 192
EXIT_REFUSED = 3

FFMPEG = None
FFPROBE = None
QUIET_JSON = False     # with --analyze-only, human-readable lines go to stderr
VERBOSE = False        # --verbose: print each ffmpeg command


def say(msg=''):
    print(msg, file=sys.stderr if QUIET_JSON else sys.stdout, flush=True)


def warn(msg):
    print('warning: ' + msg, file=sys.stderr, flush=True)


class Fatal(Exception):
    pass


def die(msg):
    raise Fatal(msg)


def find_tool(name):
    p = shutil.which(name)
    if p:
        return p
    for d in ('/opt/homebrew/bin', '/usr/local/bin'):
        c = os.path.join(d, name)
        if os.access(c, os.X_OK):
            return c
    return None


def _f(v, default=None):
    try:
        x = float(v)
        return x if math.isfinite(x) else default
    except (TypeError, ValueError):
        return default


def _rate(s):
    try:
        n, d = str(s).split('/')
        n, d = float(n), float(d)
        return n / d if d else None
    except (ValueError, AttributeError):
        return _f(s)


def _tag_duration(s):
    # Matroska/WebM keeps per-stream durations in a tag like "00:00:30.033000000".
    t = (s.get('tags') or {}).get('DURATION')
    if not t:
        return None
    try:
        h, m, sec = t.split(':')
        return int(h) * 3600 + int(m) * 60 + float(sec)
    except ValueError:
        return None


# ---------------------------------------------------------------- probing

class Media:
    """What ffprobe says about one input, on ffmpeg's timeline (0 = the file's start)."""

    def __init__(self, path):
        self.path = path
        self.name = os.path.basename(path)
        if not os.path.isfile(path):
            die(f'{path}: no such file')
        p = subprocess.run([FFPROBE, '-v', 'error', '-show_format', '-show_streams', '-of', 'json', path],
                           capture_output=True, text=True)
        try:
            j = json.loads(p.stdout or '{}')
        except ValueError:
            j = {}
        if p.returncode != 0 or not j.get('streams'):
            last = (p.stderr or '').strip().splitlines()[-1:] or ['no streams']
            die(f'{path}: ffprobe could not read it ({last[0]})')
        fmt = j.get('format') or {}
        self.fstart = _f(fmt.get('start_time'), 0.0)
        self.fdur = _f(fmt.get('duration'))
        self.video = None
        self.audio = None
        self.n_audio = 0
        for s in j['streams']:
            kind = s.get('codec_type')
            if kind == 'video' and self.video is None and not (s.get('disposition') or {}).get('attached_pic'):
                self.video = s
            elif kind == 'audio':
                self.n_audio += 1
                # The first audio stream, skipping any ffmpeg cannot decode (an iPhone's spatial
                # audio track, say); further streams are ignored.
                if self.audio is None and s.get('codec_name') not in (None, '', 'none', 'unknown'):
                    self.audio = s
        self.v_end = self.a_end = None
        if self.video is not None:
            v = self.video
            self.w, self.h = int(v.get('width') or 0), int(v.get('height') or 0)
            if not self.w or not self.h:
                die(f'{path}: the video stream has no size')
            sar = _rate(str(v.get('sample_aspect_ratio', '1:1')).replace(':', '/')) or 1.0
            self.rotation = 0
            for sd in v.get('side_data_list') or []:
                if 'rotation' in sd:
                    self.rotation = int(round(_f(sd['rotation'], 0)))
            if not self.rotation and (v.get('tags') or {}).get('rotate'):
                self.rotation = int(round(_f(v['tags']['rotate'], 0)))
            dw, dh = self.w * (sar if sar > 0 else 1.0), float(self.h)
            if abs(self.rotation) % 180 == 90:      # ffmpeg autorotates: scale with the turned size
                dw, dh = dh, dw
            self.dw, self.dh = dw, dh
            self.fps = _rate(v.get('avg_frame_rate')) or _rate(v.get('r_frame_rate')) or 30.0
            self.transfer = v.get('color_transfer') or ''
            self.primaries = v.get('color_primaries') or ''
            self.matrix = v.get('color_space') or ''
            self.range = v.get('color_range') or ''
            self.pix_fmt = v.get('pix_fmt') or ''
            self.hdr = {'arib-std-b67': 'hlg', 'smpte2084': 'pq'}.get(self.transfer)
            self.dovi = None
            for sd in v.get('side_data_list') or []:
                if 'DOVI' in str(sd.get('side_data_type', '')).upper() or 'dv_profile' in sd:
                    self.dovi = sd
            self.v_end = self._end(v)
        if self.audio is not None:
            self.a_end = self._end(self.audio)
        if (self.video is not None and self.v_end is None) or (self.audio is not None and self.a_end is None):
            # A WebM straight from a browser's MediaRecorder says nothing about how long it is
            # (no duration in the header, the streams or the tags): ask its last packets instead.
            ends = self._packet_ends()
            if self.video is not None and self.v_end is None:
                self.v_end = ends.get(self.video['index'])
            if self.audio is not None and self.a_end is None:
                self.a_end = ends.get(self.audio['index'])
        # The picture decides what can be shown; without a picture, the sound.
        self.dur = self.v_end if self.v_end is not None else self.a_end
        if not self.dur or self.dur <= 0:
            die(f'{path}: could not tell how long it is (no duration, and no timed packets)')

    def _end(self, s):
        """Where a stream ends on ffmpeg's timeline, or None when the file does not say."""
        st = _f(s.get('start_time'), self.fstart) - self.fstart
        du = _f(s.get('duration')) or _tag_duration(s)
        if du is None and self.fdur is not None:
            du = self.fdur - st
        return None if du is None else st + du

    def _packet_ends(self):
        """{stream index: end} from the packets: the last packet's time plus its duration.

        Reads the whole file, but only the packet headers (nothing is decoded): about a second
        for a few minutes of take.
        """
        p = subprocess.run([FFPROBE, '-v', 'error', '-show_entries',
                            'packet=stream_index,pts_time,dts_time,duration_time', '-of', 'json', self.path],
                           capture_output=True, text=True)
        try:
            packets = json.loads(p.stdout or '{}').get('packets') or []
        except ValueError:
            packets = []
        times, lens = {}, {}
        for k in packets:
            t = _f(k.get('pts_time'), _f(k.get('dts_time')))
            if t is None:
                continue
            i = k.get('stream_index')
            times.setdefault(i, []).append(t)
            lens.setdefault(i, []).append(_f(k.get('duration_time')))
        ends = {}
        for i, ts in times.items():
            ts = np.asarray(ts)
            last = int(np.argmax(ts))
            d = lens[i][last]
            if d is None or d <= 0:          # no duration on the last packet: the usual step
                steps = np.diff(np.unique(ts))
                d = float(np.median(steps)) if len(steps) else 0.0
            ends[i] = float(ts[last]) + d - self.fstart
        return ends

    def describe(self):
        if self.video is None:
            return f'{self.dur:.2f} s, no picture'
        rot = f', turned {self.rotation} deg' if self.rotation else ''
        dyn = {'hlg': 'HDR (HLG)', 'pq': 'HDR (PQ)'}.get(self.hdr, 'SDR')
        if self.dovi:
            dyn += ' + Dolby Vision'
        snd = '' if self.audio is not None else ', NO SOUND'
        return f'{self.dur:.2f} s, {int(self.dw)}x{int(self.dh)}{rot} @ {self.fps:.3g} fps, {dyn}{snd}'


def load_sidecar(app_path):
    p = os.path.splitext(app_path)[0] + '.json'
    if not os.path.isfile(p):
        return None
    try:
        with open(p) as fh:
            j = json.load(fh)
        return j if isinstance(j, dict) else None
    except (OSError, ValueError) as e:
        warn(f'could not read the sidecar {p}: {e}')
        return None


def sound_model(sidecar, latency_ms=None, take_path=''):
    """Where the take's file keeps each sound against its picture, and when the speakers played it.

    Everything is in ms after the take's picture of the same moment (a key lighting up):
      latency_ms          the Mac's speakers played the sound this much later (outputLatencyMs)
      take_sound_delay_ms the take's file holds the sound this much later
      correction_ms       latency - take sound delay: what comes off the sound match (see main)
    Keylight's recorder says in the sidecar's "sync" block how it laid the file out:
      applied: true   it lined the tracks up so each sound sits where the speakers played it,
                      the output latency after its picture: with an edit list (method "edit
                      list") the sound was moved lateMs earlier, so pipeline + first frame -
                      lateMs; with the older tfdt shift, pipeline + first frame - video shift +
                      audio shift (both are outputLatencyMs by construction)
      applied: false  the raw file from the browser (a .webm, or a failed rewrite): the sound
                      is pipelineMs + firstFrameMs late against the picture
      no sync block   the take's sound was captured with its picture (delay 0), as the first
                      sidecars had it
    Without a sidecar (a screen recording, say) both are 0: a recording that heard the
    speakers, as the phone did, has the same delay as the phone.
    """
    sc = sidecar if isinstance(sidecar, dict) else {}
    lat_side = _f(sc.get('outputLatencyMs'))
    sync = sc.get('sync') if isinstance(sc.get('sync'), dict) else None
    notes = []
    if sync is not None and sync.get('applied'):
        pipe, first = _f(sync.get('pipelineMs')), _f(sync.get('firstFrameMs'), 0.0)
        late = _f(sync.get('lateMs'))
        if sync.get('method') == 'edit list' and pipe is not None and late is not None:
            delay = pipe + first - late
        elif pipe is not None:
            delay = pipe + first - _f(sync.get('videoShiftMs'), 0.0) + _f(sync.get('audioShiftMs'), 0.0)
        else:
            delay = lat_side or 0.0
        how = 'recorder sync applied: the sound sits where the speakers played it'
    elif sync is not None:
        pipe, first = _f(sync.get('pipelineMs')), _f(sync.get('firstFrameMs'), 0.0)
        if pipe is None:
            delay = first
            notes.append("the take's sidecar does not say how late its raw sound is (no pipelineMs)")
        else:
            delay = pipe + first
        how = 'raw recorder file: the sound is pipelineMs + firstFrameMs late'
        if sync.get('measuredRate') is False:
            notes.append(f"the recorder's pipelineMs ({pipe:g} ms) was not measured at this sample rate")
        if take_path.lower().endswith('.webm'):
            notes.append(f"the recorder's pipelineMs ({pipe if pipe is not None else 0:g} ms) is measured on its .mp4 "
                         "files (AAC sound); for a .webm take where the file keeps its sound is not measured, "
                         'so check the result and nudge it with --offset if the hands look early or late')
    elif sidecar:
        delay, how = 0.0, 'sidecar without a sync block: the sound was captured with its picture'
    else:
        delay, how = 0.0, 'no sidecar'
    if latency_ms is not None:
        lat, src = latency_ms, '--latency-ms'
    elif lat_side is not None:
        lat, src = lat_side, 'sidecar outputLatencyMs'
    elif sync is not None and sync.get('applied'):
        lat, src = delay, 'recorder sync (the sidecar has no outputLatencyMs)'
    else:
        lat, src = 0.0, 'none'
    return {'latency_ms': lat, 'latency_source': src, 'take_sound_delay_ms': round(delay, 3),
            'take_sound_source': how, 'correction_ms': round(lat - delay, 3) + 0.0, 'notes': notes}


def decode_audio(m):
    """The first audio stream as mono float32 at SR, sample 0 = time 0 of ffmpeg's timeline.

    aresample's first_pts=0 pads (or trims) the start so that a stream which starts a little
    after (or before) the file's start keeps its true position; the render uses the same timeline.
    """
    if m.audio is None:
        return None
    cmd = [FFMPEG, '-nostdin', '-hide_banner', '-v', 'error', '-i', m.path,
           '-map', f"0:{m.audio['index']}", '-af', 'aresample=async=1:min_comp=0.0001:first_pts=0',
           '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-']
    p = subprocess.run(cmd, capture_output=True)
    if p.returncode != 0:
        die(f'{m.path}: ffmpeg could not decode the sound: {p.stderr.decode(errors="replace").strip()[-300:]}')
    x = np.frombuffer(p.stdout, dtype='<f4').astype(np.float32)
    x[~np.isfinite(x)] = 0
    return x


# ---------------------------------------------------------------- analysis

def _band_bins():
    edges = np.geomspace(BAND_LO, BAND_HI, N_BANDS + 1)
    return np.unique(np.round(edges / (SR / NFFT)).astype(int))


def onset_envelope(x):
    """Per-band onset strength (frames x bands), zero mean and unit variance per band.

    Log band energy at 200 frames/s, half-wave rectified 10 ms difference: it rises when a
    note starts in that band, whatever the level, room colour or microphone.  Keeping the bands
    apart (instead of one broadband curve) keeps which notes were played, so a phrase that
    repeats does not match itself one bar later.  Very loud transients (claps, a dropped phone)
    are clipped so they cannot outvote the music.
    """
    from numpy.lib.stride_tricks import sliding_window_view
    bins = _band_bins()
    nb = len(bins) - 1
    if x is None or len(x) < NFFT + 4 * HOP:
        return np.zeros((0, nb), np.float32)
    frames = sliding_window_view(x, NFFT)[::HOP]
    n = frames.shape[0]
    win = np.hanning(NFFT).astype(np.float32)
    E = np.empty((n, nb), np.float32)
    step = 2048
    for s in range(0, n, step):
        spec = np.fft.rfft(frames[s:s + step] * win, axis=1)
        p = (spec.real ** 2 + spec.imag ** 2)[:, bins[0]:bins[-1]]
        E[s:s + step] = np.add.reduceat(p, bins[:-1] - bins[0], axis=1)
    floor = np.percentile(E, 95, axis=0) * 1e-4 + 1e-12
    L = np.log(E + floor)
    D = np.zeros_like(L)
    D[2:] = L[2:] - L[:-2]
    np.maximum(D, 0, out=D)
    top = np.percentile(D, 99.5, axis=0)
    np.minimum(D, top[None, :], out=D)
    D -= D.mean(axis=0)
    sd = D.std(axis=0)
    D /= np.where(sd > 1e-9, sd, 1.0)
    return D


def _parabolic(y, i):
    if i <= 0 or i >= len(y) - 1:
        return 0.0
    a, b, c = float(y[i - 1]), float(y[i]), float(y[i + 1])
    d = a - 2 * b + c
    if d >= 0:
        return 0.0
    return max(-0.5, min(0.5, 0.5 * (a - c) / d))


def coarse_match(A, C, min_overlap_frames, n_cand=None):
    """Cross-correlate the take's and camera's onset envelopes over every possible overlap.

    Returns the strongest few matches (at least GUARD_S apart), best first.  Lags are in
    envelope frames: lag k means camera frame = take frame + k.
    """
    n_cand = n_cand or N_CANDIDATES
    na, nc = len(A), len(C)
    if na < 10 or nc < 10:
        return None
    n = 1 << int(math.ceil(math.log2(na + nc)))
    S = np.zeros(n // 2 + 1, np.complex128)
    for b in range(A.shape[1]):
        S += np.conj(np.fft.rfft(A[:, b], n)) * np.fft.rfft(C[:, b], n)
    r = np.fft.irfft(S, n)
    lags = np.arange(-(na - 1), nc)
    vals = np.concatenate([r[n - (na - 1):], r[:nc]]) if na > 1 else r[:nc].copy()
    norm = math.sqrt(float((A.astype(np.float64) ** 2).sum()) * float((C.astype(np.float64) ** 2).sum()))
    if norm <= 0:
        return None
    vals /= norm
    overlap = np.minimum(na, nc - lags) - np.maximum(0, -lags)
    valid = overlap >= min_overlap_frames
    if not valid.any():
        return None
    guard = int(round(GUARD_S * ENV_RATE))
    vv = vals[valid]
    med = float(np.median(vv))
    mad = float(np.median(np.abs(vv - med))) * 1.4826
    w = np.where(valid, vals, -np.inf)
    cands = []
    for _ in range(n_cand):
        i = int(np.argmax(w))
        if not np.isfinite(w[i]):
            break
        far = valid & (np.abs(lags - lags[i]) > guard)
        second = float(vals[far].max()) if far.any() else 0.0
        cands.append({
            'lag': lags[i] + _parabolic(vals, i), 'peak': float(vals[i]),
            # the confidence: this match against the best match anywhere else
            'ratio': min(99.0, float(vals[i]) / second) if second > 1e-9 else 99.0,
            'z': min(999.0, (float(vals[i]) - med) / mad) if mad > 0 else 999.0,
        })
        w[max(0, i - guard):i + guard + 1] = -np.inf
    return cands


def fine_match(xa, xc, lag0, search_s=FINE_SEARCH_S):
    """Sample-accurate lag (in samples) near lag0, by GCC-PHAT of the band-limited audio.

    The overlap is cut into windows (about ten, 3 to 15 s long); each gives its own estimate.
    The true alignment gives the same answer in every window (give or take a slow drift between
    the Mac's and the phone's clocks); another performance of the same notes does not, even when
    single windows lock onto it.  Returns None when no window had sound.
    """
    M = int(round(search_s * SR))
    L0 = int(round(lag0))
    s0 = max(0, M - L0)
    s1 = min(len(xa), len(xc) - L0 - M)
    if s1 - s0 < SR:
        return None
    total = s1 - s0
    seg = int(min(FINE_WIN_S, max(FINE_MIN_WIN_S, total / SR / FINE_TARGET_WINDOWS)) * SR)
    if total < 2 * seg:
        wins = [(s0, s1)]
    else:
        starts = [s0 + i * seg for i in range(total // seg)]
        if len(starts) > FINE_MAX_WINDOWS:
            pick = np.linspace(0, len(starts) - 1, FINE_MAX_WINDOWS).round().astype(int)
            starts = [starts[k] for k in pick]
        wins = [(a, a + seg) for a in starts]
    ref = float(np.sqrt(np.mean(xa[s0:s1].astype(np.float64) ** 2)))
    if ref <= 0:
        return None
    ramp = int(0.02 * SR)
    out = []
    for a, b in wins:
        xs = xa[a:b].astype(np.float64)
        level = float(np.sqrt(np.mean(xs ** 2)))
        if level < 0.05 * ref:
            continue                      # (nearly) silent stretch of the take: nothing to lock to
        ys = xc[a + L0 - M:b + L0 + M].astype(np.float64)
        taper = np.ones(len(xs))
        r = min(ramp, len(xs) // 4)
        if r > 1:
            h = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, r))
            taper[:r] = h
            taper[-r:] = h[::-1]
        nfft = 1 << (len(ys) - 1).bit_length()
        X = np.fft.rfft(xs * taper, nfft)
        Y = np.fft.rfft(ys, nfft)
        G = np.conj(X) * Y
        f = np.fft.rfftfreq(nfft, 1.0 / SR)
        band = (f >= FINE_BAND[0]) & (f <= FINE_BAND[1])
        G = np.where(band, G / (np.abs(G) ** PHAT_BETA + 1e-30), 0)
        c = np.fft.irfft(G, nfft)
        cs = c[:2 * M + 1]
        rest = c[2 * M + 1 + 64:nfft - 64]
        noise = float(np.sqrt(np.mean(rest ** 2))) if len(rest) > 256 else 0.0
        j = int(np.argmax(np.abs(cs)))
        if noise <= 0:
            continue
        sign = 1.0 if cs[j] >= 0 else -1.0     # a phase-inverted speaker still locks
        lag = (L0 - M) + j + _parabolic(sign * cs, j)
        out.append({'t': (a + b) / 2.0 / SR, 'lag': lag, 'q': abs(float(cs[j])) / noise,
                    'edge': j < 2 or j > 2 * M - 2})
    if not out:
        return None
    # How well the waveform locks at this alignment: the median over every window with sound,
    # so one lucky window cannot make a wrong alignment look good.
    score = float(np.median([w['q'] for w in out]))
    good = [w for w in out if w['q'] >= FINE_MIN_Q]
    if not good:
        return {'lag': None, 'score': score, 'windows': out}
    lags = np.array([w['lag'] for w in good])
    wts = np.array([w['q'] for w in good])
    t = np.array([w['t'] for w in good])
    tm = float((wts * t).sum() / wts.sum())
    tol = AGREE_MS / 1000.0 * SR
    max_slope = MAX_DRIFT_PPM * 1e-6 * SR          # samples of lag per second of take

    def fit(mask):
        if mask.sum() < 3:
            return 0.0
        sw, tt, ll = wts[mask], t[mask], lags[mask]
        tw = (sw * tt).sum() / sw.sum()
        den = (sw * (tt - tw) ** 2).sum()
        s = (sw * (tt - tw) * (ll - (sw * ll).sum() / sw.sum())).sum() / den if den > 0 else 0.0
        return float(np.clip(s, -max_slope, max_slope))   # a faster "drift" is not a clock

    best = None
    for slope in {0.0, fit(np.ones(len(good), bool))}:
        for _ in range(2):                                  # fit, then refit on the windows that agree
            base = _wmedian(lags - slope * (t - tm), wts)
            resid = lags - (base + slope * (t - tm))
            inl = np.abs(resid) <= tol
            agree = float(wts[inl].sum() / wts.sum())
            # Any two windows fit some line: believe a drift only when three or more agree on it.
            if (slope == 0.0 or inl.sum() >= 3) and (best is None or agree > best[0] + 1e-9):
                best = (agree, slope, inl, resid)
            slope = fit(inl)
    agree, slope, inl, resid = best
    enough = len(good) * 2 >= len(out)              # at least half the stretches with sound locked
    consistent = len(good) == 1 or (agree >= AGREE_SHARE and enough)
    use = inl if inl.any() else np.ones(len(good), bool)
    span = float(t[use].max() - t[use].min()) if use.sum() >= 2 else 0.0
    res = {
        'lag': _wmedian(lags[use], wts[use]), 'score': score, 'windows': out, 'used': int(use.sum()),
        'locked': len(good), 'agree': agree, 'consistent': bool(consistent),
        'spread': float((wts[use] * np.abs(resid[use])).sum() / wts[use].sum()),
        'edge': sum(w['edge'] for w in good) * 2 > len(good),
        'drift': slope * span / SR if use.sum() >= 3 else 0.0,   # seconds over the measured span
        'steps': [],
    }
    if enough and len(good) >= 4:
        # No single offset fits, but maybe a few in a row do: the sound jumped once or twice.
        # (A small jump also fits a sloping line; then the runs fit much more tightly than the
        # line does, while real clock drift fits the line more tightly than any runs.)
        st = _step_fit(t, lags, wts, tm, tol, max_slope, (0.0, slope))
        if st is not None and max_slope > 0 and abs(st['slope']) >= 0.999 * max_slope:
            st = None       # runs that only line up with an impossible clock drift: not believed
        if st is not None and st['agree'] >= AGREE_SHARE and st['span'] <= MAX_STEP_SPAN_MS / 1000.0 * SR:
            runs, levels, d = st['runs'], st['levels'], st['d']
            members = np.concatenate(runs)
            st_spread = float(sum((wts[g] * np.abs(d[g] - lv)).sum() for g, lv in zip(runs, levels))
                              / wts[members].sum())
            tighter = (st['agree'] >= agree - 1e-9 and res['spread'] >= 0.15e-3 * SR
                       and st_spread * 2 < res['spread'])
            if consistent and not tighter:
                return res
            res.update({
                # The part before the first jump: there the take's own sync still holds.  A glitch
                # (in the Mac's output, the take's recording or the phone) moves a sound from then
                # on, never a picture, so this offset keeps the pictures in step to the end.
                'lag': levels[0], 'used': int(len(members)), 'agree': st['agree'], 'consistent': True,
                'spread': st_spread,
                'drift': st['slope'] * float(t[members].max() - t[members].min()) / SR,
                'steps': [{'take_time': round((float(t[a].max()) + float(t[b].min())) / 2.0, 2),
                           'ms': round((lb - la) / SR * 1000.0, 2)}
                          for a, b, la, lb in zip(runs, runs[1:], levels, levels[1:])],
                'step_max_ms': round(max(abs(lv - levels[0]) for lv in levels) / SR * 1000.0, 2),
            })
    return res


def _runs(order, d, wts, tol):
    """Windows in time order, cut where the offset jumps; only runs of two or more are kept.

    A lone window that disagrees, between two that agree with each other, is left out.
    """
    runs, cur = [], []
    for pos, k in enumerate(order):
        if cur:
            level = _wmedian(d[cur], wts[cur])
            if abs(d[k] - level) <= tol:
                cur.append(k)
                continue
            nxt = order[pos + 1] if pos + 1 < len(order) else None
            if len(cur) >= 2 and nxt is not None and abs(d[nxt] - level) <= tol:
                continue
            runs.append(cur)
        cur = [k]
    if cur:
        runs.append(cur)
    return [np.array(g) for g in runs if len(g) >= 2]


def _step_fit(t, lags, wts, tm, tol, max_slope, slopes):
    """The windows as a few runs in time, each agreeing on one offset, with jumps between them.

    When the Mac's sound output glitches (a buffer played late, say), the speakers' sound moves
    against the take's by a few ms from then on: the windows before agree on one offset and the
    windows after on another.  Another performance of the same notes gives a different offset in
    nearly every window, so it does not make runs.  Lags in samples, times in seconds; the levels
    are lags at time tm (after any clock drift, shared by all runs).  Returns the best split with
    two or more runs, or None.
    """
    order = np.argsort(t, kind='stable')
    best = None
    for s in slopes:
        for _ in range(2):                  # cut, then refit the drift inside the runs and cut again
            d = lags - s * (t - tm)
            runs = _runs(order, d, wts, tol)
            if len(runs) < 2:
                break
            agree = float(sum(wts[g].sum() for g in runs) / wts.sum())
            levels = [_wmedian(d[g], wts[g]) for g in runs]
            if best is None or agree > best['agree'] + 1e-9:
                best = {'agree': agree, 'slope': s, 'runs': runs, 'levels': levels, 'd': d,
                        'span': max(levels) - min(levels)}
            num = den = 0.0
            for g in runs:
                w = wts[g]
                tt = t[g] - (w * t[g]).sum() / w.sum()
                ll = lags[g] - (w * lags[g]).sum() / w.sum()
                num += float((w * tt * ll).sum())
                den += float((w * tt * tt).sum())
            s = float(np.clip(num / den, -max_slope, max_slope)) if den > 0 else 0.0
    return best


def _wmedian(v, w):
    o = np.argsort(v)
    v, w = np.asarray(v, float)[o], np.asarray(w, float)[o]
    c = np.cumsum(w)
    return float(v[min(len(v) - 1, int(np.searchsorted(c, 0.5 * c[-1])))])


def analyse(xa, xc, min_conf):
    """Find where the take's sound sits in the camera's sound.  Times in seconds.

    1. The onset envelopes give the few strongest candidate alignments over the whole range.
    2. Each candidate is checked against the waveform (GCC-PHAT, sample accurate).  Only the
       true alignment has the same waveform in both recordings, even when the phone also heard
       an earlier attempt at the same piece, with the same notes.
    3. The candidate that locks best wins.  It is accepted when its envelope match is clearly
       the best (confidence >= min_conf), or when its waveform lock is clearly the best.
    """
    A = onset_envelope(xa)
    C = onset_envelope(xc)
    if len(A) == 0 or not np.any(A):
        return {'ok': False, 'why': 'the take has no usable sound'}
    if len(C) == 0 or not np.any(C):
        return {'ok': False, 'why': 'the camera clip has no usable sound'}
    min_ov = min(3.0 * ENV_RATE, 0.3 * min(len(A), len(C)))
    cands = coarse_match(A, C, min_ov)
    if not cands:
        return {'ok': False, 'why': 'the recordings are too short to compare'}
    fines = [fine_match(xa, xc, c['lag'] * HOP) for c in cands]
    scores = [f['score'] if f else 0.0 for f in fines]
    k = int(np.argmax(scores)) if max(scores) >= FINE_MIN_Q else 0
    c, fine = cands[k], fines[k]
    if fine and fine['lag'] is not None and fine['edge']:
        fine = fine_match(xa, xc, c['lag'] * HOP, search_s=0.12) or fine    # coarse was off: look wider
    q = scores[k]
    q_next = max([s for j, s in enumerate(scores) if j != k], default=0.0)
    lock = q / max(q_next, 1.0)
    locked = bool(fine and fine['lag'] is not None)
    # The waveform locked, but the windows disagree: the same notes, a different recording.
    disagree = locked and not fine['consistent']
    by_envelope = c['ratio'] >= min_conf and c['z'] >= MIN_Z and not disagree
    by_waveform = locked and fine['consistent'] and q >= 2 * FINE_MIN_Q and lock >= LOCK_RATIO
    ok = by_envelope or by_waveform
    res = {
        'ok': bool(ok), 'confidence': round(c['ratio'], 3), 'zscore': round(c['z'], 1),
        'lock': round(q, 1), 'lock_ratio': round(lock, 2),
        'decided_by': ('envelope and waveform' if by_envelope and by_waveform else
                       'envelope' if by_envelope else 'waveform' if by_waveform else None),
        'coarse_offset': c['lag'] * HOP / SR,
        'candidates': [{'offset': round(cc['lag'] * HOP / SR, 4), 'envelope': round(cc['peak'], 4),
                        'confidence': round(cc['ratio'], 3), 'lock': round(s, 1)} for cc, s in zip(cands, scores)],
    }
    if locked:
        res.update(audio_offset=fine['lag'] / SR, refined=True, windows=fine['used'],
                   windows_locked=fine['locked'], windows_with_sound=len(fine['windows']),
                   agree=round(fine['agree'], 3), spread_ms=fine['spread'] / SR * 1000.0,
                   drift_ms=fine['drift'] * 1000.0, steps=fine['steps'])
        if fine['steps']:
            res['step_max_ms'] = fine['step_max_ms']
    else:
        res.update(audio_offset=c['lag'] * HOP / SR, refined=False, windows=0, spread_ms=None, drift_ms=None)
    if disagree:
        res['why'] = (f"the notes line up but the recordings do not: only {fine['agree'] * 100:.0f}% of the "
                      f"waveform lock agrees on one offset across {fine['locked']} stretches, so the phone "
                      f"probably heard a different take of this piece (or its sound slides against the "
                      f"take's too much to follow)")
    elif not ok:
        res['why'] = (f"the take's sound was not found in this clip with enough confidence (confidence "
                      f"{c['ratio']:.2f}, need {min_conf:.2f}; waveform lock {q:.0f} at {lock:.1f}x the next "
                      f"candidate, need {2 * FINE_MIN_Q:.0f} at {LOCK_RATIO:.0f}x)")
    return res


# ---------------------------------------------------------------- HDR

_HDR_CACHE = {}


def _swscale_tonemaps():
    """Does this ffmpeg's swscale do real HDR->SDR tone mapping (FFmpeg 8 colour management)?

    Converts one HLG grey frame both ways, through the same filters and yuv420p output as the
    render, and checks that the tone-mapped one is darker (HLG 75% lands near 68% when mapped).
    (A gray output format would skip the colour management, so the probe must not use one.)
    """
    w, h = 16, 2
    raw = np.full((3, h, w), int(0.75 * 65535), '<u2').tobytes()
    tag = 'setparams=color_trc=arib-std-b67:color_primaries=bt2020:colorspace=bt2020nc:range=pc,format=yuv420p10le,'

    def luma(vf):
        p = subprocess.run([FFMPEG, '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'gbrp16le', '-s', f'{w}x{h}',
                            '-i', '-', '-vf', vf + ',format=yuv420p', '-f', 'rawvideo', '-'],
                           input=raw, capture_output=True)
        if p.returncode != 0 or len(p.stdout) != w * h * 3 // 2:
            return None
        return (float(np.frombuffer(p.stdout[:w * h], np.uint8).mean()) - 16.0) / 219.0

    plain = luma(tag + tonemap_filters(None, 'none')[0])
    mapped = luma(tag + tonemap_filters(None, 'swscale')[0])
    return plain is not None and mapped is not None and plain - mapped > 0.03


def hdr_path(choice='auto'):
    """Which HDR->SDR tone mapper to use: zscale, libplacebo, swscale or none."""
    if choice in _HDR_CACHE:
        return _HDR_CACHE[choice]
    p = subprocess.run([FFMPEG, '-hide_banner', '-filters'], capture_output=True, text=True)
    names = set()
    for line in p.stdout.splitlines():
        parts = line.split()
        if len(parts) >= 3 and '->' in parts[2]:
            names.add(parts[1])
    have = {
        'zscale': 'zscale' in names and 'tonemap' in names,
        'libplacebo': 'libplacebo' in names,
    }
    order = ['zscale', 'libplacebo', 'swscale', 'none'] if choice == 'auto' else [choice, 'none']
    path = 'none'
    for o in order:
        if o == 'swscale' and _swscale_tonemaps():
            path = o
            break
        if have.get(o):
            path = o
            break
    if choice not in ('auto', 'none') and path != choice:
        warn(f'--tonemap {choice} is not available in this ffmpeg; HDR will only be converted')
    _HDR_CACHE[choice] = path
    return path


def tonemap_filters(m, path):
    tin = m.transfer if (m is not None and m.transfer in ('arib-std-b67', 'smpte2084')) else 'arib-std-b67'
    if path == 'zscale':
        return [f'zscale=tin={tin}:pin=bt2020:min=bt2020nc:rin=limited:t=linear:npl=100', 'format=gbrpf32le',
                'zscale=p=bt709', 'tonemap=tonemap=hable:desat=0', 'zscale=t=bt709:m=bt709:r=limited',
                'format=yuv420p']
    if path == 'libplacebo':
        return ['libplacebo=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv:'
                'tonemapping=auto:format=yuv420p']
    if path == 'swscale':
        return [f'scale=in_transfer={tin}:in_primaries=bt2020:in_color_matrix=bt2020:out_transfer=bt709:'
                'out_primaries=bt709:out_color_matrix=bt709:out_range=tv:intent=perceptual', 'format=yuv420p']
    return ['scale=in_color_matrix=bt2020:out_color_matrix=bt709:out_range=tv', 'format=yuv420p']


# ---------------------------------------------------------------- layout and render

def even_floor(v):
    return max(0, int(math.floor(v + 1e-9)) // 2 * 2)


def even_round(v):
    return max(2, int(round(v / 2.0)) * 2)


def even_ceil(v):
    return max(2, int(math.ceil(v / 2.0 - 1e-9)) * 2)


def cover(src_w, src_h, box_w, box_h, fy, fx=0.5):
    """Scale to cover the box, then crop; fy/fx pick which part survives (0 top/left .. 1 bottom/right)."""
    s = max(box_w / src_w, box_h / src_h)
    w, h = max(box_w, even_ceil(src_w * s)), max(box_h, even_ceil(src_h * s))
    return {'w': w, 'h': h, 'cx': even_floor((w - box_w) * fx), 'cy': even_floor((h - box_h) * fy),
            'cw': box_w, 'ch': box_h}


def fit(box_w, box_h):
    return {'w': box_w, 'h': box_h, 'cx': 0, 'cy': 0, 'cw': box_w, 'ch': box_h}


def plan_layout(layout, W, H, app, cam, args):
    """Panels in drawing order: (source, x, y, sizing); 'box' is a background-coloured frame."""
    aw, ah = (app.dw, app.dh) if app.video is not None else (16.0, 9.0)
    cw, ch = cam.dw, cam.dh
    if layout == 'stack':
        top = min(H - 2, max(2, even_round(H * args.split)))
        return [('app', 0, 0, cover(aw, ah, W, top, args.app_focus)),
                ('cam', 0, top, cover(cw, ch, W, H - top, args.camera_focus))]
    if layout == 'pip':
        iw = even_round(W * 0.42)
        ih = even_round(iw * ah / aw)
        if ih > H * 0.45:
            ih = even_round(H * 0.45)
            iw = even_round(ih * aw / ah)
        b = max(2, even_round(H * 0.004))
        x, y = even_round((W - iw) / 2.0), max(b, even_round(H * 0.035))
        return [('cam', 0, 0, cover(cw, ch, W, H, args.camera_focus)),
                ('box', x - b, y - b, fit(iw + 2 * b, ih + 2 * b)),
                ('app', x, y, fit(iw, ih))]
    # vertical: Keylight at its natural aspect across the top, the camera fills the rest
    nat = even_round(W * ah / aw)
    cap = even_round(H * 0.6)
    if nat <= cap:
        top, sz = nat, fit(W, nat)
    else:
        top, sz = cap, cover(aw, ah, W, cap, args.app_focus)
    return [('app', 0, 0, sz), ('cam', 0, top, cover(cw, ch, W, H - top, args.camera_focus))]


def _sdr_matrix_opts(m):
    mat = {'bt709': 'bt709', 'smpte170m': 'bt601', 'bt470bg': 'bt601', 'bt2020nc': 'bt2020',
           'bt2020c': 'bt2020', 'smpte240m': 'smpte240m', 'fcc': 'fcc'}.get(m.matrix)
    rgb = m.pix_fmt.startswith(('rgb', 'bgr', 'gbr', 'argb', 'abgr', 'rgba', 'bgra'))
    opts = ''
    if not rgb:
        opts += f":in_color_matrix={mat or ('bt709' if m.h >= 600 else 'bt601')}"
        if m.range in ('pc', 'tv'):
            opts += f":in_range={'full' if m.range == 'pc' else 'limited'}"
    return opts + ':out_color_matrix=bt709:out_range=tv'


TAGS_709 = 'setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv'


def video_chain(src, m, sz, fps, D, tmpath, label):
    f = []
    if m.hdr and tmpath != 'sdr':
        f.append(f"scale={sz['w']}:{sz['h']}:flags=bicubic")
        f.append('format=yuv420p10le')            # stay 10-bit until the tone mapping
        if (sz['cw'], sz['ch']) != (sz['w'], sz['h']):
            f.append(f"crop={sz['cw']}:{sz['ch']}:{sz['cx']}:{sz['cy']}")
        f += tonemap_filters(m, tmpath)
    else:
        f.append(f"scale={sz['w']}:{sz['h']}:flags=bicubic" + _sdr_matrix_opts(m))
        if (sz['cw'], sz['ch']) != (sz['w'], sz['h']):
            f.append(f"crop={sz['cw']}:{sz['ch']}:{sz['cx']}:{sz['cy']}")
    f += ['setsar=1', f'fps=fps={fps}:start_time=0', 'format=yuv420p', TAGS_709, f'trim=duration={D:.6f}']
    return f"[{src}:{m.video['index']}]" + ','.join(f) + f'[{label}]'


def colour_source(w, h, fps, D, label):
    # One frame converted from RGB with the BT.709 matrix, then cloned: converting every
    # frame of a solid colour cost about a quarter of the whole render.
    return (f'color=c={BG}:s={w}x{h}:r={fps},trim=end_frame=1,format=gbrp,'
            f'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,{TAGS_709},'
            f'tpad=stop=-1:stop_mode=clone,trim=duration={D:.6f}[{label}]')


def audio_chain(src, m, D, label, delay_s=0.0, gain_db=0.0):
    f = ['aresample=async=1:min_comp=0.0001:first_pts=0', f'aresample={AUDIO_RATE}',
         f'aformat=sample_fmts=fltp:sample_rates={AUDIO_RATE}:channel_layouts=stereo']
    if delay_s > 0:
        f.append(f'adelay=delays={int(round(delay_s * AUDIO_RATE))}S:all=1')
    if gain_db:
        f.append(f'volume={gain_db}dB')
    f += ['apad', f'atrim=duration={D:.6f}']
    return f"[{src}:{m.audio['index']}]" + ','.join(f) + f'[{label}]'


def build_command(job, W, H, include_audio=True):
    app, cam, D, fps = job['app'], job['cam'], job['D'], job['fps']
    hw = ['-hwaccel', 'videotoolbox'] if (job['args'].hwdecode and sys.platform == 'darwin') else []
    inputs = ['-ss', f"{job['app_ss']:.6f}", '-t', f'{D + 1:.6f}', '-i', app.path] + hw + \
             ['-ss', f"{job['cam_ss']:.6f}", '-t', f'{D + 1:.6f}', '-i', cam.path]
    g = [colour_source(W, H, fps, D, 'bg')]
    base = 'bg'
    for k, (what, x, y, sz) in enumerate(plan_layout(job['layout'], W, H, app, cam, job['args'])):
        lab = f'p{k}'
        if what == 'box':
            g.append(colour_source(sz['w'], sz['h'], fps, D, lab))
        elif what == 'app':
            if app.video is None:
                continue
            g.append(video_chain(0, app, sz, fps, D, job['tm_app'], lab))
        else:
            g.append(video_chain(1, cam, sz, fps, D, job['tm_cam'], lab))
        g.append(f'[{base}][{lab}]overlay=x={x}:y={y}:eof_action=repeat:format=yuv420[o{k}]')
        base = f'o{k}'
    g.append(f'[{base}]null[vout]')
    maps = ['-map', '[vout]']
    if include_audio:
        mode = job['audio']
        use_app = mode in ('app', 'mix') and app.audio is not None
        use_cam = mode in ('camera', 'mix') and cam.audio is not None
        if not use_app and not use_cam:          # the chosen source has no sound: use the other one
            use_app = app.audio is not None
            use_cam = not use_app and cam.audio is not None
        if use_cam:
            # The phone's sound goes where it matched the take's sound (the picture offset plus
            # L - S, see main), so it sits against the pictures just as the take's sound does,
            # and the two sounds do not echo each other in --audio mix.
            ss = job['cam_ss'] + job['cam_sound_s']
            inputs += ['-ss', f'{max(0.0, ss):.6f}', '-t', f'{D + 1:.6f}', '-i', cam.path]
        if use_app and use_cam:
            g.append(audio_chain(0, app, D, 'a0'))
            g.append(audio_chain(2, cam, D, 'a1', delay_s=max(0.0, -ss), gain_db=-12))
            g.append('[a0][a1]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]')
        elif use_app:
            g.append(audio_chain(0, app, D, 'aout'))
        elif use_cam:
            g.append(audio_chain(2, cam, D, 'aout', delay_s=max(0.0, -ss)))
        else:
            g.append(f'anullsrc=r={AUDIO_RATE}:cl=stereo,atrim=duration={D:.6f}[aout]')
        maps += ['-map', '[aout]']
    return inputs, ';'.join(g), maps


def run_ffmpeg(cmd, what):
    tty = sys.stderr.isatty()
    full = [FFMPEG, '-nostdin', '-hide_banner', '-y', '-loglevel', 'error'] + (['-stats'] if tty else []) + cmd
    if VERBOSE:
        import shlex
        print('+ ' + ' '.join(shlex.quote(c) for c in full), file=sys.stderr, flush=True)
    p = subprocess.run(full, stderr=None if tty else subprocess.PIPE, text=True)
    if p.returncode != 0:
        tail = '' if tty else '\n' + (p.stderr or '').strip()[-1500:]
        die(f'ffmpeg failed while {what}{tail}')


def render(job):
    args = job['args']
    D = job['D']
    W, H = (1080, 1920) if job['layout'] == 'vertical' else (1920, 1080)
    venc = ['-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-fps_mode', 'cfr',
            '-g', str(int(round(job['fps_f'] * 2))),
            '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv']
    aenc = ['-c:a', 'aac', '-b:a', f'{AUDIO_KBPS}k', '-ar', str(AUDIO_RATE), '-ac', '2']
    tail = ['-t', f'{D:.6f}', '-map_metadata', '-1', '-map_chapters', '-1', '-movflags', '+faststart']
    out = job['out']
    if args.preview:
        W, H = W // 2, H // 2
        inputs, graph, maps = build_command(job, W, H)
        say(f"  rendering preview {W}x{H}, {D:.2f} s ...")
        run_ffmpeg(inputs + ['-filter_complex', graph] + maps + venc + ['-preset', 'superfast', '-crf', '30']
                   + aenc + tail + [out], 'rendering the preview')
    elif args.max_mb:
        limit = args.max_mb * 1_000_000
        budget = limit * 8 * 0.96 - AUDIO_KBPS * 1000 * 1.02 * D
        vbps = budget / D
        if vbps < 150_000:
            die(f'{D:.1f} s does not fit in {args.max_mb:g} MB with {AUDIO_KBPS} kbit/s sound '
                f'(only {max(0, vbps) / 1000:.0f} kbit/s would be left for the picture); '
                f'shorten it with --trim or raise --max-mb')
        if vbps / (W * H * job['fps_f']) < 0.035:
            W, H = (720, 1280) if job['layout'] == 'vertical' else (1280, 720)
            say(f'  {vbps / 1000:.0f} kbit/s is thin for 1080p: rendering {W}x{H}')
        if vbps / (W * H * job['fps_f']) < 0.02:
            say('  (tip: at this size, --fps 30 or a shorter --trim will look cleaner)')
        inputs, graph, maps = build_command(job, W, H)
        vinputs, vgraph, vmaps = build_command(job, W, H, include_audio=False)
        with tempfile.TemporaryDirectory(prefix='sync-take-') as tmp:
            log = os.path.join(tmp, 'x264')
            rate = vbps
            for attempt in range(3):
                rc = ['-b:v', f'{int(rate)}', '-maxrate', f'{int(rate * 2)}', '-bufsize', f'{int(rate * 4)}',
                      '-preset', 'medium', '-passlogfile', log]
                say(f'  two-pass encode for {args.max_mb:g} MB: {W}x{H}, video {rate / 1000:.0f} kbit/s'
                    + (f' (retry {attempt})' if attempt else '') + ' ...')
                run_ffmpeg(vinputs + ['-filter_complex', vgraph] + vmaps + venc + rc + ['-pass', '1', '-an',
                           '-t', f'{D:.6f}', '-f', 'mp4', os.devnull], 'encoding pass 1')
                run_ffmpeg(inputs + ['-filter_complex', graph] + maps + venc + rc + ['-pass', '2'] + aenc
                           + tail + [out], 'encoding pass 2')
                size = os.path.getsize(out)
                if size <= limit:
                    break
                rate *= (limit / size) * 0.95
                if rate < 100_000:
                    break
            if os.path.getsize(out) > limit:
                warn(f'{out} is {os.path.getsize(out) / 1e6:.2f} MB, still over {args.max_mb:g} MB')
    else:
        inputs, graph, maps = build_command(job, W, H)
        say(f"  rendering {W}x{H}, {D:.2f} s ...")
        run_ffmpeg(inputs + ['-filter_complex', graph] + maps + venc + ['-preset', 'medium', '-crf', '18']
                   + aenc + tail + [out], 'rendering')
    return W, H


def check_output(path):
    p = subprocess.run([FFPROBE, '-v', 'error', '-show_format', '-show_streams', '-of', 'json', path],
                       capture_output=True, text=True)
    j = json.loads(p.stdout or '{}')
    v = next((s for s in j.get('streams', []) if s.get('codec_type') == 'video'), {})
    return (f"{v.get('width')}x{v.get('height')}, {_rate(v.get('avg_frame_rate')) or 0:.3g} fps, "
            f"{_f((j.get('format') or {}).get('duration'), 0):.2f} s, {os.path.getsize(path) / 1e6:.2f} MB")


# ---------------------------------------------------------------- command line

HELP_EPILOG = """\
offset sign (for --offset and for what this tool prints)
  offset = camera time - take time, in seconds, for the same moment.
  Positive: the phone started recording before the take; the take's first
  frame is that many seconds into the phone clip.  Negative: the phone started
  after the take.  To nudge by hand: if the hands press a key one frame
  AFTER Keylight shows it, the offset is too small; the tool said +2.345, so
  try --offset 2.362 (one 60 fps frame more).  Hands early: make it smaller.
  A manual --offset is used as is.  The tool's own answer lines up the
  pictures: the phone's picture of a key going down with Keylight lighting it.
  The take's .json sidecar says how late the Mac's speakers played each sound
  (outputLatencyMs) and where the take's file keeps it (its "sync" block); the
  difference is taken out of the sound match.  With Keylight's recorder the
  file keeps each sound where the speakers played it, so nothing comes off.

exit status
  0 done, 1 error, 2 bad options, 3 no confident sync (use --offset)

examples
  scripts/sync-take.py --app keylight-take-20261030-201500.mp4 --camera IMG_4521.MOV --out duet.mp4
  scripts/sync-take.py --app take.mp4 --camera IMG_4521.MOV --out duet.mp4 --max-mb 10
  scripts/sync-take.py --app take.mp4 --camera a.MOV --camera b.MOV --out duet.mp4 --layout vertical
  scripts/sync-take.py --app take.mp4 --camera IMG_4521.MOV --analyze-only
"""


def parse_args(argv):
    ap = argparse.ArgumentParser(
        prog='sync-take.py', formatter_class=argparse.RawDescriptionHelpFormatter,
        description=__doc__.split('Needs python3')[0].strip().split('\n', 1)[1].strip(),
        epilog=HELP_EPILOG)
    ap.add_argument('--app', required=True, metavar='TAKE',
                    help='the Keylight take (keylight-take-*.mp4 or .webm; its .json sidecar is read when it '
                         'sits next to it), or any other video with sound, such as a screen recording')
    ap.add_argument('--camera', required=True, action='append', metavar='CLIP',
                    help='a phone clip (.MOV/.mp4) that heard the Mac play the take; repeat for more clips')
    ap.add_argument('--out', metavar='OUT.mp4', help='output file (with several cameras: OUT-1.mp4, OUT-2.mp4, ...)')
    ap.add_argument('--layout', choices=['stack', 'pip', 'vertical'], default='stack',
                    help='stack (default): 1920x1080, Keylight on top, camera below. pip: camera full frame, '
                         'Keylight as an inset (42%% of the width) at the top. vertical: 1080x1920 for phones, '
                         'Keylight across the top at its own shape, camera fills the rest')
    ap.add_argument('--audio', choices=['app', 'camera', 'mix'],
                    help="app: the take's clean sound (default when the take has its .json sidecar or a "
                         "keylight-take name); camera: the phone's sound, moved to stay in sync (default "
                         "otherwise); mix: the take's sound plus the phone's 12 dB lower")
    ap.add_argument('--offset', action='append', metavar='SECONDS',
                    help='manual offset for one camera, in --camera order (camera time = take time + SECONDS); '
                         'skips the listening for that camera; use "auto" to keep listening for one of them')
    ap.add_argument('--trim', metavar='START:END',
                    help='render only this part, in take seconds (either side may be empty: 12: or :75); '
                         'default: all of the time both recordings cover')
    ap.add_argument('--split', type=float, default=0.55,
                    help="stack layout: the top (Keylight) panel's share of the height (default 0.55)")
    ap.add_argument('--app-focus', type=float, default=1.0, metavar='0..1',
                    help="which part of Keylight's view to keep when it is cropped: 0 top, 0.5 middle, "
                         "1 bottom (default 1: the on-screen keyboard)")
    ap.add_argument('--camera-focus', type=float, default=0.5, metavar='0..1',
                    help="which part of the camera picture to keep when it is cropped: 0 top, 0.5 middle "
                         "(default), 1 bottom")
    ap.add_argument('--fps', type=float, default=60.0, help='output frame rate (default 60)')
    ap.add_argument('--max-mb', type=float, metavar='N',
                    help="fit each file under N megabytes (1 MB = 1,000,000 bytes); 10 fits Discord's free "
                         "limit. Two-pass; drops to 1280x720 (720x1280 vertical) when the bitrate gets thin")
    ap.add_argument('--analyze-only', action='store_true', help='print the offsets as JSON and render nothing')
    ap.add_argument('--preview', action='store_true',
                    help='fast, low-quality, half-size render of the first 10 seconds, to OUT-preview.mp4')
    ap.add_argument('--latency-ms', type=float, metavar='MS',
                    help="how much later than a key lit up the Mac's speakers played its sound (default: the "
                         "sidecar's outputLatencyMs, or 0 without a sidecar). What comes off the sound match is "
                         "this minus how late the take's own file keeps the sound (from the sidecar's sync "
                         "block; 0 without one)")
    ap.add_argument('--min-confidence', type=float, default=MIN_CONFIDENCE, metavar='R',
                    help='refuse a sync whose confidence (how many times stronger the best match is than the '
                         f'best match elsewhere) is below R (default {MIN_CONFIDENCE})')
    ap.add_argument('--tonemap', choices=['auto', 'zscale', 'libplacebo', 'swscale', 'none'], default='auto',
                    help='HDR to SDR tone mapper for HDR phone clips (default auto: zscale+tonemap, then '
                         'libplacebo, then FFmpeg 8 swscale, whichever this ffmpeg has)')
    ap.add_argument('--hwdecode', action='store_true',
                    help="decode the camera clip with the Mac's VideoToolbox (faster for long 4K clips; matched "
                         'software decoding exactly on a 10-bit HLG test clip, not tried on Dolby Vision)')
    ap.add_argument('--verbose', action='store_true', help='print every ffmpeg command it runs')
    a = ap.parse_args(argv)
    if not a.analyze_only and not a.out:
        ap.error('--out is required (or use --analyze-only)')
    for name in ('split', 'app_focus', 'camera_focus'):
        v = getattr(a, name)
        lo, hi = (0.1, 0.9) if name == 'split' else (0.0, 1.0)
        if not lo <= v <= hi:
            ap.error(f'--{name.replace("_", "-")} must be between {lo} and {hi}')
    if not 1 <= a.fps <= 240:
        ap.error('--fps must be between 1 and 240')
    if a.max_mb is not None and a.max_mb <= 0:
        ap.error('--max-mb must be positive')
    offs = []
    for o in a.offset or []:
        if o.lower() == 'auto':
            offs.append(None)
            continue
        v = _f(o)
        if v is None:
            ap.error(f'--offset {o}: not a number of seconds')
        offs.append(v)
    if len(offs) > len(a.camera):
        ap.error('more --offset values than --camera clips')
    a.offsets = offs + [None] * (len(a.camera) - len(offs))
    a.trim_range = (None, None)
    if a.trim:
        if ':' not in a.trim:
            ap.error('--trim wants START:END in take seconds, e.g. 12:75, 12: or :75')
        s, e = a.trim.split(':', 1)
        ts, te = (_f(s) if s.strip() else None), (_f(e) if e.strip() else None)
        if (s.strip() and ts is None) or (e.strip() and te is None) or (ts is not None and te is not None and te <= ts):
            ap.error(f'--trim {a.trim}: not a valid START:END range')
        a.trim_range = (ts, te)
    return a


def output_name(out, i, n, preview):
    base, ext = os.path.splitext(out)
    ext = ext or '.mp4'
    if n > 1:
        base += f'-{i + 1}'
    if preview:
        base += '-preview'
    return base + ext


def main(argv):
    global FFMPEG, FFPROBE, QUIET_JSON, VERBOSE
    args = parse_args(argv)
    QUIET_JSON = args.analyze_only
    VERBOSE = args.verbose
    FFMPEG, FFPROBE = find_tool('ffmpeg'), find_tool('ffprobe')
    if not FFMPEG or not FFPROBE:
        die('ffmpeg and ffprobe are needed and were not found on PATH or in /opt/homebrew/bin.\n'
            '  Install them with:  brew install ffmpeg')
    app = Media(args.app)
    sidecar = load_sidecar(args.app)
    model = sound_model(sidecar, args.latency_ms, args.app)
    lat_ms, lat_src = model['latency_ms'], model['latency_source']
    corr_s = model['correction_ms'] / 1000.0
    song = ((sidecar or {}).get('song') or {}).get('title') if isinstance((sidecar or {}).get('song'), dict) else None
    say(f'Take: {app.name}  ({app.describe()})' + (f'  song "{song}"' if song else '')
        + (f'  sidecar: outputLatencyMs {lat_ms:g}' if lat_src == 'sidecar outputLatencyMs' else ''))
    for n in model['notes']:
        warn(n)
    if app.video is None:
        warn('the take has no picture; only the camera will be shown')
    cams = [Media(c) for c in args.camera]
    for c in cams:
        if c.video is None:
            die(f'{c.path}: has no picture')
    if args.out:
        for m in [app] + cams:
            for i in range(len(cams)):
                if os.path.realpath(output_name(args.out, i, len(cams), args.preview)) == os.path.realpath(m.path):
                    die(f'--out would overwrite the input {m.path}')
    xa = None
    if any(o is None for o in args.offsets):
        if app.audio is None:
            die(f'{app.path} has no sound, so there is nothing to listen for; give --offset by hand')
        xa = decode_audio(app)
    audio_mode = args.audio or ('app' if (sidecar or app.name.lower().startswith('keylight-take')) else 'camera')

    results = []
    for i, cam in enumerate(cams):
        say(f'Camera {i + 1}: {cam.name}  ({cam.describe()})')
        manual = args.offsets[i]
        if manual is not None:
            r = {'ok': True, 'method': 'manual', 'offset': manual, 'audio_offset': manual + corr_s}
        elif cam.audio is None:
            r = {'ok': False, 'method': 'audio', 'why': 'the camera clip has no sound'}
        else:
            r = analyse(xa, decode_audio(cam), args.min_confidence)
            r['method'] = 'audio'
            if 'audio_offset' in r:
                # From the sound match to the picture offset.  Say a key lights up in the take's
                # picture at take time t.  The Mac's speakers play its sound L ms later (the
                # output latency), so the phone, whose picture shows the finger going down at
                # camera time t + offset, hears it at  t + offset + L.  The take's file holds that
                # sound at  t + S,  where S is how the file was laid out (sound_model): Keylight's
                # recorder moves its tracks so that S = L; its raw files have S = pipeline + first
                # frame; a take whose sound was captured with its picture has S = 0.  Matching
                # the sounds finds  audio_offset = (t + offset + L) - (t + S),  so
                #     offset = audio_offset - (L - S).
                # For the recorder's own files that is the sound match as it is; for a take with
                # S = 0 the picture sits L ms earlier than the matched point.  (A screen
                # recording made with the MacBook microphone heard the speakers just as the phone
                # did, so without a sidecar both are 0.)  scripts/test-sync-take.py checks each
                # layout against the pictures (white flashes), not against this formula.
                r['offset'] = r['audio_offset'] - corr_s
        r['path'] = cam.path
        r['latency_ms'] = lat_ms
        r['latency_source'] = lat_src
        r['take_sound_delay_ms'] = model['take_sound_delay_ms']
        r['take_sound_source'] = model['take_sound_source']
        r['correction_ms'] = model['correction_ms']
        if 'offset' in r:
            off = r['offset']
            t0 = max(0.0, -off)
            t1 = min(app.dur if app.video is not None else (app.a_end or 0.0), cam.dur - off)
            r['overlap'] = {'take_start': round(t0, 4), 'take_end': round(t1, 4),
                            'camera_start': round(t0 + off, 4), 'camera_end': round(t1 + off, 4),
                            'duration': round(max(0.0, t1 - t0), 4)}
            if t1 - t0 < 0.5 and r['ok']:
                r['ok'] = False
                r['why'] = 'with this offset the two recordings do not overlap'
        r['video'] = {'width': int(cam.dw), 'height': int(cam.dh), 'rotation': cam.rotation,
                      'fps': round(cam.fps, 3), 'hdr': cam.hdr, 'dolby_vision': bool(cam.dovi)}
        if cam.hdr:
            r['video']['tonemap'] = hdr_path(args.tonemap)
        print_result(r)
        results.append(r)

    if args.analyze_only:
        doc = {'app': {'path': app.path, 'duration': round(app.dur, 4), 'sidecar': bool(sidecar),
                       'song': song, 'latency_ms': lat_ms, 'latency_source': lat_src,
                       'take_sound_delay_ms': model['take_sound_delay_ms'],
                       'take_sound_source': model['take_sound_source'],
                       'correction_ms': model['correction_ms']},
               'convention': 'camera_time = take_time + offset (seconds); positive = the phone started first',
               'cameras': [_jsonable(r) for r in results]}
        print(json.dumps(doc, indent=2))
        return EXIT_REFUSED if not all(r['ok'] for r in results) else 0

    if app.hdr:
        hdr_path(args.tonemap)
    empty = 0
    for i, (cam, r) in enumerate(zip(cams, results)):
        if not r['ok']:
            continue
        ov = r['overlap']
        t0, t1 = ov['take_start'], ov['take_end']
        ts, te = args.trim_range
        if ts is not None:
            t0 = max(t0, ts)
        if te is not None:
            t1 = min(t1, te)
        if args.preview:
            t1 = min(t1, t0 + 10.0)
        if t1 - t0 < 0.1:
            print(f'sync-take: {cam.name}: --trim {args.trim} leaves nothing of the time both recordings cover '
                  f'(take {ov["take_start"]:.2f}-{ov["take_end"]:.2f} s); nothing rendered', file=sys.stderr)
            empty += 1
            continue
        fps_frac = Fraction(args.fps).limit_denominator(1001)
        job = {
            'args': args, 'app': app, 'cam': cam, 'layout': args.layout, 'audio': audio_mode,
            'D': t1 - t0, 'app_ss': t0, 'cam_ss': max(0.0, t0 + r['offset']), 'cam_sound_s': corr_s,
            'fps': f'{fps_frac.numerator}/{fps_frac.denominator}', 'fps_f': float(fps_frac),
            'tm_app': hdr_path(args.tonemap) if app.hdr else 'sdr',
            'tm_cam': hdr_path(args.tonemap) if cam.hdr else 'sdr',
            'out': output_name(args.out, i, len(cams), args.preview),
        }
        if cam.hdr:
            if job['tm_cam'] == 'none':
                warn(f'{cam.name} is HDR but this ffmpeg has no tone mapper (zscale, libplacebo or FFmpeg 8 '
                     'swscale); its colours will look flat and grey')
            if cam.dovi and int(_f(cam.dovi.get('dv_profile'), 0) or 0) == 5:
                warn(f'{cam.name} is Dolby Vision profile 5, which ffmpeg cannot show correctly; colours will be off')
        os.makedirs(os.path.dirname(os.path.abspath(job['out'])), exist_ok=True)
        say(f"Rendering {cam.name} -> {job['out']}  ({args.layout}, take {t0:.3f}-{t1:.3f} s, "
            f"audio: {audio_mode})")
        render(job)
        say(f"  wrote {job['out']}: {check_output(job['out'])}")
    if not all(r['ok'] for r in results):
        return EXIT_REFUSED
    return 1 if empty else 0


def _jsonable(r):
    out = {}
    for k, v in r.items():
        if isinstance(v, (np.floating, float)):
            out[k] = round(float(v), 6)
        elif isinstance(v, np.integer):
            out[k] = int(v)
        else:
            out[k] = v
    return out


def print_result(r):
    if not r['ok'] and r.get('method') == 'audio':
        if 'confidence' in r:
            say(f"  confidence  {r['confidence']:.2f}, waveform lock {r['lock']:.0f} ({r['lock_ratio']:.1f}x the next "
                f"candidate)")
        print(f"  REFUSED {os.path.basename(r['path'])}: {r.get('why', 'no confident sync')}.\n"
              "  Check that the phone could hear the Mac's speakers during the take, or give the offset by hand:\n"
              '    --offset SECONDS   (camera time = take time + SECONDS; positive = the phone started first)',
              file=sys.stderr, flush=True)
        return
    if 'offset' in r:
        off = r['offset']
        when = (f'the phone started {off:.3f} s before the take' if off >= 0
                else f'the phone started {-off:.3f} s after the take')
        say(f'  offset      {off:+.4f} s   camera time = take time + offset ({when})')
    if r.get('method') == 'manual':
        say('  (manual --offset, no listening)')
    else:
        if 'confidence' in r:
            say(f"  confidence  {r['confidence']:.2f}   (this match vs. the best match elsewhere in the clip)")
            say(f"  waveform    lock {r['lock']:.0f}, {r['lock_ratio']:.1f}x the next candidate"
                + (f"; accepted on: {r['decided_by']}" if r.get('decided_by') else ''))
        if r.get('refined'):
            drift = r.get('drift_ms')
            steps = r.get('steps') or []
            say(f"  fine sync   {r['windows']} of {r['windows_with_sound']} stretches agree within {AGREE_MS:g} ms "
                + (f"in {len(steps) + 1} parts " if steps else '')
                + f"(average spread {r['spread_ms']:.2f} ms)"
                + (f', clock drift {drift:+.1f} ms over the clip' if drift and abs(drift) >= 0.05 else ''))
            if steps:
                jumps = ', '.join(f"{s['ms']:+.1f} ms near take {s['take_time']:.1f} s" for s in steps)
                say(f"  jumps       the phone's sound jumped against the take's: {jumps}")
                warn(f"the phone's sound jumped against the take's during the clip ({jumps}), probably a "
                     "glitch in the Mac's sound output. The offset is from the part before the first jump; a "
                     "glitch moves sound, not pictures, so the two pictures stay in step, but after the jump "
                     f"the sound can be up to {r.get('step_max_ms', 0):.0f} ms off them")
            if drift and abs(drift) > 17:
                warn(f'the phone and Mac clocks drift {drift:+.0f} ms over the clip; the ends can be a frame off')
        elif 'audio_offset' in r:
            warn('could not lock onto the waveform; the offset is from the onset envelope only (about +/-10 ms)')
        if 'audio_offset' in r and (r.get('latency_ms') or r.get('take_sound_delay_ms')):
            lat, dly, corr = r['latency_ms'], r['take_sound_delay_ms'], r['correction_ms']
            say(f"  latency     sound matched at {r['audio_offset']:+.4f} s; the speakers played it {lat:g} ms after "
                f"the key lit ({r['latency_source']}), the take's file holds it {dly:g} ms after")
            say(f"              ({r['take_sound_source']}), so "
                + (f"the match is the picture offset as it is" if abs(corr) < 0.05 else
                   f"the picture offset is the match {'minus' if corr > 0 else 'plus'} {abs(corr):g} ms"))
    if 'overlap' in r:
        o = r['overlap']
        say(f"  overlap     take {o['take_start']:.3f}-{o['take_end']:.3f} s = camera {o['camera_start']:.3f}-"
            f"{o['camera_end']:.3f} s ({o['duration']:.2f} s)")
    if not r['ok']:
        print(f"  REFUSED {os.path.basename(r['path'])}: {r.get('why', 'no confident sync')}.\n"
              "  Check that the phone could hear the Mac's speakers during the take, or give the offset by hand:\n"
              '    --offset SECONDS   (camera time = take time + SECONDS; positive = the phone started first)',
              file=sys.stderr, flush=True)


if __name__ == '__main__':
    try:
        sys.exit(main(sys.argv[1:]))
    except Fatal as e:
        print(f'sync-take: {e}', file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        sys.exit(130)
