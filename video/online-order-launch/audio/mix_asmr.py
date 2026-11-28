# «جديدنا!» — the ASMR cut: the same picture told only with FOOD sounds (no music, no instruments, no musical tones).
# Hot oil sizzles under the whole video; words and stickers land as crunchy bites; «جاهزين؟» is a can opening; the reveal is
# one huge crunch + «mmm»; the order being sent is a soda pour + «aah»; the branch prints the ticket (synthesized printer);
# the kitchen chops, fries and crunches; the end is a pour, a bite and a happy hum.
# usage: bash audio/get_asmr.sh && /root/.studio/bin/python audio/mix_asmr.py   → public/audio-asmr.wav
import json, os, subprocess
import numpy as np, pyloudnorm as pyln, soundfile as sf, librosa
from pedalboard import Pedalboard, Compressor, HighpassFilter, HighShelfFilter

HERE = os.path.dirname(os.path.abspath(__file__)); SR = 48000
TM = json.load(open(os.path.join(HERE, '../src/timing.json')))
B, DROP, TOTAL = TM['beat'], TM['drop'], TM['duration']
b = lambda n: DROP + n * B

def load(p):
    cmd = ['ffmpeg', '-nostdin', '-loglevel', 'error', '-i', p, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-']
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float32).reshape(-1, 2).copy()
def trim(x, db=-40):
    a = np.abs(x).max(1); i = int(np.argmax(a > a.max() * 10 ** (db / 20))); return x[max(0, i - int(SR * .003)):]
def fade(x, a=.004, r=.05):
    x = x.copy(); n = len(x); ka, kr = min(n, int(SR * a)), min(n, int(SR * r))
    x[:ka] *= np.linspace(0, 1, ka)[:, None]; x[n - kr:] *= np.linspace(1, 0, kr)[:, None]; return x
def cut(x, a, z): return x[int(SR * a):int(SR * z)]
def rms(x, target=-18): return x * (10 ** (target / 20) / (np.sqrt(np.mean(x ** 2)) + 1e-9))
def peak_t(x): e = np.convolve(np.abs(x).max(1), np.ones(480) / 480, 'same'); return int(np.argmax(e)) / SR

def table(f):
    return {r[0]: r for r in (l.rstrip('\n').split('\t') for l in open(os.path.join(HERE, f), encoding='utf8') if l.strip() and not l.startswith('#'))}
SRC = {**table('sfx_sources.tsv'), **table('asmr_sources.tsv')}
def raw(name): _, mid, _t, ext = SRC[name]; return load(os.path.join(HERE, 'mixkit', f'{mid}.{ext}'))

S = {}
for name in ['impact', 'deep', 'whoosh', 'swoosh', 'whip', 'pop', 'hardpop', 'tap', 'scroll', 'hit', 'crunch', 'box', 'transmit', 'laugh', 'kiss', 'paperslide', 'paperflick', 'chop', 'jump', 'sparkle', 'bubbles']:
    S[name] = fade(rms(trim(raw(name))), .002, .03)
S['juicy'] = fade(rms(trim(raw('juicy'))), .002, .05)
S['mmm'] = fade(rms(trim(raw('mmm'))), .01, .1)
S['aah'] = fade(rms(trim(raw('aah'))), .01, .15)
S['canopen'] = fade(rms(trim(raw('canopen'))), .002, .1)
S['soda'] = fade(rms(cut(trim(raw('soda')), 0, 2.2)), .05, .5)
S['pourice'] = fade(rms(cut(trim(raw('pourice')), 0, 2.0)), .02, .5)
S['slurp'] = fade(rms(trim(raw('slurp'))), .01, .1)
S['knife'] = fade(rms(cut(trim(raw('knife')), 0, 1.4)), .01, .3)
S['crinkle'] = fade(rms(cut(trim(raw('crinkle')), 0, .45)), .005, .1)
S['crumple'] = fade(rms(trim(raw('crumple'))), .005, .1)

# a bank of single, crisp bites cut out of the eating recordings (strongest onsets), used for every «crunch» hit
bank = []
for src in ['bite', 'cookies', 'chips', 'eat']:
    x = raw(src); mono = x.mean(1)
    on = librosa.onset.onset_detect(y=librosa.resample(mono, orig_sr=SR, target_sr=22050), sr=22050, units='time', backtrack=True)
    for t0 in on:
        seg = x[int(SR * max(0, t0 - .005)):int(SR * (t0 + .24))]
        if len(seg) > SR * .2: bank.append((float(np.abs(seg).max()), fade(rms(seg, -16), .002, .06)))
bank = [s for _, s in sorted(bank, key=lambda v: -v[0])[:18]]
for i, s in enumerate(bank): S[f'c{i}'] = s
def C(i): return f'c{i % len(bank)}'
# the huge reveal crunch: three bites stacked + the short «crunch» + a low thump
big = np.zeros((int(SR * .5), 2), np.float32)
for k, s in enumerate([bank[0], bank[1], S['crunch'][:int(SR * .4)], bank[2]]): big[int(SR * .012 * k):int(SR * .012 * k) + len(s)] += s[:len(big) - int(SR * .012 * k)]
S['bigcrunch'] = fade(rms(big, -14), .001, .1)

# a ticket printer at the branch, synthesized: stepper-motor clicks + paper feed, then a tear
def printer():
    rng = np.random.default_rng(3); n = int(SR * 1.15); t = np.arange(n) / SR
    clicks = np.zeros(n)
    for c in np.arange(0, .95, 1 / 110): i = int(SR * c); clicks[i:i + 40] += np.hanning(40) * (.6 + .4 * rng.random())
    noise = rng.normal(0, 1, n); feed = np.convolve(noise, np.ones(6) / 6, 'same') * .18 * (t < .95)
    y = np.convolve(clicks, rng.normal(0, 1, 120) * np.hanning(120), 'same') * .5 + feed
    tear = rng.normal(0, 1, int(SR * .14)) * np.linspace(1, 0, int(SR * .14)) ** 2 * .9; y[int(SR * 1.0):int(SR * 1.0) + len(tear)] += tear
    return fade(rms(np.stack([y, y], 1).astype(np.float32), -20), .005, .05)
S['printer'] = printer()
# the phone buzz (two motor rattles, no pitch)
def buzz():
    t = np.arange(int(SR * .5)) / SR; rng = np.random.default_rng(7)
    motor = np.sign(np.sin(2 * np.pi * 155 * t + rng.normal(0, .35, len(t)).cumsum() * .02)); rattle = .55 + .45 * np.sign(np.sin(2 * np.pi * 31 * t))
    env = np.convolve(((t < .17) | ((t > .26) & (t < .43))).astype(float), np.ones(240) / 240, 'same')
    y = np.convolve(motor * rattle * env * .5 + rng.normal(0, .04, len(t)) * env, np.ones(18) / 18, 'same')
    return fade(rms(np.stack([y, y], 1).astype(np.float32), -20), .002, .03)
S['buzz'] = buzz()
# the hot-oil bed under everything (looped with crossfades), and a louder sizzle swell for the kitchen
oil = rms(cut(raw('oil'), 2, 30), -18); L = int(SR * (TOTAL + 1)); xf = int(SR * 1.0); bed = np.zeros((L, 2), np.float32); pos = 0
while pos < L:
    seg = fade(oil, 1.0, 1.0); m = min(len(seg), L - pos); bed[pos:pos + m] += seg[:m]; pos += len(seg) - xf
S['bed'] = fade(bed, 1.2, 2.0)
S['sizzle'] = fade(rms(cut(raw('oil'), 10, 14), -16), .3, .8)

ALIGN = {'whoosh': .25, 'swoosh': .12, 'whip': .12, 'transmit': 1.2}
GAIN = dict(impact=.55, deep=.5, whoosh=.38, swoosh=.32, whip=.4, pop=.4, hardpop=.4, tap=.55, scroll=.28, hit=.32, crunch=.8, box=.5, transmit=.4, laugh=.4, kiss=.45,
            paperslide=.4, paperflick=.45, chop=.6, jump=.18, sparkle=.2, bubbles=.32, juicy=.7, mmm=.75, aah=.7, canopen=.75, soda=.55, pourice=.55, slurp=.5,
            knife=.5, crinkle=.5, crumple=.5, bigcrunch=1.0, printer=.6, buzz=.6, bed=.42, sizzle=.45, **{f'c{i}': .55 for i in range(len(bank))})

AT = dict(transmit=b(41), branch=b(44), kitchen=b(50), hero=b(56), end=b(60)); LEN = 2 * B
SP = dict(transmit=3 / (b(44) - b(41)), branch=4.36 / (b(50) - b(44)))
SENT = b(39) + .05
REEL = json.load(open(os.path.join(HERE, '../../online-order-reel/audio/cues.json')))
SWAP = {'notify': 'buzz', 'uiok': 'hardpop', 'chime': 'pop', 'logo': None, 'fry': None, 'box': None, 'deep': 'deep'}
def from_reel(a, z, at, speed=1.0, until=99):
    out = []
    for n, t in REEL:
        if a <= t < z and (t - a) / speed < until:
            n = SWAP.get(n, n)
            if n: out.append((n, at + (t - a) / speed))
    return out
# the build into the reveal: bites that speed up and get louder (instead of a drum roll)
build, x, gap, k = [], b(-2) + .15, .3, 0
while x < b(0) - .08: build.append((C(k + 3), x, .35 + .5 * (x - b(-2)) / (b(0) - b(-2)))); x += gap; gap = max(.05, gap * .8); k += 1

STEPS = [b(18), b(22), b(25), b(30), b(33), b(36)]
CUES = [
    # teaser: the oil starts to sizzle, each word is a bite, «جاهزين؟» opens a can, the bites speed up
    ('bed', 0), (C(5), .04), (C(6), b(-4)), (C(7), b(-3)), ('canopen', b(-2) - .05), ('bubbles', b(-2) + .25), ('soda', b(-1.6)), *[(n, a) for n, a, _ in build],
    # the reveal: one HUGE crunch, a low thump, «mmm», crumpled-paper confetti
    ('bigcrunch', b(0)), ('impact', b(0)), ('mmm', b(0) + .5), ('crinkle', b(0) + .15), ('crumple', b(0) + .3), ('pop', b(2)),
    *[(C(n + 8), b(n) - .02) for n in (1, 3, 5, 7)],
    # «صار فيك تطلب أونلاين!» + the broasted zooming in: a whoosh into a juicy bite, the sizzle swells
    ('whoosh', b(4)), ('juicy', b(4)), ('bigcrunch', b(4.5)), ('sizzle', b(4)),
    # cream studio: logo slam = bite + thump, the meals burst out as three quick bites, «صارت أقرب!» = «aah»
    ('swoosh', b(8) - .05), ('deep', b(8) + .05), (C(0), b(8) + .05), (C(1), b(8) + .35), (C(2), b(8) + .47), (C(3), b(8) + .59), ('whoosh', b(10)), ('pop', b(10) + .2), ('aah', b(11) + .05),
    ('whoosh', b(12)), (C(4), b(12.5)), (C(5), b(13.5)), (C(6), b(14.5)), ('paperflick', b(14.5) + .06), ('swoosh', b(18)),
    # the order: stickers are crinkly paper (on) and a paper slide (off), taps, pops; the mascot; the split = 8 bites
    ('scroll', b(18.6)), *[('crinkle', a) for a in STEPS], *[('paperslide', a - .06) for a in STEPS[1:]], ('paperslide', SENT - .06),
    *[('tap', a) for a in [b(22), b(25), b(30), b(31.5), b(33), b(36), b(39) - .1]],
    *[('bubbles', a) for a in [b(19), b(26), b(33.6), b(37)]], ('laugh', b(26) + .3), *[('jump', a - .05) for a in [b(18.3), b(25.5), b(28), b(30), b(33), b(36.6)]],
    ('pop', b(22) + .1), ('swoosh', b(23.5) + .1), ('pop', b(25) + .25), *[(C(i + 2), b(26) + i * .136) for i in range(8)], ('juicy', b(28)), ('mmm', b(28) + .3),
    ('crumple', b(30) + .1), ('pop', b(31.5) + .1), ('pop', b(33) + .1), ('pop', b(36) + .1),
    ('buzz', b(36.6)), *[('tap', b(37.4) + i * .08) for i in range(6)], ('hardpop', b(38)),
    # sent: a can opens, the soda pours, «aah», paper confetti
    ('canopen', SENT - .05), ('soda', SENT + .1), ('aah', SENT + .9), ('crinkle', SENT + .1), ('crumple', SENT + .25),
    # hand-off to the branch (the reel's moves, sped up), and the branch PRINTS the ticket when it accepts
    *from_reel(12.5, 15.5, AT['transmit'], SP['transmit']), *from_reel(15.5, 19.5, AT['branch'], SP['branch']), ('printer', AT['branch'] + 2.12 / SP['branch']),
    # kitchen: knife, chopping, a sizzle swell, a crunch on every cut, a juicy bite
    ('sizzle', AT['kitchen']), ('knife', AT['kitchen'] + .02), ('chop', AT['kitchen'] + .6), ('bigcrunch', AT['kitchen'] + .12),
    *[('whip', AT['kitchen'] + i * LEN) for i in (1, 2)], (C(9), AT['kitchen'] + LEN + .05), ('juicy', AT['kitchen'] + 2 * LEN + .05), ('box', AT['kitchen'] + 2 * LEN + .35),
    # hero shot
    *from_reel(23.5, 28, AT['hero'], 1, until=b(60) - b(56)),
    # final card: a pour over ice, a bite, «mmm»; cash = paper money; three branches = three bites; a kiss; the last bite + «aah»
    ('pourice', AT['end'] - .1), ('bigcrunch', AT['end']), ('mmm', AT['end'] + .5), ('crinkle', AT['end'] + .15), ('hardpop', AT['end'] + .55), ('pop', b(60.5)), ('pop', b(61.5)),
    ('paperflick', b(62.5)), ('bubbles', b(62.5)), ('kiss', b(62.6)), ('pop', b(63.5)), *[(C(i + 10), b(n)) for i, n in enumerate((64, 64.5, 65))], ('jump', b(63) - .05),
    ('slurp', b(65) + .45), ('aah', b(65) + .75),
]
n = int(SR * TOTAL); mix = np.zeros((n + SR * 8, 2), np.float32)
vols = {(nm, round(a, 3)): v for nm, a, v in build}
for name, at in CUES:
    x = S[name] * GAIN[name] * vols.get((name, round(at, 3)), 1)
    if name in ALIGN: at = at + ALIGN[name] - peak_t(x)
    a = max(0, int(SR * at)); mix[a:a + len(x)] += x[:len(mix) - a]
mix = mix[:n]
# ASMR polish: a little air on top, gentle glue
board = Pedalboard([HighpassFilter(35), HighShelfFilter(cutoff_frequency_hz=6000, gain_db=2.0), Compressor(threshold_db=-18, ratio=2.2, attack_ms=8, release_ms=140)])
mix = board(mix.T.astype(np.float32), SR).T
meter = pyln.Meter(SR); mix = pyln.normalize.loudness(mix, meter.integrated_loudness(mix), -15.0)
# tame the bite transients (soft clip) so the whole thing can sit at -14 LUFS with true-peak headroom
mix = mix / np.abs(mix).max(); mix = np.tanh(2.2 * mix) / np.tanh(2.2) * .95
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True); pre = os.path.join(HERE, 'out', 'premaster-asmr.wav'); sf.write(pre, mix, SR, subtype='FLOAT')
out = os.path.join(HERE, '../public/audio-asmr.wav')
# master: -14 LUFS with a soft ceiling, checked on a 4x-oversampled signal (true peak <= -1.5 dBTP)
from scipy.signal import resample_poly
c = 10 ** (-3.4 / 20)
for _ in range(6):
    mix = pyln.normalize.loudness(mix, meter.integrated_loudness(mix), -14.0)
    mix = c * np.tanh(mix / c)
    tp = np.abs(resample_poly(mix, 4, 1, axis=0)).max()
    if tp <= 10 ** (-3.0 / 20) and abs(meter.integrated_loudness(mix) + 14) < .3: break
f = int(SR * .6); mix[-f:] *= np.linspace(1, 0, f)[:, None]
sf.write(out, mix.astype(np.float32), SR, subtype='PCM_24')
print('master ->', out, '| LUFS %.1f | true peak %.1f dBTP | bites in the bank: %d' % (meter.integrated_loudness(mix), 20 * np.log10(tp), len(bank)))
