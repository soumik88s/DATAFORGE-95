import React from 'react';
import { playRetroClick } from '../../utils/audio.js';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

interface RetroTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export const RetroTabs: React.FC<RetroTabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className = ''
}) => {
  return (
    <div className={`flex flex-wrap items-end gap-1 select-none border-b-2 border-[#ffffff] pb-0 -mb-[2px] z-10 ${className}`}>
      {tabs.map(tab => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => {
              playRetroClick();
              onChange(tab.id);
            }}
            className={`px-3 py-1.5 text-xs font-bold transition-none flex items-center gap-1.5 cursor-pointer relative ${
              isActive
                ? 'bg-[#c0c0c0] text-black border-t-2 border-l-2 border-r-2 border-t-white border-l-white border-r-[#808080] -mb-[2px] pb-2 z-20 shadow-none'
                : 'bg-[#b0b0b0] text-[#404040] hover:text-black border border-[#808080] mb-0'
            }`}
            style={{
              boxShadow: isActive ? 'inset 1px 1px 0 #ffffff, inset -1px 0 0 #404040' : undefined
            }}
          >
            {tab.icon && <span>{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className="px-1 py-0.2 bg-black text-[#00ff00] text-[10px] font-mono">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
