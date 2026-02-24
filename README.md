# Kick Cleaner

A Chrome extension that simplifies [Kick.com](https://kick.com) by hiding clutter and reducing visual noise for a minimal, focused experience.

---

## Features

- **Clean layout** — Hides the sidebar (`#sidebar-wrapper`), chatroom (`#channel-chatroom`), and channel player (`#injected-channel-player`) so the page stays minimal.
- **Reduced visuals** — Blurs all images (8px) and hides video elements; optionally blocks image/video loading for a lighter, text-focused view.
- **No favicon** — Hides the site favicon in the tab.
- **Verified links** — Mark pages as “verified” from the popup. On category pages, cards that link to verified channels get a green border; on a verified page, a warning banner reminds you the page is in your list.

The extension uses injected CSS so layout changes apply immediately, and a `MutationObserver` so new elements (e.g. from the SPA) are handled in real time without breaking page load.

---

## Installation

1. Open Chrome and go to **chrome://extensions/**.
2. Enable **Developer mode** (toggle in the top-right).
3. Click **Load unpacked** and select the `kick` project folder (the one containing `manifest.json`).

The extension runs on `https://kick.com/*` and `https://www.kick.com/*`.

---

## Usage

After installation, visit any Kick.com page. Sidebar, chat, and channel player are hidden and images are blurred automatically. Use the extension icon in the toolbar to open the popup: view info, manage verified links, and (when on a category or channel page) add or remove the current page from your verified list.

---

## Customization

- **Blur strength** — Edit `src/content/content.css` and change the `blur(8px)` value in the `img` rule to make the blur stronger or weaker.

---

## Project structure

```
kick/
├── manifest.json          # Extension manifest (Manifest V3)
├── README.md
├── .gitignore
└── src/
    ├── content/           # Injected into kick.com
    │   ├── content.js     # DOM observation, image/video blocking, verified-links logic
    │   └── content.css    # Hide sidebar/chat/player, blur images, hide video
    └── popup/             # Toolbar popup
        ├── popup.html
        ├── popup.css
        └── popup.js
```

---

## Technical notes

- **Manifest V3** — Uses the current Chrome extension format.
- **Content script** runs at `document_start` so CSS and observers apply before the SPA paints.
- **MutationObserver** watches for added nodes and re-applies blocking/highlights; attribute changes on images are handled so re-set `src`/`srcset` stay blocked.
- **Verified links** are stored in `localStorage` under the key `kick_verified_links` (JSON array of URLs).
