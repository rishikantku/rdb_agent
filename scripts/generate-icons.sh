#!/usr/bin/env bash
set -e

# Create directories
mkdir -p build/icon.iconset
mkdir -p public

# Render high-DPI full-bleed transparent icon using Electron
npx electron scripts/render-icon.cjs

BASE_PNG="build/icon.png"

# Generate crisp multi-resolution icons for macOS iconset
sips -z 16 16     "$BASE_PNG" --out build/icon.iconset/icon_16x16.png
sips -z 32 32     "$BASE_PNG" --out build/icon.iconset/icon_16x16@2x.png
sips -z 32 32     "$BASE_PNG" --out build/icon.iconset/icon_32x32.png
sips -z 64 64     "$BASE_PNG" --out build/icon.iconset/icon_32x32@2x.png
sips -z 128 128   "$BASE_PNG" --out build/icon.iconset/icon_128x128.png
sips -z 256 256   "$BASE_PNG" --out build/icon.iconset/icon_128x128@2x.png
sips -z 256 256   "$BASE_PNG" --out build/icon.iconset/icon_256x256.png
sips -z 512 512   "$BASE_PNG" --out build/icon.iconset/icon_256x256@2x.png
sips -z 512 512   "$BASE_PNG" --out build/icon.iconset/icon_512x512.png
sips -z 1024 1024 "$BASE_PNG" --out build/icon.iconset/icon_512x512@2x.png

# Generate public web assets
sips -z 256 256 "$BASE_PNG" --out public/icon-256.png
sips -z 32 32   "$BASE_PNG" --out public/favicon-32.png
sips -z 512 512 "$BASE_PNG" --out public/icon.png

# Compile iconset to macOS .icns file
iconutil -c icns build/icon.iconset -o build/icon.icns

# Clean up iconset temp folder
rm -rf build/icon.iconset

echo "✅ App icons successfully regenerated with transparent background and full bleed:"
echo "   - public/icon.png (Window task tab & web)"
echo "   - build/icon.png (Windows / Linux installer & taskbar)"
echo "   - build/icon.icns (macOS app bundle & Dock)"
