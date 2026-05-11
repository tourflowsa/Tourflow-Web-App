import React from 'react';

interface BrandLogoProps {
  className?: string;
  theme?: 'dark' | 'light';
  isReversed?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ className = '', theme = 'light', isReversed = false }) => {
  const src = isReversed ? '/tourflow-logo-reversed.png' : '/tourflow-logo.png';

  return (
    <img 
      src={src} 
      alt="TourFlow" 
      className={`object-contain ${className}`}
    />
  );
};
