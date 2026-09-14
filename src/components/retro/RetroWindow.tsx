import React from 'react';
import { playRetroClick } from '../../utils/audio.js';

interface RetroWindowProps {
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  menuItems?: string[];
  statusBarText?: string;
  isActive?: boolean;
  style?: React.CSSProperties;
}

export const RetroWindow: React.FC<RetroWindowProps> = ({
  title,
  children,
  icon,
  className = '',
  onClose,
  onMinimize,
  onMaximize,
  menuItems,
  statusBarText,
  isActive = true,
  style
}) => {
  return (
    <div
      className={`bevel-outset flex flex-col select-none overflow-hidden ${className}`}
      style={{ minWidth: 260, ...style }}
    >
      {/* Title Bar */}
      <div className={`retro-titlebar ${!isActive ? 'retro-titlebar-inactive' : ''}`}>
        <div className="flex items-center gap-1.5 overflow-hidden">
          {icon && <span className="flex-shrink-0 text-sm">{icon}</span>}
          <span className="truncate font-bold tracking-wide">{title}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {onMinimize && (
            <button
              className="retro-titlebar-btn"
              onClick={() => {
                playRetroClick();
                onMinimize();
              }}
              title="Minimize"
              aria-label="Minimize window"
            >
              _
            </button>
          )}
          {onMaximize && (
            <button
              className="retro-titlebar-btn"
              onClick={() => {
                playRetroClick();
                onMaximize();
              }}
              title="Maximize"
              aria-label="Maximize window"
            >
              □
            </button>
          )}
          {onClose && (
            <button
              className="retro-titlebar-btn"
              onClick={() => {
                playRetroClick();
                onClose();
              }}
              title="Close"
              aria-label="Close window"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Menu Bar if provided */}
      {menuItems && menuItems.length > 0 && (
        <div className="flex items-center gap-3 px-2 py-0.5 border-b border-[#808080] bg-[#c0c0c0] text-xs">
          {menuItems.map((item, idx) => (
            <span
              key={idx}
              className="cursor-pointer hover:bg-[#000080] hover:text-white px-1.5 py-0.5"
              onClick={playRetroClick}
            >
              <span className="underline">{item.charAt(0)}</span>
              {item.slice(1)}
            </span>
          ))}
        </div>
      )}

      {/* Content Area */}
      <div className="p-3 bg-[#c0c0c0] flex-1 overflow-auto select-text">
        {children}
      </div>

      {/* Status Bar */}
      {statusBarText && (
        <div className="bevel-inset-gray px-2 py-0.5 text-[11px] text-[#404040] flex items-center justify-between border-t border-[#808080]">
          <span>{statusBarText}</span>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#00aa00] inline-block border border-black"></span>
            <span>READY</span>
          </div>
        </div>
      )}
    </div>
  );
};
