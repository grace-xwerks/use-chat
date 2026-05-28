const CONFIG = {
  domain: 'graceeng.com',
  chatUrl: 'https://chat.google.com',
  // Subject keywords (case-insensitive substring match) that bypass the nudge.
  // Use for cases where email genuinely is the right channel: legal CYA,
  // audit trails, FYI threads with attachments, etc.
  subjectKeywordExceptions: ['[email-ok]', 'fyi:', 'audit', 'legal', 'invoice'],
  dismissTtlMs: 30 * 60 * 1000
};

const BANNER_ID = 'use-chat-banner';
const STORAGE_KEY = 'useChatDismissals';

// In-memory mirror of chrome.storage.local — primed on script load.
// Lets updateBanner stay synchronous (called from observers/polls).
let dismissCache = {};
chrome.storage.local.get(STORAGE_KEY, data => {
  dismissCache = data[STORAGE_KEY] || {};
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY]) {
    dismissCache = changes[STORAGE_KEY].newValue || {};
  }
});

function isDismissed(email) {
  const ts = dismissCache[email];
  return typeof ts === 'number' && (Date.now() - ts) < CONFIG.dismissTtlMs;
}

function recordDismissals(emails) {
  const now = Date.now();
  emails.forEach(e => { dismissCache[e] = now; });
  chrome.storage.local.set({ [STORAGE_KEY]: dismissCache });
}

// Track instrumented compose windows so we don't double-attach observers
const instrumented = new WeakSet();

// ─────────────────────────────────────────────
// RECIPIENT DETECTION
// Tries multiple Gmail DOM patterns for resilience
// ─────────────────────────────────────────────
function getAllRecipients(composeEl) {
  const byEmail = new Map();

  const record = (email, name) => {
    if (!email || !email.includes('@')) return;
    const key = email.toLowerCase();
    // First non-empty name wins; don't let a later bare chip clobber it.
    if (!byEmail.has(key) || (name && !byEmail.get(key).name)) {
      byEmail.set(key, { email: key, name: name || '' });
    }
  };

  composeEl.querySelectorAll('[data-hovercard-id]').forEach(el => {
    record(el.getAttribute('data-hovercard-id'), extractName(el));
  });

  composeEl.querySelectorAll('span[email]').forEach(el => {
    record(el.getAttribute('email'), extractName(el));
  });

  return [...byEmail.values()];
}

function extractName(el) {
  // Gmail chips usually carry name= on the same node as email/data-hovercard-id.
  const name = el.getAttribute('name');
  if (name && name.trim()) return name.trim();
  const text = (el.textContent || '').trim();
  // The chip's text is often "Jane Doe <jane@x.com>" — strip the address.
  return text.replace(/<[^>]+>/g, '').trim();
}

function displayName(recipient) {
  return recipient.name || recipient.email.split('@')[0];
}

function dmUrl(email) {
  // Email-keyed Chat deep link — opens or starts a DM with this address.
  return `https://mail.google.com/chat/u/0/#chat/dm/?email=${encodeURIComponent(email)}`;
}

function getInternalRecipients(composeEl) {
  const suffix = '@' + CONFIG.domain;
  return getAllRecipients(composeEl).filter(r => r.email.endsWith(suffix));
}

function hasExternalRecipient(composeEl) {
  const suffix = '@' + CONFIG.domain;
  return getAllRecipients(composeEl).some(r => !r.email.endsWith(suffix));
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
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function renderBannerBody(banner, internal) {
  const chips = internal.map(r => {
    const label = escapeHtml(displayName(r));
    return `<a class="ucb-chip" href="${dmUrl(r.email)}" target="_blank" title="DM ${escapeHtml(r.email)}">${label}</a>`;
  }).join('');

  const leadIn = internal.length === 1
    ? 'This teammate is on Chat:'
    : 'These teammates are on Chat:';

  banner.innerHTML = `
    <span class="ucb-icon">💬</span>
    <div class="ucb-content">
      <strong>Use Chat instead!</strong>
      <span class="ucb-count">${leadIn}</span>
      <div class="ucb-chips">${chips}</div>
    </div>
    <button class="ucb-dismiss" title="Dismiss">✕</button>
  `;

  banner.querySelector('.ucb-dismiss').addEventListener('click', () => {
    recordDismissals(internal.map(r => r.email));
    banner.remove();
  });
}

function updateBanner(composeEl) {
  const existing = composeEl.querySelector('#' + BANNER_ID);
  const internal = getInternalRecipients(composeEl);

  // Suppress when:
  //  - no internal recipients
  //  - mixed audience (external + internal) — email is the right tool there
  //  - subject contains an exception keyword
  // Dismissed when every current internal recipient has a fresh dismiss
  // record. Adding a new teammate brings the banner back automatically.
  const allDismissed = internal.length > 0 &&
    internal.every(r => isDismissed(r.email));

  const suppress =
    internal.length === 0 ||
    hasExternalRecipient(composeEl) ||
    subjectMatchesException(composeEl) ||
    allDismissed;

  if (suppress) {
    if (existing) existing.remove();
    return;
  }

  // Rebuild contents if already showing so name/link list stays accurate.
  if (existing) {
    renderBannerBody(existing, internal);
    return;
  }

  const banner = document.createElement('div');
  banner.id = BANNER_ID;
  renderBannerBody(banner, internal);

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
// SEND INTERCEPTION
// ─────────────────────────────────────────────
const MODAL_ID = 'use-chat-modal';

function isSendButton(el) {
  if (!el || !el.closest) return null;
  const btn = el.closest('[role="button"]');
  if (!btn) return null;
  const tip = btn.getAttribute('data-tooltip') || '';
  const label = btn.getAttribute('aria-label') || '';
  if (/^Send\b/.test(tip) || /^Send\b/.test(label)) return btn;
  return null;
}

function shouldInterceptSend(composeEl) {
  const internal = getInternalRecipients(composeEl);
  if (internal.length === 0) return null;
  if (hasExternalRecipient(composeEl)) return null;
  if (subjectMatchesException(composeEl)) return null;
  return internal;
}

function showConfirmModal(composeEl, internal, sendBtn) {
  if (composeEl.querySelector('#' + MODAL_ID)) return;

  const chips = internal.map(r => {
    const label = escapeHtml(displayName(r));
    return `<a class="ucb-chip" href="${dmUrl(r.email)}" target="_blank" title="DM ${escapeHtml(r.email)}">${label}</a>`;
  }).join('');

  const lead = internal.length === 1
    ? 'You\'re emailing an internal teammate.'
    : `You're emailing ${internal.length} internal teammates.`;

  const modal = document.createElement('div');
  modal.id = MODAL_ID;
  modal.innerHTML = `
    <div class="ucm-backdrop"></div>
    <div class="ucm-card" role="dialog" aria-modal="true">
      <div class="ucm-title">💬 Use Chat instead?</div>
      <div class="ucm-body">
        <p>${lead} Try Chat first — it's usually faster.</p>
        <div class="ucb-chips">${chips}</div>
      </div>
      <div class="ucm-actions">
        <button class="ucm-cancel">Back to draft</button>
        <button class="ucm-send">Send anyway</button>
      </div>
    </div>
  `;

  const close = () => modal.remove();

  modal.querySelector('.ucm-backdrop').addEventListener('click', close);
  modal.querySelector('.ucm-cancel').addEventListener('click', close);
  modal.querySelector('.ucm-send').addEventListener('click', () => {
    close();
    // Bypass our interceptor for this one synthesized click.
    sendBtn.dataset.ucbBypass = '1';
    sendBtn.click();
    delete sendBtn.dataset.ucbBypass;
  });

  composeEl.appendChild(modal);
}

function attachSendInterceptor(composeEl) {
  composeEl.addEventListener('click', e => {
    const btn = isSendButton(e.target);
    if (!btn) return;
    if (btn.dataset.ucbBypass === '1') return;

    const internal = shouldInterceptSend(composeEl);
    if (!internal) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    showConfirmModal(composeEl, internal, btn);
  }, true);

  // Ctrl/Cmd+Enter sends without clicking the button — gate that too.
  composeEl.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !(e.ctrlKey || e.metaKey)) return;
    const internal = shouldInterceptSend(composeEl);
    if (!internal) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const btn = composeEl.querySelector(
      '[role="button"][data-tooltip^="Send"], [role="button"][aria-label^="Send"]'
    );
    if (btn) showConfirmModal(composeEl, internal, btn);
  }, true);
}

// ─────────────────────────────────────────────
// COMPOSE WINDOW INSTRUMENTATION
// Attaches a MutationObserver to a single compose window
// ─────────────────────────────────────────────
function instrumentCompose(composeEl) {
  if (instrumented.has(composeEl)) return;
  instrumented.add(composeEl);

  attachSendInterceptor(composeEl);

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
