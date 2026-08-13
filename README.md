# Web2Fig

Web2Fig captures a rendered webpage or selected DOM element and places a Figma-compatible payload on the clipboard. Paste it into an open Figma canvas using `⌘V` (macOS) or `Ctrl+V` (Windows).

**Public site:** <https://bukhtyarhaider.github.io/Web2Fig/>  
**Privacy policy:** <https://bukhtyarhaider.github.io/Web2Fig/privacy.html>  
**Support:** <https://bukhtyarhaider.github.io/Web2Fig/support.html>

## Features

- Capture the entire rendered webpage or pick one DOM element.
- Preserve the page’s editable layout, text, computed styles, SVGs, and visible image assets where the platform permits.
- Resolve visible cross-origin media directly from its original host during the user-initiated capture.
- Process captures locally in the browser with no account, analytics, or Web2Fig cloud service.

## Install locally (Developer Mode)

1. Open `chrome://extensions` in Google Chrome.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose this `Web2Fig` folder.
4. Open a regular webpage, click the Web2Fig toolbar icon, and select **Capture entire page** or **Inspect & Pick Element**.

For local `file://` pages, enable **Allow access to file URLs** in Web2Fig’s details on `chrome://extensions`.

## Release build

```bash
npm run build
```

This renders the extension icons and creates `dist/web2fig-v<version>.zip`, containing only the files needed by Chrome. Submit that zip in the Chrome Web Store Developer Dashboard.

## Project structure

- `manifest.json` — Manifest V3 configuration with minimal required permissions.
- `background.js` — action handler and cross-origin visual-asset bridge.
- `capture.js` — page serialization and Figma clipboard-payload encoder.
- `toolbar.js` — in-page capture controls and element picker.
- `docs/` — GitHub Pages site: homepage, About, Support, Privacy Policy, and Terms.
- `.github/workflows/deploy-pages.yml` — automated GitHub Pages deployment.
- `CHROMEWEBSTORE.md` — exact Chrome Web Store copy, permission rationale, and submission checklist.

## Store submission

Read [CHROMEWEBSTORE.md](CHROMEWEBSTORE.md) before uploading. It includes listing copy, URLs, data-practices guidance, and the required store-assets checklist.

## License

[MIT](LICENSE)
