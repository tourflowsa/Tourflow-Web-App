# TourFlow Phase 2 Roadmap

## 1. Phase 2 Objective
Phase 2 strengthens B2B operational scale while simultaneously preparing the verified B2B supply base for a future B2C marketplace launch. It enables richer provider profiles, expands operator tools, and lays the foundation for future direct-to-tourist bookings—all while maintaining the current commission-based business model.

## 2. Removed From Old Roadmap
- Subscription plans
- Subscription billing
- Full B2C checkout for now
- Tourist accounts for now
- Full public marketplace launch for now

## 3. Phase 2 Workstreams

### Phase 2A: Marketplace Profile Readiness
- Public bio
- Profile images and gallery
- Service areas
- Languages
- Specialties
- Public/private profile separation
- Profile completeness score
- B2C-ready toggle
- Verified trust signals

### Phase 2B: B2B Directory Upgrade
- Guide directory
- Driver directory
- Vehicle directory
- Operator directory later
- Filters by location, language, availability, compliance, vehicle capacity, rating
- Verified badges
- Featured-ready marker

### Phase 2C: Operations Expansion
Recommended build order:
1. Saved crews
2. Booking templates
3. Bulk assignment
4. Recurring bookings
5. Itinerary builder

### Phase 2D: Communication and Workflow
- In-app messaging
- Booking-linked chat
- File sharing
- Provider/operator communication
- Improved notification rules
- Message history

### Phase 2E: Commission Monetisation Tools
- Promo codes
- Commission incentives
- Operator-specific commission rates
- Featured placement fees
- Net terms refinement
- Commission reporting

*(Note: Subscription plans are strictly excluded from the roadmap.)*

### Phase 2F: Analytics and Scale
- Admin analytics dashboards
- Operator reporting
- Provider performance insights
- Calendar sync
- Multi-language support
- Multi-currency support

### Phase 2G: Future B2C Listing Foundation
- Tour listings
- Guide service listings
- Driver service listings
- Vehicle listings
- Accommodation listing foundation
- Fixed price, from price, request quote
- Featured placement foundation
- B2C visibility stays disabled until launch window

## 4. Recommended Build Order
1. Marketplace Profile Readiness
2. B2B Directory Upgrade
3. Saved Crews
4. Booking Templates
5. Bulk Assignment
6. Communication and Workflow
7. Commission Monetisation Tools
8. Analytics and Scale
9. Future B2C Listing Foundation

## 5. Existing MVP Systems That Must Not Be Broken
- Booking creation and editing
- Escrow sync
- Assignments
- Compliance blocking
- Payouts
- Disputes
- Reconciliation
- Reviews
- Notifications
- Audit logs
- Archive/unarchive
- RLS and RPC permissions

## 6. First Feature Recommendation
**Marketplace Profile Readiness**

*Why:*
- Low risk to current operations.
- Helps B2B immediately by giving operators better selection tools.
- Prepares the B2C supply base passively.
- Does not touch sensitive financial systems (payouts, escrow, disputes, or reconciliation).

## 7. Acceptance Criteria for First Feature
- Providers can add a public bio.
- Guides can add languages and specialties.
- Drivers can add service areas and transport type.
- Vehicle owners can add better vehicle profile data and images.
- Operators can view richer profiles in the directory.
- Private data (e.g., personal contact info, bank details) remains securely hidden.
- Compliance status calculation and enforcement remains unchanged.
- No payout, dispute, or escrow logic is affected.

## 8. Risks and Guardrails
- Disintermediation risk from phone numbers/emails in bios (requires moderation/filtering).
- Image size and load performance issues (needs compression/limits).
- Unverified suppliers attempting to appear as verified or public.
- Public/private data leakage across role boundaries.
- Search ranking trust issues.
- Adding unneeded complexity ahead of the future B2C switch over.

## 9. Deferred Until B2C Launch Window
- Tourist accounts
- Public checkout
- Payment gateway webhooks
- Full public marketplace SEO
- Instant accommodation booking
- Tourist support workflows
