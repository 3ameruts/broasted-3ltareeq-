# Pre-downloads the local AI models used by the studio. Run with HF_HUB_DISABLE_XET=1 (the Xet CAS host is not allowed).
from rembg import new_session
from faster_whisper import WhisperModel
from huggingface_hub import hf_hub_download
for m in ['isnet-general-use', 'birefnet-general-lite']:
    new_session(m); print('rembg', m, 'ok')
WhisperModel('small', device='cpu', compute_type='int8'); print('whisper small ok')
for f in ['ar/ar_JO/kareem/medium/ar_JO-kareem-medium.onnx', 'ar/ar_JO/kareem/medium/ar_JO-kareem-medium.onnx.json']:
    print('piper', hf_hub_download('rhasspy/piper-voices', f))
