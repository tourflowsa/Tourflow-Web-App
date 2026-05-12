import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { listOperatorPayouts, PAYOUT_STATUS_LABELS, archiveOperatorPayout, unarchiveOperatorPayout } from '../../lib/payoutService';
import { formatCurrency, formatDate } from '../../lib/formatUtils';
import { supabase } from '../../lib/supabase';
import { Loader2, CheckCircle2, AlertCircle, Download, Archive, Search, Eye, ShieldAlert, Banknote, ChevronRight, ChevronDown } from 'lucide-react';
import { filterPayouts, getPayableAmount } from '../../lib/payoutUtils';
import { PayoutDetailDrawer } from '../../components/common/PayoutDetailDrawer';

export const OperatorPayoutsPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('Open');
  const [searchTerm, setSearchTerm] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  // Drawer State
  const [selectedPayout, setSelectedPayout] = useState<any | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    if (user) loadPayouts();

    // Listen for global payouts update event
    const handlePayoutUpdate = () => {
      if (user) loadPayouts();
    };
    
    window.addEventListener('PAYOUTS_UPDATED', handlePayoutUpdate);
    return () => {
      window.removeEventListener('PAYOUTS_UPDATED', handlePayoutUpdate);
    };
  }, [user, statusFilter, includeArchived]);

  const loadPayouts = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      let status: string | string[] | undefined = ['pending', 'approved'];
      if (statusFilter === 'Pending') status = 'pending';
      if (statusFilter === 'Available') status = 'approved';
      if (statusFilter === 'Paid') status = 'paid';
      if (statusFilter === 'All') status = undefined;
      
      const data = await listOperatorPayouts(user!.id, { status, includeArchived });
      
      const bookingIds = Array.from(new Set(data.map((p: any) => p.booking_id).filter(Boolean)));
      const providerIds = Array.from(new Set(data.map((p: any) => p.provider_id).filter(Boolean)));
      
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, booking_reference, start_date, tour_id, tours(title)')
        .in('id', bookingIds);
      
      const { data: providers } = await supabase
        .from('profiles')
        .select('id, company_name, full_name')
        .in('id', providerIds);
      
      const bookingMap = (bookings || []).reduce((acc: any, b: any) => {
        acc[b.id] = {
          booking_reference: b.booking_reference,
          service_date: b.start_date,
          tour_title: b.tours?.title || 'Custom Tour'
        };
        return acc;
      }, {});

      const providerMap = (providers || []).reduce((acc: any, p: any) => {
        acc[p.id] = p.company_name || p.full_name || 'Unknown Provider';
        return acc;
      }, {});

      // Resolve missing providers (likely vehicles or owners without profiles)
      const missingProviderIds = providerIds.filter(id => !providerMap[id]);
      if (missingProviderIds.length > 0) {
        // Try to fetch from vehicles table
        const { data: vehicles } = await supabase
          .from('vehicles')
          .select('id, name, owner_id, profiles:owner_id(company_name, full_name)')
          .in('id', missingProviderIds);
        
        if (vehicles && vehicles.length > 0) {
          vehicles.forEach((v: any) => {
            const ownerName = v.profiles?.company_name || v.profiles?.full_name || v.name || 'Vehicle Provider';
            providerMap[v.id] = `${ownerName} (Vehicle)`;
          });
        }
      }

      const enriched = data.map((p: any) => {
        let providerDisplayName = providerMap[p.provider_id];
        
        // Final fallback if still unknown
        if (!providerDisplayName || providerDisplayName === 'Unknown Provider') {
          if (p.payout_reference?.includes('-VEHICLE')) {
            providerDisplayName = 'Vehicle Provider';
          } else {
            providerDisplayName = 'Unknown Provider';
          }
        }

        const payableAmount = getPayableAmount(p);

        return {
          ...p,
          provider_display_name: providerDisplayName,
          booking_reference: bookingMap[p.booking_id]?.booking_reference || 'N/A',
          service_date: bookingMap[p.booking_id]?.service_date || null,
          tour_title: bookingMap[p.booking_id]?.tour_title || 'Custom Tour',
          // Audit fields
          provider_name: providerDisplayName,
          provider_type: p.provider_type || (p.payout_reference?.includes('-VEHICLE') ? 'Vehicle' : 'Unknown'),
          booking_ref: bookingMap[p.booking_id]?.booking_reference || 'N/A',
          gross_amount: p.amount_gross,
          net_amount: p.amount_net,
          payable_amount: payableAmount,
          paid_at: p.paid_at,
          paid_by: p.paid_by
        };
      });
      setPayouts(enriched);
    } catch (err) {
      console.error(err);
      setError('Failed to load payouts.');
    } finally {
      setLoading(false);
    }
  };

  const filteredPayouts = useMemo(() => {
    return filterPayouts(payouts, searchTerm, ['provider_display_name', 'booking_reference', 'payout_reference', 'tour_title']);
  }, [payouts, searchTerm]);

  const groupedPayouts = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredPayouts.forEach(p => {
      const key = p.booking_id || p.id;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });

    return Object.values(groups).map((group) => {
      const booking_id = group[0].booking_id;
      const booking_reference = group[0].booking_reference || 'N/A';
      const tour_title = group[0].tour_title || 'N/A';
      const service_date = group[0].service_date || null;
      const providerCount = group.length;
      const totalAmount = group.reduce((sum, p) => sum + getPayableAmount(p), 0);

      const statuses = group.map(p => (p.status || '').toLowerCase());
      const onHolds = group.some(p => p.is_on_hold);
      const allPaid = statuses.every(s => s === 'paid');
      const hasPendingAppr = statuses.some(s => ['pending', 'approved'].includes(s));

      let groupStatus = 'Unknown';
      if (onHolds) groupStatus = 'On Hold';
      else if (allPaid) groupStatus = 'Paid';
      else if (statuses.includes('paid') && hasPendingAppr) groupStatus = 'Partially Paid';
      else if (hasPendingAppr) groupStatus = 'Outstanding';
      else groupStatus = statuses[0];

      return {
        id: booking_id || group[0].id,
        booking_id,
        booking_reference,
        tour_title,
        service_date,
        providerCount,
        totalAmount,
        groupStatus,
        items: group
      };
    });
  }, [filteredPayouts]);

  const handleArchive = async (id: string) => {
    try {
      await archiveOperatorPayout(id);
      await loadPayouts();
      setSuccess('Payout archived successfully.');
    } catch (err) {
      console.error(err);
      setError('Failed to archive payout.');
    }
  };

  const handleGroupArchive = async (groupId: string, items: any[]) => {
    try {
      setLoading(true);
      await Promise.all(items.filter(p => !p.operator_archived_at && p.status === 'paid').map(p => archiveOperatorPayout(p.id)));
      await loadPayouts();
      setSuccess('Booking payouts archived.');
    } catch (err) {
      console.error(err);
      setError('Could not update archived status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGroupUnarchive = async (groupId: string, items: any[]) => {
    try {
      setLoading(true);
      await Promise.all(items.filter(p => p.operator_archived_at).map(p => unarchiveOperatorPayout(p.id)));
      await loadPayouts();
      setSuccess('Booking payouts unarchived.');
    } catch (err) {
      console.error(err);
      setError('Could not update archived status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    const headers = ['batch_id', 'payout_reference', 'provider_name', 'provider_company', 'booking_reference', 'service_date', 'amount_gross', 'platform_fee', 'amount_net', 'status', 'is_on_hold'];
    const rows = filteredPayouts.map(p => [
      p.payout_batches?.batch_ref ?? p.batch_id ?? '',
      p.payout_reference.split('-').slice(0, 4).join('-'),
      p.provider_display_name,
      p.provider_company_name,
      p.booking_reference,
      p.service_date,
      p.amount_gross,
      p.platform_fee,
      p.amount_net,
      p.status,
      p.is_on_hold ? 'YES' : 'NO'
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `tourflow_payouts_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="p-12 text-center text-gray-400"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>;

  const heading = statusFilter === 'Paid' ? 'Paid History' : (statusFilter === 'All' ? 'All Payouts' : 'Open Payouts');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Payouts</h1>
      {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4 flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
      {success && <div className="bg-green-100 text-green-700 p-4 rounded mb-4 flex items-center gap-2"><CheckCircle2 size={16} /> {success}</div>}
      
      {/* Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Total Outstanding</span>
          <div className="text-xl font-bold text-brand-charcoal">
            {formatCurrency(payouts.filter(p => !p.paid_at && !p.is_on_hold).reduce((acc, p) => acc + getPayableAmount(p), 0))}
          </div>
          <span className="text-[10px] text-gray-400">{payouts.filter(p => !p.paid_at && !p.is_on_hold).length} items</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Marked as Paid</span>
          <div className="text-xl font-bold text-green-600">
            {formatCurrency(payouts.filter(p => p.status === 'paid').reduce((acc, p) => acc + getPayableAmount(p), 0))}
          </div>
          <span className="text-[10px] text-gray-400">{payouts.filter(p => p.status === 'paid').length} items</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">On Hold / Disputed</span>
          <div className="text-xl font-bold text-red-600">
            {formatCurrency(payouts.filter(p => p.is_on_hold).reduce((acc, p) => acc + getPayableAmount(p), 0))}
          </div>
          <span className="text-[10px] text-gray-400">{payouts.filter(p => p.is_on_hold).length} items</span>
        </div>
      </div>

      <PayoutDetailDrawer 
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        payout={selectedPayout}
      />

      <div className="flex flex-col gap-4 mb-6">
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border p-2 rounded">
                    <option value="Open">Open</option>
                    <option value="pending">Pending Authorization</option>
                    <option value="approved">Available</option>
                    <option value="paid">Paid</option>
                    <option value="All">All</option>
            </select>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={includeArchived} onChange={e => setIncludeArchived(e.target.checked)} />
              Include Archived
            </label>
            <button 
              onClick={exportCsv}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 flex items-center gap-2"
            >
              <Download size={16} /> Export CSV
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Search..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              className="border p-2 pl-8 rounded"
            />
          </div>
        </div>
      </div>

      <h2 className="text-xl font-semibold mb-4">{heading}</h2>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left w-10"></th>
            <th className="p-2 text-left w-10"></th>
            <th className="p-2 text-left">Booking Ref / Provider</th>
            <th className="p-2 text-left">Tour / Type</th>
            <th className="p-2 text-left">Service Date</th>
            <th className="p-2 text-left">Amount</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {groupedPayouts.length === 0 ? (
            <tr>
              <td colSpan={8} className="p-12 text-center text-gray-400">
                <div className="flex flex-col items-center justify-center gap-2">
                  <Banknote size={48} className="opacity-10 mb-2" />
                  <p className="font-bold">No payouts found</p>
                  <p className="text-xs">Adjust your filters or try a different date range.</p>
                </div>
              </td>
            </tr>
          ) : (
            groupedPayouts.map(group => {
              const isExpanded = expandedGroups.includes(group.id);
              return (
                <React.Fragment key={group.id}>
                  {/* Parent Row */}
                  <tr className="border-b bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => setExpandedGroups(prev => prev.includes(group.id) ? prev.filter(id => id !== group.id) : [...prev, group.id])}>
                    <td className="p-2" onClick={(e) => e.stopPropagation()}>
                    </td>
                    <td className="p-2">
                       {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </td>
                    <td className="p-2 font-medium">{group.booking_reference} <span className="text-xs text-gray-400 font-normal ml-2">({group.providerCount} {group.providerCount === 1 ? 'provider' : 'providers'})</span></td>
                    <td className="p-2">{group.tour_title}</td>
                    <td className="p-2">{formatDate(group.service_date)}</td>
                    <td className="p-2 font-bold">{formatCurrency(group.totalAmount)}</td>
                    <td className="p-2">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase w-fit border ${
                        group.groupStatus === 'Paid' ? 'bg-green-50 text-green-700 border-green-100' : 
                        group.groupStatus === 'On Hold' ? 'bg-red-50 text-red-700 border-red-100' :
                        group.groupStatus === 'Partially Paid' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                        group.groupStatus === 'Ready for Payout' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                        'bg-gray-50 text-gray-700 border-gray-100'
                      }`}>
                        {group.groupStatus}
                      </span>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        {group.items.some(p => p.status === 'paid' && !p.operator_archived_at) && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleGroupArchive(group.id, group.items); }} 
                            className="text-gray-600 hover:underline text-sm flex items-center gap-1 font-medium"
                          >
                            <Archive size={14} /> Archive
                          </button>
                        )}
                        {includeArchived && group.items.some(p => p.operator_archived_at) && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleGroupUnarchive(group.id, group.items); }} 
                            className="text-gray-600 hover:underline text-sm flex items-center gap-1 font-medium"
                          >
                            Unarchive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  
                  {/* Child Rows */}
                  {isExpanded && group.items.map(p => (
                    <tr 
                      key={p.id} 
                      onClick={() => {
                        setSelectedPayout(p);
                        setIsDrawerOpen(true);
                      }}
                      className="border-b hover:bg-gray-50 transition-colors cursor-pointer bg-white"
                    >
                      <td className="p-2" onClick={(e) => e.stopPropagation()}>
                      </td>
                      <td className="p-2"></td>
                      <td className="p-2 pl-6 flex items-center gap-2">
                        {p.operator_archived_at && <span className="px-1 py-0.5 rounded text-[9px] bg-gray-100 text-gray-500 font-bold border border-gray-200">ARCHIVED</span>}
                        {p.provider_display_name}
                      </td>
                      <td className="p-2 text-sm text-gray-600 capitalize">{p.provider_type || 'Unknown'}</td>
                      <td className="p-2 text-sm text-gray-500">{formatDate(p.service_date)}</td>
                      <td className="p-2">{formatCurrency(getPayableAmount(p))}</td>
                      <td className="p-2">
                        <div className="flex flex-col gap-1">
                          {p.is_on_hold ? (
                            <span className="px-2 py-1 rounded text-[10px] bg-red-100 text-red-800 font-bold uppercase flex items-center gap-1 w-fit border border-red-200">
                              <ShieldAlert size={10} /> ON HOLD
                            </span>
                          ) : (
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase w-fit border ${
                              p.status === 'paid' ? 'bg-green-50 text-green-700 border-green-100' : 
                              p.status === 'approved' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' : 
                              'bg-blue-50 text-blue-700 border-blue-100'
                            }`}>
                              {p.status === 'paid' ? 'Paid' :
                               p.status === 'approved' ? 'Available' :
                               p.status === 'pending' ? 'Pending Authorization' :
                               PAYOUT_STATUS_LABELS[p.status] || p.status.toUpperCase()}
                            </span>
                          )}
                          {p.adjustment_reason && (
                             <p className="text-[10px] text-gray-500 italic line-clamp-1 max-w-[120px]" title={p.adjustment_reason}>
                               "{p.adjustment_reason}"
                             </p>
                          )}
                        </div>
                        {p.status === 'paid' && p.paid_at && <div className="text-[10px] text-gray-400 font-mono mt-1">{formatDate(p.paid_at)}</div>}
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPayout(p);
                              setIsDrawerOpen(true);
                            }}
                            className="text-gray-400 hover:text-brand-teal transition-colors"
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>
                          {p.status === 'paid' && !p.operator_archived_at && <button onClick={(e) => { e.stopPropagation(); handleArchive(p.id); }} className="text-gray-600 hover:underline text-sm flex items-center gap-1 font-medium"><Archive size={14} /> Archive</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};
