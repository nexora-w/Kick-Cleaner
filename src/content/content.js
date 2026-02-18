const TARGET_IDS = ['sidebar-wrapper', 'channel-chatroom', 'injected-channel-player'];

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
    if (!document.getElementById('kick-extension-verify-btn')) {
      createVerificationButton();
    }
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

function createVerificationButton() {
  if (document.getElementById('kick-extension-verify-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'kick-extension-verify-btn';
  btn.textContent = 'Verify & Save';
  btn.setAttribute('type', 'button');
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: '2147483647',
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#fff',
    backgroundColor: '#53fc18',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    fontFamily: 'inherit',
  });
  btn.addEventListener('click', () => {
    savePageToStorage();
    const prev = btn.textContent;
    btn.textContent = 'Saved!';
    btn.style.backgroundColor = '#2ea043';
    setTimeout(() => {
      btn.textContent = prev;
      btn.style.backgroundColor = '#53fc18';
    }, 1500);
  });
  // Append to documentElement so button persists when SPA replaces body
  (document.body || document.documentElement).appendChild(btn);
}

function startObserving() {
  if (!document.body) {
    requestAnimationFrame(startObserving);
    return;
  }
  // Show warning first if this page is in verified links
  showVerifiedPageWarning();
  // Inject button first so it exists even if later code throws
  createVerificationButton();
  runRemovalPass();
  observer.observe(document.body, { 
    childList: true, 
    subtree: true, 
    attributes: true, 
    attributeFilter: ['src', 'srcset'] 
  });

  // Re-inject button after page/SPA has settled (kick.com may render late)
  setTimeout(createVerificationButton, 500);
  setTimeout(createVerificationButton, 2000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startObserving);
} else {
  startObserving();
}

runRemovalPass();

// https://x.com/ganasty77