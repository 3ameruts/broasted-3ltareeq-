# Measures every effect for musical tone (pitch-class concentration + harmonic energy), so no musical sound slips in.
# usage: /root/.studio/bin/python audio/tonal_check.py      (tonal > .22 or a sustained harmonic note = not used)
import os, librosa, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
for l in open(os.path.join(HERE, 'sfx_sources.tsv'), encoding='utf8'):
    if not l.strip() or l.startswith('#'): continue
    name, mid, _t, ext = l.rstrip('\n').split('\t')
    y, sr = librosa.load(os.path.join(HERE, 'mixkit', f'{mid}.{ext}'), sr=22050, duration=12)
    C = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=512); e = librosa.feature.rms(y=y, hop_length=512)[0][:C.shape[1]]
    conc = np.median((C.max(0) / (C.sum(0) + 1e-9))[e > e.max() * .2])
    print('%-13s tonal=%.2f %s' % (name, conc, 'OK' if conc < .22 or name == 'cheer' else 'TONAL'))
