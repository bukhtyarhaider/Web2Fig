# Web2Fig developer information

## Maintainer

**Bukhtyar Haider Khan** is the creator and maintainer of Web2Fig.

- GitHub: <https://github.com/bukhtyarhaider>
- Project repository: <https://github.com/bukhtyarhaider/Web2Fig>
- Website: <https://bukhtyarhaider.github.io/Web2Fig/>
- Support: <https://bukhtyarhaider.github.io/Web2Fig/support.html>
- Email: <bukhtyar.haider1@gmail.com>

## Responsibilities

The maintainer owns the extension’s release process, Chrome Web Store metadata, privacy disclosures, public support channels, and security triage. Changes that affect permissions, data handling, third-party requests, or the Chrome Web Store listing must be reviewed against `CHROMEWEBSTORE.md` and `PRIVACY_POLICY.md` before release.

## Support and security

Use [GitHub Issues](https://github.com/bukhtyarhaider/Web2Fig/issues) for reproducible bugs, feature requests, and documentation improvements. Do not post credentials, personally identifiable information, private page content, or a security vulnerability in a public issue. For sensitive reports, email the maintainer with “Web2Fig security” in the subject line.

## Release ownership

1. Update the version in `manifest.json` and `package.json` together.
2. Confirm the permissions and data-practice statements are still accurate.
3. Run `npm run build` and test the unpacked build in Chrome.
4. Update the version history and store listing copy when behavior changes.
5. Publish the release archive and complete the Chrome Web Store dashboard fields.
