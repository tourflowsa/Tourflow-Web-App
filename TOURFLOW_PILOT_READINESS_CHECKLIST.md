# TourFlow B2B MVP Pilot Readiness Checklist

## 1. Final Functional Smoke Test
- [ ] Admin login
- [ ] Operator login
- [ ] Driver login
- [ ] Guide login
- [ ] Vehicle owner login
- [ ] Booking creation
- [ ] Assignment flow
- [ ] Escrow sync
- [ ] Booking completion
- [ ] Individual payout
- [ ] Batch payout
- [ ] Dispute flow
- [ ] Reconciliation
- [ ] Reviews
- [ ] Notifications
- [ ] Audit logs
- [ ] Archive/unarchive

## 2. Security and Permissions
- [ ] Confirm payout_ledger provider update hardening
- [ ] Confirm system_audit_log insert hardening
- [ ] Confirm payout_disputes RLS enabled
- [ ] Confirm documents RLS enabled
- [ ] Confirm provider_bank_details RLS enabled
- [ ] Confirm users cannot see other operators’ bookings
- [ ] Confirm providers cannot see other providers’ payouts
- [ ] Confirm operators cannot see private provider documents

## 3. Data Cleanup Before Pilot
- [ ] Remove test bookings not needed
- [ ] Remove duplicate test users
- [ ] Reset fake payouts if needed
- [ ] Keep one complete demo booking
- [ ] Keep one dispute demo booking
- [ ] Keep one review demo booking
- [ ] Keep one compliance issue demo provider

## 4. Demo Data Set
### Demo Users
- Admin: admin@tourflow.com
- Operator: operator@tourflow.com
- Driver: driver@tourflow.com
- Guide: guide@tourflow.com
- Vehicle Owner: owner@tourflow.com

### Demo Records
- One clean completed booking
- One booking with provider acceptance pending
- One booking with declined provider
- One booking with dispute resolved
- One booking archived and unarchived

## 5. Known Deferred Items
- Invoice and receipt generation
- Booking payout activity timeline
- Provider decline reason display polish
- Advanced review moderation
- Payment gateway/webhook integration
- Automated document expiry job
- Advanced reporting dashboards
- Multi-language support
- Calendar sync
- Subscription plans
- Promotional codes

## 6. Pilot Success Criteria
- [ ] Operator can create and complete bookings without support
- [ ] Providers can accept, decline, and view payouts
- [ ] Admin can monitor disputes, documents, payouts, and reconciliation
- [ ] No critical console errors during core flows
- [ ] No cross-role data exposure
- [ ] Finance totals remain consistent across booking, payouts, CSV, and reconciliation
