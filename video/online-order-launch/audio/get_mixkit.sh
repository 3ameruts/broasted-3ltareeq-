#!/usr/bin/env bash
# Downloads the Mixkit sound effects (Mixkit Sound Effects Free License: https://mixkit.co/license/#sfxFree).
# No music: the soundtrack is effects only. The raw files are not kept in the repository (the license forbids redistributing them).
set -euo pipefail
cd "$(dirname "$0")"; mkdir -p mixkit
grep -v '^#' sfx_sources.tsv | while IFS=$'\t' read -r name id title ext; do
  [ -s "mixkit/$id.$ext" ] || curl -sSfL -A "Mozilla/5.0" -o "mixkit/$id.$ext" "https://assets.mixkit.co/active_storage/sfx/$id/$id.$ext"
done
echo "sounds ok"
