import React, { useEffect, useState } from 'react';
import { BevelButton } from '../retro/BevelButton.js';
import { playRetroClick } from '../../utils/audio.js';

interface TaskbarProps {
  activeWindowName?: string;
  onStartClick?: () => void;
  onOpenSettings?: () => void;
}

export const Taskbar: React.FC<TaskbarProps> = ({
  activeWindowName = 'DATAFORGE 95',
  onStartClick,
  onOpenSettings
}) => {
  const [timeStr, setTimeStr] = useState('');
  const [startMenuOpen, setStartMenuOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleStart = () => {
    playRetroClick();
    setStartMenuOpen(!startMenuOpen);
    if (onStartClick) onStartClick();
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 h-9 bg-[#c0c0c0] bevel-outset z-50 flex items-center justify-between px-1 select-none border-t border-white">
      {/* Start Button & Active Window Tabs */}
      <div className="flex items-center gap-1.5 h-full py-0.5">
        <BevelButton
          onClick={handleStart}
          active={startMenuOpen}
          className="h-full px-2 font-bold text-xs flex items-center gap-1.5 bg-[#c0c0c0]"
        >
          <div className="w-3.5 h-3.5 grid grid-cols-2 grid-rows-2 gap-[1px]">
            <div className="bg-[#ff0000]"></div>
            <div className="bg-[#00aa00]"></div>
            <div className="bg-[#0000ff]"></div>
            <div className="bg-[#ffff00]"></div>
          </div>
          <span>Start</span>
        </BevelButton>

        <div className="h-5 w-[2px] border-l border-[#808080] border-r border-white mx-0.5"></div>

        {/* Active Task Window Button */}
        <div className="bevel-inset-gray px-3 py-1 text-xs font-bold flex items-center gap-1.5 max-w-[220px] truncate text-black">
          <span className="w-2.5 h-2.5 bg-[#000080] inline-block border border-white"></span>
          <span className="truncate">{activeWindowName}</span>
        </div>
      </div>

      {/* Start Menu Popup */}
      {startMenuOpen && (
        <div
          className="absolute bottom-9 left-1 w-56 bevel-outset bg-[#c0c0c0] p-1 shadow-2xl flex z-50"
          onClick={() => setStartMenuOpen(false)}
        >
          {/* Windows 95 vertical side banner */}
          <div className="w-7 bg-[#000080] text-white flex items-end justify-center pb-2 select-none border-r border-black">
            <span
              className="font-bold text-xs tracking-widest uppercase font-mono"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              DATAFORGE 95
            </span>
          </div>

          <div className="flex-1 flex flex-col py-1 text-xs">
            <div
              className="px-3 py-1.5 hover:bg-[#000080] hover:text-white cursor-pointer flex items-center gap-2"
              onClick={() => {
                if (onOpenSettings) onOpenSettings();
              }}
            >
              <span>⚙️</span>
              <span>System Settings...</span>
            </div>
            <div className="groove-hr my-1"></div>
            <div
              className="px-3 py-1.5 hover:bg-[#000080] hover:text-white cursor-pointer flex items-center gap-2"
              onClick={() => alert('DATAFORGE 95 - 32-Bit Multi-Threading Enabled.')}
            >
              <span>ℹ️</span>
              <span>About DATAFORGE 95</span>
            </div>
            <div
              className="px-3 py-1.5 hover:bg-[#000080] hover:text-white cursor-pointer flex items-center gap-2"
              onClick={() => window.location.reload()}
            >
              <span>🔄</span>
              <span>Restart System...</span>
            </div>
          </div>
        </div>
      )}

      {/* System Tray with Clock */}
      <div className="bevel-inset-gray h-7 px-2 flex items-center gap-2 text-xs font-mono text-black">
        <span className="text-xs" title="100% Signal">
          📶
        </span>
        <span className="text-xs" title="Audio Device Active">
          🔊
        </span>
        <span className="font-bold text-[11px] tracking-wide">{timeStr}</span>
      </div>
    </div>
  );
};
