# PMTS Training ERP — Project Handover

## 1. Purpose and use case

PMTS Training ERP replaces a manual candidate-training tracker with a small web application. It is designed for the day-to-day operation of a training programme where staff need to:

- register learners with an enrollment date and serial-year identifier;
- log training sessions against each learner;
- select a trainer from a central trainer directory;
- see each learner's progress toward a common session target;
- monitor attendance and portfolio-level training performance; and
- keep the operational data in one Cloudflare D1 database instead of in browser storage or a spreadsheet.

The primary use case is a focused operations tool for tracking candidates from enrollment through completion. The landing page is a selected candidate's dashboard, rather than a generic marketing homepage.

## 2. Live application and source code

| Item | Location |
| --- | --- |
| Live ERP | <https://pmts-training-erp.cloud-app-services.workers.dev> |
| GitHub repository | <https://github.com/Ratu14/pmts-training-erp> |
| Cloudflare Worker | `pmts-training-erp` |
| Cloudflare D1 database | `pmts-training-erp-db` |
| Production branch | `main` |

Cloudflare Workers Builds is connected to the GitHub repository. A push to `main` builds the application, applies outstanding D1 migrations through the configured deploy command, and deploys the Worker.

## 3. What is currently built

### Route-based pages

The ERP uses individual URLs and pages, not one long single-page screen:

| Page | Path | Current purpose |
| --- | --- | --- |
| Candidate dashboard | `/` | Landing page; shows one selected learner's progress, attendance, next session, details, and history. |
| Candidate register | `/candidates` | Shows the candidate list, progress, enrollment date, contact, and remaining sessions. |
| Training log | `/training-log` | Creates sessions and shows the session register. |
| Reports | `/reports` | Shows completed sessions, attendance, no-shows, and portfolio completion. |
| Settings | `/settings` | Administrator-only operational settings: completion target, trainer directory, and time slots. |
| Admin records | `/admin` | Administrator-only candidate register with edit, deactivate/reactivate, and permanent delete. |

The dashboard can select a learner using `?candidate=<candidate-id>`, for example `/?candidate=87-26`.

### Candidate management

The **Add learner** form currently captures:

- candidate name;
- phone number;
- candidate serial number; and
- enrollment date.

The server generates the candidate ID from the serial number and enrollment year:

```text
serial number 87 + enrollment date in 2026 → 87-26
```

The same serial number can be reused in another year, but not twice in the same year. The database prevents that duplicate candidate ID.

Candidate search is available in two places:

- the dashboard picker searches by name or serial-year ID; and
- the candidate register search searches by name, serial-year ID, or phone number.

### Training sessions and trainers

The Training log lets a user choose a learner, date, time, trainer, status, and optional notes. Permitted statuses are:

- `Scheduled`
- `Completed`
- `No-show`
- `Cancelled`

Two starter trainer records are created automatically when the trainer table is empty:

- `S. Rao`
- `M. Jain`

The trainer dropdown is populated from the `trainers` table; it is not hard-coded in the page. A session stores both the trainer ID and the trainer name used at the time of logging.

### Progress calculations

The current global completion target is **15 sessions per learner**. For each candidate, the application calculates:

- completed sessions;
- remaining sessions: `target − completed`, never below zero;
- completion percentage: `completed ÷ target`; and
- attendance percentage: `completed ÷ (completed + no-shows)`.

Reports aggregate the same information across all active candidates.

## 4. Data storage and database tables

All operational data is stored in Cloudflare D1 through the Worker API. It is not stored in `localStorage` or in static application files.

| Table | Purpose | Main fields |
| --- | --- | --- |
| `candidates` | Learner master records | `id`, `serial_number`, `enrollment_year`, `name`, `phone`, `enrolled_at`, `is_active`, `created_at` |
| `trainers` | Trainer directory | `id`, `name`, `is_active`, `created_at` |
| `training_sessions` | Candidate session history | `candidate_id`, `session_date`, `time_slot`, `status`, `trainer_id`, `trainer_name`, `notes` |
| `settings` | Shared operational configuration | `training_target`, `time_slots` (JSON array), `updated_at` |
| `admin_login_attempts` | Short-lived failed-admin-login rate-limit records | `client_hash`, `window_started`, `failure_count`, `blocked_until` |

The schema is defined in [db/schema.ts](./db/schema.ts). Database migrations live in [drizzle](./drizzle).

## 5. Access model

### General access

The general ERP experience is available without an identity-provider, Cloudflare Access, or email login. General users can currently:

- view dashboards, candidates, session logs, and reports;
- create learners;
- create sessions; and
- mark the next scheduled session as completed.

**Important current trade-off:** general access is not authenticated. Anyone who knows the Worker URL can currently use these general features. This deliberately matches the lightweight, app-level approach requested for the project, but it is not suitable for sensitive production data exposed to the public internet.

### Administrator access

Settings and Admin records are restricted. Both pages are hidden from the ordinary navigation and their APIs reject requests unless the browser has an administrator session.

To sign in, an administrator clicks **Admin sign in** inside the ERP and enters the value configured in the Cloudflare `ADMIN_PASSWORD` secret. A successful sign-in creates a signed, HTTP-only cookie for 30 minutes. The browser cannot read the cookie value.

Administrator capabilities now include:

- changing the shared completion target;
- adding, renaming, deactivating, and reactivating trainer records (Settings);
- adding and removing suggested training time slots (Settings); and
- editing a candidate's name, phone, or enrollment date, deactivating/reactivating a candidate, and permanently deleting a candidate together with all of their training sessions (Admin records, `/admin`).

Trainer and candidate records are never hard-deleted from the admin API except through the explicit candidate "Delete permanently" action; deactivating a trainer or candidate keeps the historical record (and any sessions) intact while removing it from general-facing lists.

### Admin-session protections

The current application-level admin session includes:

- Cloudflare Worker secrets, rather than passwords in GitHub or client code;
- a signed, short-lived, HTTP-only cookie;
- `Secure` cookies in production and `SameSite=Strict` protection;
- same-origin validation for sign-in, sign-out, and administrator changes;
- no-cache headers on the admin endpoints;
- a hidden honeypot field for basic bot resistance; and
- a D1-backed limit of five failed password attempts per 15-minute window, followed by a 15-minute lockout.

Changing either `ADMIN_PASSWORD` or `ADMIN_SESSION_SECRET` invalidates existing administrator sessions.

## 6. Cloudflare configuration

The Worker must have these runtime secrets in **Workers & Pages → pmts-training-erp → Settings → Runtime variables and secrets**:

| Secret | Purpose |
| --- | --- |
| `ADMIN_PASSWORD` | The password entered in the ERP's administrator sign-in dialog. |
| `ADMIN_SESSION_SECRET` | A private random value of at least 32 characters used to sign administrator sessions. |

The Worker also has a D1 binding named `DB` that points to `pmts-training-erp-db`.

No Cloudflare Zero Trust, Access application, email allowlist, payment plan, or Cloudflare Access role is used by this implementation.

## 7. Application API

| Endpoint | Access | Function |
| --- | --- | --- |
| `GET /api/erp` | General | Reads settings (including time slots), active candidates, sessions, and active trainers. It seeds the two starter trainers when needed. |
| `POST /api/erp` | General | Creates candidates, creates sessions, or updates a session status. |
| `GET /api/admin/session` | General | Reports whether the current browser has an admin session and whether admin sign-in is configured. |
| `POST /api/admin/session` | General | Validates the administrator password and creates an admin session. |
| `DELETE /api/admin/session` | General | Signs the browser out of administrator access. |
| `GET /api/admin` | Admin only | Reads settings, all trainers (including inactive), and all candidates (including inactive) for the Settings and Admin records pages. |
| `POST /api/admin` | Admin only | Updates the training target, time slots, or a trainer/candidate record (`action`: `settings`, `time-slots`, `trainer-create`, `trainer-update`, `candidate-update`, `candidate-delete`). |

## 8. Design system used

The interface follows the agreed product preferences:

- **Fonts:** Geist and Geist Mono;
- **components:** shadcn-style components already included in the project;
- **icons:** Hugeicons;
- **layout:** restrained operations dashboard, route-based navigation, responsive sidebar/mobile navigation, and accessible labelled controls.

## 9. Local development and maintenance

From the repository folder:

```bash
pnpm run dev
pnpm run build:cloudflare
pnpm run db:generate
```

Before any production release, run the TypeScript check and Cloudflare production build:

```bash
pnpm exec tsc --noEmit --incremental false
pnpm run build:cloudflare
```

The project uses React, TypeScript, Vinext, Drizzle ORM/migrations, Cloudflare Workers, and Cloudflare D1.

## 10. Key implementation history

| Change | Result |
| --- | --- |
| Initial PMTS ERP | Introduced the candidate dashboard, candidate register, training log, reports, and settings. |
| Route split | Made sidebar items real pages instead of switching all content on one screen. |
| D1 integration | Connected operational records to Cloudflare D1. |
| Candidate serials and trainer directory | Added enrollment date, serial-year IDs, and table-driven trainer names. |
| Candidate picker search | Added name/serial search on the candidate dashboard selector. |
| App-level admin sessions | Replaced the proposed Cloudflare Access approach with the requested in-app password model. |
| Editable admin settings and candidate CRUD | Made the trainer directory and time slots editable in Settings, and added a dedicated `/admin` page for full candidate create/edit/deactivate/delete. |

## 11. Deliberately deferred work

The following is not yet built and should be planned as a separate protected-admin phase:

- CRUD table views for training sessions (editing/deleting a logged session, beyond the existing status update);
- hard-deleting a trainer record (trainers can only be deactivated/reactivated, to preserve historical session data);
- a distinct authenticated general-user role, if general data must not be public;
- user accounts, audit logs, password-reset flows, and per-user activity history;
- data import/export and backups; and
- more detailed reports and report downloads.

## 12. Recommended next steps

1. Use the ERP with a small set of real candidate and session records to validate the workflow.
2. Decide whether the general-data exposure is acceptable. If not, add general-user authentication before entering sensitive personal data.
3. Extend administrator CRUD to training sessions (edit/delete a logged session).
4. Add an audit trail before multiple staff members begin making administrative changes.
5. Define an export/backup routine for the D1 database.
