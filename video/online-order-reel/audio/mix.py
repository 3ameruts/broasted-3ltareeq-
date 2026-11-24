# Sound effects only (no music, no voices): places the Mixkit effects from audio/cues.json on the reel's timeline.
# usage: bash audio/get_mixkit.sh && python3 audio/mix.py && (loudness pass, see README)
import json, os, subprocess, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__)); SR = 48000
def load(p):
    raw = subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-i', p, '-ac', '2', '-ar', str(SR), '-f', 's16le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32).reshape(-1, 2) / 32768
def trim(x, db=-40):
    a = np.abs(x).max(1); i = int(np.argmax(a > a.max() * 10 ** (db / 20))); return x[max(0, i - int(SR * .003)):]
def fade(x, a=.004, r=.05):
    x = x.copy(); n = len(x); ka, kr = min(n, int(SR * a)), min(n, int(SR * r))
    x[:ka] *= np.linspace(0, 1, ka)[:, None]; x[n - kr:] *= np.linspace(1, 0, kr)[:, None]; return x
def rms(x, target=-18): return x * (10 ** (target / 20) / (np.sqrt(np.mean(x ** 2)) + 1e-9))
def peak_t(x): e = np.convolve(np.abs(x).max(1), np.ones(480) / 480, 'same'); return int(np.argmax(e)) / SR

rows = [l.rstrip('\n').split('\t') for l in open(os.path.join(HERE, 'mixkit_sources.tsv'), encoding='utf8') if l.strip() and not l.startswith('#')]
S = {}
for name, mid, _title, ext in rows:
    x = trim(load(os.path.join(HERE, 'mixkit', f'{mid}.{ext}')))
    if name == 'fry': x = fade(x[int(SR * 6):int(SR * 10.2)], .25, .4)
    if name == 'logo': x = fade(x[:int(SR * 3.2)], .002, 1.0)
    if name == 'transmit': x = fade(x, .01, .3)
    S[name] = fade(rms(x), .002, .03)
# whooshes peak on the cut; everything else starts on its cue
ALIGN = {'whoosh': .3, 'swoosh': .15, 'whip': .14, 'transmit': 1.2}
GAIN = dict(impact=.8, logo=.8, whoosh=.45, swoosh=.4, whip=.45, reveal=.4, pop=.45, hardpop=.42, scroll=.35, tap=.5, cart=.55, focus=.35, confirm=.55,
            transmit=.5, deep=.8, notify=.55, chime=.45, uiok=.45, fry=.38, hit=.42, box=.6, sparkle=.38)
TOTAL = json.load(open(os.path.join(HERE, '../src/timeline.json')))['duration']
n = int(SR * TOTAL); mix = np.zeros((n + SR * 6, 2))
for name, at in json.load(open(os.path.join(HERE, 'cues.json'))):
    x = S[name] * GAIN[name]
    if name in ALIGN: at = at + ALIGN[name] - peak_t(x)
    a = max(0, int(SR * at)); mix[a:a + len(x)] += x[:len(mix) - a]
mix = mix[:n]; mix[-int(SR * .4):] *= np.linspace(1, 0, int(SR * .4))[:, None]
mix = np.tanh(mix * 1.1) / np.tanh(1.1); mix = mix / (np.abs(mix).max() + 1e-9) * .92
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
with wave.open(os.path.join(HERE, 'out', 'effects.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype(np.int16).tobytes())
print('effects ->', os.path.join(HERE, 'out', 'effects.wav'))
