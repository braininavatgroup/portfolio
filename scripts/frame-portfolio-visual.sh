#!/usr/bin/env bash
# Frame a phone screenshot the way every portfolio visual is framed: the
# Apple Frames "Black" iPhone bezel, exported at the shared 794x1600 size.
#
#   scripts/frame-portfolio-visual.sh <screenshot.png> <group> <name>
#   scripts/frame-portfolio-visual.sh ~/Downloads/IMG_4390.PNG dubs inspector
#
# Writes public/visuals/<group>/<name>.png. Requires the `frames` CLI
# (https://github.com/…/frames, `frames doctor` to check assets) and macOS
# `sips`. The frame colour comes from ~/.config/frames/config.json
# (default_colors → Black); pass FRAME_COLOR to override for one export.
set -euo pipefail

source="${1:?screenshot path}"
group="${2:?visual group, e.g. dubs}"
name="${3:?output name without extension}"
color="${FRAME_COLOR:-Black}"
width=794
height=1600

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
target_dir="$root/public/visuals/$group"
mkdir -p "$target_dir"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

cp "$source" "$work/source.png"
frames -c "$color" -o "$work" "$work/source.png" >/dev/null
framed="$(ls "$work"/*_framed.png | head -1)"
sips -z "$height" "$width" "$framed" --out "$target_dir/$name.png" >/dev/null
echo "$target_dir/$name.png"
