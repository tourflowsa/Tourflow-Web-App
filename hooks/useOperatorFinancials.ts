
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  getOperatorFinancialSummary, 
  getOperatorBookingFinancials, 
  OperatorFinancialSummary, 
  BookingFinancialRow 
} from '../lib/financialService';
import { resolveOperatorFee } from '../lib/feeService';

export const useOperatorFinancials = (
  operatorId: string | undefined,
  startDate?: string,
  endDate?: string
) => {
  const [summary, setSummary] = useState<OperatorFinancialSummary | null>(null);
  const [bookings, setBookings] = useState<BookingFinancialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refreshData = async () => {
    if (!operatorId) return;
    
    setLoading(true);
    try {
      const [summaryData, bookingsData, feeData] = await Promise.all([
        getOperatorFinancialSummary(operatorId, startDate, endDate),
        getOperatorBookingFinancials(operatorId, startDate, endDate),
        resolveOperatorFee(operatorId)
      ]);
      
      // Fetch historical applied fee percentages for these bookings
      const bookingIds = bookingsData.map(b => b.booking_id);
      const feeMap: Record<string, number> = {};
      
      if (bookingIds.length > 0) {
        const { data: bookingFees } = await supabase
          .from('bookings')
          .select('id, applied_fee_percent')
          .in('id', bookingIds);
          
        if (bookingFees) {
          bookingFees.forEach(bf => {
            if (bf.applied_fee_percent != null) {
              feeMap[bf.id] = bf.applied_fee_percent;
            }
          });
        }
      }

      const defaultFeePercent = feeData.feePercent / 100;
      let totalPlatformFees = 0;
      
      const correctedBookings = bookingsData.map(b => {
        // Use historical percent if available, otherwise current operator tier percent
        let percentAmount = defaultFeePercent;
        if (feeMap[b.booking_id] !== undefined && feeMap[b.booking_id] !== null) {
           percentAmount = feeMap[b.booking_id] / 100;
        }
        
        // Exact platform fee = booking revenue * operator tier rate
        const actualPlatformFee = b.revenue * percentAmount;
        totalPlatformFees += actualPlatformFee;
        
        return {
          ...b,
          platform_fee: actualPlatformFee
        };
      });
      
      const correctedSummary = {
        ...summaryData,
        total_platform_fees: totalPlatformFees
      };
      
      setSummary(correctedSummary);
      setBookings(correctedBookings);
      setError(null);
    } catch (err) {
      console.error('Error fetching operator financials:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch financials'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
    
    // Listen for global payouts update event
    const handlePayoutUpdate = () => {
      refreshData();
    };
    
    window.addEventListener('PAYOUTS_UPDATED', handlePayoutUpdate);
    return () => {
      window.removeEventListener('PAYOUTS_UPDATED', handlePayoutUpdate);
    };
  }, [operatorId, startDate, endDate]);

  return {
    summary,
    bookings,
    loading,
    error,
    refreshData
  };
};
