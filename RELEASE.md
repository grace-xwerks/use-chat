# Release process

How to ship a new version of Use Chat to the Chrome Web Store and
re-roll it out to Grace Engineering's managed Chrome fleet.

## One-time setup

1. Create a Chrome Web Store developer account at
   <https://chrome.google.com/webstore/devconsole>. Use a Grace
   Engineering Workspace account, not a personal Gmail.
   ($5 one-time registration fee.)
2. First publish:
   - Run `.\scripts\build-zip.ps1` to produce `dist\use-chat-vX.Y.Z.zip`.
   - In the developer dashboard, click **New item**, upload the zip.
   - Fill in listing copy from [docs/listing.md](docs/listing.md).
   - Set **Visibility: Unlisted**.
   - Set **Privacy policy URL** to
     `https://grace-xwerks.github.io/use-chat/privacy`.
   - Submit for review. Initial review can take a few business days.
3. Note the assigned **extension ID** (a 32-char string). Save it in
   Workspace admin and in any CI / deploy automation.
4. Workspace admin → Devices → Chrome → Apps & Extensions → Users &
   browsers → pick the OU(s) to receive the extension → Add by
   extension ID → set Installation policy: **Force install**.

## Every release

1. Make code changes on a branch, open a PR, merge to `main`.
2. Bump the `version` field in `manifest.json` (semver — patch for
   fixes, minor for features, major for breaking UX changes).
3. Update [docs/privacy.md](docs/privacy.md) `Last updated` if data
   handling changed.
4. Tag the release: `git tag vX.Y.Z && git push --tags`.
5. Build: `.\scripts\build-zip.ps1`.
6. Upload `dist\use-chat-vX.Y.Z.zip` in the Web Store dashboard →
   **Package** → **Upload new package** → **Submit for review**.
7. Once approved, the Workspace force-install pushes the update to
   managed Chrome browsers automatically within a few hours.

## Verification after rollout

1. Reload Gmail on a managed device, confirm `chrome://extensions`
   shows the new version and "Installed by your administrator".
2. Walk the [#1 manual checklist](https://github.com/grace-xwerks/use-chat/issues/1)
   for any new feature areas.

## Emergency disable

If a release breaks Gmail compose for the fleet:

1. Workspace admin → Apps & Extensions → set the extension's
   Installation policy to **Blocked** and the previously-pinned
   version to roll back, OR remove from the OU entirely.
2. Open a hotfix issue, ship a patch release, then re-enable.
