import React, { useState } from 'react';
import { 
  Building2, 
  ShieldCheck, 
  Lock, 
  User, 
  KeyRound, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  Sparkles,
  CheckCircle2,
  RotateCcw,
  Info
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';

export const LoginView: React.FC = () => {
  const { login, settings, resetDefaultCredentials } = usePharmacy();

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);

    const u = username.trim();
    const p = password.trim();

    if (!u || !p) {
      setErrorMessage('Please enter both User ID / Username and Password!');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const res = login(u, p);
      if (!res.success) {
        setErrorMessage(res.message || 'Invalid credentials. Please verify your User ID and Password.');
      }
      setIsLoading(false);
    }, 200);
  };

  const handleInstantLogin = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setErrorMessage(null);
    setSuccessNotice(null);
    setIsLoading(true);
    setTimeout(() => {
      const res = login(u, p);
      if (!res.success) {
        // If first attempt failed due to cache, auto-restore credentials and retry
        resetDefaultCredentials();
        const retryRes = login(u, p);
        if (!retryRes.success) {
          setErrorMessage(retryRes.message || 'Login failed. Please check credentials.');
        }
      }
      setIsLoading(false);
    }, 200);
  };

  const handleResetDefaults = () => {
    resetDefaultCredentials();
    setUsername('admin');
    setPassword('admin123');
    setErrorMessage(null);
    setSuccessNotice('Default credentials restored successfully! (admin / admin123)');
    setTimeout(() => setSuccessNotice(null), 4000);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Top Pharmacy Branding Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white p-6 text-center space-y-2 border-b border-teal-500/20">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 mx-auto flex items-center justify-center text-white shadow-lg shadow-teal-500/20">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white">
              {settings.storeName}
            </h1>
            <p className="text-xs text-slate-300 font-medium">
              {settings.address}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-[11px] font-mono">
            <span className="bg-white/10 px-2 py-0.5 rounded border border-white/20 text-emerald-300">
              DDA: {settings.ddaLicenceNumber}
            </span>
            <span className="bg-white/10 px-2 py-0.5 rounded border border-white/20 text-amber-300">
              PAN: {settings.panNumber}
            </span>
          </div>
        </div>

        {/* Credentials Form */}
        <div className="p-6 sm:p-8 space-y-5">
          <div className="text-center space-y-1">
            <h2 className="text-base font-bold text-slate-900 flex items-center justify-center gap-1.5">
              <Lock className="w-4 h-4 text-teal-600" />
              <span>Staff &amp; Admin Sign In Gateway</span>
            </h2>
            <p className="text-xs text-slate-500">
              User ID and password required for each and every software entry
            </p>
          </div>

          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-start gap-2 text-xs text-rose-800 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{errorMessage}</p>
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="mt-1 text-[11px] text-teal-700 underline font-bold hover:text-teal-900 cursor-pointer"
                >
                  Click here to fix &amp; reset default passwords
                </button>
              </div>
            </div>
          )}

          {successNotice && (
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center gap-2 text-xs text-emerald-800 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{successNotice}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                User ID / Username:
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. admin or suman.staff"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Password:
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter your security password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-10 py-2.5 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-800 hover:to-emerald-800 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-700/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? (
                <span>Verifying Credentials...</span>
              ) : (
                <>
                  <span>Sign In to Prakash Pharmacy ERP</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick 1-Click Instant Login Buttons */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>1-Click Instant Sign In:</span>
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleInstantLogin('admin', 'admin123')}
                className="p-2.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl text-left transition-all active:scale-[0.98] cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-900">👑 Admin Sign In</span>
                  <span className="text-[10px] bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded font-mono font-bold">1-Click</span>
                </div>
                <div className="text-[11px] text-purple-700 font-mono mt-0.5">admin / admin123</div>
                <div className="text-[10px] text-purple-600">Full Access (All Tabs)</div>
              </button>

              <button
                type="button"
                onClick={() => handleInstantLogin('suman.staff', 'staff123')}
                className="p-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-left transition-all active:scale-[0.98] cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-900">👤 Staff Sign In</span>
                  <span className="text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold">1-Click</span>
                </div>
                <div className="text-[11px] text-emerald-700 font-mono mt-0.5">suman.staff / staff123</div>
                <div className="text-[10px] text-emerald-600">POS &amp; Billing Access</div>
              </button>
            </div>
          </div>

          {/* Credential Reference & Reset Helper */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] space-y-2 text-slate-600">
            <div className="flex items-center justify-between font-bold text-slate-700">
              <span className="flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-teal-600" />
                <span>All Accepted Credentials:</span>
              </span>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="flex items-center gap-1 text-[10px] text-teal-700 hover:text-teal-900 font-bold underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Fix / Reset Passwords</span>
              </button>
            </div>

            <div className="space-y-1 font-mono text-[11px]">
              <div className="flex justify-between bg-white p-1 rounded border border-slate-100">
                <span className="font-bold text-slate-800">Admin:</span>
                <span>User: <strong>admin</strong> | Pass: <strong>admin123</strong> (PIN: 1234)</span>
              </div>
              <div className="flex justify-between bg-white p-1 rounded border border-slate-100">
                <span className="font-bold text-slate-800">Staff 1:</span>
                <span>User: <strong>suman.staff</strong> | Pass: <strong>staff123</strong> (PIN: 2233)</span>
              </div>
              <div className="flex justify-between bg-white p-1 rounded border border-slate-100">
                <span className="font-bold text-slate-800">Staff 2:</span>
                <span>User: <strong>rita.staff</strong> | Pass: <strong>staff123</strong> (PIN: 4455)</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 italic">
              Note: You can also sign in using your registered email ({settings.emailId}) or phone number.
            </p>
          </div>
        </div>

        {/* Footer info */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-center text-[11px] text-slate-500">
          <span>Only Admin can change staff passwords • Makwanpur, Nepal</span>
        </div>
      </div>
    </div>
  );
};
