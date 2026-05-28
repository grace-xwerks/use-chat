# Chrome Web Store listing copy

Paste these fields into the Chrome Web Store developer dashboard when
publishing or updating the listing.

## Short description (under 132 chars)

```
Nudges Grace Engineering employees to use Google Chat instead of email when
the recipient is an internal teammate.
```

## Detailed description

```
Use Chat is an internal Chrome extension for Grace Engineering (graceeng.com).

When you compose an email in Gmail and the only recipients are @graceeng.com
teammates, Use Chat shows a discreet banner suggesting Google Chat — often
the faster, more conversational tool for quick internal questions.

Features:
• Detects internal recipients automatically as you add them.
• Stays quiet on mixed-audience emails (internal + external) and on threads
  whose subject contains opt-out keywords (e.g. "fyi:", "[email-ok]",
  "legal", "audit", "invoice").
• Shows each recipient's name as a chip linking to Google Chat.
• Confirmation modal on Send for internal-only emails — one click to keep
  drafting, one click to send anyway.
• Per-recipient dismiss memory: hide the banner for a person for 30 minutes.

Use Chat does not collect, transmit, or store any personal data. All logic
runs locally in your browser. See the privacy policy for details:
https://grace-xwerks.github.io/use-chat/privacy
```

## Category

Productivity

## Permission justifications

### `storage`

```
Used solely to remember which recipients the user has dismissed the banner
for, so the same nudge doesn't reappear for 30 minutes after dismissal.
Data is stored locally in the browser only — never transmitted off-device.
```

### Host permission: `https://mail.google.com/*`

```
The extension is a Gmail-only nudge tool. It reads the compose window's
recipient chips and subject input to decide when to show the banner, and
injects banner/modal DOM into the Gmail page. No other site is touched.
```

## Single purpose description

```
Suggest Google Chat when a Gmail compose has only internal Grace Engineering
recipients.
```

## Visibility

- Set to **Unlisted** during initial publish.
- Distribution to fleet handled via Workspace Admin Console → Devices →
  Chrome → Apps & Extensions → force-install by extension ID.
