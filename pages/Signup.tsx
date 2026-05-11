import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, Loader2, Check, CheckCircle } from 'lucide-react';
import { UserRole } from '../types';
import { routeUserByRole } from '../lib/routerUtils';
import { getFriendlyAuthError } from '../lib/authUtils';

const ROLES: { id: UserRole, label: string, desc: string }[] = [
  { id: 'operator', label: 'Tour Operator', desc: 'Create tours and manage bookings' },
  { id: 'guide', label: 'Tour Guide', desc: 'Manage your tour assignments' },
  { id: 'driver', label: 'Driver', desc: 'Transport logistics' },
  { id: 'vehicle_owner', label: 'Vehicle Owner', desc: 'Rent out your fleet' },
];

export const Signup: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<UserRole | null>(null);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) return;
    
    setLoading(true);
    setError(null);

    try {
      // 1. Create Auth User with metadata (trigger handles profile insert)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            company_name: companyName || null,
            role: role
          }
        }
      });

      if (authError) throw authError;

      if (authData.session) {
        // Immediate Redirect if session exists (email confirmation off)
        routeUserByRole(role, navigate);
      } else {
        // Email confirmation required (session is null)
        setSuccess(true);
        setLoading(false);
      }
    } catch (err: any) {
      console.error(err);
      const friendly = getFriendlyAuthError(err, 'Failed to create account');
      
      // If it's the neutral duplicate/ambiguous message, show the success screen instead
      if (friendly.includes('Account request received')) {
        setSuccess(true);
        setLoading(false);
        return;
      }

      setError(friendly);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-white p-4">
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-xl p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600">
              <CheckCircle size={32} />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-brand-charcoal mb-4">Request Received</h2>
          <p className="text-gray-600 mb-8">
            Account request received. Please check your inbox at <span className="font-semibold">{email}</span> if this is a new account. 
            If you already have an account, sign in instead.
          </p>
          <div className="space-y-4">
            <Link 
              to="/login" 
              className="block w-full bg-brand-teal hover:bg-brand-teal/90 text-white font-bold py-3 rounded-lg transition-colors"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-white p-4">
      <div className="w-full max-w-xl bg-white border border-gray-200 rounded-2xl shadow-xl p-8">
        <div className="mb-6">
          <Link to="/" className="text-sm text-gray-500 hover:text-brand-teal transition-colors flex items-center gap-1">
            ← Back to website
          </Link>
        </div>
        <div className="text-center mb-8">
           <img src="/tourflow-logo.png" alt="TourFlow" className="h-16 w-auto mx-auto mb-4" />
           <h1 className="text-2xl font-bold text-brand-charcoal">Create an Account</h1>
           <p className="text-brand-charcoal/60 mt-2 font-serif">Join the TourFlow Marketplace</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 text-red-600 text-sm">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === 1 && (
          <div>
            <h3 className="text-lg font-bold text-brand-charcoal mb-4">Select your role</h3>
            <div className="grid grid-cols-1 gap-3 mb-6">
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRole(r.id)}
                  className={`flex items-start p-4 rounded-xl border-2 transition-all text-left ${
                    role === r.id 
                      ? 'border-brand-teal bg-brand-teal/5 ring-1 ring-brand-teal' 
                      : 'border-gray-100 hover:border-brand-teal/50 hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 mt-0.5 mr-3 flex items-center justify-center shrink-0 ${
                    role === r.id ? 'border-brand-teal bg-brand-teal' : 'border-gray-300'
                  }`}>
                    {role === r.id && <Check size={12} className="text-white" />}
                  </div>
                  <div>
                    <span className="block font-bold text-brand-charcoal">{r.label}</span>
                    <span className="block text-sm text-gray-500">{r.desc}</span>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(2)}
              disabled={!role}
              className="w-full bg-brand-charcoal hover:bg-brand-charcoal/90 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              Continue
            </button>
            <div className="mt-4 text-center text-sm text-brand-charcoal/60">
              Already have an account? <Link to="/login" className="text-brand-teal font-bold hover:underline">Sign In</Link>
              <div className="mt-2">Need help? <Link to="/contact" className="text-brand-teal font-bold hover:underline">Contact support</Link></div>
            </div>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleSignup} className="space-y-4">
             <div className="flex items-center gap-2 mb-4 text-sm text-brand-charcoal/60">
               <span className="bg-brand-teal/10 text-brand-teal px-2 py-0.5 rounded font-bold capitalize">{role?.replace('_', ' ')}</span>
               <button type="button" onClick={() => setStep(1)} className="hover:underline">Change Role</button>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-brand-charcoal mb-1">Full Name</label>
                  <input type="text" required className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-brand-charcoal mb-1">Company (Opt)</label>
                  <input type="text" className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                </div>
             </div>

             <div>
                <label className="block text-sm font-bold text-brand-charcoal mb-1">Email Address</label>
                <input type="email" required className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={email} onChange={(e) => setEmail(e.target.value)} />
             </div>

             <div>
                <label className="block text-sm font-bold text-brand-charcoal mb-1">Password</label>
                <input type="password" required minLength={6} className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={password} onChange={(e) => setPassword(e.target.value)} />
             </div>

             <div className="text-xs text-brand-charcoal/60 leading-relaxed pt-2">
                By creating an account, you agree to TourFlow’s <Link to="/terms-of-service" className="text-brand-teal hover:underline font-semibold" target="_blank">Terms of Service</Link> and <Link to="/privacy-policy" className="text-brand-teal hover:underline font-semibold" target="_blank">Privacy Policy</Link>, including the processing of your personal information for verification, bookings, payments, compliance, and platform safety.
             </div>

             <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-brand-teal hover:bg-brand-teal/90 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 mt-2"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : 'Complete Registration'}
              </button>
             <div className="mt-4 text-center text-sm text-brand-charcoal/60">
                Need help? <Link to="/contact" className="text-brand-teal font-bold hover:underline">Contact support</Link>
             </div>
          </form>
        )}
      </div>
    </div>
  );
};
