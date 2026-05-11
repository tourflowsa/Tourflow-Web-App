import React from 'react';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackText?: string;
  className?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({ 
  src, 
  alt, 
  className = '', 
  fallbackText,
  ...props 
}) => {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      {...props}
    />
  );
};
