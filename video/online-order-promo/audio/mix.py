# The promo's soundtrack: «Arab Nights» (Mixkit) cut so its drop lands on the picture's drop (2.4s), plus Mixkit effects on
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
    if name == 'fry': x = fade(x[int(SR * 6):int(SR * 9)], .3, .6)
    if name == 'logo': x = fade(x[:int(SR * 3.2)], .002, 1.0)
    if name == 'chip': x = fade(x[:int(SR * .45)], .002, .08)
    S[name] = fade(rms(x), .002, .03)
# rising ticks for the 8 pieces that turn hot
for i in range(8):
    S[f'tick{i}'] = fade(librosa.effects.pitch_shift(S['hardpop'].T.copy(), sr=SR, n_steps=i * 1.5).T, .001, .03)

ALIGN = {'whoosh': .25, 'swoosh': .12, 'whip': .12}  # these peak ON the cue; everything else starts on it
GAIN = dict(impact=.75, logo=.7, whoosh=.42, swoosh=.36, whip=.42, reveal=.32, pop=.42, hardpop=.42, scroll=.3, tap=.5, cart=.5, focus=.32,
            confirm=.5, deep=.75, notify=.5, chime=.42, uiok=.5, fry=.3, hit=.42, sparkle=.35, crunch=.95, chip=.45, **{f'tick{i}': .3 for i in range(8)})
flip0 = b(16) + .32
CUES = [
    # hook: sizzle, the slam, the BITE, the riser into the drop
    ('fry', 0), ('whoosh', b(-3)), ('deep', b(-3)), ('crunch', 1.453), ('chip', 1.47), ('reveal', 1.85), ('impact', b(0)), ('swoosh', b(0)),
    # «اطلب أونلاين», the phone rises, «3 خطوات»
    ('hardpop', b(2)), ('pop', b(2.5)), ('sparkle', b(3)), ('whoosh', b(4)), ('pop', b(5)),
    # step 1
    ('swoosh', b(8)), ('scroll', 7.75), ('tap', 9.1), ('pop', 9.3),
    # step 2: hot or regular, then split
    ('swoosh', b(12)), ('focus', 10.25), ('tap', b(14)), ('pop', b(14) + .16),
    ('whoosh', b(16)), *[(f'tick{i}', flip0 + i * .158) for i in range(8)], ('hit', b(18.5)), ('confirm', b(18.5) + .05),
    # step 3: confirm + the code
    ('swoosh', b(20)), ('tap', b(20) + .42), ('pop', b(20) + .6), *[('tap', 15.97 + i * .06) for i in range(5)], ('tap', b(22) + .33), ('uiok', b(23)),
    # step 4: tracking notifications
    ('swoosh', b(24)), ('notify', b(24) + .32), ('cart', b(25) + .32), ('chime', b(26) + .32),
    # food montage: whips on the cuts, punches on the off-beats, a crunch on «مقرمش»
    ('whip', b(28)), ('impact', b(28)), ('crunch', b(28) + .12), ('fry', b(28)), ('whip', b(30)), ('whip', b(32)), ('whip', b(34)),
    ('hit', b(29)), ('hit', b(31)), ('hit', b(33)), ('hit', b(35)),
    # end card: the logo draws, fills, «اطلب هلأ!», the link is tapped
    ('sparkle', b(36)), ('reveal', b(36)), ('logo', b(37.5)), ('deep', b(37.5)), ('hardpop', b(38)), ('pop', b(39)), ('chime', b(40)), ('tap', b(40.5)),
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
f0, f1 = int(SR * 28.4), n; mus[f0:f1] *= np.linspace(1, 0, f1 - f0)[:, None] ** 1.6
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
