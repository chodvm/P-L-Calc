# Urgent Care P&L (Have Elite urgent care)

Mobile-friendly Next.js (App Router) + Supabase app. Sidebar on desktop, hamburger on iPhone. 
Pages: Inventory (blank), Calculator, Reports, Settings (boss-only intent).

## Deploy (Vercel + Supabase)

1. **Supabase**
   - Create project and enable **Email/Password** auth.
   - Open SQL Editor, run: `supabase/seed_and_schema.sql`.
   - Create at least one user and add membership rows (already seeded for example UUIDs).

2. **Vercel**
   - Push this repo to GitHub.
   - Import into Vercel.
   - Add env vars:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Deploy.

3. **Use**
   - Login at `/login`.
   - Calculator pulls staff, daily fixed cost (`v_fixed_costs_daily`), org avg reimbursement (`v_org_avg_reimbursement`).
   - **Save today** button calls `save_daily_log_and_assignments(p_org, work_date, patients, staff_ids[])` to snapshot the day.

## Notes
- Fixed cost daily divisor: weekly /7, monthly /30, quarterly /120, yearly /365.
- Seeded: org, memberships, staff, fixed costs, insurances, rates, goals. No demo daily logs.
- Reports list `v_daily_pnl` rows—add a `daily_log` via calculator save to see data.

Generated: 2025-10-04T01:35:23.043522Z
