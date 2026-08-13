# Chrome Web Store Metadata & Publishing Guide — Web2Fig

This document serves as the single source of truth for publishing **Web2Fig** to the Chrome Web Store Developer Dashboard.

---

## 1. Store Listing Information

- **Extension Name**: Web2Fig
- **Version**: 1.0.0
- **Short Description** (106 / 132 characters):
  > Capture rendered webpages or DOM elements and paste them directly into Figma as editable design layers.
- **Primary Category**: Developer Tools
- **Secondary Category**: Productivity
- **Language**: English (United States)

---

## 2. Detailed Store Description

```text
Web2Fig lets designers and front-end developers capture live webpages—or individual UI components—and bring them directly into Figma as fully editable design frames and vector shapes.

✨ KEY FEATURES:
• Entire Page Capture: Serialize full webpage layouts, typography, computed CSS styles, and media.
• Precision Element Picker: Hover over and select individual cards, buttons, or sub-sections to capture only what you need.
• Editable Figma Layers: Converts DOM trees into Figma auto-layout frames, text objects, and image fills.
• Complete Style Fidelity: Preserves flexbox/grid structures, box shadows, border radii, linear gradients, and SVG vectors.
• Cross-Origin Asset Support: Automatically captures remote images, background images, and canvas elements.
• 100% Private & Local: All serialization and clipboard encoding happen locally inside your browser. No data or images are ever uploaded to an external server.

🚀 HOW TO USE:
1. Click the Web2Fig icon in your browser toolbar on any webpage.
2. Select "Capture entire page" or "Pick one element".
3. Open Figma and paste directly onto your canvas using ⌘V (macOS) or Ctrl+V (Windows).

FOR LOCAL FILE ACCESS (file://):
Enable "Allow access to file URLs" in Chrome Extensions settings (chrome://extensions -> Web2Fig -> Details).
```

---

## 3. Permissions Justifications (For Review Team)

Every permission declared in `manifest.json` is strictly required for core functionality:

| Permission | Technical Need & Justification |
| :--- | :--- |
| `activeTab` | Required to detect the active tab when the user clicks the extension action icon and launch the in-page capture overlay. |
| `scripting` | Required to inject `capture.js` (the DOM serialization engine) and `toolbar.js` (the interactive selection UI) into the active tab. |
| `clipboardWrite` | Required to write the generated Figma-compatible payload (`text/html` base64 data) directly to the system clipboard for instantaneous pasting. |
| `tabs` | Required to check the tab state, protocol restrictions (e.g. preventing execution on `chrome://` pages), and URL eligibility. |
| `host_permissions` (`<all_urls>`) | Required for the background service worker bridge to fetch cross-origin images, SVGs, and background assets referenced by the target page. Without cross-origin host permissions, external images hosted on CDNs would render as broken assets in Figma. |

---

## 4. Privacy & Single-Purpose Disclosure

- **Single Purpose Statement**: Web2Fig has a single purpose: capturing DOM layout and computed CSS styles from a webpage and converting them into a Figma-compatible clipboard payload.
- **Data Collection Declaration**:
  - **Personal Data Collected**: NONE.
  - **User Content Collected**: NONE (processed in-memory only).
  - **Web History / Tracking**: NONE.
  - **Remote Analytics**: NONE.
- **Third-Party Server Transmission**: 0 Bytes transmitted to external servers.

---

## 5. Asset & Screenshot Checklist

When uploading to the Chrome Web Store Developer Console, provide the following assets:

- [x] **Store Icon**: `assets/icon-128.png` (128×128 PNG)
- [ ] **Store Screenshot 1** (1280×800 or 640×400): Full page capture showing Web2Fig toolbar overlay on a live site.
- [ ] **Store Screenshot 2** (1280×800 or 640×400): Element picker highlighting a specific card/component.
- [ ] **Store Screenshot 3** (1280×800 or 640×400): Pasted editable layout frame inside Figma canvas.
- [ ] **Small Promotional Tile** (440×280 PNG/JPEG): Clean promotional graphic.

---

## 6. Version History

### Version 1.0.0 — 2026-08-14
- Initial production release.
- Added full webpage capture and interactive element selection picker.
- Implemented Manifest V3 background service worker resource bridge for cross-origin image resolution.
- Integrated shadow-DOM inspection, computed CSS layout extraction, and Figma HTML clipboard format encoding.
