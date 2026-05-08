import React from 'react';
import { Clock } from 'lucide-react';

interface Props {
  days: number;
  hours: number;
  className?: string;
  showIcon?: boolean;
}

export const TourDuration: React.FC<Props> = ({ days, hours, className = "", showIcon = true }) => {
  const parts = [];
  
  if (days > 0) parts.push(`${days} ${days === 1 ? 'Day' : 'Days'}`);
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'Hour' : 'Hours'}`);
  
  // Fallback if both are 0, though technically invalid for a tour
  if (parts.length === 0) parts.push("0 Hours");

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {showIcon && <Clock size={16} />}
      <span>{parts.join(' ')}</span>
    </div>
  );
};
