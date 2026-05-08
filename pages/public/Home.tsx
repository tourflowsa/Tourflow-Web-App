import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  ShieldCheck, 
  Users, 
  Truck, 
  Calendar, 
  CreditCard, 
  Zap, 
  CheckCircle2, 
  Lock, 
  Globe, 
  ChevronDown,
  BarChart3,
  Search
} from 'lucide-react';

export function Home() {
  return (
    <div className="flex flex-col font-sans text-[#363a37] bg-[#fafbfb]">
      {/* SECTION 1: HERO */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="/home-hero.jpg" 
            alt="Tourism Operations" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#363a37]/90 via-[#363a37]/70 to-transparent"></div>
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="max-w-3xl">
            <h1 className="text-5xl md:text-7xl font-extrabold text-white leading-tight mb-8">
              Run Your Tourism Operations with <span className="text-[#00abc6]">Verified Supply</span> and Full Control
            </h1>
            <p className="text-xl text-gray-200 mb-10 leading-relaxed max-w-2xl">
              Access verified guides, drivers, and vehicles. Manage bookings in one system and secure your payments through escrow.
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

      {/* SECTION 2: AUDIENCE SPLIT */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Card 1: Operators */}
          <div className="bg-white p-10 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/50 hover:translate-y-[-4px] transition-all duration-300">
            <div className="w-14 h-14 bg-[#00abc6]/10 rounded-2xl flex items-center justify-center mb-8">
              <BarChart3 className="text-[#00abc6]" size={28} />
            </div>
            <h2 className="text-3xl font-bold mb-4">For Tour Operators</h2>
            <p className="text-gray-600 text-lg mb-8">
              Access verified providers, manage bookings, and reduce operational risk.
            </p>
            <ul className="space-y-4 mb-10">
              <li className="flex items-center gap-3 text-gray-700 font-medium">
                <CheckCircle2 className="text-[#84c9c0]" size={20} />
                Access a pre-vetted supply chain
              </li>
              <li className="flex items-center gap-3 text-gray-700 font-medium">
                <CheckCircle2 className="text-[#84c9c0]" size={20} />
                Dynamic pricing for every trip
              </li>
            </ul>
            <Link 
              to="/for-operators" 
              className="inline-flex items-center gap-2 text-[#00abc6] font-bold text-lg group"
            >
              Explore Tour Operations <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Card 2: Providers */}
          <div className="bg-white p-10 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/50 hover:translate-y-[-4px] transition-all duration-300">
            <div className="w-14 h-14 bg-[#f1c36c]/10 rounded-2xl flex items-center justify-center mb-8">
              <Globe className="text-[#f1c36c]" size={28} />
            </div>
            <h2 className="text-3xl font-bold mb-4">For Providers</h2>
            <p className="text-gray-600 text-lg mb-8">
              Find more opportunities through a trusted ecosystem for guides, drivers, and vehicle owners.
            </p>
            <ul className="space-y-4 mb-10">
              <li className="flex items-center gap-3 text-gray-700 font-medium">
                <CheckCircle2 className="text-[#84c9c0]" size={20} />
                Certified compliance documents
              </li>
              <li className="flex items-center gap-3 text-gray-700 font-medium">
                <CheckCircle2 className="text-[#84c9c0]" size={20} />
                Secure, auditable payments
              </li>
            </ul>
            <Link 
              to="/for-providers" 
              className="inline-flex items-center gap-2 text-[#00abc6] font-bold text-lg group"
            >
              List Your Services <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 3: PROBLEM */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">The Fragmentation Gap</h2>
          <p className="text-gray-500 text-xl max-w-2xl mx-auto">Traditional tourism operations are held back by disconnected systems and manual verification.</p>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-2xl bg-[#fafbfb] border border-gray-100">
            <h3 className="text-xl font-bold mb-4">Spreadsheet Reliance</h3>
            <p className="text-gray-600 leading-relaxed">Manual tracking leads to errors, double bookings, and communication breakdowns that hurt your bottom line.</p>
          </div>
          <div className="p-8 rounded-2xl bg-[#fafbfb] border border-gray-100">
            <h3 className="text-xl font-bold mb-4">Compliance Gaps</h3>
            <p className="text-gray-600 leading-relaxed">Verifying insurance and licenses manually is slow and risky. One expired document can jeopardize an entire operation.</p>
          </div>
          <div className="p-8 rounded-2xl bg-[#fafbfb] border border-gray-100">
            <h3 className="text-xl font-bold mb-4">Opaque Supply</h3>
            <p className="text-gray-600 leading-relaxed">Finding reliable, available providers at short notice is a constant struggle without a unified network.</p>
          </div>
        </div>
      </section>

      {/* SECTION 4: SOLUTION */}
      <section className="bg-[#363a37] text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold mb-8 leading-tight">A Structured System for Tourism Operations</h2>
              <p className="text-xl text-gray-300 mb-10 leading-relaxed">
                TourFlow replaces manual processes with a single source of truth. From the moment of sourcing to final payment, your operations stay visible, controlled, and secure.
              </p>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="mt-1 w-6 h-6 rounded-full bg-[#00abc6] flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 size={14} className="text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Unified Booking Control</h4>
                    <p className="text-gray-400">Centralize every assignment and schedule in real-time.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="mt-1 w-6 h-6 rounded-full bg-[#00abc6] flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 size={14} className="text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Smart Payments</h4>
                    <p className="text-gray-400">Automated escrow and payout systems ensure financial trust.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="rounded-[2rem] overflow-hidden shadow-2xl">
                <img 
                  src="/home-guide-safari.jpg" 
                  alt="Safari Guide" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute -bottom-8 -left-8 bg-[#00abc6] p-8 rounded-2xl shadow-xl hidden md:block">
                <p className="text-4xl font-bold mb-1">100%</p>
                <p className="text-sm uppercase tracking-widest font-bold opacity-80">Visibility</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: FEATURES GRID */}
      <section className="py-24 bg-[#fafbfb]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-16">
          <h2 className="text-4xl font-bold mb-6">Engineered for Excellence</h2>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-8 bg-white p-8 rounded-3xl border border-gray-100 flex flex-col md:flex-row gap-8 items-center">
            <div className="w-full md:w-1/2 h-64 rounded-2xl overflow-hidden">
              <img src="/home-guide-safari.jpg" className="w-full h-full object-cover" alt="Verified Network" referrerPolicy="no-referrer" />
            </div>
            <div className="w-full md:w-1/2">
              <h3 className="text-2xl font-bold mb-4">Verified Provider Network</h3>
              <p className="text-gray-600 leading-relaxed">Access a curated database of guides and drivers who have passed rigorous background and compliance checks.</p>
            </div>
          </div>
          
          <div className="md:col-span-4 bg-[#00abc6] p-8 rounded-3xl text-white flex flex-col justify-center">
            <ShieldCheck size={48} className="mb-6 opacity-50" />
            <h3 className="text-2xl font-bold mb-4">Compliance Tracking</h3>
            <p className="text-white/80 leading-relaxed">Automated alerts for expiring documents ensure your operations never stop due to paperwork.</p>
          </div>
          
          <div className="md:col-span-4 bg-white p-8 rounded-3xl border border-gray-100">
            <Calendar size={32} className="text-[#ff7055] mb-6" />
            <h3 className="text-xl font-bold mb-4">Real-Time Availability</h3>
            <p className="text-gray-600 leading-relaxed">Instant visibility into provider schedules means you can book with confidence in seconds.</p>
          </div>
          
          <div className="md:col-span-8 bg-white p-8 rounded-3xl border border-gray-100 flex items-center gap-8">
            <div className="flex-grow">
              <h3 className="text-2xl font-bold mb-4">Automated Payouts</h3>
              <p className="text-gray-600 leading-relaxed">Secure escrow-based payments ensure providers are paid on time and operators are protected until service delivery.</p>
            </div>
            <div className="hidden sm:flex w-24 h-24 bg-[#84c9c0]/10 rounded-full items-center justify-center flex-shrink-0">
              <CreditCard size={40} className="text-[#84c9c0]" />
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6: HOW IT WORKS */}
      <section className="py-24 bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">
            <div className="text-center">
              <div className="text-5xl font-black text-gray-100 mb-4">01</div>
              <h4 className="text-xl font-bold mb-2">Connect</h4>
              <p className="text-gray-500">Onboard your team or access our vetted network.</p>
            </div>
            <div className="text-center">
              <div className="text-5xl font-black text-gray-100 mb-4">02</div>
              <h4 className="text-xl font-bold mb-2">Verify</h4>
              <p className="text-gray-500">Automated document and compliance checks.</p>
            </div>
            <div className="text-center">
              <div className="text-5xl font-black text-gray-100 mb-4">03</div>
              <h4 className="text-xl font-bold mb-2">Book</h4>
              <p className="text-gray-500">Assign resources with one click and track in real-time.</p>
            </div>
            <div className="text-center">
              <div className="text-5xl font-black text-gray-100 mb-4">04</div>
              <h4 className="text-xl font-bold mb-2">Scale</h4>
              <p className="text-gray-500">Optimize operations with data-driven insights.</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7: SOCIAL PROOF PLACEHOLDER */}
      <section className="py-24 bg-[#fafbfb]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="bg-white p-10 rounded-3xl border border-gray-100 shadow-sm">
              <p className="text-xl italic text-gray-600 mb-8">"TourFlow has completely transformed how we manage our safari guides. The compliance tracking alone has saved us dozens of hours every month."</p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                <div>
                  <p className="font-bold">Sarah J.</p>
                  <p className="text-gray-400 text-sm">Operations Manager (Sample Testimonial)</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-10 rounded-3xl border border-gray-100 shadow-sm">
              <p className="text-xl italic text-gray-600 mb-8">"As a vehicle owner, I finally have a platform that gives me visibility into my fleet's utilization and ensures I get paid on time, every time."</p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                <div>
                  <p className="font-bold">David M.</p>
                  <p className="text-gray-400 text-sm">Fleet Owner (Sample Testimonial)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 8: TRUST SECTION */}
      <section className="py-24 bg-[#363a37] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-8">Built on Trust and Accountability</h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
            Our infrastructure is designed for operator confidence. With verifiable booking logs, escrow-backed payments, and monitored compliance, TourFlow is the foundation for high-trust tourism execution.
          </p>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white/5 border border-white/10 p-8 rounded-2xl text-center">
            <p className="text-4xl font-bold text-[#00abc6] mb-2">99.9%</p>
            <p className="text-gray-400 font-bold">Uptime Reliability</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-8 rounded-2xl text-center">
            <Lock className="mx-auto mb-4 text-[#f1c36c]" size={32} />
            <p className="text-gray-400 font-bold">ISO 27001 Compliant Security</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-8 rounded-2xl text-center">
            <p className="text-4xl font-bold text-[#ff7055] mb-2">24/7</p>
            <p className="text-gray-400 font-bold">Operational Support</p>
          </div>
        </div>
      </section>

      {/* SECTION 9: FAQ PREVIEW */}
      <section className="py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <div className="border border-gray-100 rounded-xl p-6 hover:bg-[#fafbfb] transition-colors cursor-pointer group">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-lg">How does provider verification work?</h4>
                <ChevronDown className="text-gray-400 group-hover:text-[#00abc6] transition-colors" />
              </div>
            </div>
            <div className="border border-gray-100 rounded-xl p-6 hover:bg-[#fafbfb] transition-colors cursor-pointer group">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-lg">Can I integrate my existing fleet?</h4>
                <ChevronDown className="text-gray-400 group-hover:text-[#00abc6] transition-colors" />
              </div>
            </div>
            <div className="border border-gray-100 rounded-xl p-6 hover:bg-[#fafbfb] transition-colors cursor-pointer group">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-lg">How are payments handled?</h4>
                <ChevronDown className="text-gray-400 group-hover:text-[#00abc6] transition-colors" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 10: FINAL CTA */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="/home-landscape.jpg" 
            alt="Landscape" 
            className="w-full h-full object-cover opacity-20"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#fafbfb] via-transparent to-[#fafbfb]"></div>
        </div>
        
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-8">Ready to Elevate Your Tourism Business?</h2>
          <p className="text-xl text-gray-600 mb-12 leading-relaxed">
            Join the infrastructure for digital curators and trusted service providers building the future of travel.
          </p>
          <Link 
            to="/signup" 
            className="inline-block bg-[#ff7055] text-white px-10 py-5 rounded-xl font-bold text-xl hover:bg-[#ff7055]/90 transition-all shadow-xl shadow-[#ff7055]/30"
          >
            Get Started for Free
          </Link>
        </div>
      </section>
    </div>
  );
}
