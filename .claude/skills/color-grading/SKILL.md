---
name: color-grading
description: Color Grading Specialist. Use to balance, match and grade footage, photos and renders (LUTs, curves, contrast, skin/food tones, looks) with FFmpeg, OpenCV, ImageMagick or CSS filters inside Remotion.
---
# Color Grading

Order of operations: normalize (exposure/white balance) → match shots → creative look → final contrast/saturation → sharpen → grain.

## Tools
- ffmpeg: `eq=contrast=1.06:saturation=1.1:gamma=.98`, `colorbalance=rs=.03:bs=-.03` (warm), `curves=preset=medium_contrast` or custom `curves=r='0/0 .5/.54 1/1'`, `lut3d=look.cube`, `colortemperature=temperature=5200`, `vibrance=.15`, `zscale` for color space (bt709, full/limited).
- Images: ImageMagick `-modulate 100,112,100 -sigmoidal-contrast 3x50%`; sharp `.modulate({saturation:1.1}).linear(1.05,-6)`.
- In Remotion: CSS `filter: contrast() saturate() brightness()` + gradient overlays with `mix-blend-mode` (multiply for vignette, screen/soft-light for glow).
- Measure: `ffmpeg -i in -vf signalstats,metadata=print -f null -` (YAVG, SATAVG) to match clips numerically.

## Food & brand guidance
- Food: warm highlights, rich but not orange; keep crust golden (hue ~35-45°), lift shadows slightly, saturation +8-15%, never crush blacks on fried texture.
- Brand reds must stay on-brand after the grade: grade the footage, not the overlaid UI/graphics.
- UI screenshots: no grade at all (exact colors); add depth with lighting overlays instead.
- Deliver in bt709 limited range; check on a phone-brightness preview.
