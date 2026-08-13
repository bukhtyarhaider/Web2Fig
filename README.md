# Web2Fig (v1.0.0)

Web2Fig captures a rendered webpage or a selected DOM element and puts a Figma-compatible payload on your clipboard. Paste it directly into an open Figma canvas with `⌘V` / `Ctrl+V`.

## Features

- **Entire Page & Element Picker**: Capture the whole webpage or select specific components.
- **Editable Layouts**: Converts HTML DOM trees and computed CSS styles into Figma auto-layout frames, typography, vector paths, and images.
- **Cross-Origin Media**: Service worker bridge fetches external CDN images, background images, and SVGs.
- **100% Local & Private**: No data uploaded to servers; processing occurs entirely in-memory and outputs to the clipboard.

## Install Locally (Developer Mode)

1. Open `chrome://extensions` in Google Chrome.
2. Enable **Developer mode** in the top right.
3. Click **Load unpacked** and select this `Web2Fig` folder.
4. Open any webpage, click the Web2Fig toolbar icon, then choose **Capture entire page** or **Pick one element**.

> **Note for local files (`file://`)**: Enable **Allow access to file URLs** in the extension details page in Chrome (`chrome://extensions` → Web2Fig → Details).

## Production Build & Packaging

To generate icons and build the release zip package for Chrome Web Store submission:

```bash
# Render icon assets (16x16, 32x32, 48x48, 128x128)
npm run icons

# Package release archive into dist/web2fig-v1.0.0.zip
npm run package

# Build all icons and package zip
npm run build
```

## Structure

- `manifest.json` - Manifest V3 extension configuration.
- `background.js` - Service worker for script injection and cross-origin image resolution bridge.
- `capture.js` - DOM serialization engine and Figma clipboard payload encoder.
- `toolbar.js` - Interactive in-page control panel and element selection picker.
- `assets/` - Generated PNG icons (16, 32, 48, 128px).
- `CHROMEWEBSTORE.md` - Chrome Web Store listing metadata, category tags, and permission justifications.
- `PRIVACY_POLICY.md` - Store compliance privacy policy document.
- `dist/web2fig-v1.0.0.zip` - Release package ready for Chrome Web Store Developer Dashboard.
