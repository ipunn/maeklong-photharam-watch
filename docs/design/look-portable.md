# Look and motion guide

A reusable direction for how a site looks and moves, written to be read by both people and Claude Code. Written with phones as the main example; section 0 decides whether that applies to your site. The **rules** carry over to any project. Lines marked **Example** show how one project (a water-level watch site) applied them; they are there so everyone means the same thing, not as something to copy. Replace them with your own.

## 0. Decide first: which devices does this site serve?

**Claude must ask this before designing anything, and write the answer down here. Do not assume phones.** Many sites are phone-first, but some are not (internal dashboards, desktop tools, kiosks, big-screen displays, data-heavy admin pages). Ask, with a recommendation:

| Target | When | What changes |
|---|---|---|
| **Phone first** | public site, most readers on phones | Everything in this guide applies. Test at 320/375/390/430 px; 44 px taps; one slim sticky bar; light motion for battery. |
| **Responsive (phone + desktop both matter)** | mixed audience | Design phone layout first, then widen; test at both phone widths and 768 / 1024 / 1440 px. |
| **Desktop only** | internal tool, dense dashboard | Skip the phone checks and the 44 px rule (keep pointer-sized targets), but still avoid horizontal overflow at common laptop widths (1280, 1440). Hover states matter; touch states don't. State this in the doc so nobody later "fixes" it for phones. |
| **Large display / kiosk** | wall screens | Bigger type, fewer elements, check at the real resolution; motion can be richer since battery isn't a concern. |

Record the answer here:

> **Target devices:** _phone first / responsive / desktop only / large display_ (decided by _name_ on _date_, because _reason_).

Everything below that mentions phones, iPhone widths, tap targets or battery applies **only if the answer includes phones**. If it doesn't, replace those lines with the checks for the chosen target.

## 1. Working with Claude Code

**The flow that worked:** interview, then prototype, then fold in.

1. **Interview first.** Say what you like about a reference and what you do *not* want from it. Claude asks which parts, who the reader is, and which rules must not bend. (`/grill-with-docs` does this.)
2. **Prototype the open question.** "How much motion?" cannot be settled on paper. Ask for 2-3 switchable variants (`?variant=A|B|C`) on the *real page with real data*, in a throwaway file, so you can judge them on your phone.
3. **Pick, then fold in.** The winner is rewritten into the real CSS/JS. Keep the prototype on its own branch as a record; keep `main` free of it.
4. **Write it down** (this file) and point `AGENTS.md` / `CLAUDE.md` at it, so later sessions follow it without the reference link.

**Say these things to Claude up front. They save rounds:**

| Tell Claude | Why it matters |
|---|---|
| The reference URL **and what to borrow** ("visual and animation, not features") | Otherwise it copies features your data cannot support |
| What must **not** change (colours with meaning, fonts, theme) | Restyles quietly break rules the project already has |
| The reader and device ("residents on iPhones", or "staff on desktop only") | Sets the real constraints: width, battery, taps vs hover. If you don't know, say so and Claude will ask. |
| Motion level, or "prototype two levels" | "Subtle" and "lively" mean different things to everyone |
| Reduced-motion decision | Claude will otherwise add it by default; say if you want otherwise |
| "Verify at these widths before saying done" | Claude will check only if it is a stated requirement |

**Describe the look with concrete vocabulary, not adjectives.** "Modern and clean" gives generic output. These give specific output:
- "big bold numerals, tabular figures, label as small caption above"
- "frosted floating pill nav, one sticky element"
- "cards rise in with a small overshoot, staggered 0.1 s"
- "numbers count up, chart line draws left to right, newest point pops"
- "one ambient motif that fits the subject, subtle"

## 2. Principles (rules)

- **Polish, not features.** If the site already does its job, new visuals must not hide information or imply anything the data cannot support.
- **Fit the chosen devices (section 0).** For phone-first sites, check every change at 320, 375, 390 and 430 px. For other targets, check the widths that target actually uses.
- **One sticky element**, never two. Fold related controls into it.
- **Colour never carries meaning by itself.** Severity is also said in words, and shown only if the data justifies it. Decoration must not borrow warning colours.
- **Use the project's own font and brand colours.** Never copy another site's licensed font.
- **Decoration stays decoration.** It must not change what the numbers say or look like official warnings.

> Example: light theme only; status and threshold colours unchanged and named in words; Noto Sans Thai / Sarabun.

## 3. Visual language (rules + starting values)

- **Surface:** soft background gradient, cards with a 1px faint border, 20-26 px radii, one soft layered shadow.
- **Numerals first:** the value that matters is 3-3.4 rem (3 rem on phones), weight 800, letter spacing about -0.04em, tabular figures. Its label is a small caption above; the unit a small dim suffix.
- **Frosted glass only on the sticky bar.**
- **Pill sticky bar:** about 50 px tall, 44 px+ tap targets inside, `top: 8px`.

Starting tokens (adjust the colours, keep the shape):

```css
:root {
  --bg: #eaf2f7;           /* page */
  --card-bg: #fff;
  --text: #1c3447;
  --text-dim: #5d7384;
  --accent: #1b72a8;       /* brand accent, never a warning colour */
  --border: rgba(24, 66, 92, .10);
  --shadow: 0 1px 2px rgba(20,60,88,.06), 0 10px 30px -12px rgba(20,60,88,.22);
  --ease: cubic-bezier(.32, .72, 0, 1);        /* transitions */
  --ease-out: cubic-bezier(.16, 1, .3, 1);     /* entrances */
}
.big-number {
  font-size: 3.4rem; font-weight: 800; letter-spacing: -.04em;
  line-height: 1.02; font-variant-numeric: tabular-nums;
}
@media (max-width: 480px) { .big-number { font-size: 3rem; } }
```

> Example: pale blue-white page; the local water level is the big number; the sticky pill holds the two sites and a 6/12/24 h time-window toggle.

## 4. Motion language (rules + starting values)

| Effect | Value |
|---|---|
| Entrance | rise 16-28 px, tiny overshoot, 0.8-1 s, `--ease-out`, stagger about 0.1 s |
| Count-up | 0 to value in about 1.1 s, ease-out quartic, start about 150 ms late |
| Chart draw | `clip-path: inset(0 100% 0 0)` to `inset(0)`, 1.1-1.4 s, then pop the newest point |
| Hover / press | lift 2-4 px on hover (only on `@media (hover: hover)`), `scale(.94)` on press |
| Shimmer | one sweep per card on load, not a loop |
| Ambient | **one** motif that fits the subject, slow (9-14 s), low contrast |

**Reduced motion is a decision per project.** Write down which way it went and why, in this file.

For how to choreograph it, ready-made snippets and how to ask Claude for motion, see **section 11, Motion cookbook**.

> Example: the ambient motif is water (layered waves behind the header, a pulsing live dot, drifting bubbles, a sonar ring on each chart's newest point). A shop might use a soft gradient drift; a finance app a pulsing ring on the latest value. That project deliberately ignores `prefers-reduced-motion` because most people enable it to save battery.

## 5. Performance and iPhone pitfalls (learned the hard way)

- **`overflow-x: hidden` on `body` can break `position: sticky` on iOS.** Fix overflow at its source instead.
- **`background-attachment: fixed` is ignored or janky on iOS.** Do not use it.
- **Never loop animations of `box-shadow`, `filter` or `backdrop-filter`.** They repaint whole panels every frame and drain battery. Animate `transform` and `opacity` only.
- **Do not put `backdrop-filter` on large panels.** Keep it to the one sticky bar, and include the `-webkit-` prefix.
- **`-webkit-` prefixes** are still needed for `background-clip: text` and `-webkit-text-fill-color` (gradient numerals).
- **Count of infinite animations matters.** Every looping effect costs battery, so each must earn its place.
- **Narrow phones (320 px):** the sticky bar can wrap. Add a `max-width: 340px` rule that tightens padding, and set `white-space: nowrap` on its buttons.

## 6. Verifying (tell Claude to do exactly this)

These steps are for the widths in section 0. For a desktop-only site, use the same method with laptop widths (1280, 1440) instead of phone widths and skip the tap-size and iPhone-specific checks.

Claude cannot run Safari. It can check layout in Chrome and must say plainly that real Safari is unchecked.

1. Serve the site on a **fresh port** (`python3 -m http.server 8741`); an old server can serve stale files.
2. Load the page in an **iframe of fixed width** (320 / 375 / 390 / 430) on a same-origin wrapper page. `resize_window` does not change the viewport, so media queries would not apply.
3. In each: `documentElement.scrollWidth <= width`; no element's `getBoundingClientRect().right > width`; pill height; tap targets of the sticky bar at least 44 px; chart tick labels not overlapping.
4. **Hard-refresh CSS** between edits (`fetch('/style.css', {cache: 'reload'})` then reload the iframe), because the browser caches it.
5. **Judge animation in a real browser, not headless screenshots.** Headless `--virtual-time-budget` freezes entrance animations at their first frame, so cards look invisible.
6. Run the project's tests; delete throwaway wrapper pages afterwards.
7. Ask the human to scroll the page once on their own iPhone.

## 7. Prompt templates

**New restyle**
> (Target devices: `<phone first / responsive / desktop only>`. If unsure, ask me.) I like the look of `<url>`: `<the 3-5 concrete things>`. Only visual style and animation, not its features. Keep `<font, theme, colour rules>`. The site already works, so this is polish. First prototype two variants on the real page with real data: (B) calm, (C) full. Verify at the widths for the target devices (for phones: 320-430 px, no horizontal scroll, tap targets >= 44 px, one sticky bar <= 50 px, light on battery). I will pick, then fold the winner into the real code.

**Extend later**
> Add `<thing>` following `docs/design/look.md`: same tokens, entrance, stagger and hover. Do not add a second sticky element. Check at 320/375/390/430 px.

**Tone it down**
> Keep the layout and numerals, remove the looping ambient effects, keep entrances and count-up.

## 8. Things Claude tends to get wrong (watch for these)

- Copying the reference's *features* (maps, dark mode, tabs) when you only asked for style.
- Adding severity colours because the reference has them.
- Putting `backdrop-filter` or animated shadows on big panels.
- Assuming the site is phone-first without asking, or assuming it is desktop-only.
- Calling mobile "done" after a desktop screenshot, or after a headless screenshot that froze the animations.
- Leaving prototype files and switcher code on `main`.
- Making the sticky bar taller as controls get added; fold them in or cut them.

## 9. Checklist for any new piece

1. Reuses the shared tokens (shadow, easing, radii, accent).
2. Same entrance, stagger and hover as existing cards.
3. No long labels in the sticky bar; still one sticky element.
4. No looping heavy animation; only `transform` / `opacity`.
5. Checked at the widths for the chosen target devices (section 0); for phone-first sites that means 320 / 375 / 390 / 430 px, plus the human has looked on a real iPhone.

## 10. Where to get assets and ideas

**Rule first:** check the licence of anything you take, and record it in the repo (a line in this file or a `CREDITS.md`). Prefer **MIT / OFL / CC0 / Apache-2.0**. Self-host fonts and icons rather than hotlinking, for speed and privacy. Never copy a reference site's own fonts, images or paid assets; copy its *ideas* (layout, motion timing), which you can read from its CSS in DevTools. Licences and prices change, so verify on the site before relying on them.

| Need | Good sources | Notes |
|---|---|---|
| **Fonts (incl. Thai)** | Google Fonts: Noto Sans Thai, Sarabun, Prompt, Kanit, IBM Plex Sans Thai, Mitr (display); Fontsource (npm, self-hostable) | Thai needs a font with Thai glyphs; test line height, tone marks and stacked vowels, since Thai text clips easily when `line-height` is tight. Keep to 1-2 families and few weights. |
| **Icons** | Lucide, Phosphor, Tabler Icons, Heroicons (all open source SVG) | Use inline SVG, one set only, one stroke width. |
| **Illustrations** | unDraw, Storyset, Open Doodles, Humaaans | Check each set's terms; recolour to the brand accent so they match. |
| **Photos** | Unsplash, Pexels | Compress and size to the layout (WebP/AVIF); don't ship 4 MB heroes to phones. |
| **Backgrounds, waves, patterns** | Haikei, SVGBackgrounds, Hero Patterns, Shapedivider | Generates SVG; inline it as a `data:` URI or file and keep it small. |
| **Colour** | Radix Colors, Tailwind palette, Coolors, Realtime Colors | Pick a 10-step scale for the accent plus neutrals; avoid warning hues for decoration. |
| **Contrast / accessibility** | WebAIM Contrast Checker, Stark, Chrome DevTools "contrast" row | Aim for WCAG AA (4.5:1 text, 3:1 large text). |
| **Easing curves** | easings.net, cubic-bezier.com | Save the two you pick as tokens. |
| **Animation libraries (only if CSS isn't enough)** | Motion (ex Framer Motion), GSAP, Lottie / LottieFiles, AutoAnimate | Prefer plain CSS + a few lines of JS first; each library costs bytes and battery. Lottie suits designer-made animations only. |
| **Inspiration** | Awwwards, Godly, Land-book, Mobbin (mobile apps), Dribbble, Refero | Collect 3-5 references, write what you like about each in one line, then give Claude those lines (section 1). |
| **Mockups before code** | Figma (free tier) | Optional. For motion, prototype in code on the real page instead. |

**Testing resources**
- **Real iPhone:** best, free, and nothing replaces it.
- **Xcode iOS Simulator (Mac):** free; runs real Safari at exact iPhone sizes (SE, 15/16, Pro Max). Use it when you can't get a device.
- **Safari Responsive Design Mode** and Chrome DevTools device mode: layout only, not Safari's rendering of blur and sticky.
- **BrowserStack / LambdaTest:** real devices in the cloud, paid.
- **Chrome DevTools:** Performance and Rendering tabs ("Paint flashing", "Layers") show which animations repaint; Lighthouse for a quick score.

**Getting ideas out of a reference site, with Claude**
1. Ask Claude to open the reference in the browser and list its CSS custom properties, easing curves, `@keyframes` names, transitions and font stack (computed styles).
2. Ask it to describe the layout and motion in plain words, then confirm which parts you want.
3. Have it write those findings into the "Visual / Motion language" sections above in your own tokens. From then on, the reference link is not needed.

**Keep a credits table** (copy this into your repo):

| Asset | Source | Licence | Where used |
|---|---|---|---|
| Noto Sans Thai | Google Fonts | OFL | body text |
| _example_ | _url_ | _MIT_ | _icons_ |

## 11. Motion cookbook

### 11.1 Why animate at all

Motion is justified only when it does one of these jobs:

1. **Orient:** shows where something came from or went (cards rising in, a chart drawing left to right = time flows this way).
2. **Confirm:** acknowledges an action (press feedback, toggle sliding).
3. **Signal life:** tells the reader the data is live (pulsing dot, sonar ring on the newest point).
4. **Delight, briefly:** one ambient motif that gives the site a personality.

If an effect does none of these, cut it. Every looping effect costs battery, so each one must earn its place.

### 11.2 Choreography rules

- **Order tells the story:** header, then sticky bar, then main panel, then the cards inside it, then secondary content. Each step is about 0.1 s after the last; the whole page should be settled in about 1.5 s.
- **Big things move slowly, small things fast.** Page panels 0.8-1 s; buttons and toggles 0.3-0.4 s; press feedback under 0.15 s.
- **One idea at a time:** entrance, then count-up, then chart draw, then newest-point pop. Don't start everything at once.
- **Run entrances once.** Only status/ambient effects loop.
- **Ambient motion is slow and low contrast** (cycle 9-14 s, opacity 10-15%). The reader should notice it only if they stop reading.
- **Respect content updates:** when data re-renders (a toggle changes the time window), keep the entrance short or skip the stagger, or the page feels slow to react.

### 11.3 Snippets (all verified in a working project; adapt values)

**Entrance with overshoot and stagger**
```css
@keyframes rise {
  0%   { opacity: 0; transform: translateY(28px) scale(.97); }
  60%  { opacity: 1; transform: translateY(-4px) scale(1.003); }
  100% { transform: none; }
}
.card { animation: rise 1s var(--ease-out) both; }
.card:nth-child(2) { animation-delay: .1s; }
.card:nth-child(3) { animation-delay: .2s; }
```
`both` keeps the card hidden before its delay and visible after. Cards inserted by script animate on creation without extra code.

**Count-up (small JS, no library)**
```js
function countUp(el, ms = 1100) {
  const txt = el.textContent, target = parseFloat(txt.replace(/,/g, ""));
  if (Number.isNaN(target)) return;
  const dec = (txt.split(".")[1] || "").length, t0 = performance.now() + 150;
  (function tick(t) {
    const p = Math.min(1, Math.max(0, (t - t0) / ms));
    el.textContent = (target * (1 - Math.pow(1 - p, 4))).toFixed(dec);  // ease-out quartic
    if (p < 1) requestAnimationFrame(tick);
  })(performance.now());
}
```
Keep the final value exact and use tabular figures so the digits don't jitter.

**Chart line draws in** (works with stretched or non-scaling strokes, unlike `stroke-dasharray`)
```css
@keyframes reveal { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0); } }
.chart svg { animation: reveal 1.4s var(--ease-out) .5s both; }
```

**Newest point pops, then pings**
```css
@keyframes pop   { 0% { opacity: 0; transform: translate(-50%,-50%) scale(0); }
                   70% { transform: translate(-50%,-50%) scale(1.8); }
                   100% { opacity: 1; transform: translate(-50%,-50%) scale(1); } }
@keyframes sonar { 0% { transform: translate(-50%,-50%) scale(.4); opacity: .55; }
                   100% { transform: translate(-50%,-50%) scale(3.2); opacity: 0; } }
.dot { animation: pop .7s var(--ease-out) 1.6s both; }
.dot::after { content: ""; position: absolute; left: 50%; top: 50%; width: 9px; height: 9px;
  border-radius: 50%; border: 2px solid currentColor; animation: sonar 2.2s ease-out 2.2s infinite; }
```
Delay the pop until the line has finished drawing (here 1.6 s after the 1.4 s draw starts at 0.5 s).

**Live dot pulse**
```css
@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(31,157,107,.55); } 70%,100% { box-shadow: 0 0 0 12px rgba(31,157,107,0); } }
.live-dot { width: 10px; height: 10px; border-radius: 50%; background: #1f9d6b; animation: pulse 2s ease-out infinite; }
```
This animates `box-shadow` on a 10 px dot only. That is cheap; the "never loop box-shadow" rule is about big panels.

**One shimmer sweep per card, on load**
```css
@keyframes shimmer { from { transform: translateX(-120%) skewX(-18deg); } to { transform: translateX(260%) skewX(-18deg); } }
.card { position: relative; overflow: hidden; }
.card::after { content: ""; position: absolute; inset: 0 auto 0 0; width: 40%; pointer-events: none;
  background: linear-gradient(100deg, transparent, rgba(255,255,255,.75), transparent);
  transform: translateX(-120%) skewX(-18deg); animation: shimmer 1.4s var(--ease) .9s 1 both; }
```

**Ambient waves (tile an SVG and slide it)**
```css
@keyframes wave { from { background-position-x: 0; } to { background-position-x: 320px; } }
.header-waves { height: 60px; background: url("wave.svg") repeat-x; background-size: 320px 60px; animation: wave 14s linear infinite; }
```
The tile width must equal the distance travelled (320 px) or the loop will visibly jump. Two layers moving in opposite directions at different speeds read as depth.

**Toggle / button feedback**
```css
.btn { transition: background .35s var(--ease), color .35s var(--ease), transform .35s var(--ease); }
.btn:active { transform: scale(.94); }
@media (hover: hover) { .card:hover { transform: translateY(-3px); } }
```
Gate hover on `(hover: hover)` so phones don't get stuck hover states after a tap.

### 11.4 Matching the ambient motif to the subject

| Subject | Motif idea |
|---|---|
| Water / weather / tides | waves, ripples, sonar ring, drifting bubbles |
| Finance / numbers | soft pulsing ring on the latest value, sparkline draw-in |
| Shop / food | gentle gradient drift, a hover tilt on product cards |
| Health / wellness | slow breathing glow, smooth progress rings |
| Transport / maps | moving dash along a route line, a travelling dot |
| Education / reading | calm fade-in of sections, no ambient loop at all |

Pick one. Two motifs compete and read as noise.

### 11.5 How to ask Claude for motion

- **Name the job and the feel:** "cards rise in with a small overshoot, staggered 0.1 s; numbers count up; the chart draws in left to right; only one slow ambient wave in the header."
- **Give numbers, not adjectives:** durations, delays and distances (see 11.3). "Subtle" and "snappy" are ambiguous; "0.8 s, 16 px, no overshoot" is not.
- **Ask for two levels and compare** (calm vs full) on the real page, as we did, then choose.
- **Ask Claude to list every looping animation** after it finishes, with the property each animates. This catches battery drains.
- **Feedback that works:** "the count-up starts too late", "the chart pop should wait for the line", "shimmer plays twice when the toggle re-renders", "too many things moving at once in the first second". Specific timing complaints get specific fixes.

### 11.6 Tuning motion

Change one thing at a time: first the **stagger**, then the **duration**, then the **distance/overshoot**, then the **ambient speed**. If a page feels heavy, cut in this order: ambient loops, shimmer, count-up, then entrance distance. Entrances are the last to go.

### 11.7 Testing motion

- Judge motion in a **real browser**, not in headless screenshots (those freeze animations at the first frame).
- Check at **60 fps** in DevTools Performance; look for long paints during the first second.
- Turn on **Paint flashing** in the Rendering tab; ambient loops should not flash large areas.
- Watch it on a **real phone on battery** for 30 seconds. If the phone gets warm or the scroll stutters, remove ambient loops.
- Re-trigger the re-render path (change a toggle, refresh data) and confirm the entrance doesn't replay awkwardly.
- **Reduced motion:** if you decide to respect it, wrap the effects in `@media (prefers-reduced-motion: no-preference)`; if you decide not to, say so in section 4 so no one adds it later by habit.
