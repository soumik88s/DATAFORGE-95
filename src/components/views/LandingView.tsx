import React from 'react';
import { RetroWindow } from '../retro/RetroWindow.js';
import { BevelButton } from '../retro/BevelButton.js';
import { MarqueeBanner } from '../retro/MarqueeBanner.js';
import { HitCounter } from '../retro/HitCounter.js';
import { ConstructionBanner } from '../retro/ConstructionBanner.js';

interface LandingViewProps {
  onEnterApp: () => void;
  onExploreDatasets: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onEnterApp,
  onExploreDatasets
}) => {
  return (
    <div className="flex flex-col gap-4 pb-12">
      {/* 90s Marquee Ticker */}
      <MarqueeBanner text="*** WELCOME TO DATAFORGE 95 *** REVOLUTIONARY MULTI-SERIES DATA PROCESSING SYSTEM *** 100% PURE ANALYTICAL POWER *** COMPLIANT WITH WINDOWS 95 & OS/2 WARP *** NO PLUGINS REQUIRED *** BEST VIEWED WITH DATA ***" />

      {/* Main Hero Card */}
      <RetroWindow>
        <div className="text-center py-6 px-4 flex flex-col items-center justify-center">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="blink px-2 py-0.5 bg-[#ff0000] text-white font-black text-xs border border-black shadow">
              HOT! NEW!
            </span>
            <span className="px-2 py-0.5 bg-[#00aa00] text-white font-bold text-xs border border-black shadow">
              YEAR 1997 CERTIFIED
            </span>
          </div>

          {/* Animated Rainbow Headline */}
          <h1 className="retro-heading text-3xl sm:text-5xl md:text-6xl rainbow-text uppercase tracking-tight my-2">
            DATA ANALYTICS
            <br />
            THE 90s WAY
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-lg font-black text-[#000080] max-w-2xl mt-2 tracking-wide font-mono">
            TURN RAW DATA INTO SOMETHING YOU CAN ACTUALLY UNDERSTAND.
          </p>

          <p className="text-xs sm:text-sm text-[#404040] max-w-xl mt-2 italic">
            &quot;BEST VIEWED WITH DATA.&quot; &mdash; NOW PROCESSING OVER 890,000 COMBINED RECORDS ACROSS ENERGY, FINANCE, CLIMATE, AND HEALTHCARE.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-6">
            <BevelButton
              variant="primary"
              onClick={onEnterApp}
              className="text-sm sm:text-base py-2.5 px-6 font-black tracking-wider"
            >
              ▶ ENTER DATAFORGE
            </BevelButton>

            <BevelButton
              onClick={onExploreDatasets}
              className="text-sm sm:text-base py-2.5 px-6 font-bold"
            >
              📁 EXPLORE DATASETS
            </BevelButton>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-6">
            <HitCounter initialCount={184209} />
            <div className="text-[11px] text-[#555555] font-mono">
              NETSCAPE &bull; INTERNET EXPLORER 4.0 &bull; 800x600 RECOMMENDED
            </div>
          </div>
        </div>
      </RetroWindow>

      {/* Mandatory Hazard Construction Stripe Banner */}
      <ConstructionBanner
        message="UNDER CONSTRUCTION — BUT THE DATA WORKS."
        subMessage="DATAFORGE 95 QUANTITATIVE KERNEL V4.0 LOADED IN BASE MEMORY."
      />

      {/* Bento-style Windows 95 Information Panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Panel 1: Modern Multi-Domain Datasets */}
        <RetroWindow title="SUPPORTED DOMAINS.TXT" icon="📂">
          <div className="text-xs space-y-2">
            <div className="font-bold text-[#000080] border-b border-[#808080] pb-1">
              FULL REAL-WORLD CATEGORIES:
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[#222222]">
              <li>
                <strong>Global Renewable Energy:</strong> Production (GWh), Capacity, Carbon Offset
              </li>
              <li>
                <strong>Stock Market &amp; Finance:</strong> Ticker feeds, Volatility, Moving Averages
              </li>
              <li>
                <strong>Healthcare &amp; Clinical:</strong> Patient stay length, Recovery scores, Costs
              </li>
              <li>
                <strong>Climate &amp; Atmosphere:</strong> Sensor CO2 (ppm), Temperatures, AQI
              </li>
              <li>
                <strong>E-commerce &amp; Retail:</strong> Gross Merchandise Volume, Discount rate
              </li>
            </ul>
            <div className="text-[10px] text-[#666666] font-mono mt-2">
              * Supports dynamic CSV/Excel drag-and-drop ingestion.
            </div>
          </div>
        </RetroWindow>

        {/* Panel 2: Quantitative Engine & Anomaly Detection */}
        <RetroWindow title="ANALYTICS_SPEC.HLP" icon="⚙️">
          <div className="text-xs space-y-2">
            <div className="font-bold text-[#000080] border-b border-[#808080] pb-1">
              STATISTICAL &amp; ANOMALY RIGOR:
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[#222222]">
              <li>
                <strong>Full Profiling:</strong> Mean, Median, Mode, StdDev, Variance, Q1, Q3, IQR
              </li>
              <li>
                <strong>IQR Fence Detection:</strong> Flags values outside [Q1 - 1.5*IQR, Q3 + 1.5*IQR]
              </li>
              <li>
                <strong>Z-Score Inspection:</strong> Highlights records with |Z| &ge; 2.5
              </li>
              <li>
                <strong>Correlation Matrix:</strong> Pearson coefficient pairwise cross-analysis
              </li>
              <li>
                <strong>Explainable Flags:</strong> Human-readable rationales without pseudo-science
              </li>
            </ul>
          </div>
        </RetroWindow>

        {/* Panel 3: 10 Authentic D3 Visualizations */}
        <RetroWindow title="GRAPHICS_ENGINE.DRV" icon="📊">
          <div className="text-xs space-y-2">
            <div className="font-bold text-[#000080] border-b border-[#808080] pb-1">
              10 D3.JS VISUALIZATIONS:
            </div>
            <div className="grid grid-cols-2 gap-1 text-[11px] font-mono">
              <span className="bevel-inset-gray px-1 py-0.5">1. Bar Chart</span>
              <span className="bevel-inset-gray px-1 py-0.5">2. Line Chart</span>
              <span className="bevel-inset-gray px-1 py-0.5">3. Area Chart</span>
              <span className="bevel-inset-gray px-1 py-0.5">4. Pie Chart</span>
              <span className="bevel-inset-gray px-1 py-0.5">5. Donut Chart</span>
              <span className="bevel-inset-gray px-1 py-0.5">6. Scatter Plot</span>
              <span className="bevel-inset-gray px-1 py-0.5">7. Histogram</span>
              <span className="bevel-inset-gray px-1 py-0.5">8. Heatmap</span>
              <span className="bevel-inset-gray px-1 py-0.5">9. Box Plot</span>
              <span className="bevel-inset-gray px-1 py-0.5">10. Time-Series</span>
            </div>
            <div className="text-[10px] text-[#000080] font-bold mt-2">
              Interactive tooltips, custom aggregations, SVG &amp; PNG export.
            </div>
          </div>
        </RetroWindow>
      </div>

      {/* Retro Web Badges / GeoCities Style Footer */}
      <div className="bevel-inset-gray p-3 flex flex-wrap items-center justify-around gap-4 text-center">
        <div className="border border-black bg-[#000080] text-white px-2 py-1 text-[10px] font-bold font-mono">
          [MADE WITH D3.JS]
        </div>
        <div className="border border-black bg-[#800000] text-white px-2 py-1 text-[10px] font-bold font-mono">
          [NO COOKIES TRACKED]
        </div>
        <div className="border border-black bg-[#00aa00] text-white px-2 py-1 text-[10px] font-bold font-mono">
          [ENCRYPTED SESSION RBAC]
        </div>
        <div className="border border-black bg-[#ff8000] text-black px-2 py-1 text-[10px] font-bold font-mono">
          [OS/2 &amp; WIN95 TESTED]
        </div>
      </div>
    </div>
  );
};
