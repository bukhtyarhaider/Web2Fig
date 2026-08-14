# Web2Fig

Web2Fig captures a rendered webpage or selected DOM element and places a Figma-compatible payload on the clipboard. Paste it into an open Figma canvas using `⌘V` (macOS) or `Ctrl+V` (Windows).

**Public site:** <https://bukhtyarhaider.github.io/Web2Fig/>  
**Privacy policy:** <https://bukhtyarhaider.github.io/Web2Fig/privacy.html>  
**Support:** <https://bukhtyarhaider.github.io/Web2Fig/support.html>

## Maintainer

Web2Fig is designed and maintained by **Bukhtyar Haider Khan**.

- GitHub: [@bukhtyarhaider](https://github.com/bukhtyarhaider)
- Product and support: <https://bukhtyarhaider.github.io/Web2Fig/developer.html>
- Contact: [bukhtyar.haider1@gmail.com](mailto:bukhtyar.haider1@gmail.com)

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

## How it works

1. Clicking the extension action injects the capture engine and the in-page Web2Fig controls into the active tab.
2. You choose the whole document or select one element.
3. The capture engine reads the displayed DOM, layout, computed styles, and visible assets to build a Figma-compatible payload.
4. The result is written to your local clipboard for pasting into Figma.

The extension runs only after you activate it. It does not use a backend service, analytics, user accounts, or persistent capture storage. See the [Privacy Policy](PRIVACY_POLICY.md) for the full disclosure.

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
- `DEVELOPER.md` — maintainer, support, and release ownership details.
- `CONTRIBUTING.md` — contribution and bug-reporting guidance.

## Development

Web2Fig is dependency-free at runtime. A current Node.js installation is enough for the small build scripts.

```bash
npm run icons    # regenerate 16, 32, 48, and 128px extension icons
npm run package  # create the Chrome Web Store upload archive
npm run build    # run both commands
```

Before publishing a change, run `npm run build`, load the unpacked extension in Chrome, and test both whole-page and element captures on a normal webpage containing text, remote images, and SVGs.

## Store submission

Read [CHROMEWEBSTORE.md](CHROMEWEBSTORE.md) before uploading. It includes listing copy, URLs, data-practices guidance, and the required store-assets checklist.

## Contributing and support

Bug reports, documentation corrections, and focused improvements are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or pull request. Do not include private page content, credentials, or sensitive screenshots in public reports.

## License

[MIT](LICENSE)
