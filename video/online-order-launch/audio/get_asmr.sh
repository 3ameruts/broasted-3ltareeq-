#!/usr/bin/env bash
# Downloads the sounds for both soundtracks (crowd version + ASMR version). Mixkit Sound Effects Free License; not kept in the repo.
set -euo pipefail
cd "$(dirname "$0")"; mkdir -p mixkit
cat sfx_sources.tsv asmr_sources.tsv | grep -v '^#' | while IFS=$'\t' read -r name id title ext; do
  [ -s "mixkit/$id.$ext" ] || curl -sSfL -A "Mozilla/5.0" -o "mixkit/$id.$ext" "https://assets.mixkit.co/active_storage/sfx/$id/$id.$ext"
done
echo "sounds ok"
