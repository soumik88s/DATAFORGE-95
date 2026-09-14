import React from 'react';

interface RetroInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const RetroInput: React.FC<RetroInputProps> = ({ label, className = '', ...props }) => {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-bold text-black select-none">{label}</label>}
      <input className={`retro-input w-full ${className}`} {...props} />
    </div>
  );
};

interface RetroSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const RetroSelect: React.FC<RetroSelectProps> = ({ label, children, className = '', ...props }) => {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-bold text-black select-none">{label}</label>}
      <select className={`retro-input bg-white cursor-pointer ${className}`} {...props}>
        {children}
      </select>
    </div>
  );
};
