# TourFlow: Pilot Admin Operations Runbook (Phase 2L.10)

This runbook defines the daily operations and procedures for the TourFlow Internal Admin team during the Controlled Pilot phase.

---

## 1. Daily Pilot Admin Checklist
**Every morning (08:30 - 09:00):**
- [ ] **Auth Review**: Check for any new user signups that haven't been assigned a role or verified.
- [ ] **Document Queue**: Navigate to `Document Reviews` and process all pending PrDPs, IDs, and Vehicle Licences.
- [ ] **Audit Review**: Scan `Audit Logs` for any "Access Denied" or "RLS Violation" entries (rare, but critical).
- [ ] **Support Desk**: Check for new messages in the Support inbox.
- [ ] **Booking Health**: Scan `Bookings` for any "Draft" or "Requested" tours that have been sitting for > 24h without assignment.

**End of Day (16:30 - 17:00):**
- [ ] **Payout Scan**: Review the latest Approved payouts.
- [ ] **Dispute Scan**: Check `Payout Disputes` for any flags raised by Providers.
- [ ] **Daily Report**: Complete the end-of-day reporting template.

---

## 2. Core Operational Processes

### New User & Document Approval
1. **Verify Identification**: Match the uploaded ID/Passport with the profile name.
2. **PrDP/Licence Check**: Ensure the expiry date entered by the user matches the physical document.
3. **Approval**: Click "Verify" in the Admin UI.
4. **Rejection**: If blurred or expired, click "Reject" and add a clear reason (e.g., "PrDP expired 2024-05-01").
   - *Note: Since automated emails are deferred, Admins should manually notify pilot users of rejection via WhatsApp/Phone.*

### Booking & Assignment Support
- **Issue**: Provider says they didn't receive a request.
  - **Check**: Verify the assignment exists in `system_audit_log`. Check if the Provider is "Verified" (only verified providers receive requests).
- **Issue**: Operator can't find a specific driver.
  - **Check**: Is the Driver's profile "Visible"? Do they have the correct "Operator Association" if private?

### Financial & Payout Management
1. **Review**: Check `Payout Ledger` for "Approved" entries.
2. **Manual Payment**: During this pilot, the Admin processes real bank transfers manually via their business banking portal.
3. **Mark as Paid**: Once the transfer is successful, update the status in TourFlow (Admin UI) to "Released/Paid".

---

## 3. Support & Escalation Matrix
| Issue Type | First Response | Escalation Path |
| :--- | :--- | :--- |
| **Login/Auth Errors** | Admin Support | Lead Developer |
| **Payment Inconsistency** | Admin Review of Ledger | Accounts Department |
| **Document Verification** | Admin Verification | Legal/CEO (for policy exceptions) |
| **App Crash / Bug** | Technical Support | Tech Lead |

---

## 4. Admin "Do Not Touch" Items
- **DO NOT** modify any RLS Policies or SQL Functions directly in the Supabase Dashboard.
- **DO NOT** delete records from `system_audit_log` or `payout_ledger`.
- **DO NOT** manually change a Provider's account role unless strictly authorized.
- **DO NOT** manually "Force Complete" a booking unless the Operator and Provider both provide written consent via support.

---

## 5. Reporting Templates

### Daily End-of-Day Report
- **Date**:
- **New Users Verified**:
- **Documents Processed/Rejected**:
- **New Bookings Created**:
- **Payouts Processed (Manual)**:
- **Major Issues Encountered**:
- **Pilot Sentiment (Brief)**:

### Weekly Pilot Review
- **Total Registered Users (by Role)**:
- **Total Valid Bookings**:
- **Average Time to Verification**:
- **Disputes Resolved**:
- **Top 3 Requested Features/Changes**:
- **Critical Bugs Found**:

---

## 6. When to Pause the Pilot
The pilot should be paused immediately if:
1. A "General Data Protection" breach is identified (e.g., User A can see User B's PII).
2. The financial ledger shows systemic rounding or calculation errors.
3. Multiple users report a complete inability to accept assignments.
4. The Admin Document Preview (Signed URL) fails for all documents.
