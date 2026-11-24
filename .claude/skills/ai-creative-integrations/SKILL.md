---
name: ai-creative-integrations
description: Map of AI and stock services for creative work (voice, SFX, music, image and video generation, stock media, Canva) - what is installed locally, what needs the user's API key or login, and how to request it safely. Use before calling any external creative service or when an asset must be generated or sourced.
---
# AI Creative Integrations

## Local (free, installed, no key)
| Need | Tool |
|---|---|
| Arabic TTS (draft/temp VO) | Piper `ar_JO-kareem-medium` |
| Speech-to-text / captions | faster-whisper `small` (CPU int8) |
| Background removal / masks | rembg `birefnet-general-lite`, `isnet-general-use` |
| Audio cleanup / mastering | noisereduce, pedalboard, ffmpeg afftdn/arnndn/loudnorm |
Models download from Hugging Face; set `HF_HUB_DISABLE_XET=1` (the Xet CAS host is blocked). Rebuild everything: `STUDIO_MODELS=1 bash video/studio-kit/install.sh`.

## Needs the user's key or login (never invent, never accept keys in chat)
| Service | Use | How it gets access |
|---|---|---|
| ElevenLabs | premium TTS/voice clone, SFX, music | MCP `elevenlabs` in `.mcp.json`; user saves `ELEVENLABS_API_KEY` (env secret) or the session's credential form for api.elevenlabs.io (header `xi-api-key`) |
| Canva | templated design, brand kit | user connects the Canva connector in claude.ai settings |
| Image generation (OpenAI Images, Google Imagen, Stability, Replicate/Flux, Ideogram) | hero/backgrounds | user's API key via credential form; host must be allowed in the environment |
| Video generation (Runway, Luma, Kling, Pika, Veo) | B-roll | user's account/API key |
| Stock (Pexels, Unsplash, Pixabay API) | footage/photos | free API keys; Pixabay web pages block bots |
Network: the environment is limited; a new host must be added (approval prompt) before use.

## Cost & rights rules
- Any paid generation or paid plan action: get the user's explicit approval first, state the expected cost/credits.
- Record source + license for every external asset (keep a `SOURCES.md`/tsv next to the project). Don't commit raw files whose license forbids redistribution (e.g. Mixkit).
- No impersonation of real people's voices/faces without consent; no logos of other brands.
