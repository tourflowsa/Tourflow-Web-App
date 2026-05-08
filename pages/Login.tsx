
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import { routeUserByRole } from '../lib/routerUtils';
import { UserProfile } from '../types';
import { getFriendlyAuthError } from '../lib/authUtils';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Sign In
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      if (authData.user) {
        // 2. Fetch Profile to determine Role
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        if (profileError) {
           console.error('Profile fetch error:', profileError);
           // Fallback if profile fetch fails, though AuthContext handles this eventually
           navigate('/'); 
           return;
        }

        const profile = profileData as UserProfile;
        
        // 3. Route based on role
        if (profile) {
          routeUserByRole(profile.role, navigate);
        } else {
           navigate('/');
        }
      }
    } catch (err: any) {
      setError(getFriendlyAuthError(err, 'Failed to sign in'));
      setLoading(false); // Only stop loading on error, otherwise let navigation take over
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-white p-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-xl p-8">
        <div className="mb-6">
          <Link to="/" className="text-sm text-gray-500 hover:text-brand-teal transition-colors flex items-center gap-1">
            ← Back to website
          </Link>
        </div>
        <div className="text-center mb-8">
          <img src="/tourflow-logo.png" alt="TourFlow" className="w-24 h-auto object-contain mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-brand-charcoal">Welcome Back</h1>
          <p className="text-brand-charcoal/60 mt-2 font-serif">Sign in to your TourFlow B2B account</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 text-red-600 text-sm">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-brand-charcoal mb-1">Email Address</label>
            <input 
              type="email" 
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-teal focus:border-transparent outline-none transition-all"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-bold text-brand-charcoal">Password</label>
              <Link to="/forgot-password" className="text-xs font-bold text-brand-teal hover:underline">
                Forgot password?
              </Link>
            </div>
            <input 
              type="password" 
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-teal focus:border-transparent outline-none transition-all"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-brand-teal hover:bg-brand-teal/90 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-brand-charcoal/60">
          Don't have an account? <Link to="/signup" className="text-brand-teal font-bold hover:underline">Sign Up</Link>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-center gap-4 text-xs text-brand-charcoal/50">
          <Link to="/terms-of-service" className="hover:text-brand-teal transition-colors" target="_blank">Terms of Service</Link>
          <span>&middot;</span>
          <Link to="/privacy-policy" className="hover:text-brand-teal transition-colors" target="_blank">Privacy Policy</Link>
        </div>
      </div>
    </div>
  );
};
