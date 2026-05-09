# TourFlow Pilot Onboarding Pack (Phase 2L.9)

Welcome to the TourFlow Controlled Pilot. This guide is designed to help you navigate the platform during our initial testing phase. Your feedback is critical to ensuring TourFlow becomes the standard for B2B tourism operations in Southern Africa.

---

## 1. Pilot Overview
**Purpose:** To validate the end-to-end workflow from tour booking to financial reconciliation in a live environment.
**Duration:** 2-4 weeks.
**Scope:** A strictly controlled environment with limited real-world transactions.

---

## 2. Quick-Start Guides

### A. For Tour Operators
1. **Signup & Consent**: Complete your registration and review the Terms of Service and Privacy Policy before creating your account.
2. **Setup Tours**: Create your standard tour templates (Pricing, Duration, Routes).
3. **Draft Bookings**: Create a live booking for a group.
4. **Search/Assign**: Use the directory to find compliant Drivers, Guides, or Vehicles.
5. **Completion**: Once a tour ends, mark it as "Completed" to trigger the financial ledger.
6. **Payout Review**: Monitor generated payouts for your bookings to ensure accuracy and readiness for processing.

### B. For Drivers & Guides (Individual Providers)
1. **Compliance First**: Complete your profile and upload your **PrDP (Driver)** or **Tourism ID (Guide)**.
2. **Assignments**: You will receive notifications when an Operator requests your services.
3. **Dashboard**: View your "Requests" to accept or decline upcoming tours.
4. **Earnings**: After completion, view your "Financial Dashboard" to see pending balances.
5. **Withdrawal**: Request a withdrawal once your payout reaches "Approved" status.

### C. For Fleet Owners (Company Providers)
1. **Add Fleet**: Register your vehicles and upload current **Vehicle Licences**.
2. **Manage Requests**: Respond to availability requests from Operators.
3. **Driver Management**: Keep track of which drivers are associated with your fleet (full driver allocation logic is being refined).
4. **Financials**: Track earnings across multiple vehicles and drivers in one view.

---

## 3. Required Documents by Role
| Role | Required Document | Verification Requirement |
| :--- | :--- | :--- |
| **Driver** | PrDP (Professional Driving Permit) | Must be current (Expiry Date required) |
| **Guide** | Provincial/National Guide ID | Valid registration number |
| **Vehicle** | Vehicle Licence Disc | Must match VIN/Reg on platform |
| **Operator** | Company PTY/Reg Docs | For financial verification (KYC) |

*Note: Additional documents may be requested depending on role, vehicle type, or specific compliance status.*

---

## 4. Known Pilot Limitations
Please be aware that this is a **Controlled Pilot** environment:
- **Notifications**: The in-app notification bell is the system's "Source of Truth" for this phase.
- **Email Notifications**: Currently in "Sandbox" mode. You may not receive real-time emails until our domain is finalized.
- **Domain/Environment**: You are using a temporary test URL (e.g., `ais-pre-...`). This will be updated to `tourflow.co.za` for the production launch.
- **Expiry Reminders**: The automatic expiry reminder function exists, but automated cron scheduling is deferred for the pilot phase.
- **Payouts & Transfers**: Real bank transfers and withdrawals may be handled manually by the Admin team during the pilot phase.
- **Storage Security**: Production-grade storage policy hardening for all internal corner cases is deferred to the staging environment.

---

## 5. Support & Feedback
- **Support**: Use the "Support" link in the sidebar for any technical issues.
- **Feedback**: We will reach out via a weekly survey. 

### Feedback Questions to Consider:
- Was it easy to upload your documents?
- Did the financial breakdown for each booking make sense?
- Were there any "Access Denied" screens that felt incorrect?
- On mobile, were you able to easily see your upcoming assignments?

---

## 6. Admin Internal Readiness Checklist
*To be completed before inviting the first real user:*
- [ ] Verify Supabase project is "Clean" (No test bookings).
- [ ] Confirm `get-document-signed-url` Edge Function is live.
- [ ] Signup displays the Terms and Privacy consent notice and links work.
- [ ] Check that `payout_ledger` RLS only allows users to see their own data.
- [ ] Confirm specific admin accounts are excluded from public directory.
- [ ] Reset all system notifications.
