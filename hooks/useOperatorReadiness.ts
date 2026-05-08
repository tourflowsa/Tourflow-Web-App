
import { useState, useEffect, useCallback } from 'react';
import { getOperatorPaymentReadiness, PaymentReadiness } from '../lib/readinessService';

export const useOperatorReadiness = (operatorId: string | undefined) => {
  const [readiness, setReadiness] = useState<PaymentReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refreshReadiness = useCallback(async () => {
    if (!operatorId) return;
    
    setLoading(true);
    try {
      const data = await getOperatorPaymentReadiness(operatorId);
      setReadiness(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching operator readiness:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch readiness'));
    } finally {
      setLoading(false);
    }
  }, [operatorId]);

  useEffect(() => {
    refreshReadiness();
  }, [refreshReadiness]);

  useEffect(() => {
    const handleUpdate = () => refreshReadiness();
    window.addEventListener('DOCUMENTS_UPDATED', handleUpdate);
    window.addEventListener('DISPUTE_UPDATED', handleUpdate);
    window.addEventListener('LEDGER_UPDATED', handleUpdate);
    window.addEventListener('ESCROW_UPDATED', handleUpdate);
    
    return () => {
      window.removeEventListener('DOCUMENTS_UPDATED', handleUpdate);
      window.removeEventListener('DISPUTE_UPDATED', handleUpdate);
      window.removeEventListener('LEDGER_UPDATED', handleUpdate);
      window.removeEventListener('ESCROW_UPDATED', handleUpdate);
    };
  }, [refreshReadiness]);

  return {
    readiness,
    loading,
    error,
    refreshReadiness
  };
};
