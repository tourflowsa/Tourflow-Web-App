# TourFlow Project File Tree (Phase 2)

```text
.
├── components
│   ├── bookings
│   │   ├── BookingCalendar.tsx
│   │   ├── BookingFinancialBreakdown.tsx
│   │   └── BookingStatusBadge.tsx
│   ├── common
│   │   ├── ComplianceBadge.tsx <-- Compliance
│   │   ├── ConfirmationModal.tsx
│   │   ├── PayoutAuditTimeline.tsx <-- Payouts
│   │   └── PayoutDetailDrawer.tsx <-- Payouts
│   ├── documents <-- Documents
│   │   ├── DocumentCard.tsx <-- Documents
│   │   └── DocumentManager.tsx <-- Documents
│   ├── fleet
│   │   ├── VehicleForm.tsx
│   │   └── VehiclePhotos.tsx
│   ├── onboarding
│   │   └── StatusBanner.tsx
│   ├── providers
│   │   ├── ProviderCard.tsx
│   │   └── ProviderComplianceSummary.tsx <-- Compliance
│   ├── readiness
│   │   └── ReadinessDetailModal.tsx
│   ├── reviews <-- Reviews
│   │   ├── ProviderReviewSection.tsx <-- Reviews
│   │   └── ReviewModal.tsx <-- Reviews
│   ├── tours
│   │   ├── ImageGalleryUploader.tsx
│   │   └── TourDuration.tsx
│   ├── BankDetailsForm.tsx
│   ├── ConnectionHealthCheck.tsx
│   ├── DashboardLayout.tsx <-- Dashboards
│   ├── NotificationBell.tsx <-- Notifications
│   ├── OperatorBankDetailsForm.tsx
│   └── PublicLayout.tsx
├── contexts
│   └── AuthContext.tsx
├── hooks
│   ├── useOperatorFinancials.ts
│   └── useOperatorReadiness.ts
├── lib
│   ├── adminFeeService.ts
│   ├── adminPayoutService.ts <-- Payouts logic
│   ├── assignmentService.ts <-- Assignments logic
│   ├── auditService.ts <-- Audit logs logic
│   ├── bankDetailsService.ts
│   ├── bookingService.ts
│   ├── compliance.ts <-- Compliance
│   ├── complianceGate.ts <-- Compliance
│   ├── complianceRequirements.ts <-- Compliance
│   ├── csvExportService.ts
│   ├── documentService.ts <-- Documents logic
│   ├── escrowService.ts
│   ├── feeService.ts
│   ├── financialService.ts
│   ├── fleetService.ts
│   ├── formatUtils.ts
│   ├── notificationService.ts <-- Notifications logic
│   ├── onboardingUtils.ts
│   ├── operatorBankDetailsService.ts
│   ├── payoutService.ts <-- Payouts logic
│   ├── payoutUtils.ts <-- Payouts
│   ├── pdfGenerator.ts
│   ├── platformBankService.ts
│   ├── readinessService.ts
│   ├── reviewService.ts <-- Reviews logic
│   ├── routerUtils.ts
│   ├── supabase-admin.ts
│   └── supabase.ts
├── pages
│   ├── admin
│   │   ├── AdminBookingDetail.tsx <-- Booking detail
│   │   ├── AdminBookingsList.tsx
│   │   ├── AdminPayoutBatchDetail.tsx <-- Payouts
│   │   ├── AdminPayoutDetail.tsx <-- Payouts
│   │   ├── AdminPayoutsList.tsx <-- Payouts
│   │   ├── AdminReconciliationPage.tsx
│   │   ├── AdminReviewsPage.tsx <-- Reviews
│   │   ├── ComplianceRequirementsView.tsx <-- Compliance
│   │   ├── Diagnostics.tsx
│   │   ├── DocumentReviews.tsx <-- Documents
│   │   ├── FeeManagement.tsx
│   │   ├── FinanceSettingsPage.tsx
│   │   ├── PayoutDisputesPage.tsx <-- Payouts
│   │   ├── PayoutsPage.tsx <-- Payouts & Dashboards
│   │   ├── SystemAudit.tsx <-- Audit logs
│   │   ├── UserDetail.tsx
│   │   └── UserVerification.tsx
│   ├── dashboards
│   │   ├── AdminDashboard.tsx <-- Dashboards
│   │   ├── DriverDashboard.tsx <-- Dashboards
│   │   ├── GuideDashboard.tsx <-- Dashboards
│   │   ├── OperatorDashboard.tsx <-- Dashboards
│   │   └── VehicleOwnerDashboard.tsx <-- Dashboards
│   ├── driver
│   │   ├── AssignmentDetail.tsx <-- Assignments
│   │   ├── AssignmentsList.tsx <-- Assignments
│   │   └── DriverRequestsPage.tsx
│   ├── guide
│   │   ├── AssignmentDetail.tsx <-- Assignments
│   │   ├── AssignmentsList.tsx <-- Assignments
│   │   └── GuideRequestsPage.tsx
│   ├── operator
│   │   ├── BookingDetail.tsx <-- Booking detail
│   │   ├── BookingForm.tsx
│   │   ├── BookingsList.tsx
│   │   ├── DocumentsPage.tsx <-- Documents
│   │   ├── FinancialDashboard.tsx <-- Dashboards
│   │   ├── FleetList.tsx
│   │   ├── MyRequestsPage.tsx
│   │   ├── PayoutDetail.tsx <-- Payouts
│   │   ├── PayoutsList.tsx <-- Payouts
│   │   ├── PayoutsPage.tsx <-- Payouts & Dashboards
│   │   ├── ProviderDirectory.tsx
│   │   ├── ProviderProfilePage.tsx
│   │   ├── TourDetail.tsx
│   │   ├── TourForm.tsx
│   │   ├── ToursList.tsx
│   │   ├── VehicleDetailPage.tsx
│   │   └── VehicleFormPage.tsx
│   ├── owner
│   │   ├── BookingList.tsx
│   │   ├── LinkRequestsPage.tsx
│   │   └── VehicleRequestsPage.tsx
│   ├── public
│   │   ├── About.tsx
│   │   ├── ConflictResolution.tsx
│   │   ├── Contact.tsx
│   │   ├── FAQ.tsx
│   │   ├── ForOperators.tsx
│   │   ├── ForProviders.tsx
│   │   ├── Home.tsx
│   │   ├── HowItWorks.tsx
│   │   ├── Pricing.tsx
│   │   ├── PrivacyPolicy.tsx
│   │   └── TermsOfService.tsx
│   ├── shared
│   │   ├── DocumentsChecklist.tsx <-- Documents
│   │   ├── EditProfile.tsx
│   │   └── ProviderEarningsPage.tsx
│   ├── Login.tsx
│   └── Signup.tsx
├── public
│   ├── about-guide.jpg
│   ├── about-hero.jpg
│   ├── about-team.jpg
│   ├── contact-hero.jpg
│   ├── home-driver-transfer.jpg
│   ├── home-guide-safari.jpg
│   ├── home-hero.jpg
│   ├── home-landscape.jpg
│   ├── how-driver.jpg
│   ├── how-hero.jpg
│   ├── operators-driver.jpg
│   ├── operators-hero.jpg
│   ├── operators-operations.jpg
│   ├── pricing-hero.jpg
│   ├── pricing-trust.jpg
│   ├── providers-guide.jpg
│   ├── providers-hero.jpg
│   ├── providers-support.jpg
│   ├── tourflow-logo-reversed.png
│   └── tourflow-logo.png
├── supabase
│   ├── functions
│   │   ├── _shared
│   │   │   └── cors.ts
│   │   └── get-document-signed-url <-- Documents
│   │       └── index.ts
│   └── migrations
│       ├── 20240317000000_fix_assignment_archive_recalc.sql <-- Assignments
│       ├── 20240317000001_fix_assignment_archive_recalc_v2.sql <-- Assignments
│       ├── 20240523_search_drivers_rpc.sql
│       ├── 20240524_fix_assignment_rls.sql <-- Assignments
│       ├── 20260317000000_fix_assignment_archive_recalc_v3.sql <-- Assignments
│       ├── 20260317000001_vehicle_availability_requests.sql
│       ├── 20260318000000_create_vehicle_availability_requests.sql
│       ├── 20260319000001_driver_availability_requests.sql
│       ├── 20260322000000_add_profile_images.sql
│       ├── 20260323000000_create_notifications.sql <-- Notifications
│       ├── 20260324000000_get_triggers.sql
│       ├── 20260324000001_get_triggers_table.sql
│       ├── 20260324000002_find_trigger.sql
│       ├── 20260324000003_get_trigger_info.sql
│       ├── 20260324000004_fix_archive_booking.sql
│       ├── 20260324000005_fix_archive_booking_robust.sql
│       ├── 20260324000007_get_rpc.sql
│       ├── 20260331000000_add_guest_phone.sql
│       ├── 20260402000000_add_vat_to_profiles.sql
│       ├── 20260402000001_add_payout_statement_context_rpc.sql <-- Payouts
│       ├── 20260402000002_add_payout_tracking_columns.sql <-- Payouts
│       ├── 20260402000003_add_payouts_context_rpc.sql <-- Payouts
│       ├── 20260402000004_add_rpc_operator_assign_resource.sql
│       ├── 20260406000000_add_payout_approval_columns.sql <-- Payouts
│       ├── 20260408000000_add_escrow_fields.sql
│       ├── 20260408000001_add_withdrawal_request_fields.sql
│       ├── 20260410000000_fix_payout_ledger_rls.sql <-- Payouts
│       ├── 20260410000001_add_payout_audit_tracking.sql <-- Payouts
│       ├── 20260411000000_create_payout_batches.sql <-- Payouts
│       ├── 20260411000001_create_operator_bank_details.sql
│       ├── 20260411000002_create_platform_bank_details.sql
│       ├── 20260411000003_add_withdrawal_approval_fields.sql
│       ├── 20260412000000_add_escrow_fields_to_bookings.sql
│       ├── 20260412000001_add_canonical_finance_fields.sql
│       ├── 20260414000000_fix_rpc_complete_booking_order.sql
│       ├── 20260414000001_add_reconcile_booking_financials.sql
│       ├── 20260414000002_add_dispute_adjustment_fields.sql
│       ├── 20260416000000_add_financial_dashboard_data_layer.sql <-- Dashboards
│       ├── 20260417000000_add_batch_ref.sql
│       ├── 20260418000000_add_date_filters_to_financials.sql
│       ├── 20260418000001_fix_finance_rpc_signature.sql
│       ├── 20260418000003_payout_bank_normalization.sql <-- Payouts
│       ├── 20260418000004_operator_reconciliation_logic.sql
│       ├── 20260418000005_fix_platform_fee_calc.sql
│       ├── 20260418000006_add_rpc_operator_update_booking_vehicle.sql
│       ├── 20260418000007_fix_system_audit_log_policies.sql <-- Audit logs
│       ├── 20260424000000_get_booking_financial_breakdown.sql
│       ├── 20260424000001_get_booking_provider_display_names.sql
│       ├── 20260424000002_get_booking_financial_breakdown.sql
│       ├── 20260424000003_fix_booking_financial_breakdown_admin.sql
│       ├── 20260424000004_recreate_booking_financial_breakdown.sql
│       ├── 20260425000000_fix_outstanding_payout_logic.sql <-- Payouts
│       ├── 20260425000001_fix_dispute_visibility.sql
│       ├── 20260425000002_fix_finance_view_disputes.sql
│       ├── 20260425000003_fix_payout_status_priority.sql <-- Payouts
│       ├── 20260425000004_backfill_platform_fees.sql
│       ├── 20260425000005_add_rpc_update_booking_trip_info.sql
│       ├── 20260425000006_fix_rpc_update_trip_info_financials.sql
│       ├── 20260426000001_add_rpc_operator_cancel_assignment.sql <-- Assignments
│       ├── 20260428000000_create_provider_reviews.sql <-- Reviews
│       ├── 20260429000000_harden_audit_log_policy.sql <-- Audit logs
│       ├── 20260429000000_harden_provider_payout_updates.sql <-- Payouts
│       ├── 20260430000000_secure_payout_disputes.sql <-- Payouts
│       ├── 20260430000001_add_operator_archived_at.sql
│       └── 20260430000002_add_operator_archive_rpc.sql
├── types
│   └── index.ts
├── all_policies.txt
├── App.tsx <-- Routing
├── dump.js
├── extract_policies.cjs
├── extract_policies.js
├── index.html
├── index.tsx
├── inspect_payout.cjs <-- Payouts
├── metadata.json
├── package-lock.json
├── package.json
├── policies_output.txt
├── PROJECT_CHECKLIST_PAYOUTS.md <-- Payouts
├── PROJECT_PLAN.md
├── TOURFLOW_DEMO_DATA_PLAN.md
├── TOURFLOW_MVP_CHECKLIST_UPDATED.md
├── TOURFLOW_PHASE_2_ROADMAP.md
├── TOURFLOW_PILOT_DATA_CLEANUP_REPORT.md
├── TOURFLOW_PILOT_READINESS_CHECKLIST.md
├── TOURFLOW_PILOT_VERIFICATION_SQL.md
├── tsconfig.json
└── vite.config.ts
```
