import React, { useState } from 'react';
import { ChevronDown, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';

interface FAQItemProps {
  question: string;
  answer: React.ReactNode;
  isOpen: boolean;
  onClick: () => void;
}

function FAQItem({ question, answer, isOpen, onClick }: FAQItemProps) {
  return (
    <div className="border-b border-gray-200 last:border-0">
      <button
        onClick={onClick}
        className="w-full py-6 flex items-center justify-between text-left focus:outline-none group"
      >
        <h3 className={`text-xl font-bold transition-colors ${isOpen ? 'text-brand-teal' : 'text-brand-charcoal group-hover:text-brand-teal'}`}>
          {question}
        </h3>
        <ChevronDown
          className={`w-6 h-6 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-brand-teal' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pb-6 text-lg text-gray-600 leading-relaxed">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqData = [
    {
      question: "What is TourFlow?",
      answer: "TourFlow is a platform that connects tour operators with verified guides, drivers, and vehicles in one system."
    },
    {
      question: "How does escrow work?",
      answer: (
        <div className="space-y-4">
          <p>When a booking is made, the payment is held securely.</p>
          <p>The provider is paid only after the service is completed.</p>
          <p>This protects both sides.</p>
        </div>
      )
    },
    {
      question: "Do I need to schedule a demo?",
      answer: "No. You can sign up and start using the platform immediately."
    },
    {
      question: "How are providers verified?",
      answer: "All providers submit documents which are reviewed and tracked for compliance."
    },
    {
      question: "What fees does TourFlow charge?",
      answer: (
        <div>
          <p className="mb-2">TourFlow charges a commission per booking based on your plan:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Bronze: 15%</li>
            <li>Silver: 12%</li>
            <li>Gold: 10%</li>
          </ul>
        </div>
      )
    },
    {
      question: "Who is TourFlow for?",
      answer: (
        <ul className="list-disc pl-6 space-y-1">
          <li>Tour operators</li>
          <li>Guides</li>
          <li>Drivers</li>
          <li>Vehicle owners</li>
        </ul>
      )
    },
    {
      question: "Can I manage multiple bookings?",
      answer: "Yes. The platform includes a calendar and booking system to manage all assignments."
    },
    {
      question: "What happens if something goes wrong?",
      answer: "TourFlow includes tracking, records, and support to help resolve issues quickly."
    }
  ];

  return (
    <div className="bg-brand-white font-sans text-brand-charcoal min-h-screen">
      {/* HEADER */}
      <header className="bg-brand-charcoal text-white py-20">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Frequently Asked Questions</h1>
          <p className="text-xl text-white/80">Clear answers to common questions about TourFlow.</p>
        </div>
      </header>

      {/* FAQ LIST */}
      <main className="container mx-auto px-4 py-16 max-w-3xl">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 md:p-12">
          {faqData.map((item, index) => (
            <FAQItem
              key={index}
              question={item.question}
              answer={item.answer}
              isOpen={openIndex === index}
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </div>

        {/* FINAL CTA */}
        <section className="mt-20 text-center">
          <h2 className="text-3xl font-bold mb-8">Still Have Questions?</h2>
          <Link
            to="/signup"
            className="inline-flex items-center bg-brand-teal text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-brand-teal/90 transition-all shadow-lg hover:shadow-xl group"
          >
            Get Started for Free
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </section>
      </main>
    </div>
  );
}
