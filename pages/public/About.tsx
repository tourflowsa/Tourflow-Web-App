import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight, ShieldCheck, Users, Briefcase, Globe, Eye, Zap } from 'lucide-react';

export function About() {
  return (
    <div className="bg-[#fafbfb] font-sans text-[#363a37]">
      {/* SECTION 1: HERO */}
      <section className="relative h-[70vh] min-h-[500px] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="/about-hero.jpg" 
            loading="eager"
            alt="About TourFlow Hero" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-[#363a37]/70"></div>
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl">
            <span className="text-[#84c9c0] font-bold tracking-widest uppercase text-sm mb-4 block">
              ABOUT TOURFLOW
            </span>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Built for the People Behind Every Great Journey
            </h1>
            <p className="text-xl text-white/90 mb-10 leading-relaxed max-w-2xl">
              TourFlow connects operators with trusted guides, drivers, and vehicles to deliver seamless tourism experiences.
            </p>
            <Link 
              to="/signup" 
              className="bg-[#00abc6] hover:bg-[#00abc6]/90 text-white px-8 py-4 rounded-full font-bold transition-all inline-flex items-center gap-2 shadow-lg"
            >
              Get Started for Free <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 2: MISSION */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-[#363a37] mb-8">
              Why TourFlow Exists
            </h2>
            <div className="space-y-6 text-lg text-gray-600 mb-12">
              <p>
                Tourism operations are fragmented. Operators struggle to find reliable providers, manage bookings, and maintain compliance across every trip.
              </p>
              <p className="font-medium text-[#363a37]">
                TourFlow brings structure, trust, and visibility to every moving part of a tour operation.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
              {[
                "Connect verified supply in one place",
                "Replace manual coordination with structured workflows",
                "Ensure every booking is tracked and accountable"
              ].map((bullet, i) => (
                <div key={i} className="flex gap-4 p-6 bg-[#fafbfb] rounded-2xl border border-gray-100">
                  <CheckCircle2 className="text-[#00abc6] shrink-0" size={24} />
                  <span className="font-semibold text-[#363a37]">{bullet}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: WHAT WE DO */}
      <section className="py-24 bg-[#fafbfb] border-y border-gray-100">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="rounded-3xl overflow-hidden shadow-2xl">
              <img 
                src="/about-team.jpg" 
                loading="lazy"
                alt="TourFlow Team and Operations" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-[#363a37] mb-6">
                A Platform Built for Real Operations
              </h2>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                TourFlow is designed for how tourism actually works. From planning to execution, every step is supported.
              </p>
              <div className="space-y-4">
                {[
                  { icon: <ShieldCheck className="text-[#00abc6]" />, text: "Verified guides, drivers, and vehicles" },
                  { icon: <Zap className="text-[#00abc6]" />, text: "Real-time availability and booking management" },
                  { icon: <Briefcase className="text-[#00abc6]" />, text: "Escrow-secured payments" },
                  { icon: <Eye className="text-[#00abc6]" />, text: "Full operational visibility" }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="bg-[#00abc6]/10 p-2 rounded-lg">
                      {item.icon}
                    </div>
                    <span className="text-[#363a37] font-medium">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: WHO WE SERVE */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-[#363a37] mb-4">
              Built for the Entire Ecosystem
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "OPERATORS",
                description: "Manage bookings, coordinate teams, and deliver consistent experiences.",
                icon: <Globe className="text-[#00abc6]" size={40} />
              },
              {
                title: "PROVIDERS",
                description: "Access reliable work, manage schedules, and get paid securely.",
                icon: <Users className="text-[#00abc6]" size={40} />
              },
              {
                title: "VEHICLE OWNERS",
                description: "List vehicles, manage compliance, and maximize utilization.",
                icon: <Briefcase className="text-[#00abc6]" size={40} />
              }
            ].map((card, i) => (
              <div key={i} className="p-10 bg-[#fafbfb] rounded-3xl border border-gray-100 hover:shadow-xl transition-all text-center">
                <div className="mb-6 flex justify-center">{card.icon}</div>
                <h3 className="text-xl font-bold text-[#363a37] mb-4 tracking-wider">
                  {card.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {card.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 5: TRUST & QUALITY */}
      <section className="py-24 bg-[#fafbfb] border-y border-gray-100">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1">
              <h2 className="text-3xl md:text-4xl font-bold text-[#363a37] mb-6">
                Trust is Built Into Every Booking
              </h2>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                Every provider on TourFlow is verified. Every transaction is tracked. Every booking is accountable.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  "Document verification system",
                  "Expiry tracking and compliance checks",
                  "Escrow-backed payments",
                  "Transparent booking records"
                ].map((bullet, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="text-[#00abc6] shrink-0" size={20} />
                    <span className="text-[#363a37] font-semibold text-sm">{bullet}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="order-1 lg:order-2 rounded-3xl overflow-hidden shadow-2xl">
              <img 
                src="/about-guide.jpg" 
                loading="lazy"
                alt="Verified Tour Guide" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6: VISION */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold text-[#363a37] mb-8">
            Where We Are Going
          </h2>
          <p className="text-xl text-gray-600 leading-relaxed">
            TourFlow is building the operating system for tourism. A single platform where every role, every booking, and every payment works together seamlessly.
          </p>
        </div>
      </section>

      {/* SECTION 7: FINAL CTA */}
      <section className="py-24 bg-[#363a37] text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Join the Network Powering Modern Tourism
          </h2>
          <p className="text-xl mb-10 text-white/80 max-w-2xl mx-auto">
            Start building more reliable, scalable operations today.
          </p>
          <Link 
            to="/signup" 
            className="inline-block bg-[#00abc6] hover:bg-[#00abc6]/90 text-white px-12 py-5 rounded-full font-bold text-lg transition-all shadow-xl"
          >
            Get Started for Free
          </Link>
        </div>
      </section>
    </div>
  );
}
