# Web2Fig Privacy Policy

**Effective and last updated:** August 14, 2026  
**Public policy URL:** `https://bukhtyarhaider.github.io/Web2Fig/privacy.html`

Web2Fig has no accounts, analytics, advertising, cloud storage, or developer-operated servers. It does not sell or share user data.

## What Web2Fig processes

Only after the user activates Web2Fig, it processes the selected webpage's DOM structure, displayed text, computed styles, layout data, and visible resources such as images, SVGs, and background assets. This may include personal or sensitive information if it is present on the page the user chooses. Processing is solely necessary to create the Figma-compatible clipboard payload requested by the user.

## Where processing happens

Processing occurs locally in the browser. Capture data remains in memory only long enough to create the clipboard payload; Web2Fig does not persist it. It does not use extension storage, browser sync, cookies, telemetry, or remote databases.

## Images and network requests

To preserve visible cross-origin images and SVGs, Web2Fig may request the same public asset URL directly from its original host after the user starts a capture. That is a browser request to the asset host—not a transfer to Web2Fig or a developer-operated service. Web2Fig does not upload captured page content or assets to a Web2Fig server.

## Clipboard

When capture completes, Web2Fig writes the Figma-compatible payload to the user's local system clipboard. Clipboard data is governed by the operating system and any application where the user pastes it. Web2Fig does not read that data back or retain it.

## Permissions

| Permission | Why it is needed |
| --- | --- |
| `activeTab` | Lets Web2Fig operate only in the tab the user explicitly activates it on. |
| `scripting` | Lets Web2Fig inject its capture and element-selection UI into that active tab. |
| `<all_urls>` host access | Lets the extension request cross-origin visual assets required for the user-initiated capture. It is not used for tracking or background browsing. |

## Sharing, sale, and retention

Web2Fig does not collect, sell, share, retain, or use captured content for advertising, profiling, analytics, or any purpose unrelated to the requested capture. No Web2Fig operator can access a capture because Web2Fig receives no copy.

## Changes and contact

If this policy changes, the effective date will be updated above. For questions or privacy requests, open an issue at <https://github.com/bukhtyarhaider/Web2Fig/issues>.
