import React from 'react';

interface ConstructionBannerProps {
  message?: string;
  subMessage?: string;
}

export const ConstructionBanner: React.FC<ConstructionBannerProps> = ({
  message = 'UNDER CONSTRUCTION — BUT THE DATA WORKS.',
  subMessage = 'BEST VIEWED WITH 800x600 RESOLUTION & NETSCAPE NAVIGATOR'
}) => {
  return (
    <div className="my-2 bevel-outset p-1 bg-[#c0c0c0] select-none">
      <div className="construction-stripes h-3 w-full border border-black mb-1"></div>
      <div className="flex flex-col sm:flex-row items-center justify-between px-3 py-1 bg-[#ffffe0] border border-black gap-2 text-center sm:text-left">
        <div className="flex items-center gap-2">
          <span className="text-xl animate-bounce">⚠️</span>
          <div>
            <div className="text-xs font-black tracking-wide text-[#800000]">{message}</div>
            <div className="text-[10px] text-[#555555] font-mono">{subMessage}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="blink px-1.5 py-0.5 bg-[#ff0000] text-white font-bold text-[10px] border border-black">
            NEW!
          </span>
          <span className="px-1.5 py-0.5 bg-[#00aa00] text-white font-bold text-[10px] border border-black">
            100% ANALYTICALLY VERIFIED*
          </span>
        </div>
      </div>
      <div className="construction-stripes h-3 w-full border border-black mt-1"></div>
    </div>
  );
};
