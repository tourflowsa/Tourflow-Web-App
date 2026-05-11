import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  CreditCard, 
  CalendarDays, 
  CheckCircle2, 
  UserCheck, 
  Repeat, 
  Settings, 
  Briefcase, 
  Layers, 
  Lock, 
  CalendarX, 
  DollarSign, 
  EyeOff, 
  LayoutGrid,
  Users,
  Search,
  ArrowRight
} from 'lucide-react';

export function ForProviders() {
  return (
    <div className="bg-brand-white font-sans">
      {/* SECTION 1: HERO */}
      <section className="relative h-[80vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="/providers-hero.jpg" 
            loading="eager"
            alt="Professional Tour Provider" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-brand-charcoal/70"></div>
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl">
            <span className="text-brand-aqua font-bold tracking-widest uppercase text-sm mb-4 block">
              FOR PROVIDERS
            </span>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Turn Your Expertise into Consistent Work
            </h1>
            <p className="text-xl text-white/90 mb-10 leading-relaxed max-w-2xl">
              Join a network of verified guides, drivers, and vehicle owners and get access to reliable bookings with secure payments.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link 
                to="/signup" 
                className="bg-brand-teal hover:bg-brand-teal/90 text-white px-8 py-4 rounded-full font-bold transition-all flex items-center justify-center gap-2"
              >
                Get Started for Free <ArrowRight size={20} />
              </Link>
              <Link 
                to="/how-it-works" 
                className="bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white border border-white/30 px-8 py-4 rounded-full font-bold transition-all text-center"
              >
                See How it Works
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: PROBLEM */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-brand-charcoal mb-6 text-center">
              Finding Consistent, Reliable Work Is Difficult
            </h2>
            <p className="text-lg text-gray-600 mb-12 text-center max-w-2xl mx-auto">
              Many providers rely on fragmented communication, last-minute bookings, and inconsistent payment cycles.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[
                { icon: <CalendarX className="text-brand-coral" />, text: "Irregular booking demand" },
                { icon: <DollarSign className="text-brand-coral" />, text: "Late or missed payments" },
                { icon: <EyeOff className="text-brand-coral" />, text: "No visibility into upcoming work" },
                { icon: <LayoutGrid className="text-brand-coral" />, text: "No central place to manage bookings" }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 p-6 bg-brand-white rounded-2xl border border-gray-100">
                  <div className="bg-brand-coral/10 p-3 rounded-xl">
                    {item.icon}
                  </div>
                  <span className="font-semibold text-brand-charcoal">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: SOLUTION */}
      <section className="py-24 bg-brand-white border-y border-gray-100">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-brand-charcoal mb-6">
                A Marketplace Built for Professional Providers
              </h2>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                TourFlow connects you directly with tour operators looking for verified, reliable partners.
              </p>
              <div className="space-y-4">
                {[
                  { icon: <ShieldCheck className="text-brand-teal" />, text: "Access to verified operators" },
                  { icon: <Briefcase className="text-brand-teal" />, text: "Real booking opportunities" },
                  { icon: <Layers className="text-brand-teal" />, text: "Centralised work management" },
                  { icon: <Lock className="text-brand-teal" />, text: "Secure, escrow-based payments" }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="bg-brand-teal/10 p-2 rounded-lg">
                      {item.icon}
                    </div>
                    <span className="text-brand-charcoal font-medium">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="bg-brand-teal/5 rounded-3xl p-8 border border-brand-teal/10">
                <img 
                  src="/providers-guide.jpg" 
                  loading="lazy"
                  alt="Tour Guide at Work" 
                  className="rounded-2xl shadow-2xl w-full h-auto object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: BENEFITS GRID */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-brand-charcoal mb-4">
              Benefits of Joining TourFlow
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                title: "Consistent Work Opportunities",
                description: "Get access to repeat bookings from professional operators",
                icon: <Repeat className="text-brand-teal" size={32} />
              },
              {
                title: "Secure Payments",
                description: "Payments are protected and released after service completion",
                icon: <CreditCard className="text-brand-teal" size={32} />
              },
              {
                title: "Digital Profile & Reputation",
                description: "Build a trusted profile with reviews and verified credentials",
                icon: <UserCheck className="text-brand-teal" size={32} />
              },
              {
                title: "Simplified Operations",
                description: "Manage availability, bookings, and communication in one place",
                icon: <Settings className="text-brand-teal" size={32} />
              }
            ].map((benefit, i) => (
              <div key={i} className="p-8 bg-brand-white rounded-3xl border border-gray-100 hover:shadow-xl transition-all group">
                <div className="mb-6 group-hover:scale-110 transition-transform">
                  {benefit.icon}
                </div>
                <h3 className="text-xl font-bold text-brand-charcoal mb-4">
                  {benefit.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 5: VISUAL SECTION */}
      <section className="py-24 bg-brand-charcoal text-white overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1">
              <img 
                src="/providers-guide.jpg" 
                loading="lazy"
                alt="Guide with Client" 
                className="rounded-3xl shadow-2xl w-full h-[500px] object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="order-1 lg:order-2">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Work with Confidence on the Ground
              </h2>
              <p className="text-xl text-white/80 leading-relaxed">
                Know exactly what is expected before every job. Receive clear booking details, schedules, and client requirements in advance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6: PROFESSIONAL GROWTH */}
      <section className="relative py-32 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="/providers-support.jpg" 
            loading="lazy"
            alt="Support and Growth" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-white/90"></div>
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl">
            <h2 className="text-3xl md:text-4xl font-bold text-brand-charcoal mb-8">
              Grow Your Business Without Marketing Spend
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                "Get discovered by tour operators",
                "Build long-term working relationships",
                "Increase utilisation of your time and assets",
                "Focus on delivering great experiences"
              ].map((bullet, i) => (
                <div key={i} className="flex items-center gap-3">
                  <CheckCircle2 className="text-brand-teal flex-shrink-0" size={24} />
                  <span className="text-brand-charcoal font-semibold">{bullet}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7: TRUST SECTION (DARK) */}
      <section className="py-24 bg-brand-charcoal text-white">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Built for Fairness and Transparency
            </h2>
            <p className="text-lg text-white/70">
              TourFlow ensures that providers are protected with structured workflows and secure payment systems.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { icon: <ShieldCheck size={48} />, title: "Escrow-Protected Payments" },
              { icon: <Users size={48} />, title: "Verified Operator Network" },
              { icon: <Search size={48} />, title: "Transparent Booking Process" }
            ].map((stat, i) => (
              <div key={i} className="text-center flex flex-col items-center">
                <div className="text-brand-teal mb-6">
                  {stat.icon}
                </div>
                <h3 className="text-xl font-bold uppercase tracking-wider">
                  {stat.title}
                </h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 8: FINAL CTA */}
      <section className="py-24 bg-brand-teal text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Start Getting Reliable Work Today
          </h2>
          <p className="text-xl mb-10 text-white/90 max-w-2xl mx-auto">
            Join a growing network of professional providers and take control of your income.
          </p>
          <Link 
            to="/signup" 
            className="inline-block bg-brand-charcoal hover:bg-brand-charcoal/90 text-white px-12 py-5 rounded-full font-bold text-lg transition-all shadow-xl"
          >
            Get Started for Free
          </Link>
        </div>
      </section>
    </div>
  );
}
