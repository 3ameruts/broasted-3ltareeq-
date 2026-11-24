#!/usr/bin/env bash
# Downloads the Mixkit sound effects used in the reel (Mixkit Sound Effects Free License: https://mixkit.co/license/#sfxFree).
# They are not kept in the repository: the license does not allow redistributing them on their own or with source files.
set -euo pipefail
cd "$(dirname "$0")"; mkdir -p mixkit
grep -v '^#' mixkit_sources.tsv | while IFS=$'\t' read -r name id title ext; do
  [ -s "mixkit/$id.$ext" ] || curl -sSfL -A "Mozilla/5.0" -o "mixkit/$id.$ext" "https://assets.mixkit.co/active_storage/sfx/$id/$id.$ext"
  echo "ok  $name  $id  $title"
done
