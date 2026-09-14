import React, { useState } from 'react';
import { RetroModal } from '../retro/RetroModal.js';
import { BevelButton } from '../retro/BevelButton.js';
import { isSoundEnabled, toggleSound, playRetroChime } from '../../utils/audio.js';

interface SystemSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemSettingsModal: React.FC<SystemSettingsModalProps> = ({ isOpen, onClose }) => {
  const [sound, setSound] = useState(isSoundEnabled());

  const handleToggleAudio = () => {
    const next = toggleSound();
    setSound(next);
    if (next) playRetroChime();
  };

  return (
    <RetroModal
      isOpen={isOpen}
      title="SYSTEM SETTINGS &amp; HARDWARE DIAGNOSTICS"
      icon="⚙️"
      onClose={onClose}
      footer={<BevelButton onClick={onClose} variant="primary">OK</BevelButton>}
    >
      <div className="space-y-3 text-xs">
        <div className="bevel-outset p-2 bg-[#dfdfdf] space-y-1">
          <div className="font-bold text-[#000080]">OPERATING SPECIFICATION:</div>
          <div className="font-mono text-[11px] space-y-0.5">
            <div>&bull; Kernel: DATAFORGE 95 Core Build 4.0.1997</div>
            <div>&bull; Architecture: 32-bit Protected Mode Flat Memory</div>
            <div>&bull; Rendering Engine: D3.js v7 Quantitative Graphics</div>
            <div>&bull; Graphics Resolution: 800x600 Optimized (High Color 16-bit)</div>
            <div>&bull; Database State: Secure In-Memory High-Speed Cache</div>
            <div>&bull; Security Protocol: RBAC Session Token Protection</div>
          </div>
        </div>

        <div className="bevel-outset p-2 bg-[#dfdfdf] space-y-2">
          <div className="font-bold text-[#000080]">AUDIO HARDWARE (SOUND BLASTER 16 EMULATION):</div>
          <div className="flex items-center justify-between">
            <span>Synthesized 90s Sound Effects:</span>
            <BevelButton onClick={handleToggleAudio} className="text-xs py-1">
              {sound ? '🔊 Enabled (Click to Mute)' : '🔇 Muted (Click to Enable)'}
            </BevelButton>
          </div>
          <div className="flex justify-end">
            <BevelButton onClick={playRetroChime} className="text-[10px] py-0.5">
              Test Audio Chime
            </BevelButton>
          </div>
        </div>

        <div className="p-2 bevel-inset-gray bg-[#ffffe0] text-[#555555] text-[10px] font-mono">
          TRADEMARK NOTICE: DATAFORGE 95 is an authentic historical aesthetic tribute. Built using modern TypeScript, Express, and D3.js underneath.
        </div>
      </div>
    </RetroModal>
  );
};
