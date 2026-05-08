import React from 'react';
import { BookingStatus } from '../../types';
import { CheckCircle2, AlertCircle, XCircle, Clock } from 'lucide-react';

interface Props {
  status: BookingStatus | string;
  className?: string;
}

export const BookingStatusBadge: React.FC<Props> = ({ status, className = '' }) => {
  const baseClasses = "px-2 py-1 rounded text-xs font-bold uppercase flex items-center gap-1.5 w-fit";
  
  switch(status) {
    case 'confirmed':
      return (
        <span className={`${baseClasses} bg-green-100 text-green-700 ${className}`}>
          <CheckCircle2 size={12} /> Confirmed
        </span>
      );
    case 'completed':
      return (
        <span className={`${baseClasses} bg-gray-100 text-gray-700 ${className}`}>
          <CheckCircle2 size={12} /> Completed
        </span>
      );
    case 'cancelled':
      return (
        <span className={`${baseClasses} bg-red-100 text-red-700 ${className}`}>
          <XCircle size={12} /> Cancelled
        </span>
      );
    case 'pending':
      return (
        <span className={`${baseClasses} bg-amber-100 text-amber-700 ${className}`}>
          <Clock size={12} /> Pending
        </span>
      );
    case 'draft':
      return (
        <span className={`${baseClasses} bg-blue-50 text-blue-600 border border-blue-100 ${className}`}>
          <Clock size={12} /> Draft
        </span>
      );
    default:
      return (
        <span className={`${baseClasses} bg-gray-100 text-gray-500 ${className}`}>
          <AlertCircle size={12} /> {status}
        </span>
      );
  }
};