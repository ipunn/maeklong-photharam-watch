## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/<feature>/` (no GitHub/GitLab remote configured for this repo). See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Look and motion

Colours, type, cards, the sticky pill and the animation style are written down in `docs/design/look.md`. Read it before touching visuals, and follow it instead of asking for a reference site.

## Layout changes

Whenever you touch layout, markup or CSS (both `index.html` and `bangkruai.html`), check it on a phone-width viewport as well as desktop, before calling it done. Most people read these pages on a phone.

- A `resize_window` call does not change the page's viewport. Load the page in a 375 px wide same-origin `<iframe>` instead, so the mobile media queries (`max-width: 480px`) really apply, then look at the screenshot.
- Check: no horizontal scroll (`documentElement.scrollWidth <= 375`), nothing wider than the viewport, chart tick labels not overlapping, tap targets at least 44 px tall, and any sticky element not eating too much of the screen.
- Serve the repo on a fresh port (`python3 -m http.server <port>`) and add a cache-buster to the URL. An older server on a common port may serve stale files.
- If the browser extension is not connected, headless Chrome works: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --screenshot=out.png --window-size=600,<height> --virtual-time-budget=7000 <url>`. Headless Chrome will not go narrower than about 500 px, so load a small wrapper page holding a 375 px wide `<iframe>` of the site, not the site itself, or the screenshot shows a wider layout cropped to 375.
