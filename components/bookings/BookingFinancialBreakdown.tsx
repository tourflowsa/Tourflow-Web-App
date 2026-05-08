import React, { useState } from 'react';
import { 
  ChevronDown,
  ChevronUp,
  DollarSign, 
  Wallet, 
  Scale, 
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink
} from 'lucide-react';
import { BookingFinancialBreakdown, ProviderBreakdown } from '../../lib/financialService';
import { formatCurrency } from '../../lib/formatUtils';
import { Link } from 'react-router-dom';

interface Props {
  data: BookingFinancialBreakdown;
  isAdmin?: boolean;
}

export const BookingFinancialBreakdownView: React.FC<Props> = ({ data, isAdmin = false }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Defensive guards
  const providers = data?.providers || [];
  const total_provider_cost = data?.total_provider_cost ?? 0;
  const currency = data?.currency || 'ZAR';

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid': return 'text-green-600 bg-green-50 border-green-100';
      case 'approved': 
      case 'resolved_approved':
        return 'text-blue-600 bg-blue-50 border-blue-100';
      case 'pending': return 'text-amber-600 bg-amber-50 border-amber-100';
      case 'disputed': 
      case 'on_hold':
        return 'text-red-600 bg-red-50 border-red-100';
      case 'resolved_reduced':
        return 'text-indigo-600 bg-indigo-50 border-indigo-100';
      default: return 'text-gray-600 bg-gray-50 border-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid': return <CheckCircle2 size={12} />;
      case 'approved': 
      case 'resolved_approved':
      case 'resolved_reduced':
        return <CheckCircle2 size={12} className="opacity-70" />;
      case 'pending': return <Clock size={12} />;
      case 'disputed':
      case 'on_hold':
        return <AlertCircle size={12} />;
      default: return <AlertCircle size={12} />;
    }
  };

  const getStatusLabel = (status: string, isDisputed: boolean) => {
    if (isDisputed) return 'Disputed';
    switch (status?.toLowerCase()) {
      case 'resolved_reduced': return 'Resolved, Reduced';
      case 'resolved_approved': return 'Resolved, Approved';
      case 'on_hold': return 'On Hold';
      default: return status.replace(/_/g, ' ');
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <h3 className="font-bold text-brand-charcoal flex items-center gap-2">
            <DollarSign size={18} className="text-brand-teal" /> Booking Financial Summary
          </h3>
          <div className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">
            Ref: {data.booking_ref}
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Gross Revenue</p>
            <p className="text-2xl font-mono font-bold text-brand-charcoal whitespace-nowrap">
              {formatCurrency(data?.total_revenue || 0, currency)}
            </p>
          </div>
          
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Platform Fee</p>
            <p className="text-2xl font-mono font-bold text-brand-coral whitespace-nowrap">
              -{formatCurrency(data?.platform_fee || 0, currency)}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Provider Costs</p>
            <p className="text-2xl font-mono font-bold text-gray-600 whitespace-nowrap">
              {formatCurrency(total_provider_cost, currency)}
            </p>
            <p className="text-[10px] text-gray-400 flex items-center gap-1">
              {providers.length} provider slots active
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Net Margin</p>
            <p className={`text-2xl font-mono font-bold whitespace-nowrap ${(data?.net_margin || 0) < 0 ? 'text-red-600' : 'text-brand-teal'}`}>
              {formatCurrency(data?.net_margin || 0, currency)}
            </p>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-8">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-600" />
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase">Settled</p>
              <p className="text-xs font-mono font-bold text-brand-charcoal whitespace-nowrap">{formatCurrency(data?.total_paid_out || 0, currency)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Clock size={16} className="text-amber-600" />
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase">Outstanding Payouts</p>
              <p className="text-xs font-mono font-bold text-brand-charcoal whitespace-nowrap">{formatCurrency(data?.outstanding_payout || 0, currency)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600" />
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase">In Dispute</p>
              <p className="text-xs font-mono font-bold text-brand-charcoal whitespace-nowrap">{formatCurrency(data?.dispute_amount || 0, currency)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-0 lg:ml-auto">
            <Wallet size={16} className="text-blue-600" />
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase">Escrow Held</p>
              <p className="text-xs font-mono font-bold text-brand-charcoal whitespace-nowrap">{formatCurrency(data?.escrow_amount || 0, currency)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Provider Breakdown */}
      {providers.length > 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <Scale size={18} className="text-gray-400 group-hover:text-brand-teal transition-colors" />
              <h3 className="font-bold text-brand-charcoal">Provider cost breakdown</h3>
              <span className="bg-gray-100 text-gray-500 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">
                {providers.length} Resources
              </span>
            </div>
            {isExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
          </button>

          {isExpanded && (
            <div className="border-t border-gray-100 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">Provider</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">Role</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">Agreed Rate</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 text-right">Adjustment</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 text-right">Net Payout</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {providers.map((p: ProviderBreakdown, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-brand-charcoal truncate max-w-[200px]">
                            {p.provider_name}
                          </span>
                          {isAdmin && (
                            <Link 
                              to={`/admin/users/${p.provider_id}`}
                              className="text-[10px] text-brand-teal hover:underline flex items-center gap-1 mt-0.5"
                            >
                              <ExternalLink size={8} /> View details
                            </Link>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-gray-500 font-medium capitalize">{p.provider_type}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs font-bold text-gray-600">
                        {formatCurrency(p.agreed_rate, currency)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs font-bold text-brand-coral text-right">
                        {p.payout_amount < p.agreed_rate ? `- ${formatCurrency(p.agreed_rate - p.payout_amount, currency)}` : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs font-bold text-brand-charcoal text-right">
                        {formatCurrency(p.payout_amount, currency)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1 w-max">
                          <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase w-fit ${getStatusColor(p.payout_status)}`}>
                            {getStatusIcon(p.payout_status)}
                            {getStatusLabel(p.payout_status, p.is_disputed)}
                          </div>
                          {(p as any).resolution_status && p.payout_status.toLowerCase() === 'paid' && (
                            <p className="text-[10px] text-brand-teal font-bold px-1 flex items-center gap-1">
                              <CheckCircle2 size={10} /> {getStatusLabel((p as any).resolution_status, false)}
                            </p>
                          )}
                          {p.adjustment_reason && (
                            <p className="text-[10px] text-gray-500 italic line-clamp-1 max-w-[150px]" title={p.adjustment_reason}>
                              "{p.adjustment_reason}"
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50/50 font-bold border-t border-gray-100">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-right text-xs uppercase text-gray-400">Total Costs</td>
                    <td className="px-4 py-3 font-mono text-sm text-brand-charcoal whitespace-nowrap">{formatCurrency(total_provider_cost, currency)}</td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 font-mono text-sm text-brand-charcoal text-right whitespace-nowrap">Settled: {formatCurrency(data?.total_paid_out || 0, currency)}</td>
                    <td className="px-4 py-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden p-6 text-center">
          <Scale size={24} className="text-gray-300 mx-auto mb-3" />
          <h3 className="font-bold text-brand-charcoal mb-1">Provider cost breakdown</h3>
          <p className="text-sm text-gray-500">
            Provider-level payout breakdown will appear once resources are assigned.
          </p>
        </div>
      )}
    </div>
  );
};
