# TourFlow Payouts & Fees Regression Checklist

Use this checklist before deploying changes to fee logic, booking workflows, or payout generation.

## 1. Fee Tier Assignment
- [ ] **Action:** Log in as **Admin**. Navigate to **Fees > Operator Assignments**.
- [ ] **Action:** Search for a test Operator. Assign them to a specific tier (e.g., "Gold - 12%").
- [ ] **Expected:** Toast confirms assignment. The UI shows "Current" on the selected tier.

## 2. Booking Fee Snapshot (The "Lock")
- [ ] **Action:** Log in as the **Operator** configured above.
- [ ] **Action:** Create a new Booking. Select a Tour and set Guest count.
- [ ] **Action:** Check the "Estimated Cost" sidebar.
- [ ] **Expected:** Platform Fee matches the tier percent (e.g., 12% of Total).
- [ ] **Action:** Submit/Confirm the booking.
- [ ] **Expected:** Booking is created. 
- [ ] **Verification:** In Supabase/Diagnostics, verify the `bookings` row has `applied_fee_percent` = 12 and `applied_platform_fee` calculated correctly.

## 3. Payout Ledger Creation
- [ ] **Action:** Open the newly created Booking details.
- [ ] **Action:** Click **Actions > Mark as Completed**.
- [ ] **Expected:** Status changes to `Completed`.
- [ ] **Action:** Navigate to **Payouts** in the Operator dashboard.
- [ ] **Expected:** A new "Pending" payout record appears with the generated reference (e.g., PO-202X-XXXX).
- [ ] **Verification:** `Amount Net` = `Total Amount` - `Platform Fee`.

## 4. Statement Generation
- [ ] **Action:** Click **View** on the Payout record.
- [ ] **Action:** Click **Download Statement**.
- [ ] **Expected:** PDF downloads successfully.
- [ ] **Check:** 
    - [ ] TourFlow logo is present at the top.
    - [ ] Layout matches 40mm margin/alignment rules.
    - [ ] Financial figures match the on-screen values.

## 5. Admin Payout Lifecycle
- [ ] **Action:** Log in as **Admin**. Navigate to **Payouts**.
- [ ] **Expected:** The new payout is visible in the list.
- [ ] **Action:** Click **View**, then **Mark as Paid**.
- [ ] **Expected:** Status updates to `Paid` (Green).
- [ ] **Action:** Log back in as **Operator**. Check Payout details.
- [ ] **Expected:** Status is `Paid`.
