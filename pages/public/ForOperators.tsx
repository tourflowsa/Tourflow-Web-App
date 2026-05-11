import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  Users, 
  LayoutDashboard, 
  CreditCard, 
  CheckCircle2, 
  ArrowRight,
  AlertCircle,
  Zap,
  FileText,
  Lock
} from 'lucide-react';

export function ForOperators() {
  return (
    <div className="flex flex-col font-sans text-[#363a37] bg-[#fafbfb]">
      {/* SECTION 1: HERO */}
      <section className="relative min-h-[80vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="/operators-hero.jpg" 
            loading="eager"
            alt="Tour Operations" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-[#363a37]/80"></div>
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 w-full">
          <div className="max-w-3xl">
            <span className="inline-block py-1 px-3 rounded-full bg-[#00abc6]/20 text-[#00abc6] text-xs font-bold tracking-widest uppercase mb-6">
              FOR TOUR OPERATORS
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold text-white leading-tight mb-8">
              Run Your Tours with Full Operational Control
            </h1>
            <p className="text-xl text-gray-200 mb-10 leading-relaxed max-w-2xl">
              Access verified providers, manage bookings in one system, and eliminate operational risk across your supply chain.
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

      {/* SECTION 2: PROBLEM */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl font-bold mb-8 leading-tight">Tour Operations Are Complex and Fragmented</h2>
            <p className="text-xl text-gray-600 mb-10 leading-relaxed">
              Managing providers, schedules, and payments across multiple channels creates operational risk and inefficiency.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                "No visibility into provider reliability",
                "Manual coordination across channels",
                "Compliance risks across regions",
                "Payment uncertainty and delays"
              ].map((bullet, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <AlertCircle className="text-[#ff7055] mt-1 flex-shrink-0" size={20} />
                  <p className="font-medium text-gray-700">{bullet}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#ff7055]/5 rounded-full -mr-16 -mt-16"></div>
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 opacity-60">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-24 bg-gray-200 rounded"></div>
                    <div className="h-2 w-16 bg-gray-100 rounded"></div>
                  </div>
                </div>
              ))}
              <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[2px]">
                <div className="bg-white p-6 rounded-2xl shadow-2xl border border-gray-100 text-center max-w-[240px]">
                  <div className="w-12 h-12 bg-[#ff7055]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Zap className="text-[#ff7055]" size={24} />
                  </div>
                  <p className="font-bold text-sm">Stop the Fragmentation</p>
                  <p className="text-xs text-gray-500 mt-2">Centralize your operations with TourFlow.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: SOLUTION */}
      <section className="py-24 bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div className="order-2 md:order-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="h-48 bg-[#00abc6]/10 rounded-3xl flex items-center justify-center">
                    <Users className="text-[#00abc6]" size={48} />
                  </div>
                  <div className="h-32 bg-[#84c9c0]/10 rounded-3xl flex items-center justify-center">
                    <LayoutDashboard className="text-[#84c9c0]" size={32} />
                  </div>
                </div>
                <div className="space-y-4 pt-8">
                  <div className="h-32 bg-[#f1c36c]/10 rounded-3xl flex items-center justify-center">
                    <ShieldCheck className="text-[#f1c36c]" size={32} />
                  </div>
                  <div className="h-48 bg-[#ff7055]/10 rounded-3xl flex items-center justify-center">
                    <CreditCard className="text-[#ff7055]" size={48} />
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <h2 className="text-4xl font-bold mb-8 leading-tight">A Single System for End-to-End Operations</h2>
              <p className="text-xl text-gray-600 mb-10 leading-relaxed">
                TourFlow replaces manual coordination with a structured platform that gives you visibility and control at every step.
              </p>
              <div className="space-y-4">
                {[
                  "Verified provider marketplace",
                  "Real-time availability tracking",
                  "Centralised booking management",
                  "Escrow-secured payments"
                ].map((bullet, idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <div className="w-6 h-6 bg-[#84c9c0]/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="text-[#84c9c0]" size={14} />
                    </div>
                    <p className="font-bold text-gray-700">{bullet}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: KEY BENEFITS GRID */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Operational Excellence by Design</h2>
          <p className="text-xl text-gray-500">Everything you need to scale your tour business.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            {
              title: "Verified Supply Network",
              desc: "Access a curated network of vetted providers ready to deploy",
              icon: <Users className="text-[#00abc6]" size={24} />
            },
            {
              title: "Real-Time Operational Visibility",
              desc: "Track bookings, availability, and assignments in one system",
              icon: <LayoutDashboard className="text-[#00abc6]" size={24} />
            },
            {
              title: "Automated Documentation",
              desc: "Generate professional itineraries and booking confirmations",
              icon: <FileText className="text-[#00abc6]" size={24} />
            },
            {
              title: "Financial Control",
              desc: "Secure payments and manage margins with clarity",
              icon: <CreditCard className="text-[#00abc6]" size={24} />
            }
          ].map((benefit, idx) => (
            <div key={idx} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300">
              <div className="w-12 h-12 bg-[#00abc6]/10 rounded-2xl flex items-center justify-center mb-6">
                {benefit.icon}
              </div>
              <h3 className="text-xl font-bold mb-4">{benefit.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{benefit.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 5: VISUAL SECTION */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div className="rounded-[2.5rem] overflow-hidden shadow-2xl">
              <img 
                src="/operators-driver.jpg" 
                loading="lazy"
                alt="Execution on the Ground" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h2 className="text-4xl font-bold mb-8 leading-tight">Execution on the Ground</h2>
              <p className="text-xl text-gray-600 mb-10 leading-relaxed">
                From airport transfers to multi-day tours, TourFlow ensures every provider is aligned, briefed, and accountable before execution.
              </p>
              <div className="flex items-center gap-6">
                <div className="flex -space-x-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-12 h-12 rounded-full border-4 border-white bg-gray-200 overflow-hidden">
                      <img src={`https://picsum.photos/seed/user${i}/100/100`} loading="lazy" alt="User" referrerPolicy="no-referrer" />
                    </div>
                  ))}
                </div>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Verified Providers</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6: OPERATIONS CONTROL */}
      <section className="relative py-32 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="/operators-operations.jpg" 
            loading="lazy"
            alt="Operations Control" 
            className="w-full h-full object-cover opacity-10"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#fafbfb] via-transparent to-[#fafbfb]"></div>
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h2 className="text-4xl font-bold mb-12 leading-tight">Operate with Structure, Not Chaos</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {[
                "Assign drivers and guides with precision",
                "Monitor availability in real time",
                "Track compliance across your network",
                "Maintain full visibility into every booking"
              ].map((bullet, idx) => (
                <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex gap-4">
                  <div className="mt-1">
                    <CheckCircle2 className="text-[#00abc6]" size={20} />
                  </div>
                  <p className="font-bold text-gray-700">{bullet}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7: TRUST SECTION (DARK) */}
      <section className="py-24 bg-[#363a37] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-8 leading-tight">Built for High-Stakes Operations</h2>
              <p className="text-xl text-gray-400 mb-10 leading-relaxed">
                TourFlow is designed for operators who require reliability, transparency, and control at scale.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {[
                { label: "99.9% System Reliability", icon: <Zap size={24} /> },
                { label: "24/7 Support", icon: <Users size={24} /> },
                { label: "Verified Provider Network", icon: <ShieldCheck size={24} /> }
              ].map((stat, idx) => (
                <div key={idx} className="text-center">
                  <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#00abc6]">
                    {stat.icon}
                  </div>
                  <p className="font-bold text-sm leading-tight">{stat.label}</p>
                </div>
              ))}
            </div>
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
          <h2 className="text-4xl md:text-5xl font-bold mb-8">Take Control of Your Tour Operations</h2>
          <p className="text-xl text-white/80 mb-12 leading-relaxed">
            Replace fragmented workflows with a system built for professional operators.
          </p>
          <Link 
            to="/signup" 
            className="inline-block bg-[#ff7055] text-white px-10 py-5 rounded-xl font-bold text-xl hover:bg-[#ff7055]/90 transition-all shadow-2xl shadow-[#ff7055]/40 flex items-center gap-2"
          >
            Get Started for Free <ArrowRight size={24} />
          </Link>
        </div>
      </section>
    </div>
  );
}
