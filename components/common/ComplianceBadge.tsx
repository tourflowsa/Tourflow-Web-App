
import React, { useEffect, useState } from 'react';
import { Shield, AlertCircle, CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-react';
import { getComplianceForUser } from '../../lib/documentService';
import { getProviderComplianceForOperator } from '../../lib/compliance';
import { ComplianceSummary } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface ComplianceBadgeProps {
  userId: string;
  role?: any;
  showLabels?: boolean;
  className?: string;
  initialSummary?: ComplianceSummary | null;
  onStatusLoad?: (summary: ComplianceSummary | null) => void;
}

export const ComplianceBadge: React.FC<ComplianceBadgeProps> = ({ 
  userId, 
  role, 
  showLabels = true,
  className = "",
  initialSummary = null,
  onStatusLoad
}) => {
  const [summary, setSummary] = useState<ComplianceSummary | null>(initialSummary);
  const [loading, setLoading] = useState(!initialSummary);
  const { user, profile } = useAuth();

  useEffect(() => {
  if (initialSummary) {
    setSummary(initialSummary);
    setLoading(false);
    if (onStatusLoad) onStatusLoad(initialSummary);
    return;
  }
    const supportedRoles = ['driver', 'guide'];
    if (role && !supportedRoles.includes(role)) {
      setSummary(null);
      setLoading(false);
      if (onStatusLoad) onStatusLoad(null);
      return;
    }

  let mounted = true;
  const fetchCompliance = async () => {
      try {
        let data: ComplianceSummary;
        // If current user is operator/admin and checking another user, use the readiness-optimized check
        const isOperatorCheckingOther = (profile?.role === 'operator' || profile?.role === 'admin') && userId !== user?.id;
        
        if (isOperatorCheckingOther && role) {
           const result = await getProviderComplianceForOperator(userId, role);
           // Convert ComplianceResult to ComplianceSummary (simplified)
           data = {
             isCompliant: result.status === 'compliant' || result.status === 'warn_only',
             missingCount: result.issues.filter(i => i.problem === 'missing').length,
             expiredCount: result.issues.filter(i => i.problem === 'expired').length,
             expiringSoonCount: result.issues.filter(i => i.problem === 'expiring_soon').length,
             pendingReviewCount: result.issues.filter(i => i.problem === 'pending').length,
             rejectedCount: result.issues.filter(i => i.problem === 'rejected').length,
             validCount: 0, // Not strictly needed for badge
             totalRequired: result.issues.filter(i => i.isRequired).length
           } as any as ComplianceSummary;
        } else {
          data = await getComplianceForUser(userId, role);
        }

        if (mounted) {
          setSummary(data);
          if (onStatusLoad) onStatusLoad(data);
        }
      } catch (err) {
        console.error("Failed to fetch compliance for badge", err);
        if (mounted && onStatusLoad) onStatusLoad(null);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchCompliance();
    return () => { mounted = false; };
  }, [userId, role, initialSummary, user?.id, profile?.role, onStatusLoad]);

  if (loading) return <Loader2 size={14} className="animate-spin text-gray-300" />;
  if (!summary) return null;

  const { isCompliant, missingCount, expiredCount, expiringSoonCount, pendingReviewCount, rejectedCount } = summary;

  // Determine Overall Status
  let status: 'verified' | 'expired' | 'expiring_soon' | 'missing' | 'pending' | 'rejected' = 'verified';
  
  if (expiredCount > 0) status = 'expired';
  else if (rejectedCount > 0) status = 'rejected';
  else if (missingCount > 0) status = 'missing';
  else if (pendingReviewCount > 0) status = 'pending';
  else if (expiringSoonCount > 0) status = 'expiring_soon';
  else if (!isCompliant) status = 'missing';

  const getBadgeConfig = () => {
    switch (status) {
      case 'expired':
        return {
          color: 'bg-red-100 text-red-700 border-red-200',
          icon: <XCircle size={14} />,
          label: 'Expired Documentation'
        };
      case 'rejected':
        return {
          color: 'bg-red-50 text-red-600 border-red-100',
          icon: <AlertCircle size={14} />,
          label: 'Documents Rejected'
        };
      case 'pending':
        return {
          color: 'bg-blue-50 text-blue-600 border-blue-100',
          icon: <Clock size={14} />,
          label: 'Docs Pending Review'
        };
      case 'missing':
        return {
          color: 'bg-gray-100 text-gray-600 border-gray-200',
          icon: <AlertCircle size={14} />,
          label: 'Missing Documents'
        };
      case 'expiring_soon':
        return {
          color: 'bg-amber-100 text-amber-700 border-amber-200',
          icon: <Clock size={14} />,
          label: 'Expiring Soon'
        };
      case 'verified':
        return {
          color: 'bg-green-100 text-green-700 border-green-200',
          icon: <CheckCircle2 size={14} />,
          label: 'Fully Compliant'
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-500 border-gray-200',
          icon: <Shield size={14} />,
          label: 'Documentation'
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-2xl border text-[10px] font-bold uppercase transition-colors ${config.color} ${className}`}>
      {config.icon}
      {showLabels && <span>{config.label}</span>}
    </div>
  );
};
