# Privacy Policy for Web2Fig

**Effective Date:** August 14, 2026  
**Last Updated:** August 14, 2026

Web2Fig ("we", "our", or "the extension") is committed to respecting and protecting your privacy. This Privacy Policy explains how Web2Fig operates and handles your data.

## 1. Information We Do Not Collect

Web2Fig **does not collect, store, transmit, or share any personal data or usage information**.

- **No Personal Identifiers:** We do not collect names, email addresses, IP addresses, browser IDs, or device identifiers.
- **No Browsing Activity or History:** We do not track, log, or monitor the websites you visit, the URLs you browse, or how long you spend on any webpage.
- **No Captured Data Uploads:** When you capture a webpage or element using Web2Fig, the DOM tree, CSS styles, images, and text content are serialized entirely in your browser's local memory. No page content is uploaded to external servers or cloud services.
- **No Analytics or Telemetry:** Web2Fig contains zero tracking pixels, analytics scripts, or telemetry frameworks.

## 2. How Data is Processed

All operations performed by Web2Fig occur **100% locally** inside your web browser tab:

1. **DOM & Style Serialization:** When initiated by the user, Web2Fig reads the computed styles and layout of the active tab.
2. **Local Clipboard Encoding:** The serialized layout is encoded into a Figma-compatible format and written directly to your operating system's clipboard (`navigator.clipboard`).
3. **Cross-Origin Media Bridge:** If a page contains external images or icons hosted on remote CDNs, the extension's background service worker fetches those images locally into data URLs so they appear correctly when pasted in Figma. No image URLs or media data are saved or sent anywhere else.

## 3. Storage and Permissions

- **Local Storage:** Web2Fig does not store persistent browser storage or cookies.
- **Permissions:** Web2Fig requests permissions (`activeTab`, `scripting`, `clipboardWrite`, `tabs`, and `<all_urls>`) strictly to perform in-page DOM capture, load cross-origin images for the active capture, and place the result onto your local clipboard.

## 4. Third-Party Services

Web2Fig does not integrate with third-party tracking, advertising, analytics, or external API providers.

## 5. Changes to This Privacy Policy

We may update this Privacy Policy from time to time if functionality or regulations change. Any updates will be reflected in the "Last Updated" date above.

## 6. Contact Us

If you have any questions or feedback regarding this Privacy Policy, please open an issue on our official code repository or contact the extension maintainers.
