import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type DialogType = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  type: DialogType;
  title?: string;
  message: string;
  duration?: number;
}

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'danger' | 'warning' | 'primary';
}

interface DialogContextValue {
  showToast: (message: string, type?: DialogType, title?: string, duration?: number) => void;
  confirmDialog: (options: ConfirmOptions) => Promise<boolean>;
  alertDialog: (message: string, title?: string, type?: DialogType) => Promise<void>;
}

const DialogContext = createContext<DialogContextValue | undefined>(undefined);

export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: (val: boolean) => void;
  } | null>(null);

  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: DialogType;
    resolve: () => void;
  } | null>(null);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((
    message: string,
    type: DialogType = 'success',
    title?: string,
    duration = 4000
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newToast: ToastItem = { id, type, title, message, duration };
    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const confirmDialog = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        isOpen: true,
        options,
        resolve: (result: boolean) => {
          setConfirmState(null);
          resolve(result);
        },
      });
    });
  }, []);

  const alertDialog = useCallback((message: string, title?: string, type: DialogType = 'info'): Promise<void> => {
    return new Promise<void>((resolve) => {
      setAlertState({
        isOpen: true,
        title: title || (type === 'error' ? 'Notice' : type === 'success' ? 'Success' : 'Notice'),
        message,
        type,
        resolve: () => {
          setAlertState(null);
          resolve();
        },
      });
    });
  }, []);

  return (
    <DialogContext.Provider value={{ showToast, confirmDialog, alertDialog }}>
      {children}

      {/* Floating Notifications (Toast Stack) */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((toast) => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';
          const isWarning = toast.type === 'warning';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 ${
                isSuccess
                  ? 'bg-emerald-950/90 text-emerald-100 border-emerald-600/40 shadow-emerald-950/20'
                  : isError
                  ? 'bg-rose-950/90 text-rose-100 border-rose-600/40 shadow-rose-950/20'
                  : isWarning
                  ? 'bg-amber-950/90 text-amber-100 border-amber-600/40 shadow-amber-950/20'
                  : 'bg-slate-900/90 text-slate-100 border-slate-700/50 shadow-slate-950/30'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                {isError && <AlertCircle className="w-5 h-5 text-rose-400" />}
                {isWarning && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                {!isSuccess && !isError && !isWarning && <Info className="w-5 h-5 text-teal-400" />}
              </div>
              <div className="flex-1 min-w-0">
                {toast.title && <div className="text-xs font-bold leading-tight">{toast.title}</div>}
                <div className="text-xs leading-relaxed opacity-90 break-words">{toast.message}</div>
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="shrink-0 p-1 rounded-lg opacity-60 hover:opacity-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Styled Modern Alert Modal */}
      {alertState && alertState.isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden transform transition-all scale-100 animate-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-2xl shrink-0 ${
                  alertState.type === 'error'
                    ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-200'
                    : alertState.type === 'success'
                    ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200'
                    : alertState.type === 'warning'
                    ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-200'
                    : 'bg-teal-50 text-teal-700 ring-1 ring-teal-200'
                }`}>
                  {alertState.type === 'error' && <AlertCircle className="w-6 h-6" />}
                  {alertState.type === 'success' && <CheckCircle2 className="w-6 h-6" />}
                  {alertState.type === 'warning' && <AlertTriangle className="w-6 h-6" />}
                  {alertState.type === 'info' && <Info className="w-6 h-6" />}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    {alertState.title}
                  </h3>
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                    {alertState.message}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                autoFocus
                onClick={() => alertState.resolve()}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styled Modern Confirm Modal */}
      {confirmState && confirmState.isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden transform transition-all scale-100 animate-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-2xl shrink-0 ${
                  confirmState.options.type === 'danger'
                    ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-200'
                    : confirmState.options.type === 'warning'
                    ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-200'
                    : 'bg-teal-50 text-teal-700 ring-1 ring-teal-200'
                }`}>
                  {confirmState.options.type === 'danger' ? (
                    <AlertTriangle className="w-6 h-6 text-rose-600" />
                  ) : confirmState.options.type === 'warning' ? (
                    <AlertTriangle className="w-6 h-6 text-amber-600" />
                  ) : (
                    <Info className="w-6 h-6 text-teal-700" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    {confirmState.options.title || 'Confirm Action'}
                  </h3>
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                    {confirmState.options.message}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => confirmState.resolve(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition cursor-pointer"
              >
                {confirmState.options.cancelLabel || 'Cancel'}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => confirmState.resolve(true)}
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white transition shadow-xs cursor-pointer ${
                  confirmState.options.type === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                    : 'bg-teal-700 hover:bg-teal-800 shadow-teal-700/20'
                }`}
              >
                {confirmState.options.confirmLabel || 'Proceed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};
