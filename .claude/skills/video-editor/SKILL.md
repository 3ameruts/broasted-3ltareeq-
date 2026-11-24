---
name: video-editor
description: Professional Video Editor, Cinematic Video Director, VFX and AI Video Production specialist. Use for cutting, pacing, speed ramps, stabilization, compositing, masking/rotoscoping, chroma key, transitions, scene detection, captions/subtitles, upscaling and final encoding with FFmpeg, MoviePy, OpenCV, PySceneDetect.
---
# Video Editor / Cinematic Director / VFX

Python: `/root/.studio/bin/python` (moviepy 2, opencv, numpy, scenedetect, faster-whisper, rembg). CLI: ffmpeg 6.1 (libx264/x265, vidstab, minterpolate, zscale, lut3d, rubberband), ffprobe, mediainfo. If missing: `bash video/studio-kit/install.sh`.

## Cinematic language
- Cut on action; vary shot size (wide → medium → close-up); 1 idea per shot. Ads: average shot 0.6-1.5 s, slower for the hero/payoff.
- Camera moves: slow push-in for emphasis, whip-pan for energy, parallax for depth. Match motion direction across cuts.
- Rhythm: cut on beats from the music grid; hits on downbeats; leave 4-8 frames of breath before the CTA.

## Recipes (ffmpeg)
- Inspect: `ffprobe -v error -show_streams -of json in.mp4`
- Scene cuts: `scenedetect -i in.mp4 detect-adaptive list-scenes` (via `/root/.studio/bin/scenedetect`)
- Stabilize: `ffmpeg -i in.mp4 -vf vidstabdetect=shakiness=6:result=t.trf -f null - && ffmpeg -i in.mp4 -vf vidstabtransform=input=t.trf:smoothing=20,unsharp=5:5:.6 out.mp4`
- Speed ramp: split into segments, `setpts=PTS/2` (fast) / `setpts=2*PTS` + `minterpolate=fps=60:mi_mode=mci` (smooth slow-mo), concat; or keyframed in Remotion via frame remap.
- Motion blur from footage: `tmix=frames=3` (light) / `minterpolate` then `tblend`.
- Chroma key: `chromakey=0x00ff00:.12:.08,despill` ; masking/roto: rembg per-frame (birefnet-general-lite) or OpenCV GrabCut, then alpha overlay.
- Overlay/composite: `overlay=x:y:enable='between(t,1,3)'`; blend modes `blend=all_mode=screen`.
- Subtitles: faster-whisper (model `small`, `language='ar'`) → SRT → burn with `subtitles=f.srt:force_style='FontName=Cairo,FontSize=18'` or render captions in Remotion (@remotion/captions).
- Upscale: `zscale=w=2160:h=3840:filter=lanczos` + `unsharp` (no AI upscaler installed; generative upscaling needs an external service).

## Delivery encodes
- Social master: `-c:v libx264 -profile:v high -pix_fmt yuv420p -crf 17 -preset slow -movflags +faststart -c:a aac -b:a 192k -ar 48000`
- Size-capped: two-pass `-b:v` from target_MB*8192/seconds - audio kbps.
- HEVC archive: `-c:v libx265 -crf 20 -tag:v hvc1`. ProRes for handoff: `-c:v prores_ks -profile:v 3`.
- Always check: duration, fps, resolution, loudness (see sound-designer), first/last frame.

## AI video
Generated clips (Runway, Pika, Luma, Kling, Veo, Sora…) need the user's account/API key - never invent keys; see ai-creative-integrations. Treat generated footage like stock: grade to match, cut short, cover artifacts with motion.
