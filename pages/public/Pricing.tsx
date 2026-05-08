import React, { useState } from 'react';
import { CheckCircle2, ArrowRight, ShieldCheck, ChevronDown, ChevronUp, DollarSign, Zap, TrendingUp, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Pricing() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      question: "How does TourFlow charge fees?",
      answer: "TourFlow operates on a commission-based model. We only charge a percentage of the total booking value once a service is successfully completed. There are no monthly subscription fees for our base plans."
    },
    {
      question: "What is escrow and how does it work?",
      answer: "Escrow is a financial arrangement where a third party (TourFlow) holds and regulates payment of the funds required for two parties involved in a given transaction. It helps make transactions more secure by keeping the payment in a secure account which is only released when all of the terms of an agreement are met as overseen by the escrow company."
    },
    {
      question: "Are there any setup costs?",
      answer: "No, there are zero setup costs to join TourFlow. You can create your account, set up your profile, and start browsing the network or listing your services for free."
    },
    {
      question: "Can I upgrade my plan later?",
      answer: "Absolutely. As your booking volume grows, you can move to a higher tier (Silver or Gold) to benefit from lower commission rates. Our system automatically reviews your volume, or you can contact our support team to discuss a custom arrangement."
    }
  ];

  return (
    <div className="bg-[#fafbfb] font-sans text-[#363a37]">
      {/* SECTION 1: HERO */}
      <section className="relative h-[60vh] min-h-[500px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="/pricing-hero.jpg" 
            alt="Pricing Hero" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-[#363a37]/70"></div>
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block text-[#84c9c0] font-bold tracking-widest mb-4 uppercase text-sm">PRICING</span>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 max-w-4xl mx-auto leading-tight">
            Simple, Transparent Pricing for Tourism Operations
          </h1>
          <p className="text-xl text-white/90 max-w-2xl mx-auto mb-10">
            No hidden fees. No long-term contracts. Pay only when you earn.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              to="/signup" 
              className="bg-[#00abc6] hover:bg-[#00abc6]/90 text-white px-8 py-4 rounded-full font-bold transition-all flex items-center gap-2 shadow-lg"
            >
              Get Started for Free <ArrowRight size={20} />
            </Link>
            <Link 
              to="/how-it-works" 
              className="bg-white/10 hover:bg-white/20 text-white border border-white/30 px-8 py-4 rounded-full font-bold transition-all backdrop-blur-sm"
            >
              See How it Works
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 2: PRICING MODEL */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">You Only Pay When You Get Paid</h2>
            <p className="text-lg text-gray-600">
              TourFlow charges a small commission on each completed booking. There are no upfront costs and no monthly subscription required to start.
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: <Zap className="text-[#ff7055]" />, title: "No setup fees" },
              { icon: <DollarSign className="text-[#ff7055]" />, title: "No monthly subscription" },
              { icon: <CheckCircle2 className="text-[#ff7055]" />, title: "Pay per completed booking" },
              { icon: <TrendingUp className="text-[#ff7055]" />, title: "Scales with your business" }
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center text-center p-6 bg-[#fafbfb] rounded-2xl border border-gray-100">
                <div className="mb-4 p-3 bg-white rounded-xl shadow-sm">
                  {item.icon}
                </div>
                <h3 className="font-bold text-lg">{item.title}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 3: PRICING TIERS */}
      <section className="py-24 bg-[#fafbfb]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Choose the Right Plan for Your Business</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* BRONZE */}
            <div className="bg-white p-10 rounded-3xl border border-gray-100 flex flex-col h-full shadow-sm hover:shadow-md transition-all">
              <h3 className="text-2xl font-bold mb-2 text-[#363a37]">Bronze</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold text-[#00abc6]">15%</span>
                <span className="text-gray-500 ml-2">platform commission</span>
              </div>
              <p className="text-gray-600 mb-8">Ideal for operators getting started.</p>
              <ul className="space-y-4 mb-10 flex-1">
                {["Full platform access", "Verified provider network", "Booking and assignment tools", "Escrow-secured payments"].map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <CheckCircle2 className="text-[#00abc6] shrink-0" size={18} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/signup" className="bg-[#363a37] text-white py-4 rounded-xl font-bold text-center hover:bg-[#363a37]/90 transition-all flex items-center justify-center gap-2">
                Get Started for Free <ArrowRight size={18} />
              </Link>
            </div>

            {/* SILVER */}
            <div className="bg-white p-10 rounded-3xl border-2 border-[#00abc6] flex flex-col h-full shadow-xl relative transform md:-translate-y-4">
              <div className="absolute top-0 right-0 bg-[#00abc6] text-white px-4 py-1 rounded-bl-xl text-[10px] font-bold uppercase tracking-widest">
                Most Popular
              </div>
              <h3 className="text-2xl font-bold mb-2 text-[#363a37]">Silver</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold text-[#00abc6]">12%</span>
                <span className="text-gray-500 ml-2">platform commission</span>
              </div>
              <p className="text-gray-600 mb-8">Best for growing operators managing regular bookings.</p>
              <ul className="space-y-4 mb-10 flex-1">
                {["Everything in Bronze", "Improved margins", "Priority access to providers"].map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <CheckCircle2 className="text-[#00abc6] shrink-0" size={18} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/signup" className="bg-[#00abc6] text-white py-4 rounded-xl font-bold text-center hover:bg-[#00abc6]/90 transition-all flex items-center justify-center gap-2">
                Get Started for Free <ArrowRight size={18} />
              </Link>
            </div>

            {/* GOLD */}
            <div className="bg-white p-10 rounded-3xl border border-gray-100 flex flex-col h-full shadow-sm hover:shadow-md transition-all">
              <h3 className="text-2xl font-bold mb-2 text-[#363a37]">Gold</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold text-[#00abc6]">10%</span>
                <span className="text-gray-500 ml-2">platform commission</span>
              </div>
              <p className="text-gray-600 mb-8">Built for high-volume operators.</p>
              <ul className="space-y-4 mb-10 flex-1">
                {["Lowest commission rate", "Priority support", "Scalable operations"].map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <CheckCircle2 className="text-[#00abc6] shrink-0" size={18} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/contact" className="bg-[#363a37] text-white py-4 rounded-xl font-bold text-center hover:bg-[#363a37]/90 transition-all">
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: ESCROW EXPLANATION */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">How Payments Work</h2>
              <p className="text-lg text-gray-600 mb-8">
                TourFlow uses a secure payment system called escrow to protect both operators and providers.
              </p>
              <div className="bg-[#fafbfb] p-8 rounded-3xl border border-gray-100 mb-8">
                <p className="text-[#363a37] font-medium mb-6">
                  Escrow means that payment is held safely by TourFlow until the service is completed.
                </p>
                <div className="space-y-6">
                  {[
                    { step: 1, text: "You make a booking and payment is secured" },
                    { step: 2, text: "The provider delivers the service" },
                    { step: 3, text: "Once completed, the payment is released to the provider" }
                  ].map((s, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-[#00abc6] text-white flex items-center justify-center font-bold text-sm shrink-0">
                        {s.step}
                      </div>
                      <p className="text-gray-700">{s.text}</p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[#363a37] font-bold">
                This ensures that providers get paid and operators only pay for completed services.
              </p>
            </div>
            <div className="bg-[#363a37] rounded-3xl p-12 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Lock size={120} />
              </div>
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <ShieldCheck className="text-[#84c9c0]" /> Secure Escrow
              </h3>
              <p className="text-white/80 mb-8 leading-relaxed">
                Our escrow system acts as a neutral third party, ensuring that funds are only transferred when both parties are satisfied with the service delivery. This eliminates the risk of non-payment for providers and the risk of service failure for operators.
              </p>
              <div className="flex items-center gap-4">
                <div className="bg-[#84c9c0]/20 p-4 rounded-2xl">
                  <p className="text-3xl font-bold text-[#84c9c0]">100%</p>
                  <p className="text-[10px] uppercase tracking-widest text-white/60">Protected Funds</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: VALUE JUSTIFICATION */}
      <section className="py-24 bg-[#363a37] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white">Pricing That Aligns with Your Growth</h2>
          <p className="text-lg text-white/70 max-w-3xl mx-auto mb-16">
            Unlike traditional systems that charge fixed fees, TourFlow only earns when you do.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              "No wasted spend during slow periods",
              "Costs scale with bookings",
              "Clear and predictable margins",
              "Built for long-term growth"
            ].map((bullet, i) => (
              <div key={i} className="flex items-center gap-3 bg-white/5 p-6 rounded-2xl border border-white/10">
                <CheckCircle2 className="text-[#84c9c0] shrink-0" />
                <span className="text-sm font-medium text-left">{bullet}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 6: TRUST SECTION */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="rounded-3xl overflow-hidden shadow-2xl">
              <img 
                src="/pricing-trust.jpg" 
                alt="Trust and Transparency" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-[#363a37]">Built on Trust and Transparency</h2>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                Every transaction is secured, tracked, and fully visible to both parties.
              </p>
              <div className="space-y-6">
                {[
                  "Escrow-protected payments",
                  "Clear booking-level pricing",
                  "No hidden charges",
                  "Full transaction visibility"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="bg-[#00abc6]/10 p-2 rounded-lg text-[#00abc6]">
                      <CheckCircle2 size={20} />
                    </div>
                    <span className="font-bold text-[#363a37]">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7: FAQ */}
      <section className="py-24 bg-[#fafbfb]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-[#363a37]">Pricing Questions</h2>
          </div>
          
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <button 
                  onClick={() => toggleFaq(i)}
                  className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-50 transition-all"
                >
                  <span className="font-bold text-[#363a37]">{faq.question}</span>
                  {openFaq === i ? <ChevronUp className="text-[#00abc6]" /> : <ChevronDown className="text-[#00abc6]" />}
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-6 text-gray-600 leading-relaxed">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 8: FINAL CTA */}
      <section className="py-24 bg-[#00abc6] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white">Start Using TourFlow Without Upfront Costs</h2>
          <p className="text-xl text-white/90 mb-10 max-w-2xl mx-auto">
            Create your account and start managing bookings today.
          </p>
          <Link 
            to="/signup" 
            className="inline-block bg-[#363a37] text-white px-10 py-5 rounded-full font-bold text-lg hover:bg-[#363a37]/90 transition-all shadow-xl"
          >
            Get Started for Free
          </Link>
        </div>
      </section>
    </div>
  );
}
