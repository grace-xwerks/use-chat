---
title: Use Chat — Privacy Policy
---

# Use Chat — Privacy Policy

_Last updated: 2026-05-28_

**Use Chat** ("the extension") is a Chrome extension developed by Grace Engineering for internal use by `@graceeng.com` employees. It nudges users toward Google Chat when emailing internal teammates.

## What the extension does

When a Gmail compose window is open, the extension:

- Reads the recipient chips and subject line from the compose DOM to detect whether all recipients are at `graceeng.com`.
- Displays an in-page banner suggesting Google Chat when appropriate.
- Optionally shows a confirmation modal when the user clicks Send.

## What data the extension collects

**None.** The extension performs all logic locally in the browser tab. It does not send any data to Grace Engineering, the developer, or any third party. There are no analytics, telemetry, error reporting, or remote logging.

## What data the extension stores

The extension uses `chrome.storage.local` (local browser storage) to remember dismiss timestamps for the banner. Specifically:

- **Key:** `useChatDismissals`
- **Contents:** A map of `recipient-email -> dismiss-timestamp` used to suppress the banner for 30 minutes after the user dismisses it for a given recipient.
- **Storage location:** The user's local Chrome profile only. Not synchronized to any Google account, server, or backup.

This data never leaves the user's device.

## Permissions

- `storage` — used solely to persist the dismiss timestamps described above.
- `https://mail.google.com/*` host access — required to read the compose window and inject the nudge banner.

The extension does **not** request or use:

- Network or `fetch` access
- Tabs API, history API, or bookmarks API
- Background scripts or service workers
- Access to any site other than Gmail
- Access to other Google accounts or services

## Source code

The extension is open source: <https://github.com/grace-xwerks/use-chat>

## Contact

Questions, concerns, or vulnerability reports: open an issue at the repository above, or contact Grace Engineering IT.
