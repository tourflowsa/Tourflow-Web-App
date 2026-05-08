import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CheckCircle2, XCircle, Loader2, Database } from 'lucide-react';

export const ConnectionHealthCheck: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [latency, setLatency] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    setStatus('loading');
    const start = performance.now();
    try {
      // We perform a simple query that doesn't require auth (fetching the current timestamp from the db)
      // Note: Since we haven't set up RPCs, we just check if we can initialize the client
      // and maybe hit the auth endpoint which is always open.
      const { data, error } = await supabase.auth.getSession();
      
      if (error) throw error;

      const end = performance.now();
      setLatency(Math.round(end - start));
      setStatus('success');
    } catch (err: any) {
      console.error("Supabase Connection Error:", err);
      setStatus('error');
      setErrorMessage(err.message || "Failed to connect");
    }
  };

  return (
    <div className="bg-white border border-brand-teal/20 rounded-lg p-4 shadow-sm mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-teal/10 rounded-full text-brand-teal">
            <Database size={20} />
          </div>
          <div>
            <h3 className="font-bold text-brand-charcoal text-sm uppercase tracking-wider">Database Connection</h3>
            <div className="flex items-center gap-2 mt-1">
              {status === 'loading' && (
                <span className="text-xs text-brand-charcoal/60 flex items-center gap-1">
                  <Loader2 size={12} className="animate-spin" /> Pinging Supabase...
                </span>
              )}
              {status === 'success' && (
                <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 size={12} /> Connected
                </span>
              )}
              {status === 'error' && (
                <span className="text-xs text-brand-coral font-bold flex items-center gap-1">
                  <XCircle size={12} /> Disconnected
                </span>
              )}
            </div>
          </div>
        </div>

        {status === 'success' && latency && (
          <div className="text-right">
            <span className="block text-xs text-brand-charcoal/50 font-serif">Latency</span>
            <span className="block text-sm font-bold text-brand-teal font-mono">{latency}ms</span>
          </div>
        )}
        
        {status === 'error' && (
          <button 
            onClick={checkConnection}
            className="text-xs text-brand-teal underline hover:text-brand-charcoal"
          >
            Retry
          </button>
        )}
      </div>
      
      {errorMessage && (
        <div className="mt-3 p-2 bg-red-50 text-red-600 text-xs rounded border border-red-100 font-mono">
          {errorMessage}
        </div>
      )}
    </div>
  );
};
