const TARGET_IDS = ['sidebar-wrapper', 'channel-chatroom', 'injected-channel-player'];

function removeElement(el) {
  if (el && el.parentNode) el.remove();
}

function removeMetadata(root) {
  if (!root) return;
  const container = root === document && document.head ? document.head : root;
  if (!container.querySelectorAll) return;
  container.querySelectorAll('meta').forEach(removeElement);
}

function removeTargetElements(root) {
  if (!root || !root.querySelector) return;
  TARGET_IDS.forEach((id) => {
    const el = root.getElementById ? root.getElementById(id) : root.querySelector(`#${CSS.escape(id)}`);
    if (el) removeElement(el);
  });
}

/** Prevent image from loading by clearing src/srcset */
function blockImageLoad(img) {
  if (!img || img.tagName !== 'IMG') return;
  img.removeAttribute('src');
  img.removeAttribute('srcset');
  img.src = '';
}

/** Prevent video from loading by clearing src and source elements */
function blockVideoLoad(video) {
  if (!video || video.tagName !== 'VIDEO') return;
  video.removeAttribute('src');
  video.querySelectorAll?.('source')?.forEach(removeElement);
  if (video.pause) video.pause();
  if (video.currentTime !== undefined) video.currentTime = 0;
  video.style.setProperty('opacity', '0', 'important');
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
  if (TARGET_IDS.includes(node.id)) {
    removeElement(node);
    return;
  }
  // Keep favicon visible – do not remove link[rel=icon]
  if (node.tagName === 'META') {
    removeElement(node);
  }
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
  removeMetadata(node);
}

function runRemovalPass() {
  removeTargetElements(document);
  removeMetadata(document);
  blockImagesInRoot(document);
  blockVideosInRoot(document);
}

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      processAddedNode(node);
      blockImagesInRoot(node);
      blockVideosInRoot(node);
    }
    // If page sets img src/srcset later, clear again so they never load
    if (mutation.type === 'attributes' && mutation.target.tagName === 'IMG') {
      if (mutation.attributeName === 'src' || mutation.attributeName === 'srcset') {
        blockImageLoad(mutation.target);
      }
    }
  }
  runRemovalPass();
  // Re-inject verification button if SPA removed it
  if (!document.getElementById('kick-extension-verify-btn')) {
    createVerificationButton();
  }
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
  removeMetadata(document);
  observer.observe(document.body, { 
    childList: true, 
    subtree: true, 
    attributes: true, 
    attributeFilter: ['style', 'class', 'src', 'srcset'] 
  });
  observer.observe(document.head, { childList: true, subtree: true });

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
removeMetadata(document);

// https://x.com/ganasty77