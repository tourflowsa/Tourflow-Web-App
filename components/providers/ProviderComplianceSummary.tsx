
import React from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  XCircle, 
  AlertTriangle 
} from 'lucide-react';
import { ComplianceResult, ComplianceIssue } from '../../lib/compliance';

interface ProviderComplianceSummaryProps {
  compliance: ComplianceResult;
  title?: string;
  isOwner?: boolean;
}

export const ProviderComplianceSummary: React.FC<ProviderComplianceSummaryProps> = ({ 
  compliance, 
  title = "Compliance Status",
  isOwner = false
}) => {
  const issues = compliance.issues;
  
  const getIssueIcon = (problem: string) => {
    switch (problem) {
      case 'missing': return <AlertCircle size={16} className="text-gray-400" />;
      case 'pending': return <Clock size={16} className="text-amber-500" />;
      case 'rejected': return <XCircle size={16} className="text-red-500" />;
      case 'expired': return <XCircle size={16} className="text-red-500" />;
      case 'expiring_soon': return <AlertTriangle size={16} className="text-amber-500" />;
      default: return <CheckCircle2 size={16} className="text-green-500" />;
    }
  };

  const getProblemLabel = (problem: string) => {
    switch (problem) {
      case 'missing': return 'Missing';
      case 'pending': return 'Pending Review';
      case 'rejected': return 'Rejected';
      case 'expired': return 'Expired';
      case 'expiring_soon': return 'Expiring Soon';
      default: return 'Verified';
    }
  };

  const getProblemColor = (problem: string) => {
    switch (problem) {
      case 'missing': return 'bg-gray-100 text-gray-600';
      case 'pending': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'rejected': return 'bg-red-50 text-red-700 border-red-100';
      case 'expired': return 'bg-red-50 text-red-700 border-red-100';
      case 'expiring_soon': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-green-50 text-green-700 border-green-100';
    }
  };

  if (issues.length === 0 && compliance.status === 'compliant') {
    return (
      <div className="bg-green-50 rounded-2xl p-6 border border-green-100 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
          <CheckCircle2 size={24} />
        </div>
        <div>
          <h4 className="font-bold text-green-800">Fully Compliant</h4>
          <p className="text-sm text-green-700">All required documents are verified and up to date.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">{title}</h3>
        <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${
          compliance.status === 'compliant' ? 'bg-green-50 text-green-700 border-green-200' :
          compliance.status === 'warn_only' ? 'bg-amber-50 text-amber-700 border-amber-200' :
          'bg-red-50 text-red-700 border-red-200'
        }`}>
          {compliance.status.replace('_', ' ')}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {issues.map((issue, idx) => (
          <div key={`${issue.document_type}-${idx}`} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="shrink-0">{getIssueIcon(issue.problem)}</div>
              <div className="truncate">
                <div className="text-sm font-bold text-brand-charcoal truncate">{issue.title}</div>
                {issue.isRequired && <span className="text-[10px] text-gray-400 font-bold uppercase">Required</span>}
              </div>
            </div>
            <div className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border ${getProblemColor(issue.problem)}`}>
              {getProblemLabel(issue.problem)}
            </div>
          </div>
        ))}
        {/* Fill in with placeholders for items that ARE valid but not in issues list */}
        {/* Actually ComplianceResult only has issues. We might want to show verified items too for trust */}
      </div>

      {isOwner && (
        <p className="text-[10px] text-gray-400 italic">
          * As the owner, you can manage these documents in your account settings.
        </p>
      )}
    </div>
  );
};
