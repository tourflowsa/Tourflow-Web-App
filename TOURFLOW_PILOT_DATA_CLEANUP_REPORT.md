# TourFlow B2B MVP Pilot Data Cleanup Review Report

> **Note:** This report is based on the project's database schema and common patterns inferred from test development. Please verify the actual record counts in your database before executing any suggested SQL. 

## 1. Keep for Demo (Preserve List)
Records essential for pilot functionality and demo flows:

- **Bookings**: One of each type:
    - `completed_booking`
    - `dispute_resolved_booking`
    - `pending_acceptance_booking`
    - `declined_provider_booking`
    - `archived_booking`
- **Profiles**:
    - Demo users: Admin, Operator, Driver, Guide, Vehicle Owner.
- **Providers**:
    - One compliant driver, one compliant guide, one vehicle owner with vehicle and compliant documents.
- **Provider with Blocker**: One non-compliant provider (missing PrDP/license) to demonstrate compliance-block flow.

## 2. Candidate for Deletion
Records likely created during testing/debugging that are non-essential:

- **Bookings**:
    - Status `failed`, `draft` (older than 30 days).
    - Duplicates that share the same `booking_ref` but were created during test retries.
- **Payouts**:
    - Rows with `booking_id` that do not exist (orphans).
- **Users**:
    - Users not belonging to the demo set (e.g., `test1@...`, `foo@bar.com`) and not associated with any active booking in the "Keep" list.
- **System**:
    - `system_audit_log` entries older than 30 days.
    - `notifications` that are read and older than 30 days.

## 3. Data Integrity Issues (Checklist)
Please run these queries to identify orphans before deleting:

- **Bookings without Operator**: `SELECT * FROM bookings WHERE operator_id IS NULL AND status != 'draft';`
- **Payouts without Booking**: `SELECT * FROM payout_ledger WHERE booking_id NOT IN (SELECT id FROM bookings);`
- **Assignments without Provider**: `SELECT * FROM booking_assignments WHERE provider_id NOT IN (SELECT id FROM profiles);`
- **Vehicles without Owner**: `SELECT * FROM vehicles WHERE owner_id NOT IN (SELECT id FROM profiles);`

## 4. Recommended Cleanup SQL (Safe, Commented)

```sql
-- 1. DELETE: Orphaned Payouts (Payouts with non-existent booking IDs)
-- VERIFY: SELECT count(*) FROM payout_ledger WHERE booking_id NOT IN (SELECT id FROM bookings);
-- DELETE FROM payout_ledger WHERE booking_id NOT IN (SELECT id FROM bookings);

-- 2. DELETE: Old Failed Bookings
-- VERIFY: SELECT count(*) FROM bookings WHERE status = 'failed' AND created_at < NOW() - INTERVAL '30 days';
-- DELETE FROM bookings WHERE status = 'failed' AND created_at < NOW() - INTERVAL '30 days';

-- 3. DELETE: Stale Audit Logs
-- VERIFY: SELECT count(*) FROM system_audit_log WHERE created_at < NOW() - INTERVAL '30 days';
-- DELETE FROM system_audit_log WHERE created_at < NOW() - INTERVAL '30 days';

-- 4. DELETE: Read Notifications older than 30 days
-- VERIFY: SELECT count(*) FROM notifications WHERE is_read = true AND created_at < NOW() - INTERVAL '30 days';
-- DELETE FROM notifications WHERE is_read = true AND created_at < NOW() - INTERVAL '30 days';
```

## 5. Pilot Dataset Recommendation
We recommend you utilize the records identified in `TOURFLOW_DEMO_DATA_PLAN.md` and explicitly mark them as "DEMO" in an internal notes field or separate system-audit flag if possible, so they are not accidentally cleaned in future iterations. 

---
*Confirmed: No data has been changed or deleted by this report generation.*
