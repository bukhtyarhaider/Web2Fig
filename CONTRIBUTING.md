# Contributing to Web2Fig

Thanks for helping improve Web2Fig. Small, focused contributions are easiest to review and safest to release.

## Before you start

1. Check existing [issues](https://github.com/bukhtyarhaider/Web2Fig/issues) to avoid duplicates.
2. For a bug, reproduce it on a non-sensitive page whenever possible.
3. Keep changes tied to Web2Fig’s single purpose: converting a user-selected web page or element into a Figma-compatible clipboard payload.

## Local workflow

1. Load the `Web2Fig` directory through Chrome’s **Load unpacked** flow.
2. Make the smallest change that solves the issue.
3. Test both **Capture entire page** and **Inspect & Pick Element**.
4. Run `npm run build` before opening a pull request.

## Good bug reports

Include Chrome version, operating system, steps to reproduce, expected result, actual result, and a safe public test URL when available. Do **not** include passwords, private URLs, personally identifiable information, clipboard contents, or screenshots containing sensitive data.

## Pull requests

Describe the user impact, testing performed, and any changes to permissions, network behavior, privacy wording, or Chrome Web Store metadata. Update `README.md`, `PRIVACY_POLICY.md`, and `CHROMEWEBSTORE.md` whenever the behavior they describe changes.
