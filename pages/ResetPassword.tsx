
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, Loader2, CheckCircle, Lock } from 'lucide-react';
import { getFriendlyAuthError } from '../lib/authUtils';

export const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;

      setSuccess(true);
    } catch (err: any) {
      setError(getFriendlyAuthError(err, 'Failed to update password. The link may have expired.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-white p-4 font-sans">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <img src="/tourflow-logo.png" alt="TourFlow" className="w-24 h-auto object-contain mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-brand-charcoal">Reset Password</h1>
          <p className="text-brand-charcoal/60 mt-2 font-serif">Enter your new secure password below</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 text-red-600 text-sm">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="text-center space-y-6">
            <div className="flex flex-col items-center gap-3 p-6 bg-brand-teal/5 rounded-xl border border-brand-teal/10">
              <CheckCircle className="text-brand-teal w-12 h-12" />
              <div className="space-y-1">
                <p className="text-brand-charcoal font-bold">Password Updated Successfully</p>
                <p className="text-sm text-brand-charcoal/70">
                  Your password has been changed. You can now use your new password to sign in.
                </p>
              </div>
            </div>
            <button 
              onClick={() => navigate('/login')}
              className="w-full bg-brand-teal hover:bg-brand-teal/90 text-white font-bold py-3 rounded-lg transition-colors shadow-md"
            >
              Go to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-brand-charcoal mb-1">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="password" 
                  required
                  autoComplete="new-password"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-teal focus:border-transparent outline-none transition-all"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-brand-charcoal mb-1">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="password" 
                  required
                  autoComplete="new-password"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-teal focus:border-transparent outline-none transition-all"
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-brand-teal hover:bg-brand-teal/90 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Update Password'}
            </button>

            <div className="text-center">
              <Link to="/login" className="text-sm text-brand-teal font-bold hover:underline">
                Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
