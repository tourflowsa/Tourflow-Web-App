# TourFlow MVP Checklist, Updated

## Completed

- [x] Booking creation flow
- [x] Booking edit flow
- [x] Guest count recalculation
- [x] Automatic escrow funding sync after booking creation
- [x] Admin escrow management
- [x] Operator Mark Completed safeguards
- [x] Archive and unarchive bookings
- [x] Operator and admin booking lists
- [x] Assignment accept flow
- [x] Assignment decline flow
- [x] Declined provider visibility
- [x] Provider remove and replace flow
- [x] Provider compliance document badges
- [x] Admin document review count
- [x] Operator payment readiness card
- [x] Provider compliance blockers in readiness
- [x] Compliance blocking during provider assignment
- [x] Provider availability and overlap checks
- [x] Vehicle overlap checks
- [x] Provider cost breakdown refresh after assignment changes
- [x] Provider cost breakdown calculations
- [x] Financial summary card
- [x] Platform fee snapshot and display
- [x] Individual payouts
- [x] Batch payouts
- [x] Payout disputes
- [x] Dispute resolution
- [x] Reduced payout settlements
- [x] Provider payout history adjusted amount display
- [x] Admin disputes page
- [x] Admin payout CSV exports
- [x] Admin dispute CSV exports
- [x] Admin reconciliation dashboard
- [x] Admin payout batch reconciliation
- [x] Reviews and ratings
- [x] Provider review visibility
- [x] Admin review visibility
- [x] Notifications centre
- [x] System audit visibility

## Remaining MVP Tasks

- Final dashboard data sanity checks across all roles
- [x] Final responsive desktop layout pass
- [x] Final mobile layout pass where required
- Empty states and loading states audit
- Error message consistency audit
- [x] Remove temporary console logs
- RLS and RPC permission review
- Final test data cleanup
- Final end-to-end regression test
- Production environment readiness checklist

## Deferred Until Later

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

## Final Regression Checklist

1. Create booking
2. Confirm escrow funds auto-sync
3. Assign compliant driver
4. Assign compliant guide
5. Assign vehicle
6. Attempt to assign non-compliant provider and confirm block
7. Attempt overlapping provider/vehicle and confirm block
8. Provider accepts assignment
9. Provider declines assignment
10. Operator removes/replaces declined provider
11. Mark booking complete
12. Generate payout ledger
13. Pay individual provider
14. Process batch payout
15. Raise dispute
16. Resolve dispute with reduced payout
17. Pay reduced payout
18. Confirm provider payout history shows reduced amount
19. Confirm admin CSV exports show final settlement amount
20. Confirm reconciliation shows zero mismatches
21. Submit review
22. Confirm provider sees review
23. Confirm admin sees review
24. Archive booking
25. Unarchive booking
