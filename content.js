const CONFIG = {
  domain: 'graceeng.com',
  chatUrl: 'https://chat.google.com'
};

const BANNER_ID = 'use-chat-banner';

// Track instrumented compose windows so we don't double-attach observers
const instrumented = new WeakSet();

// ─────────────────────────────────────────────
// RECIPIENT DETECTION
// Tries multiple Gmail DOM patterns for resilience
// ─────────────────────────────────────────────
function getInternalRecipients(composeEl) {
  const found = new Set();

  // Pattern 1: data-hovercard-id (most reliable, used on recipient chips)
  composeEl.querySelectorAll('[data-hovercard-id]').forEach(el => {
    const val = el.getAttribute('data-hovercard-id');
    if (val && val.toLowerCase().endsWith('@' + CONFIG.domain)) {
      found.add(val.toLowerCase());
    }
  });

  // Pattern 2: email attribute on spans (older Gmail builds)
  composeEl.querySelectorAll('span[email]').forEach(el => {
    const val = el.getAttribute('email');
    if (val && val.toLowerCase().endsWith('@' + CONFIG.domain)) {
      found.add(val.toLowerCase());
    }
  });

  return [...found];
}

// ─────────────────────────────────────────────
// BANNER INJECTION
// ─────────────────────────────────────────────
function updateBanner(composeEl) {
  const existing = composeEl.querySelector('#' + BANNER_ID);
  const internal = getInternalRecipients(composeEl);

  // No internal recipients — remove banner if present
  if (internal.length === 0) {
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
