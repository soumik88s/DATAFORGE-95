import React from 'react';

interface MarqueeBannerProps {
  text?: string;
  speed?: 'normal' | 'fast';
}

export const MarqueeBanner: React.FC<MarqueeBannerProps> = ({
  text = '*** WELCOME TO DATAFORGE 95 - THE PREMIER MULTI-DISCIPLINARY DATA INTELLIGENCE SYSTEM *** SYSTEM STATUS: 100% OPERATIONAL *** 5 ENTERPRISE DATASETS LOADED *** READY FOR HIGH-SPEED ANALYSIS ***'
}) => {
  return (
    <div className="marquee-container my-1 shadow-inner select-none" role="marquee" aria-label="System announcements">
      <div className="marquee-content text-xs">
        {text} &nbsp;&nbsp;&nbsp; ★ &nbsp;&nbsp;&nbsp; {text}
      </div>
    </div>
  );
};
