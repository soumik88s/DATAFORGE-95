import React, { useState, useEffect } from 'react';
import { RetroWindow } from '../retro/RetroWindow.js';
import { RetroInput } from '../retro/RetroInput.js';
import { BevelButton } from '../retro/BevelButton.js';
import { api, setStoredToken } from '../../utils/api.js';
import { User } from '../../types.js';
import { playRetroChime, playRetroError } from '../../utils/audio.js';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
  onNavigateHome: () => void;
  initialMode?: 'login' | 'register';
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  onNavigateHome,
  initialMode = 'login'
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanId = identifier.trim();
    if (!cleanId) {
      setError('Please enter a valid email address.');
      playRetroError();
      return;
    }
    if (!password) {
      setError('Password is required.');
      playRetroError();
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setInfo(null);
      const res = await api.login(cleanId, password);
      setStoredToken(res.token);
      playRetroChime();
      onLoginSuccess(res.user);
    } catch (err: any) {
      playRetroError();
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
      playRetroError();
      return;
    }
    if (!password) {
      setError('Password is required.');
      playRetroError();
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      playRetroError();
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setInfo(null);
      const res = await api.register({
        email: cleanEmail,
        username: identifier.trim() || cleanEmail.split('@')[0],
        fullName: fullName.trim() || cleanEmail.split('@')[0],
        department: department.trim() || 'General Analytics',
        password
      });
      setStoredToken(res.token);
      playRetroChime();
      onLoginSuccess(res.user);
    } catch (err: any) {
      playRetroError();
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanId = identifier.trim();
    if (!cleanId) {
      setError('Please enter a username or email address.');
      playRetroError();
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await api.forgotPassword(cleanId);
      setInfo(res.instructions || 'Password reset instructions generated.');
    } catch (err: any) {
      playRetroError();
      setError(err.message || 'User not found in registry.');
    } finally {
      setLoading(false);
    }
  };

  const autofill = (u: string, p: string) => {
    setIdentifier(u);
    setPassword(p);
    setError(null);
  };

  return (
    <div
      id="login-screen"
      className="min-h-[calc(100vh-68px)] bg-[#008080] p-4 flex flex-col items-center justify-center font-pixel"
    >
      <div className="w-full max-w-lg">
        <RetroWindow
          title={
            mode === 'login'
              ? 'Log On to DATAFORGE 95'
              : mode === 'register'
              ? 'DATAFORGE 95 - New Operator Registration'
              : 'DATAFORGE 95 - Security Recovery'
          }
          icon="🔑"
          onClose={onNavigateHome}
        >
          <div className="space-y-4 text-xs">
            {/* Windows 95 Logon Banner */}
            <div className="flex items-center gap-3 bg-[#c0c0c0] p-2 bevel-inset">
              <div className="text-3xl select-none" aria-hidden="true">
                💻
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm text-[#000080]">
                  DATAFORGE 95 Professional Edition
                </div>
                <div className="text-[11px] text-[#404040]">
                  {mode === 'login'
                    ? 'Type a user name (or email) and password to log on to the system.'
                    : mode === 'register'
                    ? 'Create a new operator account with verified database authentication.'
                    : 'System operator password reset protocol.'}
                </div>
              </div>
            </div>

            {/* Quick Fill Credentials Bar */}
            <div className="p-2 bevel-inset bg-[#ffffe0] border border-black space-y-1">
              <div className="font-bold text-[10px] text-[#800000] uppercase tracking-wide">
                Pre-configured System Accounts (Click to Autofill):
              </div>
              <div className="flex flex-wrap gap-1">
                <BevelButton
                  id="btn-autofill-admin"
                  type="button"
                  onClick={() => autofill('admin', 'admin95')}
                  className="text-[10px] py-0.5 px-2 bg-white"
                >
                  👑 ADMIN (admin / admin95)
                </BevelButton>
                <BevelButton
                  id="btn-autofill-analyst"
                  type="button"
                  onClick={() => autofill('analyst', 'analyst95')}
                  className="text-[10px] py-0.5 px-2 bg-white"
                >
                  📊 ANALYST (analyst / analyst95)
                </BevelButton>
                <BevelButton
                  id="btn-autofill-viewer"
                  type="button"
                  onClick={() => autofill('viewer', 'viewer95')}
                  className="text-[10px] py-0.5 px-2 bg-white"
                >
                  👁 VIEWER (viewer / viewer95)
                </BevelButton>
              </div>
            </div>

            {/* Error and Info Display */}
            {error && (
              <div
                id="login-error-alert"
                className="p-2 bevel-inset bg-[#ffe0e0] text-[#800000] font-bold flex items-start gap-2"
                role="alert"
              >
                <span className="text-base select-none">⚠️</span>
                <span className="pt-0.5">{error}</span>
              </div>
            )}

            {info && (
              <div
                id="login-info-alert"
                className="p-2 bevel-inset bg-[#e0ffe0] text-[#006000] font-bold flex items-start gap-2"
                role="status"
              >
                <span className="text-base select-none">ℹ️</span>
                <span className="pt-0.5">{info}</span>
              </div>
            )}

            {/* LOGIN FORM */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-3">
                <RetroInput
                  id="login-user-input"
                  label="User name or Email:"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="e.g. sysadmin@dataforge95.internal or admin"
                  disabled={loading}
                />
                <RetroInput
                  id="login-password-input"
                  label="Password:"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter password"
                  disabled={loading}
                />

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError(null);
                    }}
                    className="text-[11px] underline text-[#000080] hover:text-[#0000ff]"
                  >
                    Forgot password?
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setError(null);
                    }}
                    className="text-[11px] underline text-[#000080] hover:text-[#0000ff]"
                  >
                    Need an account? Register
                  </button>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#808080]">
                  <BevelButton
                    id="btn-login-cancel"
                    type="button"
                    onClick={onNavigateHome}
                    disabled={loading}
                  >
                    Cancel
                  </BevelButton>
                  <BevelButton
                    id="btn-login-submit"
                    type="submit"
                    variant="primary"
                    disabled={loading}
                    className="min-w-[80px]"
                  >
                    {loading ? 'Authenticating...' : 'OK'}
                  </BevelButton>
                </div>
              </form>
            )}

            {/* REGISTER FORM */}
            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-3">
                <RetroInput
                  id="register-email-input"
                  label="Email Address (Required):"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="operator@example.com"
                  disabled={loading}
                />
                <RetroInput
                  id="register-username-input"
                  label="Username:"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="e.g. jdoe"
                  disabled={loading}
                />
                <RetroInput
                  id="register-fullname-input"
                  label="Full Name:"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="John Doe"
                  disabled={loading}
                />
                <RetroInput
                  id="register-department-input"
                  label="Department:"
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  placeholder="Analytics Division"
                  disabled={loading}
                />
                <RetroInput
                  id="register-password-input"
                  label="Password (min 6 chars):"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Create strong password"
                  disabled={loading}
                />

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                    }}
                    className="text-[11px] underline text-[#000080] hover:text-[#0000ff]"
                  >
                    Already have an account? Log On
                  </button>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#808080]">
                  <BevelButton
                    id="btn-register-cancel"
                    type="button"
                    onClick={() => setMode('login')}
                    disabled={loading}
                  >
                    Cancel
                  </BevelButton>
                  <BevelButton
                    id="btn-register-submit"
                    type="submit"
                    variant="primary"
                    disabled={loading}
                    className="min-w-[90px]"
                  >
                    {loading ? 'Registering...' : 'Register'}
                  </BevelButton>
                </div>
              </form>
            )}

            {/* FORGOT PASSWORD FORM */}
            {mode === 'forgot' && (
              <form onSubmit={handleForgot} className="space-y-3">
                <RetroInput
                  id="forgot-identifier-input"
                  label="Username or Email:"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="Enter registered username or email"
                  disabled={loading}
                />

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                    }}
                    className="text-[11px] underline text-[#000080] hover:text-[#0000ff]"
                  >
                    Return to Log On
                  </button>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#808080]">
                  <BevelButton
                    type="button"
                    onClick={() => setMode('login')}
                    disabled={loading}
                  >
                    Cancel
                  </BevelButton>
                  <BevelButton
                    type="submit"
                    variant="primary"
                    disabled={loading}
                  >
                    {loading ? 'Working...' : 'Reset Password'}
                  </BevelButton>
                </div>
              </form>
            )}
          </div>
        </RetroWindow>
      </div>
    </div>
  );
};
