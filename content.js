const CONFIG = {
  domain: 'graceeng.com',
  chatUrl: 'https://chat.google.com',
  // Subject keywords (case-insensitive substring match) that bypass the nudge.
  // Use for cases where email genuinely is the right channel: legal CYA,
  // audit trails, FYI threads with attachments, etc.
  subjectKeywordExceptions: ['[email-ok]', 'fyi:', 'audit', 'legal', 'invoice']
};

const BANNER_ID = 'use-chat-banner';

// Track instrumented compose windows so we don't double-attach observers
const instrumented = new WeakSet();

// ─────────────────────────────────────────────
// RECIPIENT DETECTION
// Tries multiple Gmail DOM patterns for resilience
// ─────────────────────────────────────────────
function getAllRecipientEmails(composeEl) {
  const found = new Set();

  composeEl.querySelectorAll('[data-hovercard-id]').forEach(el => {
    const val = el.getAttribute('data-hovercard-id');
    if (val && val.includes('@')) found.add(val.toLowerCase());
  });

  composeEl.querySelectorAll('span[email]').forEach(el => {
    const val = el.getAttribute('email');
    if (val && val.includes('@')) found.add(val.toLowerCase());
  });

  return [...found];
}

function getInternalRecipients(composeEl) {
  const suffix = '@' + CONFIG.domain;
  return getAllRecipientEmails(composeEl).filter(e => e.endsWith(suffix));
}

function hasExternalRecipient(composeEl) {
  const suffix = '@' + CONFIG.domain;
  return getAllRecipientEmails(composeEl).some(e => !e.endsWith(suffix));
}

function subjectMatchesException(composeEl) {
  const input = composeEl.querySelector('input[name="subjectbox"]');
  if (!input || !input.value) return false;
  const subject = input.value.toLowerCase();
  return CONFIG.subjectKeywordExceptions.some(kw =>
    subject.includes(kw.toLowerCase())
  );
}

// ─────────────────────────────────────────────
// BANNER INJECTION
// ─────────────────────────────────────────────
function updateBanner(composeEl) {
  const existing = composeEl.querySelector('#' + BANNER_ID);
  const internal = getInternalRecipients(composeEl);

  // Suppress when:
  //  - no internal recipients
  //  - mixed audience (external + internal) — email is the right tool there
  //  - subject contains an exception keyword
  const suppress =
    internal.length === 0 ||
    hasExternalRecipient(composeEl) ||
    subjectMatchesException(composeEl);

  if (suppress) {
    if (existing) existing.remove();
    return;
  }

  // Already showing — update recipient count
  if (existing) {
    const countEl = existing.querySelector('.ucb-count');
    if (countEl) {
      const n = internal.length;
      countEl.textContent = `${n} internal teammate${n > 1 ? 's' : ''} detected — keep it in Google Chat.`;
    }
    return;
  }

  // Build banner
  const banner = document.createElement('div');
  banner.id = BANNER_ID;

  const n = internal.length;
  banner.innerHTML = `
    <span class="ucb-icon">💬</span>
    <div class="ucb-content">
      <strong>Use Chat instead!</strong>
      <span class="ucb-count">${n} internal teammate${n > 1 ? 's' : ''} detected — keep it in Google Chat.</span>
    </div>
    <a href="${CONFIG.chatUrl}" target="_blank" class="ucb-btn">Open Chat</a>
    <button class="ucb-dismiss" title="Dismiss">✕</button>
  `;

  banner.querySelector('.ucb-dismiss').addEventListener('click', () => {
    banner.remove();
  });

  // Insert above the message body
  const insertTarget =
    composeEl.querySelector('.Am.Al.editable') ||
    composeEl.querySelector('[contenteditable="true"]');

  if (insertTarget && insertTarget.parentElement) {
    insertTarget.parentElement.insertBefore(banner, insertTarget);
  } else {
    composeEl.prepend(banner);
  }
}

// ─────────────────────────────────────────────
// COMPOSE WINDOW INSTRUMENTATION
// Attaches a MutationObserver to a single compose window
// ─────────────────────────────────────────────
function instrumentCompose(composeEl) {
  if (instrumented.has(composeEl)) return;
  instrumented.add(composeEl);

  let debounceTimer = null;

  const observer = new MutationObserver(() => {
    // Debounce: collapse rapid-fire mutations (tab completion, banner injection
    // itself) into a single deferred call once the DOM settles
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => updateBanner(composeEl), 150);
  });

  observer.observe(composeEl, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-hovercard-id', 'email']
  });

  // Subject typing doesn't mutate DOM — listen for input so keyword
  // exceptions take effect as the user types.
  composeEl.addEventListener('input', e => {
    if (e.target.matches && e.target.matches('input[name="subjectbox"]')) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => updateBanner(composeEl), 150);
    }
  });

  updateBanner(composeEl);
}

// ─────────────────────────────────────────────
// TOP-LEVEL OBSERVER
// Watches for Gmail compose windows being added to the DOM
// Handles both popup and full-screen compose modes
// ─────────────────────────────────────────────
function findAndInstrumentComposeWindows() {
  document.querySelectorAll([
    '[aria-label="New Message"]',
    '[aria-label^="Message -"]',
    '.nH.Hd[role="dialog"]'
  ].join(', ')).forEach(instrumentCompose);
}

const rootObserver = new MutationObserver(findAndInstrumentComposeWindows);

rootObserver.observe(document.body, {
  childList: true,
  subtree: true
});

// ─────────────────────────────────────────────
// POLLING FALLBACK
// Gmail's SPA can have compose windows open before or during
// script load. Poll aggressively for the first 5s, then slow
// down to a lazy heartbeat for the lifetime of the tab.
// ─────────────────────────────────────────────
let pollCount = 0;
const MAX_FAST_POLLS = 20; // 20 × 250ms = 5 seconds

function poll() {
  findAndInstrumentComposeWindows();
  pollCount++;

  if (pollCount < MAX_FAST_POLLS) {
    setTimeout(poll, 250);       // fast: every 250ms for 5s
  } else {
    setTimeout(poll, 3000);      // slow: every 3s forever
  }
}

poll();
