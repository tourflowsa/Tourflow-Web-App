
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Play, 
  Loader2, 
  AlertTriangle, 
  Lock, 
  Server,
  ShieldCheck,
  Fingerprint,
  Database
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface CheckResult {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'pass' | 'fail';
  message?: string;
  details?: string;
}

export const Diagnostics: React.FC = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CheckResult[]>([
    { id: 'auth', name: 'Identity Resolution', status: 'pending' },
    { id: 'rls_bookings', name: 'RLS: Global Bookings Visibility', status: 'pending' },
    { id: 'rls_assignments', name: 'RLS: Global Assignments Visibility', status: 'pending' },
    { id: 'rls_payouts', name: 'RLS: Payout Ledger Access', status: 'pending' },
    { id: 'rls_vehicles', name: 'RLS: Fleet Discovery', status: 'pending' },
    { id: 'rls_docs', name: 'RLS: Compliance Document Access', status: 'pending' },
  ]);

  const updateResult = (id: string, status: 'pass' | 'fail', message: string, details?: string) => {
    setResults(prev => prev.map(r => r.id === id ? { ...r, status, message, details } : r));
  };

  const runDiagnostics = async () => {
    setLoading(true);
    // Reset statuses to running
    setResults(prev => prev.map(r => ({ ...r, status: 'running', message: '', details: '' })));

    try {
      // 1. Identity Check
      if (user && profile) {
        updateResult('auth', 'pass', `Resolved as ${profile.role.toUpperCase()}`, `User ID: ${user.id}\nEmail: ${user.email}`);
      } else {
        updateResult('auth', 'fail', 'Identity context missing.');
      }

      // 2. RLS Bookings
      const { count: bCount, error: bErr } = await supabase.from('bookings').select('*', { count: 'exact', head: true });
      if (bErr) updateResult('rls_bookings', 'fail', bErr.message);
      else updateResult('rls_bookings', 'pass', `Success: ${bCount || 0} bookings visible under admin context.`);

      // 3. RLS Assignments
      const { count: aCount, error: aErr } = await supabase.from('booking_assignments').select('*', { count: 'exact', head: true });
      if (aErr) updateResult('rls_assignments', 'fail', aErr.message);
      else updateResult('rls_assignments', 'pass', `Success: ${aCount || 0} assignments visible.`);

      // 4. RLS Payouts
      const { count: pCount, error: pErr } = await supabase.from('payout_ledger').select('*', { count: 'exact', head: true });
      if (pErr) updateResult('rls_payouts', 'fail', pErr.message);
      else updateResult('rls_payouts', 'pass', `Success: ${pCount || 0} payout records reachable.`);

      // 5. RLS Vehicles
      const { count: vCount, error: vErr } = await supabase.from('vehicles').select('*', { count: 'exact', head: true });
      if (vErr) updateResult('rls_vehicles', 'fail', vErr.message);
      else updateResult('rls_vehicles', 'pass', `Success: ${vCount || 0} fleet items discovered.`);

      // 6. RLS Documents
      const { count: dCount, error: dErr } = await supabase.from('documents').select('*', { count: 'exact', head: true });
      if (dErr) updateResult('rls_docs', 'fail', dErr.message);
      else updateResult('rls_docs', 'pass', `Success: ${dCount || 0} compliance documents visible.`);

    } catch (err: any) {
      console.error('Diagnostic routine exception:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial Run
  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-brand-charcoal flex items-center gap-3">
            <Activity className="text-brand-teal" size={32} />
            System Diagnostics
          </h1>
          <p className="text-gray-500 mt-1">Verifying API connectivity and Row-Level Security (RLS) policies.</p>
        </div>
        
        <button 
          onClick={runDiagnostics}
          disabled={loading}
          className="bg-brand-charcoal text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-black transition-all shadow-lg disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} />}
          Rerun All Tests
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left: Environment Summary */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Server size={14} /> Platform Context
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="p-2 bg-brand-teal/10 text-brand-teal rounded-lg">
                  <Fingerprint size={18} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Role Identity</p>
                  <p className="text-sm font-bold text-brand-charcoal capitalize">{profile?.role || 'Guest'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Auth Scope</p>
                  <p className="text-sm font-bold text-brand-charcoal">Authenticated</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                  <Database size={18} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">API Status</p>
                  <p className="text-sm font-bold text-brand-charcoal">v4.0 Connect</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-brand-charcoal text-white rounded-2xl shadow-xl relative overflow-hidden">
             <h4 className="font-bold mb-2 flex items-center gap-2">
               <Lock size={16} className="text-brand-teal" /> 
               RLS Enforcement
             </h4>
             <p className="text-xs text-gray-400 leading-relaxed relative z-10">
               As an Admin, your account should have "Full Bypass" or specific "Policy Coverage" that allows oversight of all user data. These tests verify your specific role can see data created by other providers.
             </p>
             <Lock size={100} className="absolute -bottom-6 -right-6 text-white/5" />
          </div>
        </div>

        {/* Right: Test Results Grid */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Policy Validation Routine</span>
              {loading && <span className="text-xs text-brand-teal animate-pulse font-bold">Scanning...</span>}
            </div>
            
            <div className="divide-y divide-gray-100">
              {results.map((check) => (
                <div key={check.id} className="p-6 hover:bg-gray-50/50 transition-colors flex items-start gap-4">
                  <div className="mt-1">
                    {check.status === 'pending' && <div className="w-6 h-6 rounded-full border-2 border-gray-200"></div>}
                    {check.status === 'running' && <Loader2 className="animate-spin text-brand-teal" size={24} />}
                    {check.status === 'pass' && <CheckCircle2 className="text-green-500" size={24} />}
                    {check.status === 'fail' && <XCircle className="text-red-500" size={24} />}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg text-brand-charcoal">{check.name}</h3>
                      {/* FIX: Move title prop to a wrapping span as Lucide icons don't support it directly */}
                      {check.id.startsWith('rls') && (
                        <span title="RLS Restricted Table">
                          <Lock size={14} className="text-gray-400" />
                        </span>
                      )}
                    </div>
                    
                    {check.message && (
                      <p className={`mt-1 text-sm ${check.status === 'fail' ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                        {check.message}
                      </p>
                    )}
                    
                    {check.details && (
                      <pre className="mt-3 p-3 bg-gray-900 rounded-xl font-mono text-[10px] text-green-400 overflow-x-auto border border-gray-800 shadow-inner">
                        {check.details}
                      </pre>
                    )}

                    {check.status === 'fail' && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-red-700 text-xs">
                         <AlertTriangle size={14} />
                         <span>Database policy may be blocking access for your role. Verify <strong>policies</strong> in Supabase dashboard.</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
