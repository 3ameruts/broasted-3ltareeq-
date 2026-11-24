# Studio kit — أدوات الاستوديو الإبداعي

أدوات بس، بدون مشاريع. الجهاز السحابي مؤقت، فبعد أي جلسة جديدة شغّل:

```bash
bash video/studio-kit/install.sh                 # الأدوات (≈2 دقيقة)
STUDIO_MODELS=1 bash video/studio-kit/install.sh # + نماذج الذكاء المحلية (≈0.9GB)
npm --prefix video/studio-kit run verify         # فحص كل شي
```

| المجال | الأدوات |
|---|---|
| فيديو | ffmpeg 6.1 (vidstab, minterpolate, lut3d, zscale) · MoviePy · OpenCV · PySceneDetect |
| موشن | Remotion 4.0.539 + transitions/motion-blur/noise/lottie/three/shapes/paths/captions · GSAP · Motion · Lottie · Three.js/R3F/drei |
| صوت | SoX · pedalboard · noisereduce · pyloudnorm · librosa · pydub · Piper TTS (عربي أردني) · ElevenLabs MCP (بدها مفتاح) |
| تصميم | sharp · @napi-rs/canvas · svgo · opentype.js · ImageMagick · rembg · potrace · webp/gifsicle/optipng · خطوط عربية |
| نصوص | faster-whisper (تفريغ وترجمة) |

- Python: `/root/.studio/bin/python` (venv منفصل).
- المهارات: `.claude/skills/` (creative-director, motion-graphics, video-editor, color-grading, sound-designer, graphic-designer, ai-creative-integrations + مهارات Remotion الرسمية).
- الخدمات اللي بدها مفتاح أو تسجيل دخول: شوف `.claude/skills/ai-creative-integrations/SKILL.md`. المفاتيح ما بتنكتب بالمحادثة ولا بالملفات.
