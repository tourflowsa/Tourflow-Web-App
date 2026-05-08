
import React from 'react';
import { 
  X, 
  AlertCircle, 
  AlertTriangle, 
  ArrowUpRight, 
  Calendar, 
  User, 
  CreditCard, 
  ShieldAlert,
  Search,
  Truck
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/formatUtils';
import { useNavigate } from 'react-router-dom';

interface ReadinessDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'bank' | 'compliance' | 'disputes' | 'escrow';
  items: any[];
}

export const ReadinessDetailModal: React.FC<ReadinessDetailModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  type, 
  items 
}) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const getActionLabel = (item: any) => {
    switch (type) {
      case 'bank': return 'Add bank details';
      case 'compliance': return 'Update documents';
      case 'disputes': return 'View dispute';
      case 'escrow': return 'Check funding';
      default: return 'Resolve issue';
    }
  };

  const getActionLink = (item: any) => {
    switch (type) {
      case 'bank':
      case 'compliance':
        return `/operator/directory/${item.provider_id}`;
      case 'disputes':
      case 'escrow':
        return `/operator/bookings/${item.booking_id}`;
      default:
        return '#';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-charcoal/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${
              type === 'bank' ? 'bg-blue-100 text-blue-600' :
              type === 'compliance' ? 'bg-purple-100 text-purple-600' :
              type === 'disputes' ? 'bg-red-100 text-red-600' :
              'bg-amber-100 text-amber-600'
            }`}>
              {type === 'bank' ? <CreditCard size={20} /> :
               type === 'compliance' ? <ShieldAlert size={20} /> :
               type === 'disputes' ? <AlertCircle size={20} /> :
               <AlertTriangle size={20} />}
            </div>
            <div>
              <h3 className="font-bold text-brand-charcoal text-lg">{title}</h3>
              <p className="text-xs text-gray-400 font-medium">Found {items.length} affected items</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {items.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="text-gray-300" size={32} />
              </div>
              <p className="text-gray-500 font-medium">No issues found for this category.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {(type === 'bank' || type === 'compliance') ? (
                // Grouped by Provider
                Object.entries(
                  items.reduce((acc, item) => {
                    const key = item.vehicle_id || item.provider_id;
                    if (!acc[key]) {
                      let name = item.provider_name;
                      if (name === 'Vehicle Provider' && item.vehicle_name) name = item.vehicle_name;
                      acc[key] = { name, type: item.provider_type, items: [] };
                    }
                    acc[key].items.push(item);
                    return acc;
                  }, {} as Record<string, { name: string, type: string, items: any[] }>)
                ).map(([groupId, group]: [string, any]) => (
                  <div key={groupId} className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-gray-400" />
                        <span className="text-sm font-bold text-gray-700">{group.name}</span>
                        <span className="text-[10px] text-gray-400 uppercase font-bold px-1.5 py-0.5 bg-white border border-gray-200 rounded">{group.type}</span>
                      </div>
                      {!group.items.some((i: any) => i.document_name === 'Vehicle Requirement') && (
                        <button 
                          onClick={() => {
                            onClose();
                            navigate(`/operator/directory/${group.items[0].provider_id}`);
                          }}
                          className="text-[10px] font-bold text-brand-teal hover:underline flex items-center gap-1"
                        >
                          View Profile <ArrowUpRight size={10} />
                        </button>
                      )}
                    </div>
                    <div className="divide-y divide-gray-50">
                      {group.items.map((item: any, idx: number) => (
                        <div key={`${item.booking_id}-${idx}`} className="p-4 hover:bg-gray-50/50 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-3 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                  {item.booking_ref}
                                </span>
                                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                  <Calendar size={10} /> {formatDate(item.start_date)}
                                </span>
                              </div>

                              <div className="flex flex-wrap gap-x-6 gap-y-2">
                                {type === 'compliance' ? (
                                  <>
                                    <div className="min-w-[120px]">
                                      <p className="text-[10px] text-gray-400 uppercase font-bold leading-none mb-1">Document</p>
                                      <p className="text-xs font-bold text-gray-700">
                                        {item.document_name}
                                        {item.vehicle_name && (
                                          <span className="ml-1 text-brand-teal font-medium flex items-center gap-1">
                                            <Truck size={10} /> {item.vehicle_name}
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-gray-400 uppercase font-bold leading-none mb-1">Status</p>
                                      <p className={`text-xs font-bold ${
                                        item.issue_type === 'Expired' || item.issue_type === 'Rejected' ? 'text-red-600' : 'text-amber-600'
                                      }`}>
                                        {item.issue_type === 'Compliance Blocker' ? 'Compliance Action Required' : item.issue_type}
                                      </p>
                                    </div>
                                    {item.expiry_date && (
                                      <div>
                                        <p className="text-[10px] text-gray-400 uppercase font-bold leading-none mb-1">Expiry</p>
                                        <p className="text-xs font-bold text-gray-500">{formatDate(item.expiry_date)}</p>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div>
                                    <p className="text-[10px] text-gray-400 uppercase font-bold leading-none mb-1">Issue</p>
                                    <p className="text-xs font-bold text-red-600">Bank Details Missing</p>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              <button 
                                onClick={() => {
                                  onClose();
                                  navigate(`/operator/bookings/${item.booking_id}`);
                                }}
                                className="px-3 py-1.5 bg-white border border-gray-200 text-gray-500 text-[10px] font-bold uppercase rounded-lg hover:border-brand-teal hover:text-brand-teal transition-all flex items-center gap-1.5"
                              >
                                Booking <ArrowUpRight size={12} />
                              </button>
                              {item.vehicle_id && (
                                <button 
                                  onClick={() => {
                                    onClose();
                                    navigate(`/operator/vehicles/${item.vehicle_id}`);
                                  }}
                                  className="px-3 py-1.5 bg-brand-teal/5 border border-brand-teal/20 text-brand-teal text-[10px] font-bold uppercase rounded-lg hover:bg-brand-teal hover:text-white transition-all flex items-center gap-1.5"
                                >
                                  Vehicle <ArrowUpRight size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                // Ungrouped (Disputes/Escrow)
                items.map((item, idx) => (
                  <div 
                    key={`${item.booking_id}-${idx}`}
                    className="p-4 rounded-2xl border border-gray-100 bg-white hover:border-brand-teal/30 hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {item.booking_ref}
                          </span>
                          <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <Calendar size={10} /> {formatDate(item.start_date)}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-x-6 gap-y-2">
                          {type === 'disputes' && (
                            <>
                              <div>
                                <p className="text-[10px] text-gray-400 uppercase font-bold leading-none mb-1">Status</p>
                                <p className="text-xs font-bold text-amber-600 uppercase">{item.dispute_status.replace('_', ' ')}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-gray-400 uppercase font-bold leading-none mb-1">Financial Impact</p>
                                <p className="text-xs font-bold text-red-600">{formatCurrency(item.impact_amount)}</p>
                              </div>
                            </>
                          )}

                          {type === 'escrow' && (
                            <>
                              <div>
                                <p className="text-[10px] text-gray-400 uppercase font-bold leading-none mb-1">Expected Payout</p>
                                <p className="text-xs font-bold text-brand-charcoal">{formatCurrency(item.expected_payout)}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-red-400 uppercase font-bold leading-none mb-1">Shortfall</p>
                                <p className="text-xs font-bold text-red-600">{formatCurrency(item.shortfall_amount)}</p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <button 
                        onClick={() => {
                          onClose();
                          navigate(getActionLink(item));
                        }}
                        className="px-4 py-2 bg-gray-50 text-brand-teal text-[10px] font-bold uppercase rounded-xl hover:bg-brand-teal hover:text-white transition-all flex items-center gap-2"
                      >
                        {getActionLabel(item)}
                        <ArrowUpRight size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-brand-charcoal text-white font-bold rounded-xl text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
