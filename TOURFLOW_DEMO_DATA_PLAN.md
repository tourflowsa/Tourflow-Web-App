# TourFlow B2B MVP Demo Data Plan

## 1. Demo User Accounts

| Role | Purpose | Required Fields | Required Documents | Bank Details |
| :--- | :--- | :--- | :--- | :--- |
| Admin | Platform management | Admin metadata | N/A | N/A |
| Operator | Manage bookings/payouts | Operator metadata | N/A | Yes |
| Driver | Service delivery | Driver profile | ID, DL, PrDP | Yes |
| Guide | Service delivery | Guide profile | ID, Permit | Yes |
| Vehicle Owner | Asset ownership | Owner profile | ID, Reg Docs | Yes |

## 2. Demo Provider Profiles

### Driver
- Approved ID document
- Approved driver license
- Approved PrDP
- Bank details
- Availability enabled
- At least one positive review

### Guide
- Approved ID document
- Approved tour guide permit
- Bank details
- Availability enabled
- At least one positive review

### Vehicle Owner
- At least one vehicle listing
- Verified vehicle capacity
- Valid Operator license (if applicable)
- Bank details
- Availability enabled

## 3. Demo Bookings

1. **Clean Completed Booking**: Compliant driver, compliant guide, vehicle assigned, completed, all payouts paid, review submitted.
2. **Dispute Resolved Booking**: Payout dispute raised, admin resolved with reduced amount, final payout paid, reconciliation clean.
3. **Pending Acceptance Booking**: Driver or guide assigned, provider has not accepted yet.
4. **Declined Provider Booking**: Provider declined assignment, operator replaced provider.
5. **Archived Booking**: Archived and unarchived test flow confirmed.

## 4. Demo Financial Records

- Escrow-funded booking
- Individual payout
- Batch payout
- Reduced payout (due to dispute/adjustment)
- Reconciled payout batch
- CSV export test record reflecting all above types

## 5. Demo Compliance Records

- One fully verified provider (all docs approved)
- One provider missing documents (e.g., no PrDP)
- One provider with expired document (e.g., expired DL)
- One provider with pending review document

## 6. Cleanup Rules (Remove before pilot)

- Failed test bookings
- Duplicate fake users
- Broken payout rows
- Old mismatched batches
- Unused dispute records
- Stale archived test payouts

## 7. Validation Checklist

- [ ] Login works for all demo roles
- [ ] Dashboards load without errors
- [ ] Booking detail loads
- [ ] Payout pages load
- [ ] Admin reconciliation shows zero math mismatches for clean data
- [ ] CSV exports work
- [ ] Notifications work
- [ ] Audit logs show recent actions
