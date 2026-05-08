import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, MessageSquare, Clock, ArrowRight, CheckCircle2, Send } from 'lucide-react';

export function Contact() {
  return (
    <div className="bg-brand-white font-sans text-brand-charcoal">
      {/* SECTION 1: HERO */}
      <section className="relative h-[60vh] min-h-[500px] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="/contact-hero.jpg" 
            alt="Contact TourFlow" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-brand-charcoal/70"></div>
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl">
            <span className="text-brand-aqua font-bold tracking-widest uppercase text-sm mb-4 block">
              CONTACT
            </span>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Talk to the Team Behind TourFlow
            </h1>
            <p className="text-xl text-white/90 mb-10 leading-relaxed max-w-2xl">
              Get help, ask questions, or start your onboarding. We respond quickly and clearly.
            </p>
            <Link 
              to="/signup" 
              className="bg-brand-teal hover:bg-brand-teal/90 text-white px-8 py-4 rounded-full font-bold transition-all inline-flex items-center gap-2 shadow-lg"
            >
              Get Started for Free <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 2: CONTACT OPTIONS */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">How You Can Reach Us</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 bg-brand-white rounded-3xl border border-gray-100 text-center flex flex-col items-center">
              <div className="bg-brand-teal/10 p-4 rounded-2xl mb-6">
                <Mail className="text-brand-teal" size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2 uppercase tracking-wider">EMAIL</h3>
              <a href="mailto:support@tourflow.co.za" className="text-brand-teal font-bold text-lg mb-2 hover:underline">
                support@tourflow.co.za
              </a>
              <p className="text-gray-600 text-sm">For general support and account help</p>
            </div>

            <div className="p-8 bg-brand-white rounded-3xl border border-gray-100 text-center flex flex-col items-center">
              <div className="bg-brand-teal/10 p-4 rounded-2xl mb-6">
                <MessageSquare className="text-brand-teal" size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2 uppercase tracking-wider">SALES</h3>
              <a href="mailto:sales@tourflow.co.za" className="text-brand-teal font-bold text-lg mb-2 hover:underline">
                sales@tourflow.co.za
              </a>
              <p className="text-gray-600 text-sm">For onboarding, partnerships, and platform questions</p>
            </div>

            <div className="p-8 bg-brand-white rounded-3xl border border-gray-100 text-center flex flex-col items-center">
              <div className="bg-brand-teal/10 p-4 rounded-2xl mb-6">
                <Clock className="text-brand-teal" size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2 uppercase tracking-wider">SUPPORT HOURS</h3>
              <p className="text-brand-charcoal font-bold text-lg mb-1">Mon–Fri</p>
              <p className="text-brand-charcoal font-bold text-lg">08:00 – 17:00 SAST</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: CONTACT FORM */}
      <section className="py-24 bg-brand-white border-y border-gray-100">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto bg-white p-10 md:p-16 rounded-[40px] shadow-2xl shadow-brand-charcoal/5">
            <h2 className="text-3xl font-bold mb-10 text-center">Send Us a Message</h2>
            <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase tracking-wider text-gray-500 ml-1">Full Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. John Doe"
                    className="w-full px-6 py-4 bg-brand-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-brand-teal focus:border-brand-teal outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase tracking-wider text-gray-500 ml-1">Email Address</label>
                  <input 
                    type="email" 
                    placeholder="e.g. john@company.com"
                    className="w-full px-6 py-4 bg-brand-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-brand-teal focus:border-brand-teal outline-none transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold uppercase tracking-wider text-gray-500 ml-1">Company Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Safari Adventures"
                  className="w-full px-6 py-4 bg-brand-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-brand-teal focus:border-brand-teal outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold uppercase tracking-wider text-gray-500 ml-1">Message</label>
                <textarea 
                  rows={5}
                  placeholder="Tell us how we can help..."
                  className="w-full px-6 py-4 bg-brand-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-brand-teal focus:border-brand-teal outline-none transition-all resize-none"
                ></textarea>
              </div>
              <button className="w-full bg-brand-coral hover:bg-brand-coral/90 text-white py-5 rounded-2xl font-bold text-lg transition-all shadow-lg shadow-brand-coral/20 flex items-center justify-center gap-3">
                Send Message <Send size={20} />
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* SECTION 4: SUPPORT EXPECTATIONS */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-3xl font-bold mb-10 text-center">What Happens Next</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              "We review your message within 24 hours",
              "We respond with clear next steps",
              "We guide you through onboarding if needed"
            ].map((text, i) => (
              <div key={i} className="flex flex-col items-center text-center p-6 bg-brand-white rounded-2xl border border-gray-100">
                <div className="bg-brand-teal/10 p-3 rounded-full mb-4">
                  <CheckCircle2 className="text-brand-teal" size={24} />
                </div>
                <p className="font-semibold text-brand-charcoal">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 5: TRUST SIGNAL */}
      <section className="py-24 bg-brand-charcoal text-white">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Built for Reliable Communication</h2>
          <p className="text-xl text-white/80 leading-relaxed">
            TourFlow supports operators and providers across South Africa. Our team understands real operational challenges and responds with practical solutions.
          </p>
        </div>
      </section>

      {/* SECTION 6: FINAL CTA */}
      <section className="py-24 bg-brand-teal text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to Start?</h2>
          <p className="text-xl mb-10 text-white/90 max-w-2xl mx-auto">
            Create your account and begin building structured, reliable operations.
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
