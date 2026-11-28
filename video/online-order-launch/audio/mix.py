# «جديدنا!» v2 soundtrack: «Upbeat Jazz» (Mixkit) cut so its drop lands on the picture's drop (2.6s), plus Mixkit effects on
# every visual hit, effects-keyed ducking on the music, bus compression, limiting and a -14 LUFS / -1 dBTP master.
# usage: bash audio/get_mixkit.sh && /root/.studio/bin/python audio/mix.py
import json, os, subprocess
import numpy as np, pyloudnorm as pyln, soundfile as sf, librosa
from pedalboard import Pedalboard, Compressor, HighpassFilter, LowShelfFilter

HERE = os.path.dirname(os.path.abspath(__file__)); SR = 48000
TM = json.load(open(os.path.join(HERE, '../src/timing.json')))
B, DROP, TOTAL = TM['beat'], TM['drop'], TM['duration']
b = lambda n: DROP + n * B

def load(p, ss=0, t=None):
    cmd = ['ffmpeg', '-nostdin', '-loglevel', 'error', '-ss', str(ss)] + (['-t', str(t)] if t else []) + ['-i', p, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-']
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float32).reshape(-1, 2).copy()
def trim(x, db=-40):
    a = np.abs(x).max(1); i = int(np.argmax(a > a.max() * 10 ** (db / 20))); return x[max(0, i - int(SR * .003)):]
def fade(x, a=.004, r=.05):
    x = x.copy(); n = len(x); ka, kr = min(n, int(SR * a)), min(n, int(SR * r))
    x[:ka] *= np.linspace(0, 1, ka)[:, None]; x[n - kr:] *= np.linspace(1, 0, kr)[:, None]; return x
def rms(x, target=-18): return x * (10 ** (target / 20) / (np.sqrt(np.mean(x ** 2)) + 1e-9))
def peak_t(x): e = np.convolve(np.abs(x).max(1), np.ones(480) / 480, 'same'); return int(np.argmax(e)) / SR

rows = [l.rstrip('\n').split('\t') for l in open(os.path.join(HERE, 'mixkit_sources.tsv'), encoding='utf8') if l.strip() and not l.startswith('#')]
S = {}
for name, mid, _t, ext in rows:
    x = trim(load(os.path.join(HERE, 'mixkit', f'{mid}.{ext}')))
    if name == 'drumroll': x = fade(x[:int(SR * 2.3)], .5, .03)
    if name == 'cheer': x = fade(x[:int(SR * 2.5)], .02, 1.0)
    if name == 'logo': x = fade(x[:int(SR * 3.2)], .002, 1.0)
    if name == 'fry': x = fade(x[int(SR * 6):int(SR * 9)], .3, .6)
    if name == 'transmit': x = fade(x, .01, .3)
    S[name] = fade(rms(x), .002, .03)
for i in range(8):
    S[f'tick{i}'] = fade(librosa.effects.pitch_shift(S['hardpop'].T.copy(), sr=SR, n_steps=i * 1.5).T, .001, .03)
ALIGN = {'whoosh': .25, 'swoosh': .12, 'whip': .12, 'transmit': 1.2}  # these peak ON the cue; everything else starts on it
GAIN = dict(impact=.75, logo=.7, whoosh=.42, swoosh=.36, whip=.42, reveal=.32, pop=.42, hardpop=.45, tap=.5, cart=.5, focus=.32, confirm=.5, deep=.7,
            notify=.5, chime=.42, uiok=.5, hit=.42, sparkle=.35, drumroll=.55, horn=.5, cheer=.32, bell=.4, done=.45, transmit=.5, box=.6, fry=.3, scroll=.32,
            **{f'tick{i}': .3 for i in range(8)})
dr = len(S['drumroll']) / SR
AT = dict(transmit=b(24), branch=b(30), kitchen=b(38), hero=b(46)); LEN = 2 * B
SENT = b(22) + .05
REEL = json.load(open(os.path.join(HERE, '../../online-order-reel/audio/cues.json')))
def from_reel(a, z, at):  # the original reel's cues for one scene, moved to where that scene starts here
    return [(n, at + (t - a)) for n, t in REEL if a <= t < z]
CUES = [
    # teaser: «عنّا خبر حلو…» «جاهزين؟» and a drum roll into the drop
    ('pop', .04), ('pop', b(-4)), ('pop', b(-3)), ('hardpop', b(-2)), ('hit', b(-1)), ('drumroll', b(0) - dr),
    # the drop: «جديدنا!» with confetti, horn and a cheer; «صار فيك تطلب أونلاين!»; the phone spins in
    ('impact', b(0)), ('deep', b(0)), ('horn', b(0)), ('cheer', b(0) + .05), ('sparkle', b(0) + .45), ('pop', b(2)),
    ('whoosh', b(4)), ('hardpop', b(4.5)), ('sparkle', b(5)), ('whoosh', b(6.6)), ('reveal', b(6)),
    # the studio wipe and the real order: a sticker per step, a tap per press, a pop per sheet
    ('swoosh', b(8)), ('scroll', b(8.4)),
    *[('hardpop', a) for a in [b(8), b(10), b(12), b(16), b(18), b(20)]],
    *[('tap', a) for a in [b(10), b(12), b(16), b(17), b(18), b(20), b(22) - .1]],
    ('pop', b(10) + .1), ('focus', b(11) + .1), ('pop', b(12) + .25), *[(f'tick{i}', b(13) + i * .136) for i in range(8)], ('hit', b(15)), ('confirm', b(15) + .05),
    ('cart', b(16) + .1), ('pop', b(17) + .1), ('pop', b(18.5)), ('pop', b(19)), ('pop', b(19.5)), ('pop', b(20) + .1),
    ('notify', b(20.5)), *[('tap', b(21) + .1 + i * .07) for i in range(5)], ('uiok', b(21.5)),
    ('whoosh', SENT), ('sparkle', SENT), ('chime', SENT + .1),
    # the original reel's sound design for the branch hand-off, the branch, the kitchen and the hero shot
    *from_reel(12.5, 15.5, AT['transmit']), *from_reel(15.5, 19.5, AT['branch']),
    ('fry', AT['kitchen']), ('hit', AT['kitchen']), *[('whip', AT['kitchen'] + i * LEN) for i in (1, 2, 3)], *[('hit', AT['kitchen'] + i * LEN) for i in (1, 2, 3)], ('box', AT['kitchen'] + 3 * LEN + .35),
    *from_reel(23.5, 28, AT['hero']), ('horn', AT['hero'] + 1.5), ('cheer', AT['hero'] + 1.55), ('hardpop', AT['hero'] + 2.05),
]
n = int(SR * TOTAL); fx = np.zeros((n + SR * 6, 2), np.float32)
for name, at in CUES:
    x = S[name] * GAIN[name]
    if name in ALIGN: at = at + ALIGN[name] - peak_t(x)
    a = max(0, int(SR * at)); fx[a:a + len(x)] += x[:len(fx) - a]
fx = fx[:n]

# music: cut so its drop (10.118s in the track) lands on the picture's drop
mus = load(os.path.join(HERE, 'music', f"{TM['musicId']}.mp3"), ss=TM['musicOffset'], t=TOTAL + .5)[:n]
mus = np.pad(mus, ((0, n - len(mus)), (0, 0)))
mus = rms(mus, -19) * .9
mus[:int(SR * .08)] *= np.linspace(0, 1, int(SR * .08))[:, None]
f0, f1 = int(SR * (TOTAL - 1.4)), n; mus[f0:f1] *= np.linspace(1, 0, f1 - f0)[:, None] ** 1.6
# ducking: the music dips (up to ~5 dB) under loud effects, with a fast attack and a 250 ms release
env = np.abs(fx).max(1)
win = np.ones(int(SR * .02)) / int(SR * .02); env = np.convolve(env, win, 'same')
rel = np.exp(-1 / (SR * .25)); sm = np.empty_like(env); cur = 0.0
for i, v in enumerate(env):
    cur = v if v > cur else cur * rel + v * (1 - rel); sm[i] = cur
duck = 1 - .45 * np.clip(sm / .35, 0, 1)
mix = mus * duck[:, None] + fx

board = Pedalboard([HighpassFilter(28), LowShelfFilter(cutoff_frequency_hz=90, gain_db=1.5), Compressor(threshold_db=-16, ratio=2.5, attack_ms=12, release_ms=160)])
mix = board(mix.T.astype(np.float32), SR).T
meter = pyln.Meter(SR)
mix = pyln.normalize.loudness(mix, meter.integrated_loudness(mix), -15.0)
mix = mix / max(1.0, np.abs(mix).max() / .98)
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True); pre = os.path.join(HERE, 'out', 'premaster.wav'); sf.write(pre, mix, SR, subtype='FLOAT')
# master: true-peak-aware loudness normalisation (oversampled limiter) to the social target
out = os.path.join(HERE, '../public/audio.wav')
subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-y', '-i', pre, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=7,afade=t=out:st=%.2f:d=0.05' % (TOTAL - .05),
                '-ar', str(SR), '-c:a', 'pcm_s24le', out], check=True)
print('master ->', out)
