import React, { useCallback, useEffect, useState } from 'react';
import { Banknote, RefreshCw } from 'lucide-react';
import { apiRequest } from '../services/api';

type Report = {
  invoiceCount: number;
  paidTotal: number;
  paymentMethods: Array<{ method: string; count: number; amount: number }>;
  note: string;
};

const todayNepal = (): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kathmandu', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: string) => parts.find(p => p.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};
const cash = (value: number) => `Rs. ${value.toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const ProcedureReportSummary: React.FC = () => {
  const [from, setFrom] = useState(todayNepal);
  const [to, setTo] = useState(todayNepal);
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (start: string, end: string) => {
    if (start > end) { setError('From date cannot be after To date.'); return; }
    setBusy(true);
    setError('');
    try {
      const params = new URLSearchParams({ from: start, to: end });
      const response = await apiRequest<{ success: boolean; data: Report }>(`/clinic-procedures/report?${params}`);
      setData(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load procedure report.');
      setData(null);
    } finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(from, to); }, [load]); // initial Nepal day

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-teal-50 p-2 text-teal-700"><Banknote className="h-5 w-5" /></div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Pharmacist Procedure Collections</h2>
            <p className="mt-1 text-xs text-slate-500">Paid procedure receipts, separate from doctor OPD charges and POS medicine sales.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2 text-xs">
          <label className="flex flex-col gap-1 font-semibold text-slate-600">From
            <input className="rounded-lg border border-slate-300 p-2" type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 font-semibold text-slate-600">To
            <input className="rounded-lg border border-slate-300 p-2" type="date" value={to} onChange={e => setTo(e.target.value)} />
          </label>
          <button type="button" disabled={busy || !from || !to} onClick={() => void load(from, to)} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 font-semibold text-white disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} /> Generate
          </button>
        </div>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
      {data && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Paid procedure receipts</p><strong className="text-xl text-slate-900">{data.invoiceCount}</strong></div>
          <div className="rounded-xl bg-teal-50 p-4"><p className="text-xs text-teal-700">Total collected</p><strong className="text-xl text-teal-900">{cash(data.paidTotal)}</strong></div>
          {data.paymentMethods.map(row => (
            <div key={row.method} className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs capitalize text-slate-500">{row.method.replace(/_/g, ' ')} ({row.count})</p>
              <strong className="text-lg text-slate-900">{cash(row.amount)}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
