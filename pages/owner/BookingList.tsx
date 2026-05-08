import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { fetchBookingsForVehicleOwner } from '../../lib/bookingService';
import { listProviderPayouts } from '../../lib/payoutService';
import { Payout } from '../../types';

type BookingRow = any;

export const OwnerBookingsList: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled' | 'completed'>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return bookings;
    return bookings.filter((b: any) => String(b.status).toLowerCase() === filter);
  }, [bookings, filter]);

  useEffect(() => {
    const load = async () => {
      if (!user || !profile) return;
      setLoading(true);
      try {
        const [rows, payoutList] = await Promise.all([
          fetchBookingsForVehicleOwner(profile.id, false),
          listProviderPayouts(user.id)
        ]);
        setBookings(rows || []);
        setPayouts(payoutList);
      } catch (e) {
        console.error('[OwnerBookingsList] load error', e);
        setBookings([]);
        setPayouts([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user, profile]);

  if (loading) {
    return <div className="p-8">Loading bookings...</div>;
  }

  const getPayoutForBooking = (bookingId: string) => {
    return payouts.find(p => p.booking_id === bookingId);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Ready for payout';
      case 'approved': return 'Approved';
      case 'paid': return 'Paid';
      default: return status;
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bookings</h1>
          <p className="mt-1 text-gray-500">Bookings linked to your vehicles.</p>
        </div>

        <select
          className="rounded-md border px-3 py-2"
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <div className="mt-6 space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 text-gray-600">
            No bookings found.
          </div>
        ) : (
          filtered.map((b: any) => {
            const tourTitle = b?.tours?.title || 'Tour';
            const bookingRef = b?.booking_reference || b?.id?.slice?.(0, 8) || 'Booking';
            const vehicleLabel =
              b?.vehicles
                ? `${b.vehicles.make || ''} ${b.vehicles.model || ''}`.trim()
                : 'Vehicle';
            
            const payout = getPayoutForBooking(b.id);

            return (
              <div
                key={b.id}
                className="rounded-2xl border bg-white p-5 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs rounded-full border px-2 py-1 ${
                      b.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600'
                    }`}>
                      {String(b.status || '').toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-500">{bookingRef}</span>
                    {payout && (
                      <span className={`text-xs font-bold px-2 py-1 rounded-md border ${
                        payout.status === 'paid' ? 'bg-green-100 text-green-700 border-green-200' :
                        payout.status === 'approved' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                        'bg-amber-100 text-amber-700 border-amber-200'
                      }`}>
                        {getStatusLabel(payout.status)}: ZAR {payout.amount_net.toLocaleString()}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 font-semibold truncate">{tourTitle}</div>

                  <div className="mt-1 text-sm text-gray-600">
                    {vehicleLabel}
                    {b?.vehicles?.registration_number ? ` • ${b.vehicles.registration_number}` : ''}
                  </div>

                  <div className="mt-1 text-sm text-gray-500">
                    {b?.start_date ? new Date(b.start_date).toLocaleString() : ''}
                    {b?.end_date ? ` to ${new Date(b.end_date).toLocaleString()}` : ''}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
