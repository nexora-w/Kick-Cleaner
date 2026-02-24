document.getElementById('version').textContent = chrome.runtime.getManifest().version;

const loadingEl = document.getElementById('extracted-loading');
const errorEl = document.getElementById('extracted-error');
const contentEl = document.getElementById('extracted-content');
const emailsList = document.getElementById('extracted-emails');
const linksList = document.getElementById('extracted-links');

function setStatus(loading, error, showContent) {
  loadingEl.hidden = !loading;
  errorEl.hidden = !error;
  if (error) errorEl.textContent = error;
  contentEl.hidden = !showContent;
}

function createCopyButton(value) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-copy';
  btn.title = 'Copy';
  btn.setAttribute('aria-label', 'Copy to clipboard');
  btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(value);
      btn.classList.add('copied');
      btn.title = 'Copied!';
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.title = 'Copy';
      }, 1500);
    } catch (_) {}
  });
  return btn;
}

function renderList(listEl, items, isLink) {
  listEl.innerHTML = '';
  if (items.length === 0) {
    const li = document.createElement('li');
    li.className = 'item-row item-row--empty';
    li.innerHTML = '<span class="item-text">None found</span>';
    listEl.appendChild(li);
    return;
  }
  items.forEach((item) => {
    const li = document.createElement('li');
    const row = document.createElement('div');
    row.className = 'item-row';
    const text = document.createElement(isLink ? 'a' : 'span');
    text.className = 'item-text';
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

function isRestrictedUrl(url) {
  if (!url) return true;
  const restricted = ['chrome:', 'chrome-extension:', 'edge:', 'about:', 'file:'];
  return restricted.some((p) => url.startsWith(p));
}

async function extractFromPage() {
  setStatus(true, false, false);
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      setStatus(false, 'No active tab.', false);
      return;
    }
    if (isRestrictedUrl(tab.url)) {
      setStatus(false, 'Cannot read this page. Open a normal website first.', false);
      return;
    }
    const EXTRACT_TIMEOUT_MS = 8000;
    const scriptPromise = chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
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
        return { emails: [...emails], links: [...websiteLinks] };
      },
    });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Page took too long to respond. Try refreshing the tab.')), EXTRACT_TIMEOUT_MS)
    );
    const results = await Promise.race([scriptPromise, timeoutPromise]);
    const first = results?.[0];
    if (first?.error) {
      setStatus(false, first.error.message || 'Script error on page.', false);
      return;
    }
    const data = first?.result;
    if (!data) {
      setStatus(false, 'Could not read page.', false);
      return;
    }
    setStatus(false, false, true);
    const linksWithoutKick = (data.links || []).filter(
      (url) => !url.toLowerCase().includes('kick.com')
    );
    renderList(emailsList, data.emails, false);
    renderList(linksList, linksWithoutKick, true);
  } catch (e) {
    setStatus(false, e?.message || 'Something went wrong.', false);
  }
}

extractFromPage();
