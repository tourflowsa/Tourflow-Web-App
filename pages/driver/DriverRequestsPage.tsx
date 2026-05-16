import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  listDriverAvailabilityRequestsForDriver,
  updateDriverAvailabilityRequestStatus
} from '../../lib/bookingService';
import { DriverAvailabilityRequest } from '../../types';
import { CalendarDays, Check, X, Loader2, Clock } from 'lucide-react';

export const DriverRequestsPage: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<DriverAvailabilityRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadRequests();
    }
  }, [user]);

  const loadRequests = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listDriverAvailabilityRequestsForDriver(user.id);
      setRequests(data);
    } catch (err: any) {
      console.error('Failed to load driver requests:', err);
      setError('Failed to load driver requests.');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (requestId: string, status: 'accepted' | 'declined') => {
    if (!user) return;
    setProcessingId(requestId);
    try {
      await updateDriverAvailabilityRequestStatus(requestId, user.id, status);
      await loadRequests();
      window.dispatchEvent(new CustomEvent('PENDING_REQUESTS_UPDATED'));
    } catch (err: any) {
      console.error(`Failed to ${status} request:`, err);
      setError(`Failed to ${status} request: ${err.message || 'Unknown error'}`);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin text-brand-teal" size={32} />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-brand-charcoal flex items-center gap-3">
            <CalendarDays size={32} className="text-brand-teal" />
            Trip Requests
          </h1>
          <p className="text-gray-500 mt-2">Manage trip requests from operators.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-6 border border-red-100">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {requests.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <CalendarDays size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-lg font-medium">No requests found</p>
            <p className="text-sm">You don't have any trip requests yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Operator</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Dates</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Notes</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requests.map(req => (
                  <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                          {req.operator?.avatar_url || req.operator?.profile_image_url ? (
                            <img 
                              src={req.operator?.avatar_url || req.operator?.profile_image_url || undefined} 
                              alt={req.operator?.company_name || req.operator?.full_name || ''} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span className="font-bold text-gray-400">{(req.operator?.company_name || req.operator?.full_name)?.charAt(0)}</span>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-brand-charcoal">{req.operator?.company_name || req.operator?.full_name || 'Unknown Operator'}</div>
                          <div className="text-xs text-gray-500">{req.operator?.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        {new Date(req.start_date).toLocaleDateString()} - {new Date(req.end_date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 max-w-xs truncate" title={req.notes || ''}>
                        {req.notes || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1.5 w-fit ${
                        req.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        req.status === 'accepted' ? 'bg-green-100 text-green-700' :
                        req.status === 'declined' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {req.status === 'pending' && <Clock size={12} />}
                        {req.status === 'accepted' && <Check size={12} />}
                        {req.status === 'declined' && <X size={12} />}
                        {req.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {req.status === 'pending' && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleAction(req.id, 'accepted')}
                            disabled={processingId === req.id}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Accept Request"
                          >
                            {processingId === req.id ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                          </button>
                          <button
                            onClick={() => handleAction(req.id, 'declined')}
                            disabled={processingId === req.id}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Decline Request"
                          >
                            {processingId === req.id ? <Loader2 size={18} className="animate-spin" /> : <X size={18} />}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
