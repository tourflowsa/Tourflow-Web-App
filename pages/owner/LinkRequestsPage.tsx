import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  listOwnerLinkRequestsPaginated, 
  setVehicleLinkStatus, 
  revokeVehicleLink,
  counterRates,
  acceptRates
} from '../../lib/fleetService';
import { 
  Truck, 
  Link as LinkIcon, 
  Search, 
  Loader2, 
  Check, 
  XCircle, 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle,
  Clock,
  CheckCircle2,
  X,
  History,
  ArrowLeft,
  User,
  Globe,
  MapPin,
  Mail,
  Info,
  Banknote,
  Send
} from 'lucide-react';

type TabType = 'pending' | 'approved' | 'revoked';

export const LinkRequestsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal state for viewing operator profile
  const [viewingProfile, setViewingProfile] = useState<any | null>(null);

  // Modal state for countering rates
  const [counteringRate, setCounteringRate] = useState<any | null>(null);
  const [counterDayRate, setCounterDayRate] = useState('');
  const [counterHourRate, setCounterHourRate] = useState('');

  // Modal state for accepting rates
  const [acceptingRate, setAcceptingRate] = useState<any | null>(null);

  // Inline confirmation state
  const [confirmAction, setConfirmAction] = useState<{ id: string; type: 'approved' | 'rejected' | 'revoked' } | null>(null);

  // Implemented loadData function to fetch paginated link requests for the owner
  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await listOwnerLinkRequestsPaginated({
        ownerId: user.id,
        status: activeTab,
        search: search || undefined,
        page,
        limit
      });
      setData(res.data);
      setTotal(res.count);
      setTotalPages(res.totalPages);
    } catch (e) {
      console.error('Failed to load link requests', e);
      setToast({ type: 'error', message: 'Failed to load requests' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, activeTab, page, search]);

  // Implemented status update handler for approving/rejecting links
  const handleStatusUpdate = async (linkId: string, status: 'approved' | 'rejected') => {
    setProcessingId(linkId);
    try {
      await setVehicleLinkStatus(linkId, status);
      setToast({ type: 'success', message: `Request ${status === 'approved' ? 'approved' : 'rejected'}` });
      setConfirmAction(null);
      await loadData();
    } catch (e: any) {
      setToast({ type: 'error', message: e.message || 'Operation failed' });
    } finally {
      setProcessingId(null);
    }
  };

  // Implemented revoke handler to disconnect an operator from a vehicle
  const handleRevoke = async (linkId: string) => {
    setProcessingId(linkId);
    try {
      await revokeVehicleLink(linkId);
      setToast({ type: 'success', message: 'Access revoked' });
      setConfirmAction(null);
      await loadData();
    } catch (e: any) {
      setToast({ type: 'error', message: e.message || 'Revoke failed' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleCounterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!counteringRate || !user) return;
    
    setProcessingId(counteringRate.rate_link.id);
    try {
      await counterRates({
        rateLinkId: counteringRate.rate_link.id,
        actorId: user.id,
        dayRate: parseFloat(counterDayRate),
        hourRate: parseFloat(counterHourRate)
      });
      setToast({ type: 'success', message: 'Counter rates sent' });
      setCounteringRate(null);
      await loadData();
    } catch (e: any) {
      setToast({ type: 'error', message: e.message || 'Failed to send counter' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleAcceptRates = async () => {
    if (!acceptingRate || !user) return;
    
    setProcessingId(acceptingRate.rate_link.id);
    try {
      await acceptRates({
        rateLinkId: acceptingRate.rate_link.id,
        actorId: user.id
      });
      setToast({ type: 'success', message: 'Rates accepted' });
      setAcceptingRate(null);
      await loadData();
    } catch (e: any) {
      setToast({ type: 'error', message: e.message || 'Failed to accept rates' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleActionClick = (id: string, type: 'approved' | 'rejected' | 'revoked') => {
    // For approval, we skip the secondary confirm UI as it's a positive action
    if (type === 'approved') {
      handleStatusUpdate(id, 'approved');
      return;
    }
    setConfirmAction({ id, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] px-6 py-3 rounded-lg shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300 ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-bold">{toast.message}</span>
        </div>
      )}

      {/* Counter Rates Modal */}
      {counteringRate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="font-bold text-brand-charcoal flex items-center gap-2 text-sm uppercase tracking-wider">
                <Banknote size={16} className="text-brand-teal" />
                Counter Proposed Rates
              </h3>
              <button onClick={() => setCounteringRate(null)} className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCounterSubmit} className="p-6 space-y-4 text-left">
              <p className="text-[11px] text-gray-500 mb-2 leading-relaxed">
                Counter the rates proposed by <strong>{counteringRate.operator?.company_name || counteringRate.operator?.full_name}</strong> for this vehicle.
              </p>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Day Rate ({counteringRate.rate_link?.rate_currency})</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-400 text-sm">{counteringRate.rate_link?.rate_currency}</span>
                  <input 
                    type="number"
                    step="0.01"
                    required
                    className="w-full border border-gray-200 rounded-xl pl-12 pr-3 py-2 text-sm focus:ring-2 focus:ring-brand-teal outline-none transition-all"
                    value={counterDayRate}
                    onChange={e => setCounterDayRate(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Hour Rate ({counteringRate.rate_link?.rate_currency})</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-400 text-sm">{counteringRate.rate_link?.rate_currency}</span>
                  <input 
                    type="number"
                    step="0.01"
                    required
                    className="w-full border border-gray-200 rounded-xl pl-12 pr-3 py-2 text-sm focus:ring-2 focus:ring-brand-teal outline-none transition-all"
                    value={counterHourRate}
                    onChange={e => setCounterHourRate(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setCounteringRate(null)}
                  className="flex-1 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={!!processingId}
                  className="flex-1 py-2 bg-brand-charcoal text-white rounded-xl font-bold hover:bg-black transition-colors flex items-center justify-center gap-2 text-xs shadow-sm"
                >
                  {processingId === counteringRate.rate_link.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Send Counter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Accept Rates Confirmation Modal */}
      {acceptingRate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="font-bold text-brand-charcoal flex items-center gap-2 text-sm uppercase tracking-wider">
                <CheckCircle2 size={16} className="text-green-600" />
                Accept Proposed Rates?
              </h3>
              <button onClick={() => setAcceptingRate(null)} className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4 text-center">
              <p className="text-[11px] text-gray-500 leading-relaxed text-left">
                This will approve the Operator’s proposed rates for this vehicle link. These rates will be used for future bookings with this Operator.
              </p>
              
              <div className="bg-green-50 p-4 border border-green-100 rounded-xl grid grid-cols-2 gap-4">
                <div className="text-left">
                  <span className="text-[9px] uppercase font-bold text-green-700">Daily Rate</span>
                  <div className="text-sm font-mono font-bold text-brand-charcoal">
                    {acceptingRate.rate_link?.rate_currency} {acceptingRate.rate_link?.operator_proposed_day_rate}
                  </div>
                </div>
                <div className="text-left border-l border-green-200 pl-4">
                  <span className="text-[9px] uppercase font-bold text-green-700">Hourly Rate</span>
                  <div className="text-sm font-mono font-bold text-brand-charcoal">
                    {acceptingRate.rate_link?.rate_currency} {acceptingRate.rate_link?.operator_proposed_hour_rate}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setAcceptingRate(null)}
                  className="flex-1 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAcceptRates}
                  disabled={!!processingId}
                  className="flex-1 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-xs shadow-sm"
                >
                  {processingId === acceptingRate.rate_link.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Accept Rates
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Operator Profile Modal */}
      {viewingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="font-bold text-brand-charcoal flex items-center gap-2">
                <User size={18} className="text-brand-teal" />
                Operator Profile
              </h3>
              <button onClick={() => setViewingProfile(null)} className="text-gray-400 hover:text-red-500">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal font-bold text-xl">
                  {viewingProfile.company_name?.charAt(0) || viewingProfile.full_name?.charAt(0) || 'O'}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-brand-charcoal">{viewingProfile.company_name || viewingProfile.full_name}</h4>
                  <p className="text-sm text-gray-500">{viewingProfile.full_name}</p>
                </div>
              </div>

              <div className="space-y-4">
                {viewingProfile.bio && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">About</span>
                    <p className="text-sm text-gray-600 italic leading-relaxed">{viewingProfile.bio}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Mail size={16} className="text-gray-400" />
                    <span>{viewingProfile.email}</span>
                  </div>
                  {viewingProfile.website && (
                    <div className="flex items-center gap-3 text-sm text-brand-teal">
                      <Globe size={16} className="text-brand-teal" />
                      <a href={viewingProfile.website.startsWith('http') ? viewingProfile.website : `https://${viewingProfile.website}`} target="_blank" rel="noreferrer" className="hover:underline">
                        {viewingProfile.website}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <MapPin size={16} className="text-gray-400" />
                    <span>
                      {[viewingProfile.city, viewingProfile.province, viewingProfile.country].filter(Boolean).join(', ') || 'No location set'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => setViewingProfile(null)}
                className="px-6 py-2 bg-brand-charcoal text-white rounded-2xl font-bold hover:bg-black transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <button onClick={() => navigate('/owner')} className="flex items-center gap-2 text-gray-500 hover:text-brand-charcoal mb-4 font-bold text-sm transition-colors">
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold text-brand-charcoal">Operator Link Requests</h1>
        <p className="text-gray-500 mt-1">Manage which tour operators can hire your vehicles.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-8 items-center justify-between border-b border-gray-200">
        <div className="flex gap-4">
          {(['pending', 'approved', 'revoked'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setPage(1); setConfirmAction(null); }}
              className={`px-4 py-3 font-bold text-sm border-b-2 transition-colors capitalize ${
                activeTab === tab 
                  ? 'border-brand-teal text-brand-teal' 
                  : 'border-transparent text-gray-500 hover:text-brand-charcoal'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64 mb-2">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search make, model, plate..." 
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-teal text-sm"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {loading && data.length === 0 ? (
          <div className="p-20 text-center text-gray-400 flex flex-col items-center gap-3">
            <Loader2 className="animate-spin text-brand-teal" size={32} />
            <p className="font-medium italic">Loading requests...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="p-20 text-center text-gray-400">
            <p className="italic">No {activeTab} requests found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-4">Vehicle</th>
                  <th className="px-6 py-4">Operator / Company</th>
                  <th className="px-6 py-4">Status</th>
                  {activeTab === 'approved' && <th className="px-6 py-4">Rates</th>}
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((item) => {
                  const operatorName = item.operator?.company_name || item.operator?.full_name || item.operator?.email || 'Unnamed';
                  const isConfirmingThis = confirmAction?.id === item.id;
                  const rateLink = item.rate_link;

                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 rounded-lg text-gray-400">
                            <Truck size={20} />
                          </div>
                          <div>
                            <p className="font-bold text-brand-charcoal text-sm">{item.vehicle?.make} {item.vehicle?.model}</p>
                            <p className="text-xs text-gray-500 font-mono">{item.vehicle?.license_plate}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <p className="font-bold text-brand-charcoal text-sm">{operatorName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <button 
                              onClick={() => setViewingProfile(item.operator)}
                              className="text-[10px] font-bold text-brand-teal hover:underline flex items-center gap-1 uppercase tracking-tighter"
                            >
                              <Info size={10} /> View Profile
                            </button>
                            <span className="text-[10px] text-gray-300">|</span>
                            <p className="text-[10px] text-gray-400 font-mono">{item.operator?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${
                          item.status === 'approved' ? 'bg-green-50 text-green-700 border-green-100' :
                          item.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                          'bg-gray-50 text-gray-500 border-gray-100'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      {activeTab === 'approved' && (
                        <td className="px-6 py-4">
                          {rateLink ? (
                            <div className="space-y-1">
                              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                                rateLink.rate_status === 'accepted' ? 'bg-green-50 text-green-700 border-green-100' :
                                rateLink.rate_status === 'countered' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                'bg-amber-50 text-amber-700 border-amber-100'
                              }`}>
                                {rateLink.rate_status}
                              </span>
                              <div className="text-[10px] text-gray-500 font-medium">
                                <div>Prop: {rateLink.rate_currency} {rateLink.operator_proposed_day_rate}/{rateLink.operator_proposed_hour_rate}</div>
                                {rateLink.owner_counter_day_rate && (
                                  <div className="text-blue-600">Cnt: {rateLink.rate_currency} {rateLink.owner_counter_day_rate}/{rateLink.owner_counter_hour_rate}</div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-400 italic">No rate record</span>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(item.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right min-w-[200px]">
                        <div className="flex items-center justify-end gap-2">
                          {isConfirmingThis ? (
                            <div className="flex items-center gap-2 bg-red-50 border border-red-100 px-3 py-1.5 rounded-lg animate-in fade-in slide-in-from-right-2">
                              <span className="text-[10px] font-bold text-red-700 uppercase tracking-tight">
                                {confirmAction?.type === 'rejected' ? 'REJECT REQUEST?' : 'REVOKE ACCESS?'}
                              </span>
                              <button 
                                onClick={() => setConfirmAction(null)}
                                className="text-[10px] font-bold text-gray-500 hover:text-brand-charcoal px-2"
                                disabled={!!processingId}
                              >
                                Cancel
                              </button>
                              <button 
                                onClick={() => confirmAction?.type === 'rejected' ? handleStatusUpdate(item.id, 'rejected') : handleRevoke(item.id)}
                                className="text-[10px] font-bold text-red-600 hover:text-red-800 bg-white border border-red-200 px-2 py-0.5 rounded shadow-sm flex items-center gap-1"
                                disabled={!!processingId}
                              >
                                {processingId === item.id ? <Loader2 size={10} className="animate-spin" /> : <Check size={16} />}
                                Confirm
                              </button>
                            </div>
                          ) : (
                            <>
                              {activeTab === 'pending' && (
                                <>
                                  <button
                                    onClick={() => handleActionClick(item.id, 'approved')}
                                    disabled={!!processingId}
                                    className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors shadow-sm"
                                    title="Approve Link"
                                  >
                                    {processingId === item.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                  </button>
                                  <button
                                    onClick={() => handleActionClick(item.id, 'rejected')}
                                    disabled={!!processingId}
                                    className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors shadow-sm"
                                    title="Reject Link"
                                  >
                                    {processingId === item.id ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                                  </button>
                                </>
                              )}
                              {activeTab === 'approved' && (
                                <div className="flex items-center gap-2">
                              {rateLink?.rate_status === 'proposed' && (
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => setAcceptingRate(item)}
                                        disabled={!!processingId}
                                        className="text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 shadow-sm"
                                      >
                                        <Check size={14} /> Accept Proposal
                                      </button>
                                      <button
                                        onClick={() => {
                                          setCounteringRate(item);
                                          setCounterDayRate(rateLink.operator_proposed_day_rate.toString());
                                          setCounterHourRate(rateLink.operator_proposed_hour_rate.toString());
                                        }}
                                        disabled={!!processingId}
                                        className="text-xs font-bold text-brand-teal hover:bg-brand-teal/5 border border-brand-teal/20 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                                      >
                                        <Banknote size={14} /> Counter rates
                                      </button>
                                    </div>
                                  )}
                                  {rateLink?.rate_status === 'countered' && (
                                    <div className="text-[10px] font-bold text-blue-600 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded">
                                      <Clock size={12} /> Waiting for operator response
                                    </div>
                                  )}
                                  <button
                                    onClick={() => handleActionClick(item.id, 'revoked')}
                                    disabled={!!processingId}
                                    className="text-xs font-bold text-red-600 hover:bg-red-50 border border-red-100 px-3 py-1.5 rounded-lg transition-all"
                                  >
                                    Revoke Access
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Showing {data.length} of {total} results
            </span>
            <div className="flex gap-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-400 hover:text-brand-teal disabled:opacity-50"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex items-center px-3 text-sm font-bold text-brand-charcoal">
                {page} / {totalPages}
              </div>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
                className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-400 hover:text-brand-teal disabled:opacity-50"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
