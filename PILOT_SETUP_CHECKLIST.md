# TourFlow: Controlled Pilot Setup Checklist (Phase 2L.8)

## 1. Infrastructure & Schema (The "Source of Truth")
- [ ] **Database Schema**: Export latest schema from Dev/QA (v2024.03 through v2026.05).
- [ ] **Migrations**: Execute all migration files in `supabase/migrations` to ensure identical RLS and RPC logic.
- [ ] **Edge Functions**:
  - [ ] Deploy `get-document-signed-url` (Admin preview).
  - [ ] Deploy `check-document-expiry` (Cron-ready logic).
- [ ] **Storage Buckets**: Manually recreate with strict RLS (Public Read-Only where applicable):
  - `documents` (Private/Admin-only)
  - `profiles` (Public avatars/Private PII)
  - `reviews` (Public)
- [ ] **Secrets Management**: Manually copy the following into Supabase Dash:
  - `SERVICE_ROLE_KEY`
  - `CHECK_DOCUMENT_EXPIRY_SECRET`
  - `SUPABASE_JWT_SECRET`

## 2. Data Transfer Rules
### DO COPY (Baseline Config):
- Identity of `admin@tourflow.com`.
- Current Bank Account Validation patterns (RSA Standard).
- Latest TourFlow Support/Legal content in DB (if stored in tables).

### DO NOT COPY (Clean Slate):
- [ ] **Finance**: `payout_ledger`, `payout_batches`, `payout_disputes` (Must be empty).
- [ ] **Operations**: `bookings`, `booking_assignments`, `vehicle_availability_requests` (Must be empty).
- [ ] **Compliance**: No dummy PrDPs or Vehicle Licences.
- [ ] **Audit**: `system_audit_log` (Should only contain pilot-startup logs).
- [ ] **Social**: `reviews` (No fake "Works great!" reviews).

## 3. Pilot Internal Seed Accounts
| Role | Recommended Email | Initial State |
| :--- | :--- | :--- |
| **Admin** | `admin@tourflow.com` | Full Control |
| **Internal Operator** | `operator@tourflow.com` | Verified Profile |
| **Primary Driver** | `pilot.driver@tourflow.com` | Verified + Docs |
| **Primary Guide** | `pilot.guide@tourflow.com` | Verified + Docs |
| **Fleet Owner** | `pilot.owner@tourflow.com` | Verified + Bank Details |

## 4. Post-Provisioning "Smoke Test"
- [ ] **Auth**: Sign up as a new user; verify record appears in `profiles`.
- [ ] **Triggers**: Verify `on_auth_user_created()` trigger successfully maps `user_id` to `role`.
- [ ] **Admin Preview**: Upload a file as a provider; verify Admin can generate signed URL via Edge Function.
- [ ] **Reviews**: Verify "Full Review History" page returns 404/Empty instead of a system crash.
- [ ] **Legal**: Verify Footer links correctly resolve to latest Privacy Policy/ToS.

## 5. Risks & Mitigations
- **Risk**: Accidentally seeding Pilot with `test@example.com` users.
  - **Mitigation**: Use `DELETE` scripts targeting non-pilot domains before any user makes the first booking.
- **Risk**: Storage permissions (`get_document_signed_url`) point to Dev URLs.
  - **Mitigation**: Hardcode or dynamically detect Supabase Project ID in Edge Function `index.ts`.
- **Risk**: Redirect URLs for Auth.
  - **Mitigation**: Update Supabase Auth/Site URL settings to point to the `ais-pre-...` (Shared) URL, not the Dev URL.
