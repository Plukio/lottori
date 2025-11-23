# Loading & Progress Patterns

Purpose: keep users informed during every asynchronous operation across the
LIFF app and admin tooling. All loaders should share the same visual language
(clover mark + soft pulse) to reinforce trust.

## Frontend (LIFF) Surfaces

### 1. App Boot / Auto Login

- Full-screen overlay with clover icon, “Logging you in…” copy, animated
progress bar.
- Triggered while LIFF validates LINE ID token and awaits `/api/session`.
- Block all interaction until session established or error surfaced.

### 2. Scan Lottery Ticket

- After tap `Scan Now`: disable button, swap label to “Scanning…”, show inline
spinner beneath preview frame until OCR response returns.
- Upload path mirrors same state, with filename chip + progress percentage.
- If parsing exceeds 8 seconds, show calming tip (“Still working—large images
take longer”) to reassure.

### 3. My Tickets (Grouped history)

- Tabs remain interactive.
- Render skeleton day headers plus two placeholder ticket rows per group while
fetching `/api/tickets`.
- Empty state only appears after data load confirms zero tickets.

### 4. My Rewards Wallet

- Show two skeleton voucher cards (provider dot, value bar, copy button stub).
- Replace skeletons with real cards once `/api/rewards` resolves.
- Delayed loading (>5 s) adds non-blocking toast advising to refresh.

### 5. Copy / Claim Voucher

- Clicking `Copy Code` or `Claim` triggers mini spinner inside the button and
temporarily disables it.
- On success, button flashes “Copied!” for 1.5 s and reverts.
- On failure, button re-enables with error toast; no ghost loaders remain.

## Admin Panel

### Inventory Table

- Top-of-table progress bar while CSV upload ingests; rows appear incrementally.
- Filters show inline shimmers to indicate query refreshes.

### Manual Actions

- Assign/Revoke dialogs include CTA with spinner, disable close icon until
request completes to avoid half-applied states.

### Reports & Exports

- Export buttons display percentage progress as backend streams CSV/Excel.
- Notify on completion via toast + auto-download.

## Implementation Notes

- Centralize loader components (e.g., `<FullScreenLoader />`, `<SkeletonCard />`)
inside `frontend/components/ui`.
- Use React Query (or similar) status flags to drive loaders; never rely on ad
hoc booleans.
- All loaders must have associated timeout messaging (8s soft warning, 15s hard
error) to prevent silent failures.
