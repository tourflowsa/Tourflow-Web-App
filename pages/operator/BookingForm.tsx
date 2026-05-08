
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Tour, UserRole } from '../../types';
import { ArrowLeft, Calculator, Save, Loader2, MapPin, Tag, AlertCircle, ShieldAlert, ChevronRight, CheckCircle2 } from 'lucide-react';
import { TourDuration } from '../../components/tours/TourDuration';
import { logAuditEvent } from '../../lib/auditService';
import { resolveOperatorFee } from '../../lib/feeService';
import { checkComplianceGate, ComplianceGateResult } from '../../lib/complianceGate';
import { markBookingFundsReceived } from '../../lib/escrowService';

export const BookingForm: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tours, setTours] = useState<Tour[]>([]);
  
  // Compliance
  const [gateResult, setGateResult] = useState<ComplianceGateResult | null>(null);
  
  // Form Fields
  const [selectedTourId, setSelectedTourId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [guestCount, setGuestCount] = useState(1);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  // Computed State
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null);
  const [financials, setFinancials] = useState({
    subtotal: 0,
    vat: 0,
    total: 0,
    currency: 'ZAR',
    rate: 15
  });
  
  // Fee Estimate State
  const [feePercentEstimate, setFeePercentEstimate] = useState<number>(15);

  useEffect(() => {
    if (user && profile) {
      fetchTours();
      runComplianceCheck();
      resolveOperatorFee(user.id)
        .then(res => {
          setFeePercentEstimate(res.feePercent);
        })
        .catch(err => console.error("Failed to resolve fee estimate:", err));
    }
  }, [user, profile]);

  useEffect(() => {
    const tour = tours.find(t => t.id === selectedTourId) || null;
    setSelectedTour(tour);
    if (tour) {
      calculateFinancials(tour);
    }
  }, [selectedTourId, guestCount, tours]);

  const runComplianceCheck = async () => {
    if (!user || !profile) return;
    const result = await checkComplianceGate({
      action: 'create_booking',
      actorRole: profile.role,
      actorUserId: user.id
    });
    setGateResult(result);
  };

  const fetchTours = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('tours')
      .select('*')
      .eq('operator_id', user.id)
      .eq('is_active', true)
      .eq('status', 'published')
      .order('title');
    
    if (error) {
      console.error("Error fetching tours:", error);
      setError("Failed to load tour packages.");
    } else {
      setTours(data as Tour[]);
    }
  };

  const calculateFinancials = (tour: Tour) => {
    const rate = tour.vat_rate || 0;
    const isInc = tour.is_price_including_vat;
    const basePrice = tour.price_amount * guestCount;

    let subtotal = 0;
    let vat = 0;
    let total = 0;

    if (isInc) {
      // Price is gross (includes VAT)
      total = basePrice;
      subtotal = total / (1 + rate / 100);
      vat = total - subtotal;
    } else {
      // Price is net (excludes VAT)
      subtotal = basePrice;
      vat = subtotal * (rate / 100);
      total = subtotal + vat;
    }

    setFinancials({
      subtotal,
      vat,
      total,
      currency: tour.currency,
      rate
    });
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTourId || !startDate || !endDate) {
      setError("Start and end date are required to save a draft booking.");
      return;
    }

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      setError("Authentication session lost.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const ref = `BK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      
      const payload = {
        operator_id: authUser.id,
        tour_id: selectedTourId || null,
        booking_reference: ref,
        status: 'draft',
        start_date: startDate ? new Date(startDate).toISOString() : null,
        end_date: endDate ? new Date(endDate).toISOString() : null,
        num_guests: guestCount,
        guest_name: customerName,
        guest_email: customerEmail,
        guest_phone: customerPhone ? customerPhone.trim() : null,
        currency: financials.currency,
        subtotal_amount: Number(financials.subtotal.toFixed(2)),
        vat_rate: financials.rate,
        vat_amount: Number(financials.vat.toFixed(2)),
        total_amount: Number(financials.total.toFixed(2)),
        vehicle_rate_overridden: false,
        applied_fee_percent: 0,
        applied_platform_fee: 0,
        applied_fee_amount: 0,
        applied_net_amount: 0,
        notes: null
      };

      const { data, error: insertError } = await supabase.from('bookings').insert(payload).select().single();
      
      if (insertError) throw insertError;
      
      if (data) {
        await logAuditEvent({
          action: 'BOOKING_DRAFT_CREATED',
          entityType: 'Booking',
          entityId: data.id,
          metadata: { booking_reference: ref, operator_id: authUser.id }
        });
        navigate(`/operator/bookings/${data.id}`);
      }
    } catch (err: any) {
      console.error('Draft Creation Error:', err);
      setError('There was an issue saving the draft. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Defensive check: Fetch fresh user data from Supabase to ensure valid session for RLS
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authUser) {
      setError("Authentication session lost. Please sign in again to create a booking.");
      return;
    }

    if (!selectedTourId || !profile) return;
    
    // Double check compliance before submit using the gate
    const gate = await checkComplianceGate({
      action: 'create_booking',
      actorRole: profile.role,
      actorUserId: authUser.id
    });

    if (!gate.allowed) {
      setGateResult(gate);
      setError("Action blocked by compliance requirements. Please see the details above.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const ref = `BK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const feeResolution = await resolveOperatorFee(authUser.id, new Date());
      const resolvedPercent = feeResolution.feePercent;
      const appliedPlatformFee = Number(((financials.total * resolvedPercent) / 100).toFixed(2));
      const appliedNetAmount = Number((financials.total - appliedPlatformFee).toFixed(2));

      const payload = {
        operator_id: authUser.id, // Set explicitly from verified auth context
        tour_id: selectedTourId,
        booking_reference: ref,
        status: 'confirmed',
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
        num_guests: guestCount,
        guest_name: customerName,
        guest_email: customerEmail,
        guest_phone: customerPhone ? customerPhone.trim() : null,
        currency: financials.currency,
        subtotal_amount: Number(financials.subtotal.toFixed(2)),
        vat_rate: financials.rate,
        vat_amount: Number(financials.vat.toFixed(2)),
        total_amount: Number(financials.total.toFixed(2)),
        vehicle_rate_overridden: false,
        
        applied_fee_percent: resolvedPercent,
        applied_platform_fee: appliedPlatformFee,
        applied_fee_amount: appliedPlatformFee,
        applied_net_amount: appliedNetAmount,
        applied_fee_tier_id: feeResolution.feeTierId,
        applied_fee_tier_code: feeResolution.feeTierCode,

        notes: null
      };

      const { data, error: insertError } = await supabase.from('bookings').insert(payload).select().single();
      
      if (insertError) throw insertError;
      
      if (data) {
        // MVP payment assumption: confirmed bookings are treated as funds received into escrow until payment gateway integration is added.
        let escrowSuccess = true;
        if (data.status === 'confirmed' && data.total_amount > 0) {
          try {
            await markBookingFundsReceived(data.id, data.total_amount, authUser.id);
          } catch (escrowErr) {
            console.error('Failed to auto-fund escrow for new booking:', escrowErr);
            escrowSuccess = false;
          }
        }

        await logAuditEvent({
          action: 'BOOKING_CREATED',
          entityType: 'Booking',
          entityId: data.id,
          metadata: { 
            booking_reference: ref, 
            operator_id: authUser.id,
            escrow_auto_funded: escrowSuccess
          }
        });

        if (!escrowSuccess) {
          setError("Booking was created, but escrow funding could not be confirmed. Please mark funds received from Admin.");
          setLoading(false);
          return;
        }

        navigate(`/operator/bookings/${data.id}`);
      }
    } catch (err: any) {
      console.error('Booking Creation Error:', err);
      setError(err.message || 'Failed to create booking due to a system error.');
    } finally {
      setLoading(false);
    }
  };

  const isBlocked = gateResult?.allowed === false;

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="mb-6">
        <button onClick={() => navigate('/operator/bookings')} className="flex items-center gap-2 text-gray-500 hover:text-brand-charcoal mb-4">
          <ArrowLeft size={16} /> Back to Bookings
        </button>
        <h1 className="text-2xl font-bold text-brand-charcoal">Create New Booking</h1>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-red-700 animate-in fade-in">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Compliance Alert */}
      {isBlocked && gateResult && (
        <div className="mb-6 p-4 rounded-2xl border flex items-start gap-3 bg-red-50 border-red-200 text-red-900">
          <ShieldAlert className="shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <h4 className="font-bold text-sm">Creation Blocked: Compliance Issues</h4>
            <p className="text-xs mt-1 mb-2">
              {gateResult.message}
            </p>
            <ul className="list-disc list-inside text-xs space-y-0.5">
              {gateResult.missing?.map((m, i) => <li key={`m-${i}`}>Missing: {m}</li>)}
              {gateResult.expired?.map((e, i) => <li key={`e-${i}`}>Expired: {e}</li>)}
            </ul>
            {gateResult.ctaTo && (
              <button 
                onClick={() => navigate(gateResult.ctaTo!)}
                className="mt-3 text-xs font-bold bg-white border border-red-200 text-red-700 px-3 py-1.5 rounded flex items-center gap-1 hover:bg-red-50"
              >
                {gateResult.ctaLabel || 'Go to Documents'} <ChevronRight size={12}/>
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
           {/* Main Form */}
             <form id="bookingForm" onSubmit={handleSubmit} className={`bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6 ${isBlocked ? 'opacity-50 pointer-events-none' : ''}`}>
               {/* Tour Selection */}
               <div>
                 <label className="block text-sm font-bold text-brand-charcoal mb-1">
                   Select Tour Package <span className="text-red-500">*</span>
                 </label>
                 <select 
                   required
                   className="w-full border border-gray-300 rounded-lg p-3 bg-white focus:ring-2 focus:ring-brand-teal focus:border-transparent"
                   value={selectedTourId}
                   onChange={(e) => setSelectedTourId(e.target.value)}
                 >
                   <option value="">-- Choose a Tour --</option>
                   {tours.map(t => (
                     <option key={t.id} value={t.id}>{t.title} ({t.currency} {t.price_amount}/pp)</option>
                   ))}
                 </select>
               </div>

               {/* Dynamic Tour Details Preview */}
               {selectedTour && (
                 <div className="bg-brand-teal/5 border border-brand-teal/20 rounded-lg p-4">
                   <h4 className="font-bold text-brand-teal mb-2">{selectedTour.title}</h4>
                   <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      {selectedTour.region && (
                        <div className="flex items-center gap-1"><MapPin size={14}/> {selectedTour.region}</div>
                      )}
                      <TourDuration days={selectedTour.duration_days} hours={selectedTour.duration_hours} />
                      <div className="flex items-center gap-1">
                        <Tag size={14}/> 
                        {selectedTour.currency} {selectedTour.price_amount.toLocaleString()} pp
                        <span className="text-xs text-gray-400">({selectedTour.is_price_including_vat ? 'Inc' : 'Ex'} VAT)</span>
                      </div>
                   </div>
                 </div>
               )}

               {/* Dates */}
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-sm font-bold text-brand-charcoal mb-1">
                     Start Date & Time <span className="text-red-500">*</span>
                   </label>
                   <input 
                     required
                     type="datetime-local" 
                     className="w-full border border-gray-300 rounded-lg p-2"
                     value={startDate}
                     onChange={(e) => setStartDate(e.target.value)}
                   />
                 </div>
                 <div>
                   <label className="block text-sm font-bold text-brand-charcoal mb-1">
                     End Date & Time <span className="text-red-500">*</span>
                   </label>
                   <input 
                     required
                     type="datetime-local" 
                     className="w-full border border-gray-300 rounded-lg p-2"
                     value={endDate}
                     onChange={(e) => setEndDate(e.target.value)}
                   />
                 </div>
               </div>

               {/* Guests */}
               <div>
                 <label className="block text-sm font-bold text-brand-charcoal mb-1">
                   Number of Guests <span className="text-red-500">*</span>
                 </label>
                 <input 
                   required
                   type="number" 
                   min="1"
                   className="w-full border border-gray-300 rounded-lg p-2"
                   value={guestCount}
                   onChange={(e) => setGuestCount(Number(e.target.value))}
                 />
               </div>

               {/* Customer Info */}
               <div className="pt-4 border-t border-gray-100">
                 <h3 className="font-bold text-gray-900 mb-3">Customer Details</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                     <label className="block text-sm font-bold text-gray-600 mb-1">
                       Full Name <span className="text-red-500">*</span>
                     </label>
                     <input 
                       type="text" 
                       required
                       className="w-full border border-gray-300 rounded-lg p-2"
                       value={customerName}
                       onChange={(e) => setCustomerName(e.target.value)}
                       placeholder="e.g. John Doe"
                     />
                   </div>
                   <div>
                     <label className="block text-sm font-bold text-gray-600 mb-1">
                       Email <span className="text-red-500">*</span>
                     </label>
                     <input 
                       type="email" 
                       required
                       className="w-full border border-gray-300 rounded-lg p-2"
                       value={customerEmail}
                       onChange={(e) => setCustomerEmail(e.target.value)}
                       placeholder="e.g. john@example.com"
                     />
                   </div>
                   <div className="md:col-span-2">
                     <label className="block text-sm font-bold text-gray-600 mb-1">Client Telephone</label>
                     <input 
                       type="tel" 
                       className="w-full border border-gray-300 rounded-lg p-2"
                       value={customerPhone}
                       onChange={(e) => setCustomerPhone(e.target.value)}
                       placeholder="e.g. +1 234 567 8900"
                     />
                     <p className="text-xs text-gray-500 mt-1">Optional contact number for trip coordination.</p>
                   </div>
                 </div>
               </div>
             </form>
        </div>

        {/* Financial Sidebar */}
        <div>
          <div className="bg-brand-charcoal text-white rounded-2xl shadow-lg p-6 sticky top-6">
            <div className="flex items-center gap-2 mb-4 border-b border-gray-600 pb-4">
              <Calculator size={20} className="text-brand-teal" />
              <h3 className="font-bold text-lg">Estimated Cost</h3>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Rate per person</span>
                <span>{financials.currency} {selectedTour?.price_amount.toLocaleString() || '0'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Guests</span>
                <span>x {guestCount}</span>
              </div>
              <div className="h-px bg-gray-700 my-2"></div>
              <div className="flex justify-between">
                <span className="text-gray-400">Subtotal (Ex VAT)</span>
                <span>{financials.currency} {financials.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">VAT ({financials.rate}%)</span>
                <span>{financials.currency} {financials.vat.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>
              <div className="flex justify-between pt-4 border-t border-gray-600 text-lg font-bold">
                <span>Total</span>
                <span className="text-brand-teal">{financials.currency} {financials.total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-700 text-xs text-gray-400 flex justify-between">
                 <span>Platform Fee (Est. {feePercentEstimate}%)</span>
                 <span>- {financials.currency} {((financials.total * feePercentEstimate) / 100).toFixed(2)}</span>
              </div>
            </div>

             <div className="flex flex-col gap-3 mt-6">
               <button 
                 type="submit" 
                 form="bookingForm"
                 disabled={loading || !selectedTourId || isBlocked}
                 className="w-full bg-brand-teal text-white font-bold py-3 rounded-lg hover:bg-brand-teal/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 {loading ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18} />}
                 {isBlocked ? 'Create Blocked' : 'Confirm Booking'}
               </button>
               <button 
                 type="button"
                 onClick={handleSaveDraft}
                 disabled={loading || isBlocked}
                 className="w-full bg-transparent border border-gray-400 text-gray-300 font-bold py-3 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 {loading ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                 Save as Draft
               </button>
               <p className="text-center text-xs text-gray-500">Save this booking now and confirm it later.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
