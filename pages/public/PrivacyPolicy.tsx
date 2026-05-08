import React from 'react';

export function PrivacyPolicy() {
  return (
    <div className="bg-brand-white font-sans text-brand-charcoal min-h-screen">
      <header className="bg-brand-charcoal text-white py-20">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-xl text-white/80">How we collect, use, and protect your information.</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16 max-w-4xl space-y-12">
        <section className="bg-yellow-50 border border-yellow-200 p-6 rounded-2xl text-yellow-800 text-sm italic">
          <strong>Note:</strong> This policy is prepared for pilot use and should be reviewed before public launch.
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6 border-b border-gray-200 pb-2">Information We Collect</h2>
          <p className="text-lg mb-4">TourFlow processes personal information in line with South Africa’s Protection of Personal Information Act (POPIA). We collect:</p>
          <ul className="list-disc pl-6 space-y-3 text-lg">
            <li>Names, emails, and company details</li>
            <li>Identity and compliance documents (licences, vehicle documents)</li>
            <li>Bank and payment details where applicable</li>
            <li>Booking records, assignments, and reviews</li>
            <li>Support and administrative records</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6 border-b border-gray-200 pb-2">Why We Process the Information</h2>
          <p className="text-lg mb-4">We use this information for the following purposes:</p>
          <ul className="list-disc pl-6 space-y-3 text-lg">
            <li>Account creation and user verification</li>
            <li>Compliance checks to verify provider eligibility</li>
            <li>Booking fulfilment and assignment management</li>
            <li>Handling payouts and payments</li>
            <li>Managing disputes and fraud prevention</li>
            <li>Platform safety, support, and meeting legal obligations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6 border-b border-gray-200 pb-2">Document Handling & Data Sharing</h2>
          <ul className="list-disc pl-6 space-y-3 text-lg">
            <li>Compliance documents are used to verify provider eligibility and may be reviewed by authorised admins.</li>
            <li>Only necessary information is shared between operators and providers for booking fulfilment.</li>
            <li>Sensitive documents and bank details are not publicly displayed.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6 border-b border-gray-200 pb-2">Data Retention</h2>
          <p className="text-lg leading-relaxed">
            Information is retained as long as needed for legal, operational, compliance, audit, and dispute purposes.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6 border-b border-gray-200 pb-2">Data Security</h2>
          <p className="text-lg leading-relaxed">
            We use industry-standard measures to protect your data, including access controls, secure storage, and role-based restrictions.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6 border-b border-gray-200 pb-2">Your Rights</h2>
          <p className="text-lg leading-relaxed">
            You have the right to request access, correction, or deletion of your personal information where legally permitted.
          </p>
        </section>

        <section className="bg-gray-50 p-8 rounded-2xl border border-gray-100">
          <h2 className="text-2xl font-bold mb-4">Contact</h2>
          <p className="text-lg">
            Email: <a href="mailto:privacy@tourflowsa.com" className="text-brand-teal font-bold hover:underline">privacy@tourflowsa.com</a> or contact TourFlow support.
          </p>
        </section>
      </main>
    </div>
  );
}
