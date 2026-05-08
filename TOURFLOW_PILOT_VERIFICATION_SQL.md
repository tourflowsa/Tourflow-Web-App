# TourFlow B2B MVP Pilot Data Verification Queries

This file contains SQL queries designed to identify potential data integrity issues and candidate records for cleanup before starting the pilot test.

**Note:** All queries are strictly READ-ONLY (SELECT). No data is modified.

---

### 1. Bookings without operators
Identify bookings that have not been assigned an operator, which is required for the full lifecycle.
```sql
SELECT id, booking_ref, status FROM public.bookings WHERE operator_id IS NULL;
```

### 2. Payout rows without bookings
Identify orphaned payouts that are not linked to a valid booking.
```sql
SELECT id, booking_id FROM public.payout_ledger WHERE booking_id IS NOT NULL AND booking_id NOT IN (SELECT id FROM public.bookings);
```

### 3. Payout rows without providers
Identify payouts that are missing a provider reference.
```sql
SELECT id, provider_id FROM public.payout_ledger WHERE provider_id IS NOT NULL AND provider_id NOT IN (SELECT id FROM public.profiles);
```

### 4. Assignments without bookings
Identify orphaned assignments.
```sql
SELECT id, booking_id FROM public.booking_assignments WHERE booking_id NOT IN (SELECT id FROM public.bookings);
```

### 5. Assignments without providers
Identify assignments where the provider profile has been removed or does not exist.
```sql
SELECT id, provider_id FROM public.booking_assignments WHERE provider_id NOT IN (SELECT id FROM public.profiles);
```

### 6. Vehicles without owners
Identify vehicles that are not linked to a valid profile.
```sql
SELECT id, owner_id FROM public.vehicles WHERE owner_id NOT IN (SELECT id FROM public.profiles);
```

### 7. Reviews without completed bookings
Identify reviews that are linked to bookings that either don't exist or haven't been completed.
```sql
SELECT r.id, r.booking_id FROM public.reviews r 
LEFT JOIN public.bookings b ON r.booking_id = b.id 
WHERE b.id IS NULL OR b.status != 'completed';
```

### 8. Documents without user profiles
Identify documents that are not associated with a valid user profile.
```sql
SELECT id, user_id FROM public.documents WHERE user_id NOT IN (SELECT id FROM public.profiles);
```

### 9. Disputes without payout rows
Identify disputes where the underlying payout ID is missing.
```sql
SELECT id, payout_id FROM public.payout_disputes WHERE payout_id NOT IN (SELECT id FROM public.payout_ledger);
```

### 10. Read notifications older than 30 days
Identify candidates for cleanup.
```sql
SELECT id, created_at FROM public.notifications WHERE is_read = true AND created_at < NOW() - INTERVAL '30 days';
```

### 11. Audit logs older than 30 days
Identify candidates for cleanup.
```sql
SELECT id, created_at FROM public.system_audit_log WHERE created_at < NOW() - INTERVAL '30 days';
```

### 12. Draft or failed bookings older than 30 days
Identify test/failed bookings that should be cleaned.
```sql
SELECT id, booking_ref, status, created_at FROM public.bookings WHERE status IN ('draft', 'failed') AND created_at < NOW() - INTERVAL '30 days';
```

### 13. Duplicate booking references
Identify potential duplicate test bookings sharing the same reference.
```sql
SELECT booking_ref, COUNT(*) FROM public.bookings GROUP BY booking_ref HAVING COUNT(*) > 1;
```

### 14. Payout batches with no payout ledger rows
Identify batches that might have been created but never populated.
```sql
SELECT id, batch_ref FROM public.payout_batches WHERE id NOT IN (SELECT DISTINCT batch_id FROM public.payout_ledger WHERE batch_id IS NOT NULL);
```
