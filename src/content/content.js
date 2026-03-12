const TARGET_IDS = ['sidebar-wrapper', 'channel-chatroom', 'injected-channel-player'];
const KC_PANEL_ID = 'kick-cleaner-panel';

function removeElement(el) {
  if (el && el.parentNode) el.remove();
}

// Do not remove meta tags (viewport/charset) – it breaks page init and causes stuck loading.
// Favicon is hidden via content.css (link[rel="icon"]).

// Target elements are hidden via CSS only so the SPA can complete its loading state.
function removeTargetElements(_root) { /* no-op: we hide via content.css */ }

const BLOCKED_ATTR = 'data-kick-blocked';

/** Prevent image from loading by clearing src/srcset (skip if already blocked) */
function blockImageLoad(img) {
  if (!img || img.tagName !== 'IMG') return;
  if (img.hasAttribute(BLOCKED_ATTR)) return;
  img.setAttribute(BLOCKED_ATTR, '1');
  img.removeAttribute('src');
  img.removeAttribute('srcset');
}

/** Prevent video from loading by clearing src and source elements (skip if already blocked) */
function blockVideoLoad(video) {
  if (!video || video.tagName !== 'VIDEO') return;
  if (video.hasAttribute(BLOCKED_ATTR)) return;
  video.setAttribute(BLOCKED_ATTR, '1');
  video.removeAttribute('src');
  video.querySelectorAll?.('source')?.forEach(removeElement);
  if (video.pause) video.pause();
  if (video.currentTime !== undefined) video.currentTime = 0;
}

function blockImagesInRoot(root) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll('img').forEach(blockImageLoad);
}

function blockVideosInRoot(root) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll('video').forEach(blockVideoLoad);
}

function processAddedNode(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  // Do not remove TARGET_IDS nodes – hidden via CSS so SPA can finish loading
  if (node.tagName === 'IMG') {
    blockImageLoad(node);
  }
  if (node.tagName === 'VIDEO') {
    blockVideoLoad(node);
  }
  if (node.tagName === 'SOURCE' && node.parentElement?.tagName === 'VIDEO') {
    blockVideoLoad(node.parentElement);
  }
  removeTargetElements(node);
}

function runRemovalPass() {
  removeTargetElements(document);
  blockImagesInRoot(document);
  blockVideosInRoot(document);
  highlightVerifiedCategoryCards();
}

/** On kick.com/category/* pages: find category cards and green-border those whose first-child link is in verified links. */
function highlightVerifiedCategoryCards() {
  try {
    if (!/^https:\/\/(www\.)?kick\.com\/category\//.test(window.location.href)) return;
    const verified = getVerifiedLinks();
    if (verified.length === 0) return;
    const verifiedSet = new Set(verified);
    // Card has class group/card (and others). First child is the link.
    const cards = document.querySelectorAll('[class~="group/card"]');
    for (const card of cards) {
      const link = card.firstElementChild;
      if (!link || link.tagName !== 'A') continue;
      const href = link.href;
      if (!href) continue;
      if (verifiedSet.has(href)) {
        card.style.border = '2px solid #22c55e';
      } else {
        card.style.border = '';
        card.style.borderRadius = '';
      }
    }
  } catch (_) {}
}

// Throttle heavy work so the page stays responsive (fixes "keeps loading" / can't open Inspect)
let removalPassScheduled = false;
function scheduleRemovalPass() {
  if (removalPassScheduled) return;
  removalPassScheduled = true;
  requestAnimationFrame(() => {
    removalPassScheduled = false;
    runRemovalPass();
  });
}

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      processAddedNode(node);
      blockImagesInRoot(node);
      blockVideosInRoot(node);
    }
    // If Kick re-sets src/srcset on an image, re-block it
    if (mutation.type === 'attributes' && mutation.target.tagName === 'IMG') {
      if (mutation.attributeName === 'src' || mutation.attributeName === 'srcset') {
        const img = mutation.target;
        // Only re-block if the page actually set a real src (not our own clearing)
        if (img.getAttribute('src') || img.getAttribute('srcset')) {
          img.removeAttribute(BLOCKED_ATTR); // allow re-processing
          blockImageLoad(img);
        }
      }
    }
  }
  scheduleRemovalPass();
});

const VERIFIED_LINKS_KEY = 'kick_verified_links';

function getVerifiedLinks() {
  try {
    const stored = localStorage.getItem(VERIFIED_LINKS_KEY);
    if (!stored) return [];
    const links = JSON.parse(stored);
    return Array.isArray(links) ? links : [];
  } catch (_) {
    return [];
  }
}

function isCurrentPageVerified() {
  const url = window.location.href;
  return getVerifiedLinks().includes(url);
}

function showVerifiedPageWarning() {
  if (!isCurrentPageVerified()) return;
  if (document.getElementById('kick-extension-verified-warning')) return;
  const banner = document.createElement('div');
  banner.id = 'kick-extension-verified-warning';
  banner.setAttribute('role', 'alert');
  Object.assign(banner.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    zIndex: '2147483646',
    padding: '12px 16px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#1a1a1a',
    backgroundColor: '#fef08a',
    borderBottom: '2px solid #eab308',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  });
  const text = document.createElement('span');
  text.textContent = '⚠️ This page is in your verified links list.';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Dismiss';
  closeBtn.setAttribute('type', 'button');
  Object.assign(closeBtn.style, {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#1a1a1a',
    backgroundColor: 'transparent',
    border: '1px solid #a16207',
    borderRadius: '6px',
    cursor: 'pointer',
    flexShrink: '0',
  });
  closeBtn.addEventListener('click', () => {
    banner.remove();
  });
  banner.appendChild(text);
  banner.appendChild(closeBtn);
  (document.body || document.documentElement).appendChild(banner);
}

function savePageToStorage() {
  const url = window.location.href;
  let links = [];
  try {
    const stored = localStorage.getItem(VERIFIED_LINKS_KEY);
    if (stored) links = JSON.parse(stored);
    if (!Array.isArray(links)) links = [];
  } catch (_) {}
  if (!links.includes(url)) links.push(url);
  try {
    localStorage.setItem(VERIFIED_LINKS_KEY, JSON.stringify(links));
  } catch (_) {}
  return url;
}

/** Extract emails and http(s) links from the current page (same logic as popup). */
function extractFromPage() {
  const emails = new Set();
  const linkRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const text = document.body?.innerText ?? document.body?.textContent ?? '';
  let m;
  while ((m = linkRegex.exec(text)) !== null) emails.add(m[0]);
  const emailLike = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  document.querySelectorAll('a[href^="mailto:"]').forEach((a) => {
    const href = (a.getAttribute('href') || '').replace(/^mailto:/i, '').trim();
    const addr = href.split(/[?&]/)[0].trim();
    if (addr && emailLike.test(addr)) emails.add(addr);
  });
  const websiteLinks = new Set();
  document.querySelectorAll('a[href]').forEach((a) => {
    const href = (a.href || a.getAttribute('href') || '').trim();
    if (href && (href.startsWith('http://') || href.startsWith('https://'))) websiteLinks.add(href);
  });
  const links = (websiteLinks.size ? [...websiteLinks] : []).filter(
    (url) => !url.toLowerCase().includes('kick.com')
  );
  return { emails: [...emails], links };
}

function createCopyButton(value) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'kc-btn-copy';
  btn.title = 'Copy';
  btn.setAttribute('aria-label', 'Copy to clipboard');
  btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(value);
      btn.classList.add('kc-copied');
      btn.title = 'Copied!';
      setTimeout(() => {
        btn.classList.remove('kc-copied');
        btn.title = 'Copy';
      }, 1500);
    } catch (_) {}
  });
  return btn;
}

function renderKcList(listEl, items, isLink) {
  listEl.innerHTML = '';
  if (items.length === 0) {
    const li = document.createElement('li');
    li.className = 'kc-item-row kc-item-row--empty';
    li.innerHTML = '<span class="kc-item-text">None found</span>';
    listEl.appendChild(li);
    return;
  }
  items.forEach((item) => {
    const li = document.createElement('li');
    const row = document.createElement('div');
    row.className = 'kc-item-row';
    const text = document.createElement(isLink ? 'a' : 'span');
    text.className = 'kc-item-text';
    if (isLink) {
      text.href = item;
      text.target = '_blank';
      text.rel = 'noopener noreferrer';
    }
    text.textContent = item;
    row.appendChild(text);
    row.appendChild(createCopyButton(item));
    li.appendChild(row);
    listEl.appendChild(li);
  });
}

function ensureKickCleanerFont() {
  if (document.getElementById('kc-font-link')) return;
  const link = document.createElement('link');
  link.id = 'kc-font-link';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';
  (document.head || document.documentElement).appendChild(link);
}

function createKickCleanerPanel() {
  if (document.getElementById(KC_PANEL_ID)) return;
  ensureKickCleanerFont();
  const panel = document.createElement('div');
  panel.id = KC_PANEL_ID;
  panel.className = 'kc-panel';
  const version = (typeof chrome !== 'undefined' && chrome.runtime?.getManifest)
    ? chrome.runtime.getManifest().version
    : '1.0.0';
  const logoUrl = (typeof chrome !== 'undefined' && chrome.runtime?.getURL)
    ? chrome.runtime.getURL('icons/logo.svg')
    : '';
  panel.innerHTML = `
    <header class="kc-header">
      <div class="kc-header-brand">
        <img src="${logoUrl}" alt="" class="kc-logo" width="36" height="36">
        <div class="kc-header-text">
          <h1 class="kc-title">Kick Cleaner</h1>
          <span class="kc-version" id="kc-version">${version}</span>
        </div>
      </div>
      <button type="button" id="kc-toggle" class="kc-toggle" title="Collapse panel" aria-label="Collapse panel">−</button>
    </header>
    <section class="kc-copy-current-row" aria-label="Copy current page link">
      <button type="button" id="kc-copy-current-link" class="kc-btn-copy-current" title="Copy current page URL">
        <span class="kc-btn-copy-current-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        </span>
        <span class="kc-btn-copy-current-label">Copy current link</span>
      </button>
      <span id="kc-copy-current-feedback" class="kc-copy-current-feedback" hidden aria-live="polite">Copied!</span>
    </section>
    <section class="kc-verify-row" aria-label="Verify and save this page">
      <button type="button" id="kc-verify-save" class="kc-btn-verify" title="Add this page to verified links">Verify & Save</button>
    </section>
    <main class="kc-main">
      <section class="kc-card kc-section-extracted" aria-label="Extracted from this page">
        <h2 class="kc-card-title">From this page</h2>
        <div id="kc-extracted-error" class="kc-state kc-state-error" hidden role="alert"></div>
        <div id="kc-extracted-content" class="kc-content">
          <div class="kc-block">
            <h3 class="kc-block-title"><span class="kc-block-icon" aria-hidden="true">@</span> Emails</h3>
            <ul id="kc-extracted-emails" class="kc-item-list" aria-label="Extracted emails"></ul>
          </div>
          <div class="kc-block">
            <h3 class="kc-block-title"><span class="kc-block-icon" aria-hidden="true">↗</span> Links</h3>
            <ul id="kc-extracted-links" class="kc-item-list" aria-label="Extracted links"></ul>
          </div>
        </div>
      </section>
    </main>
  `;
  (document.body || document.documentElement).appendChild(panel);

  const copyCurrentBtn = panel.querySelector('#kc-copy-current-link');
  const copyCurrentFeedback = panel.querySelector('#kc-copy-current-feedback');
  copyCurrentBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      copyCurrentFeedback.textContent = 'Copied!';
      copyCurrentFeedback.hidden = false;
      setTimeout(() => { copyCurrentFeedback.hidden = true; }, 2000);
    } catch (_) {
      copyCurrentFeedback.textContent = 'Failed';
      copyCurrentFeedback.hidden = false;
      setTimeout(() => { copyCurrentFeedback.hidden = true; }, 2000);
    }
  });

  const verifyBtn = panel.querySelector('#kc-verify-save');
  verifyBtn.addEventListener('click', () => {
    savePageToStorage();
    const prev = verifyBtn.textContent;
    verifyBtn.textContent = 'Saved!';
    verifyBtn.classList.add('kc-btn-verify--saved');
    setTimeout(() => {
      verifyBtn.textContent = prev;
      verifyBtn.classList.remove('kc-btn-verify--saved');
    }, 1500);
  });

  const toggleBtn = panel.querySelector('#kc-toggle');
  toggleBtn.addEventListener('click', () => {
    panel.classList.toggle('kc-panel--collapsed');
    toggleBtn.textContent = panel.classList.contains('kc-panel--collapsed') ? '+' : '−';
    toggleBtn.title = panel.classList.contains('kc-panel--collapsed') ? 'Expand panel' : 'Collapse panel';
  });

  const errorEl = panel.querySelector('#kc-extracted-error');
  const contentEl = panel.querySelector('#kc-extracted-content');
  const emailsList = panel.querySelector('#kc-extracted-emails');
  const linksList = panel.querySelector('#kc-extracted-links');

  function setStatus(err, showContent) {
    errorEl.hidden = !err;
    if (err) errorEl.textContent = err;
    contentEl.hidden = !showContent;
  }

  try {
    const data = extractFromPage();
    setStatus(false, true);
    renderKcList(emailsList, data.emails, false);
    renderKcList(linksList, data.links, true);
  } catch (e) {
    setStatus(e?.message || 'Could not read page.', false);
  }
}

function startObserving() {
  if (!document.body) {
    requestAnimationFrame(startObserving);
    return;
  }
  // Show warning first if this page is in verified links
  showVerifiedPageWarning();
  // Kick Cleaner panel (top-right, includes Verify & Save)
  createKickCleanerPanel();
  runRemovalPass();
  observer.observe(document.body, { 
    childList: true, 
    subtree: true, 
    attributes: true, 
    attributeFilter: ['src', 'srcset'] 
  });

  // Re-inject after page/SPA has settled (kick.com may replace body)
  setTimeout(createKickCleanerPanel, 500);
  setTimeout(createKickCleanerPanel, 2000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startObserving);
} else {
  startObserving();
}

runRemovalPass();

// https://x.com/ganasty77