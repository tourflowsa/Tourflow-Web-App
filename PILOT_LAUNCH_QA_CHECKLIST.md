# PILOT LAUNCH QA CHECKLIST

## 1. Pilot Preconditions
- [ ] **Test accounts needed:**
  - [ ] Admin
  - [ ] Operator
  - [ ] Driver
  - [ ] Guide
  - [ ] Vehicle Owner
- [ ] **Data setup:**
  - [ ] Test documents uploaded and approved for all provider roles.
  - [ ] Bank details completed for all providers.
  - [ ] At least one vehicle added with multiple photos (including a main photo).
  - [ ] At least one tour created by the Operator.
  - [ ] Platform fee tier active in Admin.
- [ ] **Access verification:**
  - [ ] Admin can access Payouts, Documents, User Verification, Bookings, and Audit Logs.

## 2. Perfect Booking Flow
- [ ] **Booking Creation:** Operator creates a draft booking.
- [ ] **Logistics:** Operator adds trip logistics: pickup location, dropoff location, guest count, special requests, start date, and end date.
- [ ] **Trip Requests:** Operator sends Trip Requests to Driver/Guide.
- [ ] **Acceptance:** Driver and Guide accept Trip Requests.
- [ ] **Assignment:** Operator converts accepted requests into assignments.
- [ ] **Vehicle Assignment:** Vehicle Owner accepts vehicle request or Operator assigns direct link vehicle.
- [ ] **Confirmation:** Operator confirms the booking.
- [ ] **Execution:** BBooking moves through the expected status path for the current workflow, for example Draft → Confirmed → In Progress or Completed.
- [ ] **Completion:** Operator marks booking as "Completed".
- [ ] **Ledger:** Payout ledger rows are generated automatically.
- [ ] **Authorization:** Admin authorizes payouts.
- [ ] **Withdrawal:** Provider requests withdrawal for eligible payouts.
- [ ] **Batching:** Admin creates a payout batch for requested withdrawals.
- [ ] **CSV Export:** Admin exports the batch CSV and verifies bank details are included.
- [ ] **Settlement:** Admin marks payout/batch as "Paid".
- [ ] **Verification:** Provider earnings show "Paid" status.
- [ ] **Financial Integrity:** Operator cost breakdown remains correct throughout.
- [ ] **Reviews:** Review flow triggers and works for Driver, Guide, and Vehicle Owner.

## 3. Disputed Booking Flow
- [ ] **Initial State:** Operator completes a booking.
- [ ] **Dispute:** Operator raises a payout dispute before authorization.
- [ ] **Hold:** Payout status moves to "On Hold".
- [ ] **Provider View:** Provider sees the "On Hold" status and the specific reason.
- [ ] **Admin Review:** Admin reviews the dispute in the Payouts dashboard.
- [ ] **Full Release Test:** Admin releases full amount; verify status updates to approved.
- [ ] **Partial Release Test:** Admin applies Partial Release; verify reduced settlement, adjustment amount, and final settlement display correctly.
- [ ] **Cancel Test:** Admin cancels payout; verify status is "Cancelled" and no longer appearing in withdrawal list.
- [ ] **Result Visibility:** Provider and Operator see the correct settlement result.
- [ ] **Audit Trail:** Admin payout list shows Adjusted/Cancelled status clearly.
- [ ] **CSV:** CSV export reflects final settlement amount.

## 4. Compliance Blocking Flow
- [ ] **Invalidate Document:** Set a required provider document to missing, expired, or rejected.
- [ ] **Assignment Block:** Try to assign the provider to a booking; verify system blocks or warns (blocking preferred for pilot).
- [ ] **Payout Block:** Try to approve or process a payout for that provider; verify compliance gate blocks the action.
- [ ] **Restore Flow:** Fix the document, approve it as Admin, and confirm the blocks clear.

## 5. Bank Details Blocking Flow
- [ ] **Remove Details:** Delete or leave bank details incomplete for a provider.
- [ ] **Withdrawal Guard:** Try to click "Request Withdrawal" as the provider; verify button is disabled and helper text appears.
- [ ] **Admin Guard:** Admin tries to process a payout for this provider; verify the payout is blocked in the authorization list.
- [ ] **Restore Flow:** Add complete bank details; verify withdrawal request and admin processing are now enabled.

## 6. Vehicle Owner Fleet Flow
- [ ] **Addition:** Add a vehicle successfully.
- [ ] **Photos:** Upload multiple vehicle photos and set one as "Main Photo".
- [ ] **Preview:** Confirm Main Photo appears in Fleet Preview, My Vehicles, Directory, and Detail views.
- [ ] **Blockage:** Mark vehicle as "Unavailable".
- [ ] **Reminders:** Confirm dashboard and My Vehicles show "Unavailable today" or "Next unavailable" reminders.
- [ ] **Clearance:** Remove the unavailable block and verify reminders disappear.

## 7. Admin Operations Flow
- [ ] **Document Review:** Approve/Reject docs with feedback.
- [ ] **User Verification:** Verify on-boarded users.
- [ ] **Action Queues:** Check dashboard widgets for pending items (Docs, Verification, Payouts).
- [ ] **Reconciliation:** Record actual bank settlement totals for a batch and check for mismatch warnings.
- [ ] **Audit Logs:** Open System Audit and verify that key actions (status changes, auth, user edits) are logged correctly.

## 8. Notifications Flow
- [ ] **Assignment Triggers:** Assignment sent, accepted, and rejected.
- [ ] **Request Triggers:** Trip request accepted/declined.
- [ ] **Link Triggers:** Link request sent and accepted.
- [ ] **Financial Triggers:** Custom rate proposal sent, Payout approved, Payout paid, Payout on hold.
- [ ] **Compliance Triggers:** Document approved or rejected.
- [ ] **UI Sync:** Notification bell updates after event dispatch or refresh/polling.; links lead to relevant detail pages.

## 9. Pass/Fail Table

| Scenario ID | Scenario Name | Tester | Pass/Fail | Notes | Ref / Screenshot | Fix Req? |
|-------------|---------------|--------|-----------|-------|------------------|----------|
| QA-01 | Perfect Booking Flow | | | | | |
| QA-02 | Dispute Resolution | | | | | |
| QA-03 | Compliance Gate (Assignment) | | | | | |
| QA-04 | Compliance Gate (Payout) | | | | | |
| QA-05 | Bank Details Guard (UI) | | | | | |
| QA-06 | Payout Batch CSV Export | | | | | |
| QA-07 | Vehicle Photo Management | | | | | |
| QA-08 | Notification Routing | | | | | |
| QA-09 | Admin Audit Log | | | | | |

## 10. Pilot Stop Conditions (Blockers)
Pilot must stop if any of these occur:
- Payout math mismatch
- Provider assigned or paid despite expired/missing required critical documents
- Payout processed to a batch without valid account information
- Escrow or settlement totals do not align with recorded payments
- Provider or Operator can see another user’s bank details
- Admin cannot export a valid payout CSV
- Provider cannot see assignment details
- Operator cannot mark a valid booking as Completed