# Chrome Web Store submission kit — Web2Fig

This file is the reviewed source for the Chrome Web Store dashboard. Do not claim a feature or data practice here that differs from the extension or [public Privacy Policy](https://bukhtyarhaider.github.io/Web2Fig/privacy.html).

## Listing fields

| Field | Submission value |
| --- | --- |
| Name | Web2Fig |
| Version | 1.0.0 |
| Category | Developer Tools |
| Language | English (United States) |
| Homepage | `https://bukhtyarhaider.github.io/Web2Fig/` |
| Support URL | `https://bukhtyarhaider.github.io/Web2Fig/support.html` |
| Privacy policy URL | `https://bukhtyarhaider.github.io/Web2Fig/privacy.html` |
| Developer | Bukhtyar Haider Khan |
| Developer profile | `https://bukhtyarhaider.github.io/Web2Fig/developer.html` |
| Support email | `bukhtyar.haider1@gmail.com` |

### Short description (106 / 132 characters)

> Capture rendered webpages or DOM elements and paste them directly into Figma as editable design layers.

### Detailed description

```text
Web2Fig brings a live webpage—or a single UI component—into Figma as an editable starting point.

CAPTURE WHAT YOU NEED
• Entire page: capture the page’s rendered layout, computed styles, text, visual assets, and SVGs.
• Element picker: hover and select an individual card, button, section, or DOM element.
• Editable output: paste the Figma-compatible result into an open Figma canvas with ⌘V (macOS) or Ctrl+V (Windows).

PRIVATE BY DESIGN
Web2Fig runs only when you activate it. Capture processing happens locally in your browser; there are no accounts, analytics, cloud storage, or Web2Fig servers. To preserve visible cross-origin assets, the extension may request the asset directly from its original host during a capture.

HOW TO USE
1. On a normal webpage, click the Web2Fig extension icon.
2. Choose Capture entire page, or Inspect & Pick Element.
3. Open Figma and paste onto a canvas.

NOTES
Chrome blocks extensions on browser-internal pages and other protected pages. Some protected media, proprietary embeds, and advanced browser effects cannot be reproduced exactly. For local file capture, enable “Allow access to file URLs” in the Web2Fig extension details.
```

## Single purpose

> Web2Fig captures a user-selected webpage or DOM element and converts its rendered structure and visual assets into a Figma-compatible clipboard payload.

## Permission justification

| Permission | Reviewer-facing justification |
| --- | --- |
| `activeTab` | Starts Web2Fig only in the current tab after the user clicks the extension action. |
| `scripting` | Injects the capture engine and selection UI into that user-activated tab. |
| `<all_urls>` host permission | Fetches cross-origin images, background images, and SVGs directly from their original hosts only while resolving assets for a user-initiated capture. Without it, those visible assets may be missing from the Figma output. |

`tabs` and `clipboardWrite` are intentionally not requested. The extension receives the active tab from the action click and writes to the clipboard from the user-initiated in-page capture flow.

## Privacy practices dashboard

Complete the dashboard’s privacy questionnaire truthfully for the exact build being uploaded:

- No data is collected, sold, or shared with Web2Fig or a developer-operated service.
- Web page content and visible resources are processed locally for the user-initiated capture and written to the local clipboard.
- A visible cross-origin asset may be requested directly from its original host during capture.
- Privacy-policy URL: `https://bukhtyarhaider.github.io/Web2Fig/privacy.html`.

The listing, dashboard answers, public policy, and packaged behavior must remain aligned.

## Developer and customer support

Web2Fig is created and maintained by **Bukhtyar Haider Khan**. The public developer profile is available at <https://bukhtyarhaider.github.io/Web2Fig/developer.html>. Users can receive help through the [support page](https://bukhtyarhaider.github.io/Web2Fig/support.html), [GitHub Issues](https://github.com/bukhtyarhaider/Web2Fig/issues), or <bukhtyar.haider1@gmail.com>.

## Upload checklist

- [ ] Enable GitHub Pages and verify the homepage, support, and privacy URLs load over HTTPS.
- [ ] Upload `dist/web2fig-v1.0.0.zip` to a draft item in the Chrome Web Store Developer Dashboard.
- [ ] Upload `assets/icon-128.png` as the store icon.
- [ ] Add 1–5 current, unedited product screenshots at 1280×800 (or 640×400), with square corners and no padding.
- [ ] Add a 440×280 PNG/JPEG small promotional tile and, if desired, a 1400×560 marquee tile.
- [ ] Set the support and privacy URLs above, category, language, and detailed description.
- [ ] Complete the Privacy practices questionnaire and certification based on the packaged build.
- [ ] Test the uploaded draft on common pages before submitting for review.

Do not use mockups in place of the required product screenshots: Chrome’s listing guidance expects screenshots to show the actual, current extension experience.

## Version history

### Version 1.0.0 — 2026-08-14

- Initial public release.
- Captures a full rendered page or a selected DOM element for Figma paste.
- Includes the Manifest V3 resource bridge for visible cross-origin image and SVG resolution.
- Uses local, in-memory capture and clipboard output with no analytics or cloud storage.
