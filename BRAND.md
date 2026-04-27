# Bravo Suite — Brand & Design System

This document is the source of truth for visual and interaction design across the Bravo product family. BravoChore is the first product; future products inherit from this guide.

**Status:** Living document. Update this file when patterns change — don't fork a second copy in another product, copy this one and update both.

---

## Voice & tone

Bravo apps speak like a **smart, warm friend** who knows the household — never corporate, never robotic. Avoid jargon. Address the user by name where possible. Use direct, confident copy ("Mark complete", not "You may wish to consider marking this task complete").

**Always do:**
- Use second person ("your routine", "your tasks")
- Use the user's name dynamically when the data is available (`${CUN}`)
- Empty states get a one-line "what next" hint, not just a sad icon
- Confirmation copy is plain English ("Move 3 tasks to Shelved?")

**Never do:**
- Reference specific people by name in code (`"Bernadette's routine"`) — pull from data
- Speak in error codes ("ERR_500") — translate to "Connection wobble"
- Apologise excessively ("Sorry, sorry…") — the warm-friend tone owns mistakes once and moves on
- Assume the user is a developer

---

## Typography

Three faces, no exceptions:

| Face | Use | Where |
|---|---|---|
| **Playfair Display** (400, 500, 600) | Display & headings — anything that's a "title" | App title, section titles, modal titles, task titles, event titles |
| **DM Sans** (300, 400, 500, 600) | Body, UI, buttons | Everything else |
| **DM Mono** (400) | Numbers when precision matters | Timer display, custom-time input, progress percentages, code badges |

**Type scale (use these — don't invent new sizes):**

```
title-xl  20px  Playfair 500   App / hero
title-lg  17px  Playfair 500   Modal / panel titles
title-md  15px  Playfair 500   Section titles
body      14px  DM Sans 400    Default
body-sm   13px  DM Sans 400    Card meta, secondary
body-xs   12px  DM Sans 500    Buttons, labels
caption   11px  DM Sans 700    Section eyebrows (uppercase, letter-spaced)
mini      10px  DM Sans 700    Caps eyebrows on small surfaces
```

**Letter-spacing on caps:** `0.3px` to `0.5px` for caption / mini caps. Never tighter.

**Rule:** if you're writing `font-family: …` inline in JS template strings, you're probably wrong. The body element sets DM Sans by default; Playfair / DM Mono should be applied via class, not inline.

---

## Color

All colors are CSS variables. **No hex literals in JS template strings.** When the audit finds a hex hardcoded somewhere, that's a bug.

### Tokens

```
--green       primary brand                     (CTA, success, primary)
--gd          green dark                        (hover/active for green)
--gm          green mid                         (mid-tone, e.g. progress)
--gl          green light tint                  (success surfaces)

--amber       warning / "due soon"              (badges, alerts)
--al          amber light tint                  (warning surfaces)

--red         destructive / overdue             (overdue badges, delete)
--rl          red light tint                    (error surfaces, listening mic)

--blue        accent (rarely used)              (informational links)

--tx          text primary                      (high contrast body)
--tx2         text secondary                    (meta, descriptions)
--tx3         text tertiary                     (timestamps, captions)

--bg          background base                   (app background)
--surf        surface                           (cards, panels)
--surf2       surface raised                    (sheets-on-cards)

--bdr         border light                      (subtle dividers)
--bdrm        border mid                        (button borders, input borders)
```

### Color usage rules

- **Green** is the only primary CTA color. Sprint headers, primary action buttons, send buttons.
- **Red** means destructive or overdue — never decorative. Coles being red was a bug for this reason.
- **Amber** means "needs attention" but not urgent.
- **Owner tags** (BW / BJ / Pete or whatever the user has) get a personalised `bg`/`color` pair stored on the person record. Never bake those colors into CSS classes.
- Per-bucket section accents (e.g. routine sections) should derive from a small extension of the palette, not hand-rolled hexes. If a feature *really* needs a new color, add it as a CSS var and document it here.

---

## Layout & spacing

**Border radius scale (pick one, don't invent):**

```
--rs   8px    Cards, inputs, badges
--r    12px   Larger cards, modals
100px         Pills (buttons, tags, focus chips)
20px          Sheet top corners (the curved top of slide-up sheets)
50%           Round elements (avatars, check circles, FABs)
```

**Spacing:** stick to multiples of 2px. Most layouts use 6/8/10/12/14/16/20px. Avoid 7, 11, 13.

**Shadows:** prefer `0 -8px 40px rgba(0,0,0,.15)` (sheet) and `0 2px 8px rgba(0,0,0,.06)` (raised card). Don't invent new shadows.

---

## Component patterns

### Buttons

| Pattern | Use | Class |
|---|---|---|
| **Primary CTA** | The single most important action in a view | `.btn-ok`, `.tc-send`, `.dp-save` — green fill, white text |
| **Secondary** | Cancel, dismiss, alternative | `.btn-cancel`, `.qa-btn` (default) — surface fill, border, dark text |
| **Pill** | Filter / tab inside a screen | `.qa-btn` with active state via inline override or modifier — green fill when selected |
| **Icon** | Reversible toggle, header action | `.tc-icon-btn`, `.bbfs-icon-btn` — round, border, no fill |
| **Destructive** | Delete only — never use for "Cancel" | Red `1px solid var(--red)` border, red text |

**Rule:** only ONE primary CTA visible per screen at a time. If you find two green buttons in the same surface, redesign.

### Sheets vs modals

- **Slide-up sheet** (`border-radius:20px 20px 0 0; bottom:0`) for anything contextual to the tab the user is on (filter, picker, confirm)
- **Center modal** (`.modal-bd`) for anything global (settings, new event wizard, scorecard)

**Native browser dialogs (`alert()`, `prompt()`, `confirm()`) are forbidden.** Always use a styled component.

### Toast / chirp

Single pattern: `chirp(message)` shows a bottom-anchored neutral toast for ~2 seconds. Never invent a parallel toast system. If you need richer affordances (Edit / Undo), extend `chirp` with optional action buttons — don't fork.

### Cards

A "task card" is the same shape across every bucket — Tasks, Events, Sprint, Schedule slotted, Focus sheet. The shared renderer is `taskCard(task)` in `js/ui.js`. **Do not build a new task-card variant inside another file.** If the variant is genuinely needed, parameterise the shared renderer.

Card includes:
- Round check on the left
- Title + meta row (owner tag, due, code, milestones progress, photo count)
- Optional progress wash
- Tap = open detail panel
- Long-press / drag handle = reorder

### Owner tags

Always rendered via `getOwner(code)` then `<span class="task-tag" style="background:${o.bg};color:${o.color}">${o.name}</span>`. Never via dedicated CSS class per person — the household is configurable so person-specific CSS classes don't survive in the generic product.

---

## Interaction principles

1. **Optimistic UI.** All ticks, edits, drags update the local state immediately and persist asynchronously. Show a small "syncing" badge in the header. If sync fails, revert + show an unobtrusive warning. The user should never wait on a network round-trip for a tap to register.

2. **Undo is better than confirm.** Prefer "Done — Undo" toasts over "Are you sure?" modals. Only use confirmation for genuinely destructive actions (delete, reset all data).

3. **Empty states have a path forward.** Every empty state shows: an icon, a one-line "what's here", a one-line "how to get something", and (often) a primary CTA.

4. **Discoverability.** A feature the user has to scroll to find, or hunt for in a corner, doesn't exist. Major features get bottom-nav slots or persistent affordances.

5. **Milestones over flat done/not-done.** When tracking work that has multiple natural steps, model it as task + milestones, not as multiple separate tasks.

---

## Accessibility floor

- Color contrast ≥ 4.5:1 for body text against its surface. Don't put `--tx2` on `--bg` for primary information — it doesn't pass.
- Tap targets ≥ 44×44 logical pixels.
- All interactive elements keyboard-reachable.
- Lottie animations use `prefers-reduced-motion: reduce` to drop to a static state.

---

## What "generic" means in practice

BravoChore is the proving ground for an eventually commercial Bravo suite. Before any feature ships, ask:

- **Would Maria, Tom, and Sarah find this useful?** (placeholder family — would generic households use it?)
- **Are any names, places, stores, or routines hardcoded?** If so, they need to come from user data, not from a constant.
- **Does the locale matter?** AU stores (Bunnings, Coles, ABI) need to be configurable for users in other regions.
- **Could a marketer screenshot this without explaining context?** Screens that read clearly without backstory are good product.

Things currently hardcoded to the Wallis household that need to migrate to config / onboarding before commercial release:

- `js/state.js` default `people` array (Brent / Bernadette / Pete)
- `js/schedule.js` `DAY_TASKS` constant (Bernadette's routine)
- `js/schedule.js` `LAUNDRY_DATA`, `FORTNIGHT_DATA`, `MONTHLY_ITEMS`
- `js/features.js` `BUNNINGS_CATEGORIES` and the AU store list
- `js/blackbird.js` system prompt mentions of "Brent (BW) and Bernadette (BJ), Perth WA"

This is technical debt against the commercial product, not against the personal version. Track but don't fix today.

---

## When this guide doesn't have an answer

Pick the option that:
1. Already exists somewhere in the codebase (re-use, don't reinvent)
2. Is the most generic of the available options
3. Could be screenshotted into a marketing deck without explanation

Then update this guide so the next person doesn't have to ask.
