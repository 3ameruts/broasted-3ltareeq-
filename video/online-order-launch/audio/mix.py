# «جديدنا!» v3 soundtrack: «Upbeat Jazz» (Mixkit) cut so its drop lands on the picture's drop (2.6s), plus Mixkit effects on
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
    if name in ('positive', 'bells'): x = fade(x[:int(SR * 1.6)], .002, .5)
    if name == 'fallwhistle': x = fade(x[:int(SR * 1.3)], .002, .3)
    S[name] = fade(rms(x), .002, .03)
for i in range(8):
    S[f'tick{i}'] = fade(librosa.effects.pitch_shift(S['hardpop'].T.copy(), sr=SR, n_steps=i * 1.5).T, .001, .03)
ALIGN = {'whoosh': .25, 'swoosh': .12, 'whip': .12, 'transmit': 1.2}  # these peak ON the cue; everything else starts on it
GAIN = dict(impact=.75, logo=.7, whoosh=.42, swoosh=.36, whip=.42, reveal=.32, pop=.42, hardpop=.45, tap=.5, cart=.5, focus=.32, confirm=.5, deep=.7,
            notify=.5, chime=.42, uiok=.5, hit=.42, sparkle=.35, drumroll=.55, horn=.5, cheer=.3, bell=.4, done=.45, transmit=.5, box=.6, fry=.3, scroll=.32,
            whistle=.32, longpop=.42, sillypop=.4, coin=.38, positive=.45, jump=.3, slide=.36, bubbles=.38, fallwhistle=.3, bells=.35, crunch=.8,
            **{f'tick{i}': .3 for i in range(8)})
dr = len(S['drumroll']) / SR
AT = dict(transmit=b(41), branch=b(44), kitchen=b(50), hero=b(56), end=b(60)); LEN = 2 * B
SP = dict(transmit=3 / (b(44) - b(41)), branch=4.36 / (b(50) - b(44)))
SENT = b(39) + .05
REEL = json.load(open(os.path.join(HERE, '../../online-order-reel/audio/cues.json')))
def from_reel(a, z, at, speed=1.0, until=99):  # the original reel's cues for one scene, moved (and sped up) to where it plays here
    return [(n, at + (t - a) / speed) for n, t in REEL if a <= t < z and (t - a) / speed < until]
CUES = [
    # teaser: «عنّا خبر حلو…» «جاهزين؟», the mascot pops up, a drum roll into the drop
    ('pop', .04), ('pop', b(-4)), ('pop', b(-3)), ('hardpop', b(-2)), ('whistle', b(-2) + .25), ('jump', b(-1) - .05), ('drumroll', b(0) - dr),
    # the drop: «جديدنا!» + confetti + horn + cheer; the mascot hops on the beat
    ('impact', b(0)), ('deep', b(0)), ('horn', b(0)), ('cheer', b(0) + .05), ('sparkle', b(0) + .45), ('pop', b(2)), *[('jump', b(n) - .05) for n in (1, 3, 5, 7)],
    # «صار فيك تطلب أونلاين!» with a strong hit, the broasted zooms in
    ('impact', b(4)), ('whoosh', b(4)), ('sillypop', b(4) + .1), ('hardpop', b(4.5)), ('sparkle', b(5)),
    # cream studio: logo slam + ring, meals burst, «وجبتك المفضلة… صارت أقرب!», the phone flies up, the 3 chips
    ('slide', b(8) - .1), ('logo', b(8) + .05), ('bubbles', b(8) + .35), ('whoosh', b(10)), ('pop', b(10) + .2), ('bells', b(11)),
    ('whoosh', b(12)), ('pop', b(12.5)), ('pop', b(13.5)), ('coin', b(14.5)), ('swoosh', b(18)),
    # the real order: a sticker per step, a tap per press, a pop per sheet; the mascot's comments
    ('scroll', b(18.6)), *[('longpop', a) for a in [b(18), b(22), b(25), b(30), b(33), b(36)]],
    *[('tap', a) for a in [b(22), b(25), b(30), b(31.5), b(33), b(36), b(39) - .1]],
    *[('bubbles', a) for a in [b(19), b(26), b(33.6), b(37)]], *[('jump', a - .05) for a in [b(18.3), b(25.5), b(28), b(30), b(33), b(36.6)]],
    ('pop', b(22) + .1), ('focus', b(23.5) + .1), ('pop', b(25) + .25), *[(f'tick{i}', b(26) + i * .136) for i in range(8)], ('hit', b(28)), ('confirm', b(28) + .05),
    ('cart', b(30) + .1), ('pop', b(31.5) + .1), ('pop', b(33) + .1), ('pop', b(36) + .1),
    ('notify', b(36.6)), *[('tap', b(37.4) + i * .08) for i in range(6)], ('uiok', b(38)),
    # sent: the celebration (the first video's «احتفال ألوان وصوت نجاح»)
    ('whoosh', SENT), ('positive', SENT), ('sillypop', SENT + .05), ('cheer', SENT + .1), ('jump', b(39.2) - .05), ('jump', b(39.7) - .05),
    # the original reel's sound for the hand-off to the branch and the branch (sped up like the picture)
    *from_reel(12.5, 15.5, AT['transmit'], SP['transmit']), *from_reel(15.5, 19.5, AT['branch'], SP['branch']),
    # kitchen: whips on the cuts, a crunch, the sizzle
    ('fry', AT['kitchen']), ('hit', AT['kitchen']), ('crunch', AT['kitchen'] + .15), *[('whip', AT['kitchen'] + i * LEN) for i in (1, 2)], *[('hit', AT['kitchen'] + i * LEN) for i in (1, 2)],
    ('box', AT['kitchen'] + 2 * LEN + .35),
    # hero shot (the reel's, up to the cut)
    *[c for c in from_reel(23.5, 28, AT['hero'], 1, until=b(60) - b(56)) if c[0] not in ('logo', 'hit')],
    # final card
    ('impact', AT['end']), ('horn', AT['end']), ('cheer', AT['end'] + .05), ('hardpop', AT['end'] + .55), ('pop', b(60.5)), ('pop', b(61.5)), ('sparkle', b(61.5) + .5),
    ('coin', b(62.5)), ('whistle', b(62)), ('bubbles', b(62.5)), ('pop', b(63.5)), *[('longpop', b(n)) for n in (63, 63.5, 64)], ('jump', b(63) - .05), ('done', b(65) + .3),
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
