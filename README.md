# Kick Cleaner – Chrome Extension

Removes the sidebar, chatroom, and channel player on kick.com and blurs all images.

## Project structure

```
kick/
├── manifest.json          # Extension manifest (Manifest V3)
├── README.md
├── .gitignore
└── src/
    ├── content/           # Injected into kick.com
    │   ├── content.js     # DOM monitoring & removal logic
    │   └── content.css    # Blur & hide overrides
    └── popup/             # Extension toolbar popup
        ├── popup.html
        ├── popup.css
        └── popup.js
```

## What it does

- **Removes** these elements as soon as they appear:
  - `#sidebar-wrapper`
  - `#channel-chatroom`
  - `#injected-channel-player`
- **Removes** the site favicon.
- **Blurs** all images on the page (8px blur).

Uses a `MutationObserver` so elements are removed in real time when the page adds them, plus injected CSS so they stay hidden and images stay blurred.

## How to install

1. Open Chrome and go to `chrome://extensions/`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked**.
4. Choose the `kick` folder (this project root).

The extension runs on `kick.com` and `www.kick.com`.

## Adjusting the blur

Edit `src/content/content.css` and change the `blur(8px)` value to make the blur stronger or weaker.
