# TourFlow Pilot Data Strategy

## 1. Environment Roadmap
| Environment | Purpose | Data Integrity |
| :--- | :--- | :--- |
| **Development / QA** (Current) | Feature builds, bug fixing, regression testing. | **Dirty.** Contains fake test users, dummy docs, and simulated failures. |
| **Controlled Pilot** (Target) | First 5-10 real operators and providers. | **Pristine.** Only real business records. No dummy data allowed. |
| **Production** (Future) | Public market availability. | **Strictly Regulated.** Full compliance and financial oversight. |

## 2. The "Do Not Delete" List (Dev/QA)
Even in Development, the following records must not be casually deleted as they preserve system history and relationship integrity:
- **`system_audit_log`**: Historical proof of RLS and RPC behavior.
- **`payout_ledger`**: Relational anchor for all financial balance calculations.
- **`payout_disputes`**: Edge-case data for dispute resolution testing.
- **`completed_bookings`**: Required for testing archival and auto-reconciliation logic.

## 3. Controlled Pilot Project: Inclusion/Exclusion Rules

### What to INCLUDE (Migration Targets):
- **Core Schemas**: All tables, RLS policies, and RPC functions.
- **System Config**: Bank account validation regex, fee structures, and document requirements.
- **Identity Seeds**: The specific admin user (`admin@tourflow.com`) and sanctioned pilot stakeholders.

### What to EXCLUDE (Strict Prohibitions):
- **Fake Reviews**: No "Works great!" dummy reviews.
- **Dummy Payouts**: No R1.00 test payouts visible to real providers.
- **Stale Notifications**: No system notifications from 2024 development cycles.
- **Expired Fake Docs**: No dummy IDs or PrDPs attached to real supply.
- **Test Accounts**: No `test@example.com` or `driver1@tourflow.com`.

## 4. Account Naming Convention (Pilot)
- **Owners/Operators**: `name@company-domain.com` (Avoid generic names like `user1`).
- **Administrative Test Accounts**: `internal.qa+[name]@tourflow.co.za`.
- **System Service Role**: Always use standard Supabase `service_role` for backend tasks.

## 5. Clean Pilot Launch Checklist
- [ ] Provision new Supabase environment.
- [ ] Deploy latest SQL migrations (v2024 through v2026).
- [ ] Verify Storage Buckets are created and empty (`documents`, `profiles`, `reviews`).
- [ ] Manually invite Pilot Admin and Pilot Operators.
- [ ] Set up `CHECK_DOCUMENT_EXPIRY_SECRET` in new project.
- [ ] Verify Bank Detail validation matches South African account standards.

## 6. Risks of "Pilot-in-Dev" Approach
- **Reporting Contamination**: Financial dashboard charts will show massive "Total Payouts" due to test cycles.
- **Compliance Noise**: Real operators will receive expiry reminders for fake test documents that were never deleted.
- **Security Visibility**: Risks of exposing test-metadata or debug entries in the audit logs to pilot participants.

## 7. Migration Notes
- **Direct SQL Copy**: Use `pg_dump --schema-only` to ensure the structure matches exactly without data payload.
- **Secrets Migration**: Manually copy `.env.example` secrets into the new Supabase dashboard.
