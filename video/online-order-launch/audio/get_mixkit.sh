#!/usr/bin/env bash
# Downloads the Mixkit sound effects + the music track (Mixkit free licenses: https://mixkit.co/license/).
# They are not kept in the repository: the licenses do not allow redistributing the raw files.
set -euo pipefail
cd "$(dirname "$0")"; mkdir -p mixkit music
grep -v '^#' mixkit_sources.tsv | while IFS=$'\t' read -r name id title ext; do
  [ -s "mixkit/$id.$ext" ] || curl -sSfL -A "Mozilla/5.0" -o "mixkit/$id.$ext" "https://assets.mixkit.co/active_storage/sfx/$id/$id.$ext"
done
M=$(python3 -c "import json;print(json.load(open('../src/timing.json'))['musicId'])")   # «Arab Nights» (Mixkit)
[ -s "music/$M.mp3" ] || curl -sSfL -A "Mozilla/5.0" -o "music/$M.mp3" "https://assets.mixkit.co/music/$M/$M.mp3"
echo "sounds ok"
