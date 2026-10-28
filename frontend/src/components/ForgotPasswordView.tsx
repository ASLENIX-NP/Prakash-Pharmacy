import React, { useState, useEffect } from 'react';
import prakashLogo from '../assets/prakash-logo.png';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  Plus,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { apiRequest, ApiError } from '../services/api';

interface ForgotPasswordViewProps {
  onBackToLogin: () => void;
  initialEmail?: string;
}

type RecoveryStep = 'request_code' | 'verify_and_reset' | 'success';

interface ForgotPasswordResponse {
  success: boolean;
  message: string;
  email?: string;
  username?: string;
  devCode?: string;
}

interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

export const ForgotPasswordView: React.FC<ForgotPasswordViewProps> = ({
  onBackToLogin,
  initialEmail = '',
}) => {
  const { settings } = usePharmacy();

  const [step, setStep] = useState<RecoveryStep>('request_code');
  const [email, setEmail] = useState(initialEmail);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  // Resend cooldown timer
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Handle Step 1: Submit Email for Recovery Code
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessInfo(null);

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!cleanEmail) {
      setErrorMessage('Please enter your registered administrator email address.');
      return;
    }

    if (!emailRegex.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email format (e.g. admin@prakashpharmacy.com.np).');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiRequest<ForgotPasswordResponse>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail }),
      });

      if (response && response.success) {
        setSuccessInfo(response.message || 'Recovery code sent successfully!');
        if (response.devCode) {
          setDevCode(response.devCode);
          setResetCode(response.devCode); // Pre-fill in dev mode for convenience
        }
        setStep('verify_and_reset');
        setCooldown(60); // 60s cooldown for resending
      } else {
        setErrorMessage(response.message || 'Could not find an administrator account with this email.');
      }
    } catch (err: any) {
      if (err instanceof ApiError && err.data && typeof err.data === 'object' && 'message' in (err.data as any)) {
        setErrorMessage((err.data as any).message);
      } else {
        setErrorMessage(err.message || 'Failed to connect to the recovery service. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Resend Code
  const handleResendCode = async () => {
    if (cooldown > 0 || isLoading) return;
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const response = await apiRequest<ForgotPasswordResponse>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      if (response && response.success) {
        setSuccessInfo('A new recovery code has been dispatched.');
        if (response.devCode) {
          setDevCode(response.devCode);
          setResetCode(response.devCode);
        }
        setCooldown(60);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to resend recovery code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Step 2: Verify Code and Set New Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanCode = resetCode.trim();
    const cleanPass = newPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanCode) {
      setErrorMessage('Please enter the 6-digit recovery code sent to your email.');
      return;
    }

    if (cleanPass.length < 6) {
      setErrorMessage('New password must be at least 6 characters.');
      return;
    }

    if (cleanPass !== cleanConfirm) {
      setErrorMessage('Passwords do not match. Please re-enter carefully.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiRequest<ResetPasswordResponse>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          resetCode: cleanCode,
          newPassword: cleanPass,
        }),
      });

      if (response && response.success) {
        setStep('success');
      } else {
        setErrorMessage(response.message || 'Password reset failed.');
      }
    } catch (err: any) {
      if (err instanceof ApiError && err.data && typeof err.data === 'object' && 'message' in (err.data as any)) {
        setErrorMessage((err.data as any).message);
      } else {
        setErrorMessage(err.message || 'Unable to reset password. Please check your code.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-[#f3fbfc] font-sans text-slate-900">
      {/* Background decorations matching LoginView */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-44 top-24 h-[540px] w-[540px] rounded-full bg-sky-100/70 blur-3xl" />
        <div className="absolute -right-32 -top-44 h-[560px] w-[560px] rounded-full bg-emerald-100/65 blur-3xl" />
        <div className="absolute bottom-0 right-[10%] h-[380px] w-[380px] rounded-full bg-cyan-100/45 blur-3xl" />
        <div className="absolute -right-[150px] -top-[210px] h-[560px] w-[560px] rounded-full border-[70px] border-emerald-100/30" />
        <div className="absolute -left-[270px] top-[260px] h-[620px] w-[620px] rounded-full border-[90px] border-sky-100/35" />

        <div className="absolute left-[4vw] top-[7vh] text-slate-200/60">
          <Plus className="h-24 w-24 stroke-[1.3]" />
        </div>
        <div className="absolute right-[4vw] top-[53%] text-slate-200/70">
          <Plus className="h-16 w-16 stroke-[1.5]" />
        </div>
        <div className="absolute right-[6vw] top-[8vh] grid grid-cols-4 gap-3 opacity-30">
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i} className="h-1.5 w-1.5 rounded-full bg-teal-700" />
          ))}
        </div>
      </div>

      {/* Main card container */}
      <section className="relative z-10 flex min-h-[100svh] flex-col items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-[470px] rounded-[32px] border border-slate-100 bg-white/95 p-7 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-md sm:p-10">
          {/* Header */}
          <header className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] border border-emerald-100 bg-gradient-to-tr from-teal-50 to-emerald-50 p-2.5 shadow-sm">
              <img
                src={prakashLogo}
                alt="Prakash Pharmacy Logo"
                className="h-full w-full object-contain"
              />
            </div>

            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-[28px]">
              {settings.storeName || 'Prakash Pharmacy'}
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              {step === 'success'
                ? 'Password Successfully Reset'
                : step === 'verify_and_reset'
                ? 'Create New Admin Password'
                : 'Administrator Password Recovery'}
            </p>
          </header>

          {/* Error Banner */}
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" strokeWidth={2} />
              <p className="leading-5">{errorMessage}</p>
            </div>
          )}

          {/* Success Banner on Step 2 */}
          {successInfo && step === 'verify_and_reset' && (
            <div
              role="status"
              className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            >
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" strokeWidth={2} />
              <div className="leading-5">
                <p>{successInfo}</p>
                {devCode && (
                  <p className="mt-1 text-xs font-semibold text-emerald-700">
                    💡 Recovery verification code: <span className="rounded bg-emerald-200/80 px-1.5 py-0.5 font-mono text-emerald-950">{devCode}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ============================================================
              STEP 1: REQUEST CODE VIA EMAIL (ADMIN ONLY)
          ============================================================ */}
          {step === 'request_code' && (
            <form onSubmit={handleRequestCode} className="space-y-5">
              {/* Note / Disclaimer Banner */}
              <div className="rounded-2xl border border-amber-200/90 bg-amber-50/80 p-4 text-[13px] leading-relaxed text-amber-950">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-bold text-amber-900">Administrator Access Only:</p>
                    <p className="mt-0.5 text-amber-800/95">
                      Password recovery is reserved exclusively for <strong>Pharmacy Administrators</strong>.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="recovery-email" className="mb-2 block text-[15px] font-bold text-slate-800">
                  Registered Administrator Email
                </label>
                <div className="group relative">
                  <Mail
                    aria-hidden="true"
                    className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-teal-600"
                    strokeWidth={2}
                  />
                  <input
                    id="recovery-email"
                    type="email"
                    maxLength={254}
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="e.g. admin@prakashpharmacy.com.np"
                    className="h-[56px] w-full rounded-[17px] border border-slate-200 bg-white pl-12 pr-4 text-[15px] font-medium text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="group relative flex h-[56px] w-full items-center justify-center overflow-hidden rounded-[17px] bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 px-5 text-[16px] font-bold text-white shadow-[0_12px_25px_rgba(5,150,105,0.22)] transition-all hover:-translate-y-0.5 hover:shadow-[0_15px_30px_rgba(5,150,105,0.28)] active:translate-y-0 disabled:opacity-65"
              >
                {isLoading ? (
                  <div className="flex items-center gap-3">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    <span>Sending code...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span>Send Recovery Code</span>
                    <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={2.2} />
                  </div>
                )}
              </button>

              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 text-center text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Notice for Staff:</span> If you are a staff member and forgot your credentials, please contact the pharmacy administrator directly.
              </div>

              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={onBackToLogin}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-teal-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Login</span>
                </button>
              </div>
            </form>
          )}

          {/* ============================================================
              STEP 2: ENTER CODE & SET NEW PASSWORD
          ============================================================ */}
          {step === 'verify_and_reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  Code sent to: <strong className="text-slate-800">{email}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setStep('request_code')}
                  className="font-medium text-teal-600 hover:underline"
                >
                  Change email
                </button>
              </div>

              {/* 6-digit Code */}
              <div>
                <label htmlFor="reset-code" className="mb-1.5 block text-[14px] font-bold text-slate-800">
                  6-Digit Recovery Code
                </label>
                <div className="group relative">
                  <KeyRound
                    aria-hidden="true"
                    className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600"
                    strokeWidth={2}
                  />
                  <input
                    id="reset-code"
                    type="text"
                    maxLength={6}
                    autoFocus
                    value={resetCode}
                    onChange={(e) => {
                      setResetCode(e.target.value.replace(/\D/g, ''));
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="Enter 6-digit code"
                    className="h-[52px] w-full rounded-[15px] border border-slate-200 bg-white pl-12 pr-4 font-mono text-base font-semibold tracking-wider text-slate-900 shadow-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                  />
                </div>
              </div>

              {/* New Password */}
              <div>
                <label htmlFor="new-password" className="mb-1.5 block text-[14px] font-bold text-slate-800">
                  New Password
                </label>
                <div className="group relative">
                  <LockKeyhole
                    aria-hidden="true"
                    className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600"
                    strokeWidth={2}
                  />
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="Minimum 6 characters"
                    className="h-[52px] w-full rounded-[15px] border border-slate-200 bg-white pl-12 pr-12 text-[15px] font-medium text-slate-900 shadow-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirm-password" className="mb-1.5 block text-[14px] font-bold text-slate-800">
                  Confirm New Password
                </label>
                <div className="group relative">
                  <LockKeyhole
                    aria-hidden="true"
                    className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600"
                    strokeWidth={2}
                  />
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="Repeat new password"
                    className="h-[52px] w-full rounded-[15px] border border-slate-200 bg-white pl-12 pr-12 text-[15px] font-medium text-slate-900 shadow-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading}
                className="group relative mt-2 flex h-[54px] w-full items-center justify-center rounded-[17px] bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 px-5 text-[16px] font-bold text-white shadow-[0_12px_25px_rgba(5,150,105,0.22)] transition hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-65"
              >
                {isLoading ? (
                  <div className="flex items-center gap-3">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    <span>Resetting password...</span>
                  </div>
                ) : (
                  <span>Update Password & Log In</span>
                )}
              </button>

              {/* Resend Code button */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={cooldown > 0 || isLoading}
                  className="flex items-center gap-1.5 text-xs font-semibold text-teal-700 transition hover:text-teal-800 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>{cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend Code'}</span>
                </button>

                <button
                  type="button"
                  onClick={onBackToLogin}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* ============================================================
              STEP 3: SUCCESS CONFIRMATION
          ============================================================ */}
          {step === 'success' && (
            <div className="py-2 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-inner">
                <CheckCircle2 className="h-10 w-10 stroke-[2.2]" />
              </div>

              <h2 className="text-xl font-bold text-slate-900">
                Password Reset Successfully!
              </h2>

              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Your credentials have been securely updated in the database. You can now use your new password to access the staff portal.
              </p>

              <button
                type="button"
                onClick={onBackToLogin}
                className="mt-6 flex h-[54px] w-full items-center justify-center gap-2 rounded-[17px] bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 px-5 text-[16px] font-bold text-white shadow-lg transition hover:-translate-y-0.5 active:translate-y-0"
              >
                <span>Proceed to Login</span>
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="relative z-20 mt-4 text-center">
          <p className="text-[12px] font-medium text-slate-500/90 sm:text-[13px]">
            © {new Date().getFullYear()} {settings.storeName || 'Prakash Pharmacy'}. All rights reserved.
          </p>
        </footer>
      </section>
    </main>
  );
};
