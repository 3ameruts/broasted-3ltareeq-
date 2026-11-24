#!/usr/bin/env bash
# Rebuilds the creative studio toolchain in a fresh container. Idempotent; safe to re-run.
# Usage: bash video/studio-kit/install.sh   (from the repo root, or anywhere)
set -euo pipefail
KIT="$(cd "$(dirname "$0")" && pwd)"
VENV="${STUDIO_VENV:-/root/.studio}"

# 1) system media tools (ffmpeg + ImageMagick are preinstalled in the base image)
if ! command -v sox >/dev/null || ! command -v mediainfo >/dev/null; then
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ffmpeg imagemagick sox libsox-fmt-all mediainfo \
    potrace webp gifsicle optipng jpegoptim librsvg2-bin fonts-noto-core fonts-noto-color-emoji
fi

# 2) Python media/AI libs in a dedicated venv (never touches the system Python)
[ -x "$VENV/bin/python" ] || uv venv -q --python 3.12 "$VENV"
VIRTUAL_ENV="$VENV" uv pip install -q -r "$KIT/requirements.txt"

# 3) Node toolkit (Remotion + motion + 3D + image tools), from the lockfile
(cd "$KIT" && npm ci --no-audit --no-fund --loglevel=error)

# 4) models (optional, ~0.9 GB): STUDIO_MODELS=1 bash install.sh
if [ "${STUDIO_MODELS:-0}" = 1 ]; then
  export HF_HUB_DISABLE_XET=1
  "$VENV/bin/python" -W ignore "$KIT/models.py"
fi
echo "studio kit ready -> run: npm --prefix $KIT run verify"
