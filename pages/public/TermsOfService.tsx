import React from 'react';

export function TermsOfService() {
  return (
    <div className="bg-brand-white font-sans text-brand-charcoal min-h-screen">
      <header className="bg-brand-charcoal text-white py-20">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Terms of Service</h1>
          <p className="text-xl text-white/80">The rules and responsibilities for using TourFlow.</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16 max-w-4xl space-y-12">
        <section className="bg-yellow-50 border border-yellow-200 p-6 rounded-2xl text-yellow-800 text-sm italic">
          <strong>Note:</strong> These terms are prepared for pilot use and should be reviewed before public launch.
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6 border-b border-gray-200 pb-2 uppercase tracking-wider text-brand-teal">1. Introduction to the Platform</h2>
          <p className="text-lg leading-relaxed mb-4">
            TourFlow is a marketplace platform connecting tour operators, guides, drivers, and vehicle owners.
          </p>
          <p className="text-lg leading-relaxed font-semibold">
            Providers are independent service providers, not employees of TourFlow. TourFlow facilitates the marketplace and verification workflow but does not guarantee every service outcome.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6 border-b border-gray-200 pb-2 uppercase tracking-wider text-brand-teal">2. User Accounts & Information</h2>
          <ul className="list-disc pl-6 space-y-3 text-lg">
            <li>Users must provide accurate account, compliance, booking, and payment information.</li>
            <li>Providers must keep documents accurate and up to date at all times.</li>
            <li>TourFlow may suspend or restrict access for incomplete, expired, misleading, or non-compliant information.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6 border-b border-gray-200 pb-2 uppercase tracking-wider text-brand-teal">3. Bookings & Responsibilities</h2>
          <ul className="list-disc pl-6 space-y-3 text-lg">
            <li>Bookings create obligations between the parties involved.</li>
            <li>Operators must review booking details before assigning providers.</li>
            <li>Providers must accept only work they are able and legally permitted to perform.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6 border-b border-gray-200 pb-2 uppercase tracking-wider text-brand-teal">4. Payments & Fees</h2>
          <p className="text-lg leading-relaxed mb-4">
            Payments, payouts, platform fees, disputes, and escrow are handled according to the standard platform workflow. Users must not misuse the platform or attempt to bypass payments.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6 border-b border-gray-200 pb-2 uppercase tracking-wider text-brand-teal">5. Reviews & Conduct</h2>
          <ul className="list-disc pl-6 space-y-3 text-lg">
            <li>Reviews must be truthful and respectful.</li>
            <li>TourFlow may hide false, misleading, abusive, or inappropriate reviews.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6 border-b border-gray-200 pb-2 uppercase tracking-wider text-brand-teal">6. Limitation of Liability & Governing Law</h2>
          <p className="text-lg leading-relaxed mb-4">
            TourFlow facilitates the marketplace and verification workflow but does not guarantee every service outcome.
          </p>
          <p className="text-lg leading-relaxed font-semibold">
            These terms and your use of the platform are governed by the laws of South Africa.
          </p>
        </section>

        <section className="bg-brand-charcoal text-white p-8 rounded-3xl text-center">
          <h2 className="text-2xl font-bold mb-4">Questions?</h2>
          <p className="text-lg mb-4 text-white/80">Get in touch with our support team.</p>
          <a href="mailto:support@tourflow.co.za" className="text-brand-aqua font-bold text-xl hover:underline">
            support@tourflow.co.za
          </a>
        </section>
      </main>
    </div>
  );
}
