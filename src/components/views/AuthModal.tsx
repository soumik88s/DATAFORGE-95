import React, { useState } from 'react';
import { RetroModal } from '../retro/RetroModal.js';
import { RetroInput } from '../retro/RetroInput.js';
import { BevelButton } from '../retro/BevelButton.js';
import { api, setStoredToken } from '../../utils/api.js';
import { User } from '../../types.js';
import { playRetroChime } from '../../utils/audio.js';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess
}) => {
  const [tab, setTab] = useState<'login' | 'register' | 'forgot'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanId = username.trim();
    if (!cleanId) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Password is required.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await api.login(cleanId, password);
      setStoredToken(res.token);
      playRetroChime();
      onLoginSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Password is required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await api.register({
        username: username.trim() || cleanEmail.split('@')[0],
        password,
        fullName: fullName.trim() || cleanEmail.split('@')[0],
        email: cleanEmail
      });
      setStoredToken(res.token);
      playRetroChime();
      onLoginSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username.trim()) {
      setError('Please enter your username or email.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await api.forgotPassword(username.trim());
      setInfo(res.instructions);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(null);
  };

  return (
    <RetroModal
      isOpen={isOpen}
      title="DATAFORGE 95 - USER AUTHENTICATION &amp; ACCESS CONTROL"
      icon="🔑"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1">
            {tab === 'login' ? (
              <button
                type="button"
                onClick={() => setTab('register')}
                className="text-[11px] underline text-[#000080]"
              >
                Create new account
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setTab('login')}
                className="text-[11px] underline text-[#000080]"
              >
                Return to Login
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <BevelButton onClick={onClose}>Cancel</BevelButton>
            {tab === 'login' && (
              <BevelButton onClick={handleLogin} variant="primary" disabled={loading}>
                {loading ? 'Authenticating...' : 'Log In'}
              </BevelButton>
            )}
            {tab === 'register' && (
              <BevelButton onClick={handleRegister} variant="primary" disabled={loading}>
                {loading ? 'Registering...' : 'Register'}
              </BevelButton>
            )}
            {tab === 'forgot' && (
              <BevelButton onClick={handleForgot} variant="primary" disabled={loading}>
                Reset Password
              </BevelButton>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-3 text-xs">
        {/* Quick Credentials Panel */}
        <div className="bevel-inset-gray p-2 bg-[#ffffe0] border border-black">
          <div className="font-bold text-[#800000] mb-1">PRE-CONFIGURED SYSTEM ACCOUNTS (CLICK TO AUTOFILL):</div>
          <div className="flex flex-wrap gap-1.5">
            <BevelButton
              onClick={() => quickFill('admin', 'admin95')}
              className="text-[10px] py-0.5 px-2 bg-white"
            >
              👑 ADMIN (admin / admin95)
            </BevelButton>
            <BevelButton
              onClick={() => quickFill('analyst', 'analyst95')}
              className="text-[10px] py-0.5 px-2 bg-white"
            >
              📊 ANALYST (analyst / analyst95)
            </BevelButton>
            <BevelButton
              onClick={() => quickFill('viewer', 'viewer95')}
              className="text-[10px] py-0.5 px-2 bg-white"
            >
              👁 VIEWER (viewer / viewer95)
            </BevelButton>
          </div>
        </div>

        {tab === 'login' && (
          <div className="space-y-2">
            <RetroInput
              label="Email or Username:"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="e.g. sysadmin@dataforge95.internal or admin"
            />
            <RetroInput
              label="Password:"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
            />
            <div className="text-right">
              <button
                type="button"
                onClick={() => setTab('forgot')}
                className="text-[10px] underline text-[#555555]"
              >
                Forgot credentials?
              </button>
            </div>
          </div>
        )}

        {tab === 'register' && (
          <div className="space-y-2">
            <RetroInput
              label="Desired Username:"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Username"
            />
            <RetroInput
              label="Full Name:"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Full Name"
            />
            <RetroInput
              label="Email Address:"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
            />
            <RetroInput
              label="Password:"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
            />
          </div>
        )}

        {tab === 'forgot' && (
          <div className="space-y-2">
            <div className="text-[#404040]">
              Enter operator username to generate system password reset tokens.
            </div>
            <RetroInput
              label="Username:"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </div>
        )}

        {error && (
          <div className="p-2 bevel-inset bg-[#ffe0e0] text-[#800000] font-bold">
            ⚠️ {error}
          </div>
        )}

        {info && (
          <div className="p-2 bevel-inset bg-[#e0ffe0] text-[#006000] font-bold">
            ℹ️ {info}
          </div>
        )}
      </div>
    </RetroModal>
  );
};
