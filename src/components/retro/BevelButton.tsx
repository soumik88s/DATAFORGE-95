import React from 'react';
import { playRetroClick } from '../../utils/audio.js';

interface BevelButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'danger';
  active?: boolean;
}

export const BevelButton: React.FC<BevelButtonProps> = ({
  children,
  variant = 'default',
  active = false,
  className = '',
  onClick,
  ...props
}) => {
  const getVariantClass = () => {
    if (variant === 'primary') return 'retro-btn-primary';
    if (variant === 'danger') return 'retro-btn-danger';
    return '';
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    playRetroClick();
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button
      className={`retro-btn ${getVariantClass()} ${active ? 'pressed' : ''} ${className}`}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
};
