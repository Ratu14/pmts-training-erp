# The ERP's four modals render through the installed Dialog primitive

Written against: `a0ed1972b46a78f9a31e4377fc3e444d86a38bae`

## Evidence chain

- Surface: the four modal overlays in `app/training-erp.tsx` — **Add a learner** (`:1017-1099`, reachable from `/` and `/candidates`), **Administrator sign in** (`:1101-1154`, reachable from the header on every route), **Edit candidate** (`:1156-1225`, `/admin`), **Delete candidate** (`:1227-1259`, `/admin`).
- Problem: `components/ui/dialog.tsx` is installed and owns the modal pattern for this design system, but `app/training-erp.tsx` never imports it — `grep "Dialog" app/training-erp.tsx` returns nothing. All four modals are hand-written instead, each repeating the identical string `fixed inset-0 z-50 grid place-items-center bg-[#151724]/30 p-4 backdrop-blur-sm` wrapped around `<Card className="w-full max-w-md bg-white shadow-2xl">`. The hand-written chrome does not match what the primitive defines: backdrop `#151724/30` vs the primitive's `bg-black/10`, `backdrop-blur-sm` vs `backdrop-blur-xs`, `shadow-2xl` vs `ring-1 ring-foreground/10`, and no entrance or exit animation at all where the primitive declares fade + zoom on both. Each modal also re-implements its own footer (`flex justify-end gap-2 pt-2`) rather than the footer treatment the primitive defines.
- Design evidence: `components/ui/dialog.tsx:29-36` defines the overlay (`fixed inset-0 isolate z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0`). `:53-58` defines the panel (`rounded-xl bg-popover p-4 text-popover-foreground ring-1 ring-foreground/10 sm:max-w-sm data-open:zoom-in-95 data-closed:zoom-out-95`). `:81-116` defines `DialogHeader` and `DialogFooter` (`-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end`). `:118-144` defines `DialogTitle` (`font-heading text-base leading-none font-medium`) and `DialogDescription` (`text-sm text-muted-foreground`). The animation utilities resolve because `app/globals.css:2` imports `tw-animate-css`.
- Owner: `components/ui/dialog.tsx`, built on `@base-ui/react/dialog` (`package.json` → `@base-ui/react@1.7.0`).
- Scope and affected surfaces: `app/training-erp.tsx` only, four blocks. `/` and `/candidates` (Add a learner), every route (Administrator sign in), `/admin` (Edit candidate, Delete candidate).
- Uncertainty: two of the four modals are driven by object-or-null state rather than a boolean, which affects whether an exit animation can play — resolved explicitly in change 3 below, not left to the executor.

## Design decision

Render all four modals through `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, and `DialogFooter` from `components/ui/dialog.tsx`, deleting the hand-written overlay and `Card` chrome. The root problem is that the modal pattern has an owner that the product does not use, so the app's most prominent interactions — creating a learner, signing in as administrator, deleting a candidate — appear instantly with no transition and with backdrop, panel edge, and footer treatments that exist nowhere else in the design system. Adopting the primitive is what makes those four surfaces match the system that already governs every `Card`, `Button`, and `Input` on the same screens, and it removes four copies of duplicated chrome in the process.

## Reuse

- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` — all exported from `components/ui/dialog.tsx:146-157`. Import with `import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';`, matching the existing import style at `app/training-erp.tsx:22`.
- Exemplar: `components/ui/command.tsx:33-56` (`CommandDialog`) — the one existing consumer of the primitive in this repository; it shows `Dialog` receiving root props and `DialogHeader`/`DialogTitle`/`DialogDescription` composed inside `DialogContent`.
- No new primitive, variant, or wrapper component. If the same modal composition appears to want extracting into a shared local component, that is out of scope — see **Stop conditions**.

## Changes

1. `app/training-erp.tsx:1017-1099` — **Add a learner**
   - Change: replace the wrapper `<div className="fixed inset-0 …">` and `<Card className="w-full max-w-md bg-white shadow-2xl">` with `<Dialog open={addOpen} onOpenChange={setAddOpen}><DialogContent className="sm:max-w-md">`. Replace `CardHeader`/`CardTitle`/`CardDescription` with `DialogHeader`/`DialogTitle`/`DialogDescription`, dropping the `className="text-lg"` from the title so `DialogTitle`'s own type treatment applies. Delete the `CardContent` wrapper and make the `<form>` a direct child of `DialogContent`. Replace the footer `<div className="flex justify-end gap-2 pt-2">` with `<DialogFooter>`, keeping both buttons and their order.
   - Preserve: the whole form body unchanged — all four `Input` fields with their `required`/`type`/`min`/`step`/`value`/`onChange` props, the candidate-ID preview panel at `:1074-1081`, `submitCandidate` on the form, and the `saving` disabled state on the submit button.
   - Verify: the dialog fades and zooms in on open, the panel is `max-w-md` on `sm` and up, and the footer sits flush to the panel's bottom edge with its own top border.

2. `app/training-erp.tsx:1101-1154` — **Administrator sign in**
   - Change: same replacement as change 1, with `<Dialog open={adminOpen} onOpenChange={(open) => { if (!open) { setAdminOpen(false); setAdminPassword(''); setAdminError(null); } else { setAdminOpen(true); } }}>`. The dismissal branch must run the same three resets the Cancel button runs at `:1138-1142`, so that Escape and backdrop-dismiss clear the password field and error exactly as Cancel does. The Cancel button itself can then be `<DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>` or keep its existing `onClick`; either is acceptable, but not both mechanisms on the same button.
   - Preserve: the hidden honeypot `<input name="website" aria-hidden="true" tabIndex={-1} className="absolute -left-[9999px] size-px">` at `:1112-1118` exactly as written — it is a bot-resistance control documented in `PROJECT_HANDOVER.md` §5. Preserve `autoFocus` and `autoComplete="current-password"` on the password `Input`, `submitAdminSignIn` on the form, the `adminError` paragraph, and the `adminSaving` disabled state.
   - Verify: opening the dialog focuses the password field; pressing Escape closes it and a reopen shows an empty field with no stale error.

3. `app/training-erp.tsx:1156-1225` (**Edit candidate**) and `:1227-1259` (**Delete candidate**)
   - Change: same replacement as change 1. These two are driven by object-or-null state, so keep the existing outer conditional and give `Dialog` a literal open state: `{editingCandidate && (<Dialog open onOpenChange={(open) => { if (!open) setEditingCandidate(null); }}><DialogContent className="sm:max-w-md">…)}`, and the same shape for `deletingCandidate` with `setDeletingCandidate(null)`. Keeping the outer conditional guarantees the body can dereference `editingCandidate.id` / `deletingCandidate.name` without a null check.
   - Preserve: on **Edit candidate**, the `onSubmit` handler and its `FormData` read, and every field's current value binding. On **Delete candidate**, the `variant="destructive"` submit button, its `adminBusy` disabled state, the `deleteCandidateAdmin(deletingCandidate.id)` call, and the warning copy naming the candidate and stating the action cannot be undone.
   - Verify: both open with the fade/zoom entrance. Their **exit** animation will not play, because the outer conditional unmounts the tree the moment state clears — this is accepted for these two. Do not add a ref that holds the last non-null candidate to work around it; if the exit animation is later wanted, that is a separate change.

4. `app/training-erp.tsx` — imports
   - Change: add the `components/ui/dialog` import. Then check whether `Card`, `CardHeader`, `CardTitle`, `CardDescription`, and `CardContent` are still used elsewhere in the file (they are — the dashboard, register, reports, and settings sections all use `Card`), and remove from the import only those names that no longer have a consumer.
   - Verify: `pnpm exec tsc --noEmit --incremental false` reports no unused-import or missing-import error.

## Scope

- Inherit: `/admin` (two modals), `/` and `/candidates` (Add a learner), and all six routes (Administrator sign in is reachable from the shared header).
- Verify: the `z-50` layering. The hand-written overlays used `z-50` inline; `DialogContent` portals out of the component tree and applies its own `z-50`. Confirm each dialog still sits above the sticky header (`app/training-erp.tsx:823`, `z-20`), the desktop sidebar (`:771`, `z-30`), and the candidate-search dropdown (`:1366`, `z-20`).
- Exclude: the modals' form logic, submit handlers, validation, API calls, and state variables. This change moves markup into the primitive; it does not alter what any modal does.
- Exclude: extracting a shared local modal component from the four now-similar compositions. Four call sites of a primitive is the intended shape.
- Exclude: converting **Delete candidate** to `AlertDialog`. `components/ui/alert-dialog.tsx` exists, but nothing in the repository establishes which confirmations belong to it rather than `Dialog`, and no existing consumer sets a precedent. `Dialog` is the primitive this change adopts for all four.
- Exclude: adding dialogs to surfaces that do not currently have one.

## Validation

- Product: an administrator signs in from the header, opens `/admin`, edits a candidate's phone number and saves, then opens the delete confirmation and cancels it. On `/`, a user opens **Add a learner** and creates a learner. Every one of those outcomes matches `main`.
- Interface: for each of the four modals, check open, close via Cancel, close via Escape, and close via backdrop click, at mobile and desktop widths. Check the **Add a learner** form at its tallest (all fields filled, ID preview populated) to confirm the panel scrolls rather than overflowing the viewport. Check that the primitive's close (X) button — which `DialogContent` renders by default and these modals did not previously have — does not collide with the title text in any of the four.
- System: `components/ui/dialog.tsx` is unmodified. No local overlay, backdrop, or modal-panel styling remains in `app/training-erp.tsx`, and no parallel modal helper was introduced.
- Repository:
  - `grep -c "fixed inset-0 z-50" app/training-erp.tsx` → `0`
  - `grep -c "backdrop-blur-sm" app/training-erp.tsx` → `0`
  - `grep -c "shadow-2xl" app/training-erp.tsx` → `0`
  - `git diff --stat components/ui/dialog.tsx` → no changes
  - `pnpm exec tsc --noEmit --incremental false` → passes
  - `pnpm run build:cloudflare` → succeeds

## Stop conditions

- Stop if `DialogContent`'s portal breaks a modal's form submission or focus behavior in a way that cannot be fixed without changing `components/ui/dialog.tsx`. Modifying the primitive is a wider decision than this plan covers.
- Stop if the default close (X) button cannot be placed without overlapping title or description text in a modal; report it rather than passing `showCloseButton={false}` on some modals and not others, which would reintroduce the inconsistency this plan removes.
- Stop if the work starts to require extracting a shared modal component or converting any modal to `AlertDialog`.

## Design documentation

- After acceptance and validation: no `DESIGN.md` exists in this repository. Record in `PROJECT_HANDOVER.md` §8 "Design system used" that modals use the `Dialog` primitive from `components/ui/dialog.tsx`, and that hand-written overlays are not used.
