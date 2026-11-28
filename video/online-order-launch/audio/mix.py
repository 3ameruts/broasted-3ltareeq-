# «جديدنا!» soundtrack, music-free (no instruments, no musical tones): the video sounds like a LAUNCH EVENT.
# A murmuring crowd and accelerating claps build the teaser, the reveal gets cheers, applause and camera flashes,
# the order is told with foley (taps, paper stickers, a synthesized phone buzz, chopping, frying, crunch),
# the confetti falls as paper, and the final card gets an ovation. Every effect sits on the picture's beat grid b(n).
# usage: bash audio/get_mixkit.sh && /root/.studio/bin/python audio/mix.py
# (audio/tonal_check.py measures every effect for musical tone; tonal ones are not used)
import json, os, subprocess
import numpy as np, pyloudnorm as pyln, soundfile as sf
from pedalboard import Pedalboard, Compressor, HighpassFilter, LowShelfFilter

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

rows = [l.rstrip('\n').split('\t') for l in open(os.path.join(HERE, 'sfx_sources.tsv'), encoding='utf8') if l.strip() and not l.startswith('#')]
S = {}
for name, mid, _t, ext in rows:
    x = load(os.path.join(HERE, 'mixkit', f'{mid}.{ext}'))
    if name not in ('murmur', 'fry'): x = trim(x)
    # long recordings: only the part that is used
    x = {'murmur': lambda v: fade(cut(v, 20, 26), .4, 1.2), 'fry': lambda v: fade(cut(v, 6, 10), .3, .8), 'rclap': lambda v: fade(cut(v, 0, 4.2), .02, 1.4),
         'crowdwin': lambda v: fade(cut(v, 0, 3.6), .02, 1.4), 'ovation': lambda v: fade(cut(v, 0, 4.6), .05, 1.6), 'reporters': lambda v: fade(cut(v, 0, 2.6), .02, .8),
         'confettifall': lambda v: fade(cut(v, 0, 2.2), .01, .8), 'clapfast': lambda v: fade(cut(v, 0, 2.2), .01, .6), 'chop': lambda v: fade(cut(v, 0, 1.6), .01, .4),
         'cheer': lambda v: fade(cut(v, 0, 2.4), .02, 1.0)}.get(name, lambda v: v)(x)
    S[name] = fade(rms(x), .002, .03)

# a phone buzz (the code arriving), synthesized: two short motor rattles, no musical pitch
def buzz():
    t = np.arange(int(SR * .5)) / SR
    rng = np.random.default_rng(7); motor = np.sign(np.sin(2 * np.pi * 155 * t + rng.normal(0, .35, len(t)).cumsum() * .02))
    rattle = .55 + .45 * np.sign(np.sin(2 * np.pi * 31 * t)); env = ((t < .17) | ((t > .26) & (t < .43))).astype(float)
    env = np.convolve(env, np.ones(240) / 240, 'same'); y = motor * rattle * env * .5 + rng.normal(0, .04, len(t)) * env
    y = np.convolve(y, np.ones(18) / 18, 'same')  # soften the edges: a muffled table rattle
    return fade(rms(np.stack([y, y], 1).astype(np.float32), -20), .002, .03)
S['buzz'] = buzz()
# a quiet bed under the whole video: the restaurant chatter of a launch event (no dead air without music)
S['bed'] = fade(rms(cut(load(os.path.join(HERE, 'mixkit', '444.wav')), 30, 30 + TOTAL + 1)), 1.5, 2.0)

ALIGN = {'whoosh': .25, 'swoosh': .12, 'whip': .12, 'transmit': 1.2}  # these peak ON the cue
GAIN = dict(impact=.8, deep=.65, whoosh=.42, swoosh=.36, whip=.42, reveal=.3, pop=.45, hardpop=.45, longpop=.42, sillypop=.42, bubbles=.4, tap=.55, scroll=.3,
            hit=.42, crunch=.85, fry=.32, box=.55, transmit=.45, cheer=.4, jump=.2, sparkle=.25, cart=.4, murmur=.32, rclap=.55, crowdwin=.6, ovation=.6,
            clapfast=.5, clap=.5, reporters=.42, shutter=.5, chop=.55, paperslide=.45, paperflick=.5, confettifall=.38, laugh=.4, kiss=.45, buzz=.6, bed=.16)

AT = dict(transmit=b(41), branch=b(44), kitchen=b(50), hero=b(56), end=b(60)); LEN = 2 * B
SP = dict(transmit=3 / (b(44) - b(41)), branch=4.36 / (b(50) - b(44)))
SENT = b(39) + .05
REEL = json.load(open(os.path.join(HERE, '../../online-order-reel/audio/cues.json')))
SWAP = {'notify': 'buzz', 'uiok': 'hardpop', 'chime': 'pop', 'logo': None, 'hit': 'hit', 'fry': None, 'box': None}
def from_reel(a, z, at, speed=1.0, until=99):  # the original reel's cues, moved/sped up, with every tonal effect swapped for foley
    out = []
    for n, t in REEL:
        if a <= t < z and (t - a) / speed < until:
            n = SWAP.get(n, n)
            if n: out.append((n, at + (t - a) / speed))
    return out
# the teaser's build: claps that speed up into the drop (instead of a drum roll)
claps, x, gap = [], b(-2) + .1, .3
while x < b(0) - .06: claps.append(('clap', x)); x += gap; gap = max(.045, gap * .8)

STEPS = [b(18), b(22), b(25), b(30), b(33), b(36)]
CUES = [
    # teaser: the crowd murmurs, words pop, «جاهزين؟», the mascot peeks, the claps speed up
    ('murmur', 0), ('bed', 0), ('pop', .04), ('pop', b(-4)), ('pop', b(-3)), ('hardpop', b(-2)), ('bubbles', b(-2) + .25), ('jump', b(-1) - .05), *claps, ('clapfast', b(-1) + .1),
    # the reveal: boom, cheering crowd, rhythmic applause, camera flashes, paper confetti
    ('impact', b(0)), ('deep', b(0)), ('crowdwin', b(0)), ('rclap', b(0) + .1), ('reporters', b(0) + .05), ('shutter', b(0)), ('shutter', b(0) + .14), ('shutter', b(0) + .31),
    ('confettifall', b(0) + .15), ('sillypop', b(0)), ('pop', b(2)), *[('jump', b(n) - .05) for n in (1, 3, 5, 7)],
    # «صار فيك تطلب أونلاين!» with a strong hit, the broasted zooms in
    ('impact', b(4)), ('whoosh', b(4)), ('sillypop', b(4) + .1), ('hardpop', b(4.5)), ('confettifall', b(4.5) + .1), ('shutter', b(4.5)),
    # cream studio: logo slam + ring, meals burst, «وجبتك المفضلة… صارت أقرب!», the phone flies up, the 3 chips (cash = paper money)
    ('swoosh', b(8) - .05), ('impact', b(8) + .05), ('deep', b(8) + .05), ('bubbles', b(8) + .35), ('whoosh', b(10)), ('pop', b(10) + .2), ('hardpop', b(11)), ('clap', b(11) + .02),
    ('whoosh', b(12)), ('pop', b(12.5)), ('pop', b(13.5)), ('pop', b(14.5)), ('paperflick', b(14.5) + .05), ('swoosh', b(18)),
    # the order: each step is a paper sticker (slap on, peel off), a tap per press, a pop per sheet; the mascot's bubbles and giggle
    ('scroll', b(18.6)), *[('paperflick', a) for a in STEPS], *[('longpop', a + .02) for a in STEPS], *[('paperslide', a - .06) for a in STEPS[1:]], ('paperslide', SENT - .06),
    *[('tap', a) for a in [b(22), b(25), b(30), b(31.5), b(33), b(36), b(39) - .1]],
    *[('bubbles', a) for a in [b(19), b(26), b(33.6), b(37)]], ('laugh', b(26) + .3), *[('jump', a - .05) for a in [b(18.3), b(25.5), b(28), b(30), b(33), b(36.6)]],
    ('pop', b(22) + .1), ('swoosh', b(23.5) + .1), ('pop', b(25) + .25), *[('pop' if i % 2 else 'hardpop', b(26) + i * .136) for i in range(8)], ('hit', b(28)), ('clap', b(28) + .02),
    ('cart', b(30) + .1), ('pop', b(31.5) + .1), ('pop', b(33) + .1), ('pop', b(36) + .1),
    ('buzz', b(36.6)), ('pop', b(36.6) + .05), *[('tap', b(37.4) + i * .08) for i in range(6)], ('hardpop', b(38)),
    # sent: the celebration — cheers, fast claps, paper confetti
    ('whoosh', SENT), ('cheer', SENT + .05), ('clapfast', SENT + .1), ('confettifall', SENT + .1), ('sillypop', SENT), ('jump', b(39.2) - .05), ('jump', b(39.7) - .05),
    # the original reel's hand-off to the branch and the branch (sped up like the picture)
    *from_reel(12.5, 15.5, AT['transmit'], SP['transmit']), *from_reel(15.5, 19.5, AT['branch'], SP['branch']),
    # kitchen: chopping, the sizzle, a crunch, whips on the cuts
    ('fry', AT['kitchen']), ('chop', AT['kitchen'] + .02), ('hit', AT['kitchen']), ('crunch', AT['kitchen'] + .2),
    *[('whip', AT['kitchen'] + i * LEN) for i in (1, 2)], *[('hit', AT['kitchen'] + i * LEN) for i in (1, 2)], ('box', AT['kitchen'] + 2 * LEN + .35),
    # hero shot (the reel's, up to the cut)
    *from_reel(23.5, 28, AT['hero'], 1, until=b(60) - b(56)),
    # final card: the ovation, camera flashes, paper confetti; cash = paper money; branches pop; the mascot blows a kiss
    ('impact', AT['end']), ('ovation', AT['end'] + .05), ('confettifall', AT['end'] + .1), ('shutter', AT['end'] + .1), ('shutter', AT['end'] + .32),
    ('hardpop', AT['end'] + .55), ('pop', b(60.5)), ('pop', b(61.5)), ('paperflick', b(62.5)), ('pop', b(62.5)), ('bubbles', b(62.5)), ('kiss', b(62.6)),
    ('pop', b(63.5)), *[('longpop', b(n)) for n in (64, 64.5, 65)], ('jump', b(63) - .05), ('clap', b(65) + .35), ('clap', b(65) + .6),
]
n = int(SR * TOTAL); mix = np.zeros((n + SR * 8, 2), np.float32)
for name, at in CUES:
    x = S[name] * GAIN[name]
    if name in ALIGN: at = at + ALIGN[name] - peak_t(x)
    a = max(0, int(SR * at)); mix[a:a + len(x)] += x[:len(mix) - a]
mix = mix[:n]

board = Pedalboard([HighpassFilter(30), LowShelfFilter(cutoff_frequency_hz=90, gain_db=1.0), Compressor(threshold_db=-16, ratio=2.5, attack_ms=10, release_ms=150)])
mix = board(mix.T.astype(np.float32), SR).T
meter = pyln.Meter(SR)
mix = pyln.normalize.loudness(mix, meter.integrated_loudness(mix), -15.0)
mix = mix / max(1.0, np.abs(mix).max() / .98)
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True); pre = os.path.join(HERE, 'out', 'premaster.wav'); sf.write(pre, mix, SR, subtype='FLOAT')
out = os.path.join(HERE, '../public/audio.wav')
subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-y', '-i', pre, '-af', 'loudnorm=I=-14:TP=-2.5:LRA=9,afade=t=out:st=%.2f:d=0.6' % (TOTAL - .6),
                '-ar', str(SR), '-c:a', 'pcm_s24le', out], check=True)
print('master ->', out)
