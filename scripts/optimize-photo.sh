#!/bin/sh
# Turn a full-resolution photo into the three web sizes a product uses.
#   scripts/optimize-photo.sh ~/Downloads/foto.jpg fruto
# writes assets/navidad/fruto-480.webp, -800.webp (product card) and -1600.webp (zoom only),
# then set "image": "assets/navidad/fruto" on the product in data/products.json.
# Needs cwebp (brew install webp). Never enlarges a photo smaller than the target width.
set -eu
src=$1; name=$2; out=assets/navidad
width=$(sips -g pixelWidth "$src" | awk '/pixelWidth/ {print $2}')
for size in 480 800 1600; do
  w=$size; [ "$width" -lt "$size" ] && w=$width
  cwebp -quiet -q 74 -resize "$w" 0 "$src" -o "$out/$name-$size.webp"
done
ls -la "$out/$name"-*.webp | awk '{print $5, $9}'
