# Look and motion

A reusable direction for how a site looks and moves. The **rules** are meant to carry over to any project. The **"Example"** lines show how this project (a water-level watch site) applied them; they are for alignment, not something to copy. Code for this project: the "Look" section at the end of `style.css` plus `look.js`. The three-way prototype that settled it is on the branch `prototype/flood-pop-style`.

## Principles (rules)

- **Polish, not features.** If the site already does its job, new visuals must not hide information or imply anything the data cannot support.
- **Phone first.** Check every change at 320, 375, 390 and 430 px: no horizontal scroll, nothing wider than the viewport, tap targets at least 44 px, the sticky bar well under ~50 px of the screen.
- **One sticky element**, never two. Fold related controls into it.
- **Colour never carries meaning by itself.** Anything that signals severity is also said in words, and only if the data justifies it.
- **Use the project's own font and brand colours.** Never copy another site's licensed font.

> Example: light theme only, no dark mode; Status and Reference line colours unchanged; Noto Sans Thai / Sarabun.

## Visual language (rules)

- **Surface:** soft background gradient, cards with a 1px faint border, 20-26 px radii, one soft layered shadow token.
- **Numerals first:** the one value that matters is 3-3.4 rem, weight 800, tight letter spacing, tabular figures. Its label is a small caption above; the unit a small dim suffix.
- **Glass (backdrop blur) only on the sticky bar.** It is heavy on iPhones when used on big panels.

> Example: pale blue-white page; the Pho Tharam water level is the big number; the sticky pill holds the two Sites and the 6/12/24 h Window toggle.

## Motion language (rules)

- **One easing family:** a smooth curve for transitions and a springier one for entrances, as shared tokens (`--ease`, `--ease-out`).
- **Entrance:** cards rise in with a small overshoot, staggered about 0.1 s down the page.
- **Numbers count up** from 0 (about 1.1 s). **Charts draw in** left to right, then the newest point pops.
- **Press and hover:** slight lift on hover, scale-down on press.
- **Pick ONE ambient motif that fits the subject** and keep it subtle; skip it if nothing fits.
- **Performance:** animate only `transform` and `opacity`. Never loop `box-shadow`, `filter` or `backdrop-filter`; they repaint whole panels every frame.
- **Reduced motion is a decision per project.** Write down which way it went and why.

> Example: the ambient motif is water (layered waves behind the header, a pulsing live dot, drifting bubbles, a sonar ring on each chart's newest point). A shop might use a soft gradient drift; a finance app a pulsing ring on the latest value. This project deliberately ignores `prefers-reduced-motion`: most people enable it to save battery.

## Adding something new (checklist)

1. Reuse the tokens at the top of the Look section (`--shadow`, `--ease`, `--ease-out`, radii).
2. Give a new card the same entrance, stagger and hover as the existing ones.
3. Keep long labels out of the sticky bar.
4. Check it at the four phone widths above before calling it done (see `AGENTS.md`).
