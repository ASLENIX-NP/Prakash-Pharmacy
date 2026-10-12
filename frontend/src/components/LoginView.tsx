import React, { useState } from 'react';
import prakashLogo from '../assets/prakash-logo.png';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Plus,
  UserRound
} from 'lucide-react';

import { usePharmacy } from '../context/PharmacyContext';

export const LoginView: React.FC = () => {
  const { login, settings } = usePharmacy();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setErrorMessage(null);

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    setIsLoading(true);

    /*
      Keeping a tiny delay for the current local login system.

      Later, when authentication is moved to the Express API,
      this will become an async TanStack Query mutation.
    */
    window.setTimeout(() => {
      const result = login(cleanUsername, cleanPassword);

      if (!result.success) {
        setErrorMessage(
          result.message || 'Invalid username or password. Please try again.'
        );
      }

      setIsLoading(false);
    }, 250);
  };

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-[#f3fbfc] font-sans text-slate-900">
      {/* ============================================================
          BACKGROUND
      ============================================================ */}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {/* Main background glow */}
        <div className="absolute -left-44 top-24 h-[540px] w-[540px] rounded-full bg-sky-100/70 blur-3xl" />

        <div className="absolute -right-32 -top-44 h-[560px] w-[560px] rounded-full bg-emerald-100/65 blur-3xl" />

        <div className="absolute bottom-0 right-[10%] h-[380px] w-[380px] rounded-full bg-cyan-100/45 blur-3xl" />

        {/* Large soft top-right circle */}
        <div className="absolute -right-[150px] -top-[210px] h-[560px] w-[560px] rounded-full border-[70px] border-emerald-100/30" />

        {/* Left soft circle */}
        <div className="absolute -left-[270px] top-[260px] h-[620px] w-[620px] rounded-full border-[90px] border-sky-100/35" />

        {/* Top-left medical plus */}
        <div className="absolute left-[4vw] top-[7vh] text-slate-200/60">
          <Plus className="h-24 w-24 stroke-[1.3]" />
        </div>

        {/* Right-side medical plus */}
        <div className="absolute right-[4vw] top-[53%] text-slate-200/70">
          <Plus className="h-16 w-16 stroke-[1.5]" />
        </div>

        {/* Dot decoration */}
        <div className="absolute right-[6vw] top-[8vh] grid grid-cols-4 gap-3 opacity-30">
          {Array.from({ length: 16 }).map((_, index) => (
            <span
              key={index}
              className="h-1.5 w-1.5 rounded-full bg-teal-300"
            />
          ))}
        </div>

        {/* Bottom-left soft decorative leaf-like blobs */}
        <div className="absolute -bottom-28 -left-20 h-72 w-28 rotate-[25deg] rounded-full bg-emerald-900/15 blur-xl" />

        <div className="absolute -bottom-24 left-10 h-72 w-24 rotate-[-10deg] rounded-full bg-emerald-700/10 blur-xl" />

        {/* Bottom layered waves */}
        <div className="absolute bottom-0 left-0 right-0 h-[120px]">
          <svg
            className="h-full w-full"
            viewBox="0 0 1440 150"
            preserveAspectRatio="none"
          >
            <path
              d="
                M0 78
                C220 105 390 55 620 72
                C830 88 1080 145 1440 48
                L1440 150
                L0 150
                Z
              "
              fill="#0f766e"
              fillOpacity="0.95"
            />

            <path
              d="
                M0 91
                C240 118 405 69 625 84
                C850 99 1090 150 1440 63
              "
              fill="none"
              stroke="#ffffff"
              strokeOpacity="0.8"
              strokeWidth="4"
            />

            <path
              d="
                M0 82
                C235 108 400 60 620 76
                C840 92 1080 143 1440 54
              "
              fill="none"
              stroke="#2dd4bf"
              strokeOpacity="0.7"
              strokeWidth="2"
            />
          </svg>
        </div>
      </div>

      {/* ============================================================
          PAGE CONTENT
      ============================================================ */}

      <section className="relative z-10 flex min-h-[100svh] flex-col items-center justify-center px-4 py-5 sm:px-6">
        {/* ============================================================
            LOGIN CARD
        ============================================================ */}

        <div className="w-full max-w-[560px] rounded-[30px] border border-white/80 bg-white/95 px-7 py-7 shadow-[0_25px_70px_rgba(15,118,110,0.12)] backdrop-blur-md sm:px-10 sm:py-8">
          {/* Brand */}
          <header className="text-center">
            {/* Logo */}
            <div className="mx-auto flex h-[76px] w-[76px] items-center justify-center rounded-[22px] bg-gradient-to-br from-teal-400 via-teal-500 to-emerald-600 text-white shadow-[0_14px_30px_rgba(16,185,129,0.28)]">
              <img
                  src={prakashLogo}
                  alt="Prakash Pharmacy"
                  className="h-full w-full object-contain p-2"
                />
            </div>

            {/* Pharmacy name */}
            <h1 className="mt-5 text-[30px] font-black leading-tight tracking-[-0.025em] text-slate-900 sm:text-[34px]">
              {settings.storeName || 'Prakash Pharmacy'}
            </h1>

            <p className="mt-2 text-[15px] font-medium tracking-[0.01em] text-slate-500 sm:text-base">
              Secure staff login
            </p>
          </header>

          {/* ========================================================
              FORM
          ======================================================== */}

          <form
            className="mt-8 space-y-5"
            onSubmit={handleSubmit}
            noValidate
          >
            {/* Error message */}
            {errorMessage && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
              >
                <AlertCircle
                  className="mt-0.5 h-5 w-5 shrink-0 text-rose-500"
                  strokeWidth={2}
                />

                <p className="leading-5">{errorMessage}</p>
              </div>
            )}

            {/* Username */}
            <div>
              <label
                htmlFor="username"
                className="mb-2 block text-[16px] font-bold text-slate-800"
              >
                Username
              </label>

              <div className="group relative">
                <UserRound
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-teal-600"
                  strokeWidth={2}
                />

                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value);

                    if (errorMessage) {
                      setErrorMessage(null);
                    }
                  }}
                  placeholder="Enter your username"
                  className="
                    h-[56px]
                    w-full
                    rounded-[17px]
                    border
                    border-slate-200
                    bg-white
                    pl-12
                    pr-4
                    text-[15px]
                    font-medium
                    text-slate-900
                    shadow-sm
                    outline-none
                    transition-all
                    duration-200
                    placeholder:font-normal
                    placeholder:text-slate-400
                    hover:border-slate-300
                    focus:border-teal-500
                    focus:ring-4
                    focus:ring-teal-500/10
                  "
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-[16px] font-bold text-slate-800"
              >
                Password
              </label>

              <div className="group relative">
                <LockKeyhole
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-teal-600"
                  strokeWidth={2}
                />

                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);

                    if (errorMessage) {
                      setErrorMessage(null);
                    }
                  }}
                  placeholder="Enter your password"
                  className="
                    h-[56px]
                    w-full
                    rounded-[17px]
                    border
                    border-slate-200
                    bg-white
                    pl-12
                    pr-12
                    text-[15px]
                    font-medium
                    text-slate-900
                    shadow-sm
                    outline-none
                    transition-all
                    duration-200
                    placeholder:font-normal
                    placeholder:text-slate-400
                    hover:border-slate-300
                    focus:border-teal-500
                    focus:ring-4
                    focus:ring-teal-500/10
                  "
                />

                <button
                  type="button"
                  aria-label={
                    showPassword ? 'Hide password' : 'Show password'
                  }
                  onClick={() => setShowPassword((current) => !current)}
                  className="
                    absolute
                    right-4
                    top-1/2
                    flex
                    h-8
                    w-8
                    -translate-y-1/2
                    items-center
                    justify-center
                    rounded-lg
                    text-slate-400
                    transition
                    hover:bg-slate-100
                    hover:text-slate-600
                    focus:outline-none
                    focus:ring-2
                    focus:ring-teal-500/30
                  "
                >
                  {showPassword ? (
                    <EyeOff
                      className="h-5 w-5"
                      strokeWidth={2}
                    />
                  ) : (
                    <Eye
                      className="h-5 w-5"
                      strokeWidth={2}
                    />
                  )}
                </button>
              </div>
            </div>

            {/* Login button */}
            <button
              type="submit"
              disabled={isLoading}
              className="
                group
                relative
                flex
                h-[58px]
                w-full
                items-center
                justify-center
                overflow-hidden
                rounded-[17px]
                bg-gradient-to-r
                from-teal-700
                via-teal-600
                to-emerald-600
                px-5
                text-[17px]
                font-bold
                text-white
                shadow-[0_12px_25px_rgba(5,150,105,0.22)]
                transition-all
                duration-200
                hover:-translate-y-0.5
                hover:shadow-[0_15px_30px_rgba(5,150,105,0.28)]
                active:translate-y-0
                disabled:cursor-not-allowed
                disabled:opacity-65
              "
            >
              {isLoading ? (
                <div className="flex items-center gap-3">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />

                  <span>Signing in...</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span>Login</span>

                  <ArrowRight
                    className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1"
                    strokeWidth={2.2}
                  />
                </div>
              )}
            </button>

            {/* Security message */}
            <p className="px-3 pt-1 text-center text-[13px] leading-6 text-slate-500">
              Authorized staff only. Please use your assigned
              <br className="hidden sm:block" />
              <span className="sm:ml-1">
                username and password to continue.
              </span>
            </p>
          </form>
        </div>

        {/* ============================================================
            FOOTER
        ============================================================ */}

        <footer className="relative z-20 mt-4 pb-[75px] text-center">
          <p className="text-[12px] font-medium text-slate-500/90 sm:text-[13px]">
            © {new Date().getFullYear()}{' '}
            {settings.storeName || 'Prakash Pharmacy'}. All rights reserved.
          </p>
        </footer>
      </section>
    </main>
  );
};