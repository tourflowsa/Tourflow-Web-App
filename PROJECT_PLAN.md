# TourFlow B2B - Project Plan & Analysis

## A. User Roles & Responsibilities

1.  **Tour Operator**
    *   **Core Role:** Business owner managing products and logistics.
    *   **Responsibilities:**
        *   Create and manage Tour Inventory (descriptions, pricing, media).
        *   Onboard and verify staff (Guides, Drivers).
        *   Manage Vehicle fleet (if owned) or hire external.
        *   Approve or reject booking requests.
        *   Oversee booking lifecycle (Pending -> Completed).
        *   View financial reports (Payout readiness).

2.  **Tour Guide**
    *   **Core Role:** Service provider.
    *   **Responsibilities:**
        *   Maintain personal profile and verified status.
        *   Upload compliance docs (Guide Accreditation, ID).
        *   Manage availability calendar.
        *   Accept or reject specific tour assignments from Operators.

3.  **Driver**
    *   **Core Role:** Logistics provider.
    *   **Responsibilities:**
        *   Maintain driver profile.
        *   Upload compliance docs (PDP License, ID).
        *   Set availability.

4.  **Vehicle Owner**
    *   **Core Role:** Asset provider.
    *   **Responsibilities:**
        *   Register vehicles on the platform.
        *   Upload vehicle docs (Operating License, Insurance, Roadworthy).
        *   Manage service intervals and vehicle availability.

5.  **Admin**
    *   **Core Role:** Platform governance.
    *   **Responsibilities:**
        *   Validate provider onboarding applications (KYC).
        *   Audit document compliance.
        *   Full data visibility (override RLS).
        *   Manage disputes and system configuration.

---

## B. Core B2B Features (MVP)

1.  **Onboarding & Verification Module:**
    *   Multi-step forms for different roles.
    *   Document upload (S3/Supabase Storage) with metadata (expiry date).
    *   Verification status tracking (Unverified -> Pending -> Verified).

2.  **Dashboard & Navigation:**
    *   Role-specific layouts (e.g., Operator sees "My Tours", Driver sees "My Trips").

3.  **Tour Inventory System:**
    *   CRUD operations for Tours.
    *   Rich text descriptions, image galleries, tagging (Region, Style).
    *   Pricing configuration.

4.  **Availability Engine:**
    *   Calendar interface for providers to block out dates.
    *   Logic to check resource availability before confirming bookings.

5.  **Booking Management:**
    *   Kanban or List view of bookings.
    *   Status transitions: `Pending` -> `Awaiting Provider` -> `Confirmed` -> `Cancelled` -> `Completed`.
    *   Assignment modal for Operators to select Guides/Drivers/Vehicles.

6.  **Compliance Guardrails:**
    *   System prevents assignment of staff with expired documents.
    *   Automated "Verified" badge assignment.

7.  **Payout Ledger:**
    *   Generation of payout records upon booking completion.
    *   Calculation of Platform Fee (15%) vs Provider Earnings.

---

## C. High-Level Architecture

*   **Frontend:**
    *   **Framework:** React 18 (TypeScript) + Vite.
    *   **UI Library:** Tailwind CSS (No component libraries, pure Tailwind for strict brand adherence).
    *   **Routing:** HashRouter (as per environment constraints).
    *   **State Management:** React Context + Hooks (for Auth and Form state).
    *   **Design Philosophy:** Desktop-first (complex tables/dashboards), responsive mobile fallback.

*   **Backend (Supabase):**
    *   **Database:** PostgreSQL.
    *   **Authentication:** Supabase Auth (Email/Password).
    *   **Storage:** 
        *   `compliance-docs`: Private bucket, RLS restricted to Owner + Admin.
        *   `public-assets`: Public bucket for Tour images/Avatars.
    *   **Edge Functions:** (Potential) For complex payout calculations or email notifications.

---

## D. Highest Risk Areas

1.  **Row Level Security (RLS) Complexity:**
    *   **Risk:** The "Hybrid Marketplace" model is complex. A Guide is an independent contractor who might work for Operator A on Monday and Operator B on Tuesday.
    *   **Challenge:** Ensuring Operator A can only see the Guide's details relevant to *their* booking, while the Guide maintains a single profile. RLS policies must be robust to prevent data leakage between competing Operators.

2.  **Document Expiry Logic:**
    *   **Risk:** Documents expire *after* a booking is made but *before* the trip dates.
    *   **Challenge:** The system needs a scheduled check or trigger to flag these bookings as "At Risk" and notify the Operator. Simply blocking the booking at creation time is insufficient.

3.  **Scalability of Availability Queries:**
    *   **Risk:** "Search" (in B2C context later, but grounded in B2B data) requires joining Tours + Assigned Guide Schedule + Vehicle Schedule.
    *   **Challenge:** Efficiently querying "Show me all tours available on Date X" without causing N+1 query performance issues in the database.

4.  **Data Privacy (POPIA Compliance):**
    *   **Risk:** Storing ID documents and Licenses requires strict encryption and access logs.
    *   **Challenge:** ensuring developers (us) don't accidentally expose signed URLs to unauthorized users.
