
import React, { useEffect, useState } from 'react';
import { downloadCSV } from '../../lib/csvExportService';
import { 
  getAdminPayoutStats, 
  listPayoutLedgerAdmin, 
  AdminPayoutStats,
  archivePayoutAdmin,
  unarchivePayoutAdmin,
  placePayoutOnHold
} from '../../lib/adminPayoutService';
import { Payout } from '../../types';
import { formatCurrency, formatDate } from '../../lib/formatUtils';
import { getPayableAmount } from '../../lib/payoutUtils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  AlertCircle,
  RefreshCw,
  Trash2,
  ShieldAlert,
  Lock
} from 'lucide-react';
import { PayoutDetailDrawer } from '../../components/common/PayoutDetailDrawer';
import { supabase } from '../../lib/supabase';
import { getPayoutLedgerByIdAdmin } from '../../lib/adminPayoutService';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';

export const AdminPayoutsList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [stats, setStats] = useState<AdminPayoutStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Archive Modal State
  const [archiveTarget, setArchiveTarget] = useState<Payout | null>(null);
  const [isProcessingArchive, setIsProcessingArchive] = useState(false);

  // Drawer State
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [withdrawalFilter, setWithdrawalFilter] = useState('all');
  const [operatorFilter, setOperatorFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Dropdown Data
  const [operators, setOperators] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);

  useEffect(() => {
    loadDropdownData();
  }, []);

  const loadDropdownData = async () => {
    try {
      const { data: ops } = await supabase
        .from('profiles')
        .select('id, full_name, company_name')
        .eq('role', 'operator')
        .order('company_name');
      
      const { data: provs } = await supabase
        .from('profiles')
        .select('id, full_name, company_name')
        .in('role', ['driver', 'guide'])
        .order('full_name');

      setOperators(ops || []);
      setProviders(provs || []);
    } catch (err) {
      console.error("Failed to load filter data:", err);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, withdrawalFilter, operatorFilter, providerFilter, startDate, endDate, showArchived, search]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, listData] = await Promise.all([
        getAdminPayoutStats(),
        listPayoutLedgerAdmin({
          status: statusFilter,
          withdrawalStatus: withdrawalFilter,
          search: search,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          includeArchived: showArchived
        })
      ]);
      
      let filtered = listData;
      if (operatorFilter !== 'all') {
        filtered = filtered.filter(p => p.operator_id === operatorFilter);
      }
      if (providerFilter !== 'all') {
        filtered = filtered.filter(p => p.provider_id === providerFilter);
      }

      setStats(statsData);
      setPayouts(filtered);
    } catch (err: any) {
      console.error(err);
      setError("Failed to load payout data. You may not have permission.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // loadData is triggered by useEffect dependency on search
  };

  const initArchiveToggle = (payout: Payout) => {
    setArchiveTarget(payout);
  };

  const handleConfirmArchive = async () => {
    if (!user || !archiveTarget) return;
    setIsProcessingArchive(true);
    try {
      if (archiveTarget.archived_at) {
        await unarchivePayoutAdmin(archiveTarget.id);
        setToast({ message: "Payout unarchived.", type: 'success' });
      } else {
        await archivePayoutAdmin(archiveTarget.id, user.id);
        setToast({ message: "Payout archived.", type: 'success' });
      }
      await loadData();
      setArchiveTarget(null);
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      setToast({ message: "Action failed: " + err.message, type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsProcessingArchive(false);
    }
  };

  const handleHold = async (payout: Payout) => {
    if (!user) return;
    const reason = prompt('Enter reason for hold:');
    if (!reason) return;

    try {
      setLoading(true);
      await placePayoutOnHold(payout.id, user.id, reason);
      setToast({ message: "Payout placed on hold.", type: 'success' });
      await loadData();
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      setToast({ message: "Failed to place hold: " + err.message, type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = async (payout: Payout) => {
    setSelectedPayout(payout);
    setIsDrawerOpen(true);
    
    // Enrich data if missing
    if (!payout.provider_display_name) {
      try {
        const enriched = await getPayoutLedgerByIdAdmin(payout.id);
        setSelectedPayout(enriched);
      } catch (err) {
        console.error("Failed to enrich payout data", err);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-amber-100 text-amber-700';
      default: return 'bg-gray-100 text-gray-500';
    }
  };

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-brand-charcoal text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={20} className="text-green-400" />
          {toast.message}
        </div>
      )}

      <ConfirmationModal
        isOpen={!!archiveTarget}
        title={archiveTarget?.archived_at ? "Unarchive Payout?" : "Archive Payout?"}
        body={archiveTarget?.archived_at 
          ? "This will restore the payout record to visibility."
          : "This will hide the payout from standard lists."}
        confirmLabel={archiveTarget?.archived_at ? "Unarchive" : "Archive"}
        isDestructive={!archiveTarget?.archived_at}
        isProcessing={isProcessingArchive}
        onConfirm={handleConfirmArchive}
        onCancel={() => setArchiveTarget(null)}
      />

      <PayoutDetailDrawer 
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        payout={selectedPayout}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-brand-charcoal">Admin Payouts</h1>
          <p className="text-gray-500">Manage all platform payouts and ledger entries.</p>
        </div>
        <button 
          onClick={async () => {
             const headers = ['Payout Reference', 'Booking Reference', 'Provider', 'Provider Type', 'Original Amount', 'Adjustment Amount', 'Final Settlement Amount', 'Status', 'Paid Date', 'Created Date'];
             const data = payouts.map(p => {
               const final = 
                 p.adjusted_amount != null ? Number(p.adjusted_amount) :
                 p.amount_net != null ? Number(p.amount_net) :
                 p.original_amount != null ? Number(p.original_amount) :
                 0;
                 
               const original = 
                 p.original_amount != null ? Number(p.original_amount) :
                 p.amount_net != null ? Number(p.amount_net) :
                 final;
                 
               const adjustment = original - final;
               
               return [
                 p.payout_reference,
                 p.booking_ref,
                 p.provider_name || 'N/A',
                 p.provider_type || 'N/A',
                 original.toFixed(2),
                 adjustment.toFixed(2),
                 final.toFixed(2),
                 p.status,
                 p.paid_at || 'N/A',
                 p.created_at
               ];
             });
             downloadCSV(`tourflow-payout-ledger-${new Date().toISOString().split('T')[0]}.csv`, headers, data);
          }}
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-gray-50 transition-colors"
        >
          <Download size={18} /> Export CSV
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 flex items-center gap-3">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><Clock size={20}/></div>
            <span className="text-sm font-bold text-gray-500 uppercase">Pending Total</span>
          </div>
          <p className="text-2xl font-bold text-brand-charcoal">{formatCurrency(stats?.pendingTotal || 0)}</p>
          <p className="text-xs text-gray-400 mt-1">{stats?.pendingCount || 0} items pending</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 text-green-600 rounded-lg"><CheckCircle2 size={20}/></div>
            <span className="text-sm font-bold text-gray-500 uppercase">Paid Total</span>
          </div>
          <p className="text-2xl font-bold text-brand-charcoal">{formatCurrency(stats?.paidTotal || 0)}</p>
          <p className="text-xs text-gray-400 mt-1">{stats?.paidCount || 0} items paid</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm mb-6">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
           <div className="flex-1 relative">
             <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
             <input 
               type="text" 
               placeholder="Search reference..." 
               className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-teal"
               value={search}
               onChange={(e) => setSearch(e.target.value)}
             />
           </div>
           
            <div className="flex gap-4 flex-wrap">
              <div className="relative">
                <Filter className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <select 
                  className="pl-9 pr-8 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:border-brand-teal cursor-pointer"
                  value={operatorFilter}
                  onChange={(e) => setOperatorFilter(e.target.value)}
                >
                  <option value="all">All Operators</option>
                  {operators.map(op => (
                    <option key={op.id} value={op.id}>{op.company_name || op.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <Filter className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <select 
                  className="pl-9 pr-8 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:border-brand-teal cursor-pointer"
                  value={providerFilter}
                  onChange={(e) => setProviderFilter(e.target.value)}
                >
                  <option value="all">All Providers</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name || p.company_name}</option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <Filter className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <select 
                  className="pl-9 pr-8 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:border-brand-teal cursor-pointer"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Payout Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="paid">Paid</option>
                </select>
              </div>

                  <div className="relative">
                    <Filter className="absolute left-3 top-2.5 text-gray-400" size={16} />
                    <select 
                      className="pl-9 pr-8 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:border-brand-teal cursor-pointer"
                      value={withdrawalFilter}
                      onChange={(e) => setWithdrawalFilter(e.target.value)}
                    >
                      <option value="all">All Withdrawal Status</option>
                      <option value="requested">Requested</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
             
             <input 
               type="date" 
               className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-teal"
               value={startDate}
               onChange={(e) => setStartDate(e.target.value)}
             />
             <input 
               type="date" 
               className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-teal"
               value={endDate}
               onChange={(e) => setEndDate(e.target.value)}
             />
             
             <button type="submit" className="bg-brand-charcoal text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-800 transition-colors">
               Apply
             </button>
           </div>
        </form>
        
        <div className="mt-4 flex justify-end">
          <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-gray-600 hover:text-brand-charcoal select-none">
            <div className={`w-10 h-5 rounded-full relative transition-colors ${showArchived ? 'bg-brand-teal' : 'bg-gray-300'}`}>
              <input type="checkbox" className="hidden" checked={showArchived} onChange={() => setShowArchived(!showArchived)} />
              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${showArchived ? 'left-6' : 'left-1'}`}></div>
            </div>
            Show Archived
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading records...</div>
        ) : payouts.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Reference</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Created</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Operator ID</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">Net Amount</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payouts.map(p => (
                  <tr 
                    key={p.id} 
                    onClick={() => handleRowClick(p)}
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${p.archived_at ? 'bg-gray-50 opacity-75' : ''}`}
                  >
                    <td className="px-6 py-4 font-mono font-bold text-brand-charcoal text-sm">
                      {p.payout_reference}
                      {p.archived_at && <span className="ml-2 px-1.5 py-0.5 bg-gray-200 text-gray-600 text-[10px] rounded uppercase">Archived</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDate(p.created_at)}</td>
                    <td className="px-6 py-4 text-xs font-mono text-gray-500 truncate max-w-[150px]" title={p.operator_id}>
                      {p.operator_id}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {p.is_on_hold ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold uppercase w-fit bg-red-100 text-red-700">
                            <ShieldAlert size={10} /> {p.hold_reason === 'dispute' ? 'ON HOLD DUE TO DISPUTE' : 'ON HOLD'}
                          </span>
                        ) : p.withdrawal_request_status ? (
                          <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase w-fit ${
                            p.withdrawal_request_status === 'requested' ? 'bg-blue-100 text-blue-700' :
                            p.withdrawal_request_status === 'approved' ? 'bg-purple-100 text-purple-700' :
                            p.withdrawal_request_status === 'rejected' ? 'bg-red-100 text-red-700' :
                            p.withdrawal_request_status === 'paid' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {p.withdrawal_request_status === 'approved' ? 'APPROVED FOR PAYOUT' : p.withdrawal_request_status.toUpperCase()}
                          </span>
                        ) : (
                          <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase w-fit ${getStatusColor(p.status)}`}>
                            {p.status === 'approved' ? 'AVAILABLE' : p.status.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-brand-charcoal text-sm">
                      {formatCurrency(getPayableAmount(p), p.currency)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(p);
                          }}
                          className="text-gray-400 hover:text-brand-teal transition-colors flex items-center gap-1 text-sm font-bold"
                        >
                          <Eye size={16} /> View
                        </button>

                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(p);
                          }}
                          className="text-gray-400 hover:text-brand-charcoal transition-colors flex items-center gap-1 text-sm font-bold"
                        >
                          <Clock size={16} /> History
                        </button>
                        
                        {p.status !== 'paid' && !p.is_on_hold && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleHold(p);
                            }}
                            className="text-gray-400 hover:text-amber-600 transition-colors flex items-center gap-1 text-sm font-bold"
                            title="Place on Hold"
                          >
                            <Lock size={16} /> Hold
                          </button>
                        )}

                        <button
                           onClick={(e) => {
                             e.stopPropagation();
                             initArchiveToggle(p);
                           }}
                           className="text-gray-400 hover:text-red-500 transition-colors"
                           title={p.archived_at ? "Unarchive" : "Archive"}
                         >
                           {p.archived_at ? <RefreshCw size={16} /> : <Trash2 size={16} />}
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
