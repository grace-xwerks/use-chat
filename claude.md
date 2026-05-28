\# use-chat — Chrome Extension



Internal Chrome extension for Grace Engineering (grace-xwerks).

Detects internal @graceeng.com recipients in Gmail compose windows

and nudges the sender to use Google Chat instead.



\## Org context

\- Domain: graceeng.com

\- Chat URL: https://chat.google.com

\- Deployed via: Chrome managed extensions (Workspace admin)

\- Repo: grace-xwerks/use-chat



\## Extension structure

\- manifest.json   — MV3 manifest

\- content.js      — Content script, injected into mail.google.com

\- styles.css      — Banner styles injected alongside content.js



\## Current behavior (v1)

\- MutationObserver watches for Gmail compose windows (popup + full-screen)

\- Polling fallback (250ms × 20, then 3s) catches already-open windows

\- Debounced observer (150ms) prevents infinite loop on DOM mutation

\- Detects internal recipients via data-hovercard-id and span\[email] attributes

\- Injects a dismissable banner above the message body when internal

&#x20; recipients are present

\- Banner has "Open Chat" link and a dismiss button



\## Planned v2 features

1\. Deep link DM button — link to chat.google.com/dm/\[email]

2\. Show recipient display names in banner, not just count

3\. Dismiss memory — suppress banner per-recipient for 30min via chrome.storage.local

4\. Send button overlay — intercept Send click, show one-step confirm modal with Chat shortcut

5\. External passthrough — suppress banner if email has mixed internal + external recipients

6\. Keyword exceptions — config list of subject keywords that bypass the nudge



\## Dev setup

\- Load unpacked from chrome://extensions (Developer mode on)

\- No build step — vanilla JS, no bundler

\- Test in Gmail with a graceeng.com account



\## Coding conventions

\- Vanilla JS only, no frameworks or bundlers

\- MV3 compliant — no background scripts unless necessary

\- All config lives in a CONFIG object at the top of content.js

\- Comment section headers with ─── banners

\- Prefer WeakSet/WeakMap for DOM element tracking

