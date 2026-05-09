# TourFlow: Clean Pilot Environment Provisioning Checklist (Phase 2M.0)

This checklist provides the step-by-step workflow for setting up a fresh Supabase project for the Controlled Pilot. The current Dev/QA project will remain untouched for ongoing feature development.

## 1. Project Initialization
- [ ] **Create Supabase Project**: Provision a new project on the Supabase dashboard (e.g., `tourflow-pilot-01`).
- [ ] **Disable Automated Emails**: Ensure SMTP is disabled or set to "Sandbox" mode.
- [ ] **Site URL & Redirects**:
  - [ ] Set "Site URL" to the Shared Preview (Pilot) URL.
  - [ ] Add the specific OAuth/Auth redirect paths for the pilot app.

## 2. Schema & Database Logic
- [ ] **Run Migrations**: Apply all SQL files from `supabase/migrations` in sequential order.
- [ ] **Verify RLS**: Scan the `system_audit_log` and `payout_ledger` tables to ensure "Enable Row Level Security" is ON.
- [ ] **Verify RPCs**: Confirm custom functions like `get_booking_financial_breakdown` and `rpc_complete_booking` are successfully created.

## 3. Storage Layer Setup
- [ ] **Create Buckets**:
  - `provider-documents` (Private: Admin Read, Owner Read/Write)
  - `compliance-docs` (If required for corporate-level verification)
  - `profiles` (Public avatars, Private PII folders)
  - `public-assets` (For icons/UI images)
- [ ] **Apply Storage Policies**: Replicate the RLS policies for storage buckets to ensure Admin can preview documents via the Edge Function.

## 4. Edge Functions & Secrets
- [ ] **Deploy Functions**:
  - `get-document-signed-url`: Used for Admin document review.
  - `check-document-expiry`: Loaded with the reminder logic.
- [ ] **Set Function Secrets**:
  - [ ] `CHECK_DOCUMENT_EXPIRY_SECRET`: Generate a unique string for the pilot environment.
- [ ] **Set Platform Variables**: Update frontend `.env` (Pilot-specific) with the new `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## 5. Seed Account Plan (Internal Pilot Roles)
| Role | Email Prefix | Initial State | Purpose |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@...` | Verified | Platform Oversight |
| **Operator** | `internal.op@...` | Verified | Booking Creation Testing |
| **Driver** | `pilot.driver@...` | Verified + Docs | Assignment Flow Testing |
| **Guide** | `pilot.guide@...` | Verified + Docs | Guide Directory Testing |
| **Fleet Owner** | `pilot.owner@...` | Verified + Bank | Vehicle Management Testing |

*Optional: Seed one "Verified Vehicle" associated with the Fleet Owner account.*

## 6. Data Copy Rules (Strict Isolation)
### Items to COPY (Structure):
- All Folder/Bucket structures.
- All Auth Trigger logic.
- All RLS and Security constraints.

### Items NOT TO COPY (Data):
- ❌ Fake/Test Bookings.
- ❌ Dummy Payout/Ledger entries.
- ❌ Dev/QA Audit Logs.
- ❌ "Placeholder" documents (Real pilots upload their own).
- ❌ Stale Notifications.

## 7. Pilot Smoke Test Checklist
- [ ] **Auth**: Can a user sign up and receive a default `tourist` or `pending` role?
- [ ] **Profiles**: Does a profile record automatically generate in the `profiles` table?
- [ ] **Storage**: Can a Driver upload a PrDP and then see it in their own "Pending" view?
- [ ] **Admin Preview**: Can the Admin successfully "Preview" the Driver's PrDP via the Edge Function URL?
- [ ] **Search**: Does the directory correctly hide "Unverified" providers?
- [ ] **Financials**: Does a "Completed" booking generate an entry in `payout_ledger`?

## 8. Risks & Rollback
- **Risk**: Environment Variable mismatch (pointing to old Dev DB).
  - **Check**: Verify Supabase Project ID in the browser console during the first login.
- **Risk**: Edge Function Timeout/Secrets missing.
  - **Check**: Run `supabase functions serve` locally against the pilot project ID to test.
- **Rollback**: If provisioning fails, the DNS/URL will remain pointed at the stable Dev/QA build while the Pilot project is wiped and re-provisioned.

## 9. Go/No-Go Criteria for Inviting Pilot Users
1. [ ] All Smoke Tests Pass.
2. [ ] Admin Document Signed URL works for Private buckets.
3. [ ] Terms of Service / Privacy Policy links are reachable.
4. [ ] No "Access Denied" errors during standard Operator/Provider flows.
