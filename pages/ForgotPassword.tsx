
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { AlertCircle, Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import { getFriendlyAuthError } from '../lib/authUtils';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/#/reset-password`,
      });

      if (resetError) throw resetError;

      setSubmitted(true);
    } catch (err: any) {
      setError(getFriendlyAuthError(err, 'An error occurred while sending the reset link.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-white p-4 font-sans">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-xl p-8">
        <div className="mb-6">
          <Link to="/login" className="text-sm text-gray-500 hover:text-brand-teal transition-colors flex items-center gap-1">
            <ArrowLeft size={14} />
            Back to login
          </Link>
        </div>

        <div className="text-center mb-8">
          <img src="/tourflow-logo.png" alt="TourFlow" className="h-16 w-auto mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-brand-charcoal">Forgot Password?</h1>
          <p className="text-brand-charcoal/60 mt-2 font-serif">
            {submitted 
              ? "Check your inbox for instructions" 
              : "Enter your email for a reset link"}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 text-red-600 text-sm">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {submitted ? (
          <div className="text-center space-y-6">
            <div className="flex flex-col items-center gap-3 p-6 bg-brand-teal/5 rounded-xl border border-brand-teal/10">
              <CheckCircle className="text-brand-teal w-12 h-12" />
              <div className="space-y-1">
                <p className="text-brand-charcoal font-bold">Email Sent</p>
                <p className="text-sm text-brand-charcoal/70">
                  If an account exists for <b>{email}</b>, you will receive a password reset link shortly.
                </p>
              </div>
            </div>
            <p className="text-sm text-brand-charcoal/60 leading-relaxed italic">
              Don't see it? Check your spam folder or try again in a few minutes.
            </p>
            <Link 
              to="/login"
              className="block w-full bg-brand-teal hover:bg-brand-teal/90 text-white font-bold py-3 rounded-lg transition-colors"
            >
              Return to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-brand-charcoal mb-1">Email Address</label>
              <input 
                type="email" 
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-teal focus:border-transparent outline-none transition-all"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-brand-teal hover:bg-brand-teal/90 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Send Reset Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
