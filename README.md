# Lottori

LINE LIFF mini-app that turns losing Thai lottery tickets into sponsor-funded
rewards (Grab, Shopee, top-up, in-app coins). Users scan or upload tickets,
the backend checks draw results, and a reward engine assigns vouchers from a
managed inventory. Admin tools handle voucher uploads, monitoring, and manual
actions.

## Repository Status
- ✅ Specs consolidated in `docs/architecture.md`.
- 🔜 Scaffold `frontend/`, `backend/`, `admin/`, and shared infra packages.
- 🔜 Flesh out loading-state UX (`docs/loading-states.md`), database schema,
  and CI guardrails.

## Quick Links
- Architecture blueprint: `docs/architecture.md`
- Mock UI reference: `/mnt/data/Screenshot 2568-11-23 at 13.30.21.png`

## Roadmap Highlights
1. Week 1: LIFF login, ticket upload, initial DB + storage.
2. Week 2: Admin CSV ingest + reward inventory views.
3. Week 3: Reward engine, cron jobs, ticket status automation.
4. Week 4: LINE notifications, rewards wallet UX.
5. Week 5: Reporting, QA, launch prep.
