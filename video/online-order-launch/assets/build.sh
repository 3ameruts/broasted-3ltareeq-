#!/usr/bin/env bash
# Builds the promo's still assets from the reel's originals: graded food photos, AI cut-outs, the vector logo.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=../online-order-reel/public/food; OUT=public/food; PY=/root/.studio/bin/python
mkdir -p "$OUT" public/brand
# 1) color grade (food: warm highlights, rich but not orange, gentle S-curve, a touch of vibrance; reds stay on-brand)
for f in k11 k13 k15 k16 k18 k20; do
  [ -s "$OUT/$f.jpg" ] || ffmpeg -v error -y -i "$SRC/$f.jpg" -vf "scale=1600:-2:flags=lanczos,curves=all='0/0 .25/.235 .5/.51 .75/.775 1/1',eq=saturation=1.06:gamma=1.02,colorbalance=rh=.025:gh=.01:bh=-.03,vibrance=.12,unsharp=5:5:.35" -q:v 2 "$OUT/$f.jpg"
done
# 2) cut-outs: the existing ones + new ones made with rembg (birefnet), trimmed to content
cp -n "$SRC"/cut*.webp "$OUT"/ 2>/dev/null || true
for f in k11 k13; do
  if [ ! -s "$OUT/cut${f#k}.webp" ]; then
    /root/.studio/bin/rembg i -m birefnet-general-lite "$SRC/$f.jpg" "/tmp/$f-cut.png"
    convert "/tmp/$f-cut.png" -trim +repage -quality 92 "$OUT/cut${f#k}.webp"
  fi
done
# 3) the logo as vector line art (dark outline strokes -> potrace) for a draw-on reveal
convert public/brand/logo.webp -resize 300% -colorspace gray -threshold 30% -negate -morphology Open Disk:1 /tmp/logo-dark.pbm 2>/dev/null || true
convert public/brand/logo.webp -resize 300% -alpha extract -threshold 50% -negate /tmp/logo-alpha.pbm
potrace -s -t 20 -O 0.6 -o public/brand/logo-line.svg /tmp/logo-dark.pbm
potrace -s -t 40 -O 0.8 -o public/brand/logo-shape.svg /tmp/logo-alpha.pbm

node assets/svg2json.mjs public/brand/logo-line.svg src/logo-line.json
echo assets ok
