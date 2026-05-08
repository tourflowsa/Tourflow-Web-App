
import React, { useEffect, useState } from 'react';
import { fetchSystemAuditLogs, AuditLogEntry } from '../../lib/auditService';
import { FileCheck, Search, Loader2, User, Tag, AlertCircle, Calendar, Hash, ExternalLink, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

export const SystemAudit: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [entityTableFilter, setEntityTableFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    loadLogs();
  }, [actionFilter, entityTableFilter, roleFilter, dateFilter, searchFilter]);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      let endDateString = undefined;
      if (dateFilter) {
        const nextDay = new Date(dateFilter);
        nextDay.setDate(nextDay.getDate() + 1);
        endDateString = nextDay.toISOString().split('T')[0];
      }

      const data = await fetchSystemAuditLogs({
        action: actionFilter || undefined,
        entityTable: entityTableFilter || undefined,
        actorRole: roleFilter || undefined,
        entityId: searchFilter || undefined,
        startDate: dateFilter || undefined,
        endDate: endDateString
      });
      
      setLogs(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  const uniqueEntityTypes = ['user', 'profile', 'tour', 'booking', 'payout', 'fee_tier', 'operator_fee_assignment', 'vehicle', 'document', 'assignment'];
  const actorRoles = ['admin', 'operator', 'guide', 'driver', 'vehicle_owner', 'system'];

  const renderMetadataSummary = (metadata: any) => {
    if (!metadata || Object.keys(metadata).length === 0) return <span className="text-gray-400 italic">None</span>;
    
    // Pick out some interesting keys to summarize
    const summaryKeys = ['booking_reference', 'status', 'amount', 'reason', 'notes', 'email', 'id'];
    const summary: string[] = [];
    
    summaryKeys.forEach(key => {
      if (metadata[key]) {
        summary.push(`${key}: ${metadata[key]}`);
      }
    });

    if (summary.length === 0) {
      // If none of the summary keys match, just show the first few keys
      const allKeys = Object.keys(metadata).slice(0, 3);
      allKeys.forEach(key => {
        summary.push(`${key}: ${metadata[key]}`);
      });
    }

    return (
      <div className="group relative">
        <div className="text-xs text-gray-500 max-w-[200px] truncate">
          {summary.join(' | ')}
        </div>
        <div className="hidden group-hover:block absolute z-10 bottom-full left-0 mb-2 p-3 bg-gray-900 text-white text-[10px] font-mono rounded shadow-xl min-w-[300px] max-h-48 overflow-y-auto whitespace-pre-wrap">
          {JSON.stringify(metadata, null, 2)}
        </div>
      </div>
    );
  };

  const getEntityLink = (log: AuditLogEntry) => {
    if (!log.entity_id) return null;

    if (log.entity_type === 'booking') {
      return (
        <Link 
          to={`/admin/bookings/${log.entity_id}`}
          className="text-brand-teal hover:underline flex items-center gap-1 group"
        >
          <Hash size={12} />
          {log.metadata?.booking_reference || log.entity_id.substring(0, 8)}
          <ExternalLink size={10} className="opacity-0 group-hover:opacity-100" />
        </Link>
      );
    }

    if (log.entity_type === 'payout') {
      return (
        <Link 
          to={`/admin/payouts/${log.entity_id}`}
          className="text-brand-teal hover:underline flex items-center gap-1 group"
        >
          <Hash size={12} />
          {log.entity_id.substring(0, 8)}
          <ExternalLink size={10} className="opacity-0 group-hover:opacity-100" />
        </Link>
      );
    }

    if (log.entity_type === 'profile' || log.entity_type === 'user') {
       return (
        <Link 
          to={`/admin/verification/${log.entity_id}`}
          className="text-brand-teal hover:underline flex items-center gap-1 group"
        >
          <Hash size={12} />
          {log.entity_id.substring(0, 8)}
          <ExternalLink size={10} className="opacity-0 group-hover:opacity-100" />
        </Link>
      );
    }

    return (
      <span className="text-gray-500 flex items-center gap-1 font-mono text-[10px]">
        <Hash size={10} />
        {log.entity_id.substring(0, 8)}...
      </span>
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-charcoal flex items-center gap-3">
            <FileCheck className="text-brand-teal" size={32} />
            System Audit Log
          </h1>
          <p className="text-gray-500 mt-2">Track all system actions, state changes, and security events across the platform.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 bg-white px-4 py-2 rounded-lg border border-gray-200">
          <Activity size={14} className="text-brand-teal" />
          REFRESHING AUTOMATICALLY
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-gray-100 bg-gray-50 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
           {/* Date Range Start */}
           <div className="relative group">
             <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Date</label>
             <div className="relative">
               <Calendar className="absolute left-3 top-2.5 text-gray-400" size={14} />
               <input 
                 type="date" 
                 className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-teal bg-white"
                 value={dateFilter}
                 onChange={e => setDateFilter(e.target.value)}
               />
             </div>
           </div>

           {/* Role Filter */}
           <div className="relative group">
             <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Actor Role</label>
             <div className="relative">
               <User className="absolute left-3 top-2.5 text-gray-400" size={14} />
               <select 
                 className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg bg-white text-xs focus:outline-none focus:border-brand-teal appearance-none cursor-pointer"
                 value={roleFilter}
                 onChange={e => setRoleFilter(e.target.value)}
               >
                 <option value="">All Roles</option>
                 {actorRoles.map(r => <option key={r} value={r}>{r}</option>)}
               </select>
             </div>
           </div>

           {/* Entity Table Filter */}
           <div className="relative group">
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Entity Type</label>
              <div className="relative">
                <Tag className="absolute left-3 top-2.5 text-gray-400" size={14} />
                <select 
                  className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg bg-white text-xs focus:outline-none focus:border-brand-teal appearance-none cursor-pointer"
                  value={entityTableFilter}
                  onChange={e => setEntityTableFilter(e.target.value)}
                >
                  <option value="">All Entities</option>
                  {uniqueEntityTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
           </div>

           {/* Action Filter */}
           <div className="relative lg:col-span-1">
             <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Action keyword</label>
             <div className="relative">
               <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
               <input 
                 type="text" 
                 placeholder="e.g. create, update..."
                 className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-teal bg-white"
                 value={actionFilter}
                 onChange={e => setActionFilter(e.target.value)}
               />
             </div>
           </div>

           {/* ID Search Filter */}
           <div className="relative lg:col-span-2">
             <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Entity ID Search</label>
             <div className="relative">
               <Hash className="absolute left-3 top-2.5 text-gray-400" size={14} />
               <input 
                 type="text" 
                 placeholder="Search by exact Entity ID..."
                 className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-brand-teal bg-white"
                 value={searchFilter}
                 onChange={e => setSearchFilter(e.target.value)}
               />
             </div>
           </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-white border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Actor / Role</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Entity</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Metadata Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="animate-spin text-brand-teal" /> 
                      <span className="font-medium">Loading audit events...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                        <FileCheck size={32} className="text-gray-200" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-300">No events found</p>
                        <p className="text-sm">Try adjusting your filters to see more results.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log, index) => (
                  <tr key={`${log.created_at}-${index}`} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-700">
                          {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="text-[10px]">
                          {new Date(log.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                         <span className={`text-[10px] font-bold uppercase ${
                           log.actor_role === 'admin' ? 'text-brand-coral' : 
                           log.actor_role === 'system' ? 'text-blue-500' : 'text-brand-teal'
                         }`}>
                           {log.actor_role}
                         </span>
                         <span className="text-xs text-brand-charcoal font-medium flex items-center gap-1">
                           <User size={10} className="text-gray-400" /> 
                           {log.actor_id?.substring(0, 8) || 'System'}
                         </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-gray-100 text-gray-800 border border-gray-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                          {log.entity_type}
                        </span>
                        <div className="text-xs">
                          {getEntityLink(log)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {renderMetadataSummary(log.metadata)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        {!loading && logs.length > 0 && (
          <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
            <span>Showing latest {logs.length} events</span>
            <span className="italic">Hover over metadata to see full JSON payload</span>
          </div>
        )}
      </div>
    </div>
  );
};
