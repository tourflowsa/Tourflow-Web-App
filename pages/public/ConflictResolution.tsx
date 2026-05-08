import React from 'react';
import { ShieldCheck, Scale, MessageSquare, Clock, CheckCircle2 } from 'lucide-react';

export function ConflictResolution() {
  const principles = [
    {
      icon: <Scale className="text-brand-teal" size={24} />,
      title: "Neutral Mediation",
      description: "TourFlow acts as a neutral third party to mediate disputes between operators and providers based on documented evidence."
    },
    {
      icon: <MessageSquare className="text-brand-teal" size={24} />,
      title: "Transparent Communication",
      description: "All dispute-related communications are logged within the platform to ensure a clear audit trail for both parties."
    },
    {
      icon: <Clock className="text-brand-teal" size={24} />,
      title: "Rapid Resolution",
      description: "We aim to resolve most operational disputes within 48-72 hours to minimize impact on business cash flow."
    },
    {
      icon: <ShieldCheck className="text-brand-teal" size={24} />,
      title: "Evidence-Based Decisions",
      description: "Decisions are made based on platform logs, submitted photos, and verified completion reports."
    }
  ];

  return (
    <div className="bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-20">
          <h1 className="text-4xl font-bold text-brand-charcoal mb-6">Conflict <span className="text-brand-teal">Resolution</span> Policy</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto font-serif italic">
            Ensuring fairness and accountability across the TourFlow ecosystem.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-24">
          {principles.map((principle, index) => (
            <div key={index} className="p-8 bg-gray-50 rounded-3xl border border-gray-100">
              <div className="mb-6">{principle.icon}</div>
              <h3 className="text-xl font-bold mb-4">{principle.title}</h3>
              <p className="text-gray-600 leading-relaxed">{principle.description}</p>
            </div>
          ))}
        </div>

        <div className="bg-brand-charcoal rounded-3xl p-12 text-white">
          <h2 className="text-3xl font-bold mb-12 text-center">The Resolution Process</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="relative">
              <div className="text-5xl font-bold text-brand-teal/20 absolute -top-6 -left-4">01</div>
              <h4 className="text-xl font-bold mb-4 relative z-10">Initiation</h4>
              <p className="text-gray-400 text-sm leading-relaxed">
                Either party can flag a booking for dispute within 24 hours of completion. A detailed reason and supporting evidence must be provided.
              </p>
            </div>
            <div className="relative">
              <div className="text-5xl font-bold text-brand-teal/20 absolute -top-6 -left-4">02</div>
              <h4 className="text-xl font-bold mb-4 relative z-10">Review</h4>
              <p className="text-gray-400 text-sm leading-relaxed">
                TourFlow's compliance team reviews the evidence, including GPS logs, chat history, and submitted documentation.
              </p>
            </div>
            <div className="relative">
              <div className="text-5xl font-bold text-brand-teal/20 absolute -top-6 -left-4">03</div>
              <h4 className="text-xl font-bold mb-4 relative z-10">Decision</h4>
              <p className="text-gray-400 text-sm leading-relaxed">
                A final decision is reached. Payouts are either released, partially refunded, or fully reversed based on the findings.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-24 max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-6">Our Commitment to Fairness</h2>
          <p className="text-gray-600 mb-8 leading-relaxed">
            We understand that operational issues happen. Our goal is not to penalize, but to ensure that the terms of every B2B agreement are respected and that providers are paid fairly for their work while operators receive the service they booked.
          </p>
          <div className="flex items-center justify-center gap-2 text-brand-teal font-bold">
            <CheckCircle2 size={20} />
            <span>Trusted by 500+ Tour Operators</span>
          </div>
        </div>
      </div>
    </div>
  );
}
