
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getOperatorPayoutOverview, listOperatorPayouts, PayoutStats, backfillPayoutsForCompletedBookings } from '../../lib/payoutService';
import { Payout } from '../../types';
import { formatCurrency, formatDate } from '../../lib/formatUtils';
import { CreditCard, Calendar, TrendingUp, Search, Filter, Eye, AlertCircle, RefreshCw, CheckCircle2, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export const PayoutsList: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [stats, setStats] = useState<PayoutStats | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Filters
  const initialStatus = searchParams.get('status');
  const [statusFilter, setStatusFilter] = useState(initialStatus ? initialStatus.charAt(0).toUpperCase() + initialStatus.slice(1) : 'All');
  const [searchText, setSearchText] = useState('');
  const [backfilling, setBackfilling] = useState(false);

  useEffect(() => {
    loadData();
  }, [user, showArchived]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [statsData, payoutsData] = await Promise.all([
        getOperatorPayoutOverview(user.id),
        listOperatorPayouts(user.id, { includeArchived: showArchived })
      ]);
      setStats(statsData);
      setPayouts(payoutsData);
    } catch (err: any) {
      console.error(err);
      setError("Some data could not be loaded. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const filteredPayouts = payouts.filter(p => {
    const matchesStatus = statusFilter === 'All' || p.status.toLowerCase() === statusFilter.toLowerCase();
    const matchesSearch = searchText === '' || p.payout_reference.toLowerCase().includes(searchText.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-amber-100 text-amber-700';
      default: return 'bg-gray-100 text-gray-500';
    }
  };

  const handleBackfill = async () => {
    if (!user) return;
    
    setBackfilling(true);
    setError(null);
    setSuccess(null);
    try {
      const count = await backfillPayoutsForCompletedBookings(user.id);
      setSuccess(`Processed ${count} bookings. Your payout list has been updated.`);
      loadData();
    } catch (err: any) {
      console.error(err);
      setError("Backfill failed: " + err.message);
    } finally {
      setBackfilling(false);
    }
  };

  if (loading && !stats) return <div className="p-12 text-center text-gray-400">Loading financials...</div>;

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-brand-charcoal">Payouts & Financials</h1>
          <p className="text-gray-500 mt-1">Track your earnings and payout history.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleBackfill}
            disabled={backfilling}
            className="bg-brand-teal/10 text-brand-teal border border-brand-teal/20 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-brand-teal/20 transition-colors disabled:opacity-50"
            title="Create missing payouts for completed bookings"
          >
            <RefreshCw size={18} className={backfilling ? 'animate-spin' : ''} /> 
            {backfilling ? 'Processing...' : 'Sync Missing Payouts'}
          </button>
          <button 
            onClick={loadData}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={18} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3">
          <AlertCircle size={20} />
          <div>
             <p className="font-bold">Error loading data</p>
             <p className="text-sm">{error}</p>
          </div>
          <button onClick={loadData} className="ml-auto text-sm font-bold bg-white px-3 py-1.5 rounded border border-red-200 hover:bg-red-50">Retry</button>
        </div>
      )}

      {success && (
        <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-3 text-green-700 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={20} />
          <p className="font-bold flex-1">{success}</p>
          <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700">
             <X size={20} />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Balance */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
           <div className="flex items-start justify-between mb-4 relative z-10">
             <div className="p-3 bg-brand-teal/10 text-brand-teal rounded-lg">
               <CreditCard size={24} />
             </div>
             <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pending Balance</span>
           </div>
           <div className="relative z-10">
             <h2 className="text-3xl font-bold text-brand-charcoal">{formatCurrency(stats?.currentBalance || 0)}</h2>
             <p className="text-sm text-gray-500 mt-1">Available for next payout</p>
           </div>
           <div className="absolute -bottom-4 -right-4 text-brand-teal/5">
             <CreditCard size={120} />
           </div>
        </div>

        {/* Next Payout */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
           <div className="flex items-start justify-between mb-4 relative z-10">
             <div className="p-3 bg-brand-gold/20 text-brand-gold rounded-lg">
               <Calendar size={24} className="text-yellow-600" />
             </div>
             <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Next Payout</span>
           </div>
           <div className="relative z-10">
             {stats?.nextPayoutDate ? (
               <>
                 <h2 className="text-2xl font-bold text-brand-charcoal">{formatDate(stats.nextPayoutDate)}</h2>
                 <p className="text-sm text-gray-500 mt-1">
                    Pending: {formatCurrency(stats.nextPayoutAmount || 0)}
                 </p>
               </>
             ) : (
               <>
                 <h2 className="text-xl font-bold text-gray-400">None Pending</h2>
                 <p className="text-sm text-gray-400 mt-1">No pending payouts found</p>
               </>
             )}
           </div>
        </div>

        {/* Lifetime */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
           <div className="flex items-start justify-between mb-4 relative z-10">
             <div className="p-3 bg-brand-coral/10 text-brand-coral rounded-lg">
               <TrendingUp size={24} />
             </div>
             <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Paid Out</span>
           </div>
           <div className="relative z-10">
             <h2 className="text-3xl font-bold text-brand-charcoal">{formatCurrency(stats?.lifetimePayouts || 0)}</h2>
             <p className="text-sm text-gray-500 mt-1">Lifetime earnings</p>
           </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
         <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-50/50">
            <h3 className="font-bold text-brand-charcoal">Payout Ledger</h3>
            
            <div className="flex items-center gap-4 w-full md:w-auto">
               <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-gray-600 hover:text-brand-charcoal select-none whitespace-nowrap">
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${showArchived ? 'bg-brand-teal' : 'bg-gray-300'}`}>
                    <input type="checkbox" className="hidden" checked={showArchived} onChange={() => setShowArchived(!showArchived)} />
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${showArchived ? 'left-6' : 'left-1'}`}></div>
                  </div>
                  Show Archived
               </label>

               <div className="relative flex-1 md:w-64">
                 <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                 <input 
                   type="text" 
                   placeholder="Search reference..."
                   className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-teal"
                   value={searchText}
                   onChange={e => setSearchText(e.target.value)}
                 />
               </div>
               <div className="relative">
                 <Filter className="absolute left-3 top-2.5 text-gray-400" size={14} />
                 <select 
                   className="pl-8 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-brand-teal cursor-pointer"
                   value={statusFilter}
                   onChange={e => setStatusFilter(e.target.value)}
                 >
                   <option>All</option>
                   <option value="pending">Pending</option>
                   <option value="paid">Paid</option>
                 </select>
               </div>
            </div>
         </div>

         {filteredPayouts.length === 0 ? (
           <div className="p-12 text-center text-gray-400">
             <p>No payouts found matching your filters.</p>
           </div>
         ) : (
           <div className="overflow-x-auto">
             <table className="w-full text-left">
               <thead className="bg-gray-50 border-b border-gray-200">
                 <tr>
                   <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Reference</th>
                   <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Created Date</th>
                   <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                   <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">Net Amount</th>
                   <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">Platform Fee</th>
                   <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Action</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                 {filteredPayouts.map(p => (
                   <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${p.archived_at ? 'bg-gray-50 opacity-75' : ''}`}>
                     <td className="px-6 py-4 text-sm font-medium text-brand-charcoal font-mono">
                       {p.payout_reference}
                       {p.archived_at && <span className="ml-2 px-1.5 py-0.5 bg-gray-200 text-gray-600 text-[10px] rounded uppercase">Archived</span>}
                     </td>
                     <td className="px-6 py-4 text-sm text-gray-600">{formatDate(p.created_at)}</td>
                     <td className="px-6 py-4">
                       <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase ${getStatusColor(p.status)}`}>
                         {p.status}
                       </span>
                     </td>
                     <td className="px-6 py-4 text-right font-mono font-bold text-brand-charcoal text-sm">
                       {formatCurrency(p.amount_net, p.currency)}
                     </td>
                     <td className="px-6 py-4 text-right font-mono text-gray-500 text-sm">
                       {formatCurrency(p.platform_fee, p.currency)}
                     </td>
                     <td className="px-6 py-4">
                       <div className="flex items-center gap-3">
                         <button 
                           onClick={() => navigate(`/operator/payouts/${p.id}`)}
                           className="text-gray-400 hover:text-brand-teal transition-colors flex items-center gap-1 text-sm font-bold"
                         >
                           <Eye size={16} /> View
                         </button>
                       </div>
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
