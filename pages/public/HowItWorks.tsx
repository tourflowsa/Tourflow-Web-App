import React from 'react';
import { Link } from 'react-router-dom';
import { 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  Search, 
  CalendarCheck, 
  CreditCard, 
  Users, 
  ChevronDown,
  Lock,
  History,
  FileCheck
} from 'lucide-react';

export function HowItWorks() {
  return (
    <div className="flex flex-col font-sans text-[#363a37] bg-[#fafbfb]">
      {/* SECTION 1: HERO */}
      <section className="relative min-h-[70vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="/how-hero.jpg" 
            loading="eager"
            alt="Tourism Operations" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#363a37]/90 via-[#363a37]/60 to-transparent"></div>
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 w-full">
          <div className="max-w-3xl text-left">
            <span className="inline-block py-1 px-3 rounded-full bg-[#00abc6]/20 text-[#00abc6] text-xs font-bold tracking-widest uppercase mb-6">
              HOW TOURFLOW WORKS
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold text-white leading-tight mb-8">
              A Structured System for Modern Tourism Operations
            </h1>
            <p className="text-xl text-gray-200 mb-10 leading-relaxed max-w-2xl">
              From sourcing providers to securing payments, TourFlow brings every step of your operation into one controlled workflow.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link 
                to="/signup" 
                className="bg-[#ff7055] text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-[#ff7055]/90 transition-all shadow-lg shadow-[#ff7055]/20 flex items-center justify-center gap-2"
              >
                Get Started for Free <ArrowRight size={20} />
              </Link>
              <Link 
                to="/how-it-works" 
                className="bg-white/10 backdrop-blur-md text-white border border-white/20 px-8 py-4 rounded-xl font-bold text-lg hover:bg-white/20 transition-all flex items-center justify-center"
              >
                See How it Works
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: INTRO */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl font-bold mb-8 leading-tight">From Fragmentation to Control</h2>
            <p className="text-xl text-gray-600 mb-6 leading-relaxed">
              TourFlow replaces manual coordination with a structured system that connects sourcing, booking, compliance, and payments.
            </p>
            <p className="text-lg text-gray-500 leading-relaxed">
              In traditional tourism operations, data lives in siloed spreadsheets, WhatsApp chats, and disconnected email threads. TourFlow was designed to replace that manual coordination with a structured digital environment where every movement is tracked, verified, and optimized.
            </p>
          </div>
          <div className="relative">
            <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-2xl shadow-gray-200/50 relative z-10">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-[#00abc6]/10 rounded-xl flex items-center justify-center">
                  <ShieldCheck className="text-[#00abc6]" size={24} />
                </div>
                <div>
                  <h4 className="font-bold">Operational Integrity</h4>
                  <p className="text-sm text-gray-500">Verified at every touchpoint</p>
                </div>
              </div>
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#00abc6] rounded-full" style={{ width: `${40 + i * 20}%` }}></div>
                    </div>
                    <CheckCircle2 className="text-[#84c9c0]" size={18} />
                  </div>
                ))}
              </div>
              <div className="mt-8 pt-8 border-t border-gray-100 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">System Status</span>
                <span className="text-[#84c9c0] font-bold flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#84c9c0] rounded-full animate-pulse"></div>
                  Active
                </span>
              </div>
            </div>
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-[#f1c36c]/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-[#00abc6]/10 rounded-full blur-3xl"></div>
          </div>
        </div>
      </section>

      {/* SECTION 3: CORE STEP FLOW */}
      <section className="py-24 bg-[#fafbfb] border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">The Operational Lifecycle</h2>
            <p className="text-xl text-gray-500">Four steps to executable operational clarity</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            {/* Connector Line (Desktop) */}
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-px bg-gray-200 -translate-y-12 z-0"></div>
            
            {[
              { 
                step: "01", 
                title: "Access Verified Supply", 
                body: "Browse a curated marketplace of vetted providers, from boutique stays to specialized guides.",
                icon: <Users className="text-[#00abc6]" size={24} />
              },
              { 
                step: "02", 
                title: "Check Availability", 
                body: "Find live inventory gaps across regions in real time and match demand to fit the right time slots and teams.",
                icon: <Search className="text-[#00abc6]" size={24} />
              },
              { 
                step: "03", 
                title: "Book and Manage", 
                body: "Centralized booking management with assignment queues, communication, and itinerary generation.",
                icon: <CalendarCheck className="text-[#00abc6]" size={24} />
              },
              { 
                step: "04", 
                title: "Pay Securely", 
                body: "Escrow-protected payments, released only after successful service delivery.",
                icon: <CreditCard className="text-[#00abc6]" size={24} />
              }
            ].map((item, idx) => (
              <div key={idx} className="relative z-10 group">
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm group-hover:shadow-xl transition-all duration-300 h-full">
                  <div className="w-12 h-12 bg-[#fafbfb] border border-gray-100 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                    {item.icon}
                  </div>
                  <div className="text-xs font-bold text-[#00abc6] uppercase tracking-[0.2em] mb-4">Step {item.step}</div>
                  <h3 className="text-xl font-bold mb-4">{item.title}</h3>
                  <p className="text-gray-500 leading-relaxed text-sm">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4: AUDIENCE VALUE SPLIT */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Card 1: Operators */}
          <div className="bg-[#363a37] p-12 rounded-[2.5rem] text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#00abc6]/10 rounded-full blur-3xl -mr-32 -mt-32 transition-all group-hover:bg-[#00abc6]/20"></div>
            <h2 className="text-3xl font-bold mb-8">For Operators</h2>
            <div className="space-y-8">
              {[
                { title: "Centralized sourcing", desc: "Access a verified network of pre-vetted local suppliers." },
                { title: "Real-Time Dashboards", desc: "Track bookings and lead input from one screen." },
                { title: "Automated Invoicing", desc: "Generate professional white-labeled documents for clients." }
              ].map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="mt-1 flex-shrink-0">
                    <CheckCircle2 className="text-[#00abc6]" size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg mb-1">{item.title}</h4>
                    <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card 2: Providers */}
          <div className="bg-white p-12 rounded-[2.5rem] border border-gray-100 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#ff7055]/5 rounded-full blur-3xl -mr-32 -mt-32 transition-all group-hover:bg-[#ff7055]/10"></div>
            <h2 className="text-3xl font-bold mb-8">For Providers</h2>
            <div className="space-y-8">
              {[
                { title: "Guaranteed Payments", desc: "No more chasing invoices. Funds are secured before the work begins." },
                { title: "Digital Compliance", desc: "Upload, manage, and monitor documents from one secure work hub." },
                { title: "Scale Your Reach", desc: "Get discovered by professional operators without marketing budget." }
              ].map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="mt-1 flex-shrink-0">
                    <CheckCircle2 className="text-[#ff7055]" size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg mb-1">{item.title}</h4>
                    <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: RELIABILITY SECTION */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div className="rounded-[2.5rem] overflow-hidden shadow-2xl">
              <img 
                src="/how-driver.jpg" 
                loading="lazy"
                alt="Reliability on the Ground" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h2 className="text-4xl font-bold mb-8 leading-tight">Reliability on the Ground</h2>
              <p className="text-xl text-gray-600 mb-10 leading-relaxed">
                TourFlow brings the gap between digital management and physical reality. We ensure that every vehicle is inspected and every driver is briefed before they ever pick up a guest.
              </p>
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-[#fafbfb] p-6 rounded-2xl border border-gray-100">
                  <div className="text-3xl font-bold text-[#00abc6] mb-2">98%</div>
                  <div className="text-sm font-bold text-gray-400 uppercase tracking-widest">Compliance Rate</div>
                </div>
                <div className="bg-[#fafbfb] p-6 rounded-2xl border border-gray-100">
                  <div className="text-3xl font-bold text-[#ff7055] mb-2">24/7</div>
                  <div className="text-sm font-bold text-gray-400 uppercase tracking-widest">Operational Support</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6: TRUST SECTION */}
      <section className="py-24 bg-[#363a37] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Built for Accountability at Every Step</h2>
            <p className="text-xl text-gray-400">Trust is the invisible infrastructure of tourism. We make it visible.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { 
                title: "Verified Documentation", 
                body: "Compliance validation checks are tracked and timestamped in real time.",
                icon: <FileCheck className="text-[#00abc6]" size={32} />
              },
              { 
                title: "Immutable Audit Trails", 
                body: "Every booking change, message, and payment is logged permanently.",
                icon: <History className="text-[#f1c36c]" size={32} />
              },
              { 
                title: "Escrow-Backed Payments", 
                body: "Funds are held in neutral custody until trip completion is verified.",
                icon: <Lock className="text-[#84c9c0]" size={32} />
              }
            ].map((item, idx) => (
              <div key={idx} className="bg-white/5 border border-white/10 p-10 rounded-3xl hover:bg-white/10 transition-all">
                <div className="mb-6">{item.icon}</div>
                <h3 className="text-xl font-bold mb-4">{item.title}</h3>
                <p className="text-gray-400 leading-relaxed text-sm">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 7: FAQ PREVIEW */}
      <section className="py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center mb-16">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {[
              { 
                q: "How are providers verified on TourFlow?", 
                a: "Every provider undergoes a multi-step verification process including identity checks, professional certification validation, and insurance verification." 
              },
              { 
                q: "Is there an implementation fee for my team?", 
                a: "TourFlow offers flexible pricing plans. Basic onboarding is free, while enterprise features may involve a setup fee depending on your team size." 
              },
              { 
                q: "Can I use my existing local providers?", 
                a: "Yes. You can invite your existing network to join TourFlow, allowing you to manage all your relationships in one structured environment." 
              }
            ].map((item, idx) => (
              <div key={idx} className="border border-gray-100 rounded-2xl p-6 hover:bg-[#fafbfb] transition-all cursor-pointer group">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-lg">{item.q}</h4>
                  <ChevronDown className="text-gray-300 group-hover:text-[#00abc6] transition-all" size={20} />
                </div>
                <div className="mt-4 text-gray-500 leading-relaxed hidden group-hover:block">
                  {item.a}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 8: FINAL CTA */}
      <section className="py-24 bg-[#00abc6] text-white text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
        </div>
        
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl md:text-5xl font-bold mb-8">Start Running Your Operations with Structure</h2>
          <p className="text-xl text-white/80 mb-12 leading-relaxed">
            Join the new standard of tourism management and leave fragmented booking behind for good.
          </p>
          <Link 
            to="/signup" 
            className="inline-block bg-[#ff7055] text-white px-10 py-5 rounded-xl font-bold text-xl hover:bg-[#ff7055]/90 transition-all shadow-2xl shadow-[#ff7055]/40"
          >
            Get Started for Free
          </Link>
        </div>
      </section>
    </div>
  );
}
