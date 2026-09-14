import React from 'react';
import { User } from '../../types.js';
import { BevelButton } from '../retro/BevelButton.js';
import { playRetroClick, toggleSound, isSoundEnabled } from '../../utils/audio.js';

export type NavView =
  | 'landing'
  | 'dashboard'
  | 'datasets'
  | 'analysis'
  | 'reports'
  | 'audit'
  | 'users'
  | 'settings'
  | 'login';

interface NavbarProps {
  currentView: NavView;
  onSelectView: (view: NavView) => void;
  currentUser: User | null;
  onOpenLogin: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onSelectView,
  currentUser,
  onOpenLogin,
  onLogout
}) => {
  const [soundOn, setSoundOn] = React.useState(isSoundEnabled());

  const handleSoundToggle = () => {
    const next = toggleSound();
    setSoundOn(next);
    if (next) playRetroClick();
  };

  const navItems: { id: NavView; label: string; icon: string; adminOnly?: boolean }[] = [
    { id: 'landing', label: 'Welcome', icon: '💾' },
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'datasets', label: 'Datasets', icon: '📁' },
    { id: 'reports', label: 'Reports', icon: '📝' },
    { id: 'audit', label: 'Audit Logs', icon: '📜', adminOnly: true },
    { id: 'users', label: 'Users', icon: '👥', adminOnly: true },
    { id: 'settings', label: 'System Info', icon: '⚙️' }
  ];

  return (
    <header className="bevel-outset p-1 bg-[#c0c0c0] select-none sticky top-0 z-40 border-b-2 border-[#808080]">
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1">
        {/* Logo & Branding */}
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => onSelectView('landing')}
        >
          <div className="w-6 h-6 bg-[#000080] text-white flex items-center justify-center font-bold text-xs border border-white">
            DF
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="retro-heading text-sm sm:text-base tracking-wider text-[#000080]">
                DATAFORGE 95
              </span>
              <span className="blink bg-[#ff0000] text-white text-[9px] font-bold px-1 border border-black">
                v4.0
              </span>
            </div>
            <div className="text-[10px] text-[#404040] font-mono hidden sm:block">
              Interactive Data Analytics & Intelligence Platform
            </div>
          </div>
        </div>

        {/* Navigation Buttons */}
        <nav className="flex flex-wrap items-center gap-1" aria-label="Main Navigation">
          {navItems.map(item => {
            if (item.adminOnly && currentUser?.role !== 'ADMIN') return null;
            const isActive = currentView === item.id;
            return (
              <BevelButton
                key={item.id}
                onClick={() => onSelectView(item.id)}
                active={isActive}
                className="text-xs py-1 px-2.5"
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </BevelButton>
            );
          })}
        </nav>

        {/* User Session Info & Sound Toggle */}
        <div className="flex items-center gap-2">
          {/* Sound toggle */}
          <button
            onClick={handleSoundToggle}
            className="retro-titlebar-btn w-6 h-6 text-xs"
            title={soundOn ? 'Mute Sound' : 'Enable 90s Sound Effects'}
            aria-label="Toggle retro audio"
          >
            {soundOn ? '🔊' : '🔇'}
          </button>

          {currentUser ? (
            <div className="flex items-center gap-2 bevel-inset-gray px-2 py-1">
              <div className="text-right">
                <div className="text-xs font-bold text-black flex items-center gap-1 justify-end">
                  <span className="w-2 h-2 bg-[#00ff00] inline-block border border-black"></span>
                  <span>{currentUser.username}</span>
                </div>
                <div className="text-[10px] text-[#000080] font-bold font-mono">
                  [{currentUser.role}]
                </div>
              </div>
              <BevelButton id="btn-navbar-logout" onClick={onLogout} className="text-[10px] py-0.5 px-1.5">
                Logout
              </BevelButton>
            </div>
          ) : (
            <BevelButton id="btn-navbar-login" onClick={onOpenLogin} variant="primary" className="text-xs py-1 px-3">
              🔑 Log In
            </BevelButton>
          )}
        </div>
      </div>
    </header>
  );
};
