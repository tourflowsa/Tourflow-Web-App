import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fetchAuditLogsForEntity, AuditLogEntry } from '../../lib/auditService';
import { formatCurrency, formatDate } from '../../lib/formatUtils';
import { 
  Clock, 
  User as UserIcon, 
  ShieldAlert, 
  CheckCircle2, 
  Check, 
  Loader2,
  AlertCircle,
  ArrowRight,
  Wallet
} from 'lucide-react';

interface PayoutAuditTimelineProps {
  payoutId: string;
}

export const PayoutAuditTimeline: React.FC<PayoutAuditTimelineProps> = ({ payoutId }) => {
  const [loading, setLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [actors, setActors] = useState<Record<string, any>>({});

  useEffect(() => {
    if (payoutId) {
      loadAuditLogs();
    }
  }, [payoutId]);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const logs = await fetchAuditLogsForEntity('payout_ledger', payoutId);
      // Sort ascending as requested: oldest first
      const sortedLogs = [...logs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setAuditLogs(sortedLogs);

      // Fetch unique actor profiles
      const actorIds = Array.from(new Set(logs.map(log => log.actor_id).filter(Boolean)));
      if (actorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, company_name')
          .in('id', actorIds);
        
        const profileMap: Record<string, any> = {};
        profiles?.forEach(p => {
          profileMap[p.id] = p;
        });
        setActors(profileMap);
      }
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const getActionLabel = (action: string) => {
    const mapping: Record<string, string> = {
      'payout_created': 'Created',
      'withdrawal_requested': 'Requested',
      'withdrawal_approved': 'Approved',
      'withdrawal_rejected': 'Rejected',
      'payout_paid': 'Paid',
      'payout_on_hold': 'On Hold',
      'payout_released': 'Released',
      'dispute_opened': 'Disputed',
      'dispute_resolved': 'Resolved',
      'payout_adjusted': 'Adjusted'
    };
    return mapping[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm font-bold">Loading history...</span>
      </div>
    );
  }

  if (auditLogs.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
        <Clock className="mx-auto text-gray-300 mb-2" size={32} />
        <p className="text-gray-400 text-sm font-bold">No audit events recorded</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-100 before:to-transparent">
      {auditLogs.map((log, index) => {
        const actor = actors[log.actor_id];
        const actorName = actor ? (actor.company_name || actor.full_name) : 'System';
        
        const isHold = log.action.includes('hold') || log.action.includes('dispute_opened');
        const isPaid = log.action.includes('paid');
        const isApproved = log.action.includes('approved');
        const isRequested = log.action.includes('requested');
        const isAdjusted = log.action.includes('adjusted');

        return (
          <div key={index} className="relative flex items-start gap-6 group">
            <div className={`absolute left-0 mt-1.5 w-10 h-10 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10 transition-transform group-hover:scale-110 ${
              isHold ? 'bg-red-50 text-red-600' :
              isPaid ? 'bg-green-50 text-green-600' :
              isApproved ? 'bg-purple-50 text-purple-600' :
              isRequested ? 'bg-blue-50 text-blue-600' :
              isAdjusted ? 'bg-amber-50 text-amber-600' :
              'bg-gray-50 text-gray-600'
            }`}>
              {isHold ? <ShieldAlert size={16} /> :
               isPaid ? <CheckCircle2 size={16} /> :
               isApproved ? <Check size={16} /> :
               isRequested ? <ArrowRight size={16} /> :
               isAdjusted ? <Wallet size={16} /> :
               <Clock size={16} />}
            </div>
            <div className="ml-12 flex-1 pt-1">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-1 mb-1">
                <span className="text-sm font-bold text-brand-charcoal uppercase tracking-wide">
                  {getActionLabel(log.action)}
                </span>
                <span className="text-[10px] font-bold text-gray-400 uppercase">
                  {formatDate(log.created_at)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                <UserIcon size={12} />
                <span>{actorName}</span>
                <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[9px] font-bold uppercase">{log.actor_role}</span>
              </div>
              
              {log.metadata && (
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 space-y-2">
                  {(log.metadata.previous_status || log.metadata.new_status) && (
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase">
                      <span className="text-gray-400">{log.metadata.previous_status || 'NONE'}</span>
                      <ArrowRight size={10} className="text-gray-300" />
                      <span className="text-brand-teal">{log.metadata.new_status || 'NONE'}</span>
                    </div>
                  )}
                  
                  {log.metadata.reason && (
                    <p className="text-xs text-gray-600 italic">
                      <span className="font-bold text-gray-400 not-italic mr-1">Reason:</span>
                      "{log.metadata.reason}"
                    </p>
                  )}
                  {log.metadata.resolution && (
                    <p className="text-xs text-gray-600 italic">
                      <span className="font-bold text-gray-400 not-italic mr-1">Resolution:</span>
                      "{log.metadata.resolution}"
                    </p>
                  )}
                  {log.metadata.notes && (
                    <p className="text-xs text-gray-600 italic">
                      <span className="font-bold text-gray-400 not-italic mr-1">Notes:</span>
                      "{log.metadata.notes}"
                    </p>
                  )}

                  {log.action === 'payout_adjusted' && log.metadata.original_amount !== undefined && (
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase">
                      <span className="text-gray-400">{formatCurrency(log.metadata.original_amount)}</span>
                      <ArrowRight size={10} className="text-gray-300" />
                      <span className="text-brand-coral">{formatCurrency(log.metadata.adjusted_amount)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
