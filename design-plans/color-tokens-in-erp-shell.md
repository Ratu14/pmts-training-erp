# The ERP shell renders its colors from the design tokens instead of hand-typed hex values

Written against: `a0ed1972b46a78f9a31e4377fc3e444d86a38bae`

## Evidence chain

- Surface: `app/training-erp.tsx` — the single client component that renders every route of the PMTS Training ERP (`/`, `/candidates`, `/training-log`, `/reports`, `/settings`, `/admin`). All six routes mount it through the 5-line page files in `app/*/page.tsx`.
- Problem: The file contains **zero** design-token color utilities. Every color in the application shell is hand-typed — 111 arbitrary hex utilities (`bg-[#…]`, `text-[#…]`, `border-[#…]`, `ring-[#…]`, `decoration-[#…]`) plus 30 `bg-white` / 7 `text-white` / 1 `bg-white/10` / 1 `ring-white/20`. Many of those values are byte-identical duplicates of tokens already defined in `app/globals.css`; the rest are undocumented drift around them. The clearest symptom is the secondary-text role: `--muted-foreground: #73788d` exists and is used verbatim 13 times as `text-[#73788d]`, while **ten additional greys** (`#85899b` ×9, `#686d81` ×7, `#777b91` ×6, `#747991` ×6, `#686c80` ×3, `#8a8ea0` ×2, `#6d7288` ×2, `#a3a7bb`, `#82869a`, `#656a80`) fill the same role across the same screens. The same pattern repeats for the indigo emphasis role (`#5559a8`, `#4b4b9d`, `#3f3f91`, `#41418e` against the defined `--accent-foreground: #363681`).
- Design evidence: `app/globals.css:7-30` publishes the token layer to Tailwind through `@theme inline` (`--color-background`, `--color-foreground`, `--color-card`, `--color-primary`, `--color-secondary`, `--color-muted`, `--color-accent`, `--color-destructive`, `--color-border`, `--color-input`, `--color-ring` and their `-foreground` pairs). `app/globals.css:32-51` sets their values: `--background:#f7f8fc`, `--foreground:#151724`, `--card:#ffffff`, `--primary:#25255e`, `--primary-foreground:#ffffff`, `--muted:#f3f4f8`, `--muted-foreground:#73788d`, `--accent:#ececff`, `--accent-foreground:#363681`, `--destructive:#b94149`, `--border:#e5e7f0`, `--input:#dfe2ec`, `--ring:#7575cf`.
- Owner: `app/globals.css` owns every color value. Every `components/ui/*` primitive already consumes it — `components/ui/card.tsx:15` (`bg-card text-card-foreground ring-foreground/10`), `components/ui/button.tsx:7` (`border-ring ring-ring/50 border-destructive`), `components/ui/input.tsx:12` (`border-input text-foreground placeholder:text-muted-foreground`), `components/ui/dialog.tsx:56` (`bg-popover text-popover-foreground`).
- Scope and affected surfaces: `app/training-erp.tsx` only. Its six routes are the entire user-facing application.
- Uncertainty: Two greys sit visibly lighter than `--muted-foreground` and are called out under **Verify** for a rendered check: `text-[#a3a7bb]` and `text-[#9a9ec2]`. The four `bg-[#151724]/30` modal backdrops are also owned by the sibling plan `dialog-primitive-for-erp-modals.md`; see **Scope → Exclude**.

## Design decision

Replace every hand-typed color in `app/training-erp.tsx` with the design token that already defines that role, collapsing the drifted near-duplicates onto the single token their role has. The root problem is not that the colors are wrong on screen — most of them render within a few hex points of the token — it is that the shell renders no color through the token layer at all, so the token file has no authority over the product, the eleven greys will keep multiplying, and no theme change (including a dark theme) can reach the interface. Using the tokens makes `globals.css` the single place a color is decided, which is what every `components/ui` primitive on these same screens already assumes.

## Reuse

- Tokens: `background`, `foreground`, `card`, `primary`, `primary-foreground`, `muted`, `muted-foreground`, `accent`, `accent-foreground`, `destructive`, `border`, `input`, `ring` — all defined at `app/globals.css:7-51`, no additions.
- Opacity modifiers on tokens (`token/40`, `token/20`) are an established pattern in this repository, not an invention: `components/ui/card.tsx:15` uses `ring-foreground/10`, `card.tsx:87` uses `bg-muted/50`, `components/ui/dialog.tsx:113` uses `bg-muted/50`, `components/ui/button.tsx:7` uses `ring-ring/50`.
- Exemplar: `components/ui/card.tsx` and `components/ui/input.tsx` — the token vocabulary those files use is exactly the vocabulary this change adopts.
- No new primitive, token, variable, or utility is required. If a replacement seems to need a value the token layer cannot express, stop (see **Stop conditions**).

## Changes

1. `app/training-erp.tsx` — value-identical swaps (the hex equals the token's value; rendering is unchanged)

   | Current utility | × | Replace with |
   | --- | --- | --- |
   | `bg-[#f7f8fc]` | 2 | `bg-background` |
   | `bg-[#f7f8fc]/90` | 1 | `bg-background/90` |
   | `text-[#151724]` | 1 | `text-foreground` |
   | `border-[#e5e7f0]` | 8 | `border-border` |
   | `border-[#e5e7f0]/90` | 1 | `border-border/90` |
   | `border-[#dfe2ec]` | 8 | `border-input` |
   | `bg-[#ececff]` | 5 | `bg-accent` |
   | `text-[#363681]` | 3 | `text-accent-foreground` |
   | `bg-[#25255e]` | 3 | `bg-primary` |
   | `text-[#25255e]` | 3 | `text-primary` |
   | `border-[#7575cf]` | 4 | `border-ring` |
   | `ring-[#7575cf]/20` | 4 | `ring-ring/20` |
   | `text-[#73788d]` | 13 | `text-muted-foreground` |
   | `bg-[#f3f4f8]` | 1 | `bg-muted` |
   | `bg-white` | 29 | `bg-card` |
   | `text-white` | 7 | `text-primary-foreground` |

   - Preserve: every non-color utility on the same element (sizing, spacing, typography, `font-mono`, `tracking-[…]`, responsive prefixes, state prefixes such as `hover:`/`sm:`/`lg:`). Preserve any opacity suffix by moving it onto the token (`/90` stays `/90`).
   - Verify: the six routes render pixel-identically to `main` for these elements.

2. `app/training-erp.tsx` — drifted values collapsed onto the token that owns the role

   | Current utility | × | Replace with | Role |
   | --- | --- | --- | --- |
   | `text-[#85899b]`, `text-[#686d81]`, `text-[#777b91]`, `text-[#747991]`, `text-[#686c80]`, `text-[#8a8ea0]`, `text-[#6d7288]`, `text-[#a3a7bb]`, `text-[#82869a]`, `text-[#656a80]` | 38 | `text-muted-foreground` | secondary/label/support text |
   | `text-[#1d1f31]`, `text-[#31323d]` | 2 | `text-foreground` | primary text |
   | `text-[#5559a8]`, `text-[#4b4b9d]`, `text-[#3f3f91]`, `text-[#41418e]` | 16 | `text-accent-foreground` | indigo emphasis (candidate IDs, links, icons on accent surfaces) |
   | `text-[#9a9ec2]` | 1 | `text-muted-foreground` | idle icon-button color at `app/training-erp.tsx:2441` (its `hover:` pair is covered in change 3) |
   | `bg-[#f4f5f9]` | 1 | `bg-muted` | sidebar nav hover surface |
   | `bg-[#f1f1fb]` | 1 | `bg-accent` | highlighted search-result row; `bg-accent` is the same token the active nav item uses |
   | `bg-[#fafbfe]` | 3 | `bg-muted/40` | inset panel on a card |
   | `border-[#cfd2e4]` | 2 | `border-input` | dashed empty-state border |

   - Preserve: the visual distinction between the *active* nav item (`bg-accent`) and the *hover* nav state (`bg-muted`) — these must not collapse to the same token.
   - Verify: secondary text reads as one consistent grey across the dashboard, candidate register, training log, and reports; candidate IDs read as one consistent indigo.

3. `app/training-erp.tsx` — destructive and on-primary roles

   | Current utility | × | Replace with |
   | --- | --- | --- |
   | `text-[#9b3039]` | 5 | `text-destructive` |
   | `bg-[#fff7f7]` | 1 | `bg-destructive/5` |
   | `border-[#eed5d8]` | 1 | `border-destructive/20` |
   | `text-[#bdbdeb]`, `text-[#bdbdea]` | 2 | `text-primary-foreground/70` |
   | `text-[#c9c9ef]`, `text-[#dbdbfb]` | 3 | `text-primary-foreground/80` |
   | `decoration-[#7878bf]` | 1 | `decoration-primary-foreground/50` |
   | `bg-white/10` | 1 | `bg-primary-foreground/10` |
   | `ring-white/20` | 1 | `ring-primary-foreground/20` |

   - Preserve: the error banner at `app/training-erp.tsx:913` must keep a tinted surface, a border, and destructive text — three separate utilities, not one.
   - Preserve: the on-primary hierarchy inside the `bg-primary` cards (`app/training-erp.tsx:803`, `:1544`) — the mono eyebrow label stays quieter (`/70`) than the body copy (`/80`), which stays quieter than the title (`text-primary-foreground`).
   - Verify: `text-destructive` (`#b94149`) is slightly brighter than the current `#9b3039`; confirm the admin sign-in error and the delete-confirmation copy still read as errors and remain legible on their surfaces.

## Scope

- Inherit: all six routes, since every one renders through `app/training-erp.tsx`.
- Verify: elements where a token utility now meets a `components/ui` primitive that already sets its own token — `Card` (`bg-card` is now applied twice on the four modal cards and elsewhere), `Input` (`border-input` now duplicated at `app/training-erp.tsx:1358`), `Badge` (`app/training-erp.tsx:1564`). Duplicated-but-identical utilities are correct to leave; a duplicate that fights the primitive should be deleted from the call site rather than re-specified.
- Exclude: the session-status palette. `statusTone()` at `app/training-erp.tsx:147-150` maps `Completed → emerald`, `Scheduled → blue`, `No-show → amber`, `Cancelled → zinc`, and the same four-way mapping is repeated at `:2553-2554`. The token layer defines no success/warning/info role, so these colors carry meaning nothing in `globals.css` can express. Leave every `emerald-*`, `blue-*`, `amber-*`, and `zinc-*` utility exactly as it is.
- Exclude: the four `bg-[#151724]/30` modal backdrops. They are removed entirely by the sibling plan `design-plans/dialog-primitive-for-erp-modals.md`, whose `DialogOverlay` supplies the backdrop. If that plan is executed first, these will already be gone. If this plan runs first or alone, replace them with `bg-foreground/30` and note it for the other plan's executor.
- Exclude: all non-color utilities — spacing, radius (`rounded-lg`/`rounded-xl`/`rounded-2xl` are a deliberate scale), typography, `tracking-[…]` values, and layout. Do not restructure markup, extract components, or split the file.
- Exclude: `app/globals.css`. No token is added, removed, or re-valued by this plan.

## Validation

- Product: an operations user opens `/`, selects a candidate, opens **Add learner**, logs a session on `/training-log`, and reads `/reports`. Every screen shows the same information, in the same layout, as before the change.
- Interface: check `/`, `/candidates`, `/training-log`, `/reports`, `/settings`, `/admin` at mobile (<`lg`, the collapsed nav branch at `app/training-erp.tsx:885`) and desktop (≥`lg`, the fixed sidebar at `:771`). Check the empty state (no candidates), the error banner (`:913`), the sidebar active vs hover states, the candidate search dropdown with results and with none (`:1366-1397`), and both `bg-primary` promo cards (`:803`, `:1544`).
- System: after the change, `app/training-erp.tsx` contains no arbitrary color utility and no named-palette color except the four status colors in `statusTone()`. No new token, CSS variable, or wrapper component exists.
- Repository:
  - `grep -c "#[0-9a-fA-F]\{6\}" app/training-erp.tsx` → `0`
  - `grep -oE "(bg|text|border|ring|decoration)-(white|black)" app/training-erp.tsx | wc -l` → `0`
  - `grep -oE "(bg|text|ring)-(emerald|blue|amber|zinc)-[0-9]+" app/training-erp.tsx | wc -l` → `18` (unchanged — the status palette)
  - `pnpm exec tsc --noEmit --incremental false` → passes
  - `pnpm run build:cloudflare` → succeeds

## Stop conditions

- Stop if a hand-typed color has no token that owns its role and cannot be expressed as an opacity modifier of one — report it rather than inventing a token or leaving a silent exception.
- Stop if a replacement changes rendered color enough to alter meaning rather than appearance (for example, if `text-destructive` on the error banner no longer reads as an error against `bg-destructive/5`).
- Stop if the scope must widen to `app/globals.css`, to adding a dark theme, or to splitting `app/training-erp.tsx`. Those are separate decisions.

## Design documentation

- After acceptance and validation: no `DESIGN.md` exists in this repository, so record the decision in `PROJECT_HANDOVER.md` §8 "Design system used" as one line — colors come from the `globals.css` token layer; the session-status palette in `statusTone()` is the single documented exception, because the token layer defines no success/warning/info role.
