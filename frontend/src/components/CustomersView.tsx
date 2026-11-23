import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Search, UsersRound } from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { apiRequest } from '../services/api';
import { MembershipRegistration } from './MembershipRegistration';

type Customer = {
  id: number;
  name: string;
  phone: string;
  address: string | null;
  membershipNumber?: string | null;
  memberSince?: string | null;
  createdAt: string;
  _count?: { bills: number; patients: number };
};
type DirectoryResponse = {
  success: boolean;
  data: Customer[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};
type PosRecord = {
  id: number;
  invoiceNumber: string;
  date: string;
  billedAs: string | null;
  paymentMethod: string;
  paymentStatus: string;
  grandTotal: number;
  returnedAmount: number;
  recordedAmountReceived: number;
  outstanding: number;
  medicines: Array<{ name: string; packs: number; units: number; netItemPrice: number }>;
};
type OpdRecord = {
  id: number;
  date: string;
  patientName: string;
  doctorName: string;
  status: string;
  consultationFee: number;
  additionalCharge: number;
  totalCharge: number;
};
type History = {
  customer: Customer;
  pos: PosRecord[];
  opd: OpdRecord[];
  pagination: {
    page: number;
    pageSize: number;
    posTotal: number;
    opdTotal: number;
    totalPages: number;
  };
  note?: string;
};
type HistoryResponse = { success: boolean; data: History };
type Period = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';

const dateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const money = (value: number): string =>
  `Rs. ${Number(value || 0).toLocaleString('en-NP', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
const showDate = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-NP');
};

export const CustomersView: React.FC = () => {
  const { isAdmin } = usePharmacy();
  const [search, setSearch] = useState('');
  const [directoryPage, setDirectoryPage] = useState(1);
  const [directoryRefresh, setDirectoryRefresh] = useState(0);
  const [directory, setDirectory] = useState<DirectoryResponse | null>(null);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);
  const [period, setPeriod] = useState<Period>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [history, setHistory] = useState<History | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const range = useMemo(() => {
    if (period === 'custom') return { from, to };
    if (period === 'all') return { from: '', to: '' };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    if (period === 'week') start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    if (period === 'month') start.setDate(1);
    if (period === 'year') {
      start.setMonth(0);
      start.setDate(1);
    }
    return { from: dateKey(start), to: dateKey(today) };
  }, [period, from, to]);
  const invalidRange = Boolean(range.from && range.to && range.from > range.to);

  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setDirectoryLoading(true);
      setDirectoryError('');
      try {
        const result = await apiRequest<DirectoryResponse>(
          `/customers?search=${encodeURIComponent(search.trim())}&page=${directoryPage}`,
          { signal: controller.signal }
        );
        if (!controller.signal.aborted) setDirectory(result);
      } catch (error) {
        if (!controller.signal.aborted) {
          setDirectory(null);
          setDirectoryError(error instanceof Error ? error.message : 'Unable to load customers.');
        }
      } finally {
        if (!controller.signal.aborted) setDirectoryLoading(false);
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [isAdmin, search, directoryPage, directoryRefresh]);

  useEffect(() => {
    if (!isAdmin || !selected) return;
    if (invalidRange) { setHistory(null); return; }
    const controller = new AbortController();
    setHistory(null);
    setHistoryLoading(true);
    setHistoryError('');
    const params = new URLSearchParams({ page: String(historyPage) });
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);
    void (async () => {
      try {
        const result = await apiRequest<HistoryResponse>(
          `/customers/${selected.id}/history?${params.toString()}`,
          { signal: controller.signal }
        );
        if (!controller.signal.aborted) setHistory(result.data);
      } catch (error) {
        if (!controller.signal.aborted) {
          setHistoryError(error instanceof Error ? error.message : 'Unable to load customer history.');
        }
      } finally {
        if (!controller.signal.aborted) setHistoryLoading(false);
      }
    })();
    return () => controller.abort();
  }, [isAdmin, selected, historyPage, range.from, range.to, invalidRange]);

  const changePeriod = (next: Period) => { setPeriod(next); setHistoryPage(1); };
  const choose = (customer: Customer) => {
    setSelected(customer);
    setHistory(null);
    setHistoryPage(1);
  };
  const pageDue = (history?.pos || []).reduce((sum, bill) => sum + bill.outstanding, 0);

  if (!isAdmin) return <p className="p-4 text-sm text-rose-700">Customer records are restricted to administrators.</p>;

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <UsersRound className="h-7 w-7 text-teal-700" />
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Membership Management</h1>
            <p className="text-sm text-slate-500">Register members first, then look them up in POS or OPD. Admin access only.</p>
          </div>
        </div>
      </header>
      <MembershipRegistration
        onRegistered={(member) => {
          setSearch(member.phone);
          setDirectoryPage(1);
          setSelected(null);
          setHistory(null);
          setHistoryPage(1);
          setDirectoryRefresh((value) => value + 1);
        }}
      />
      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-bold">Find registered member</h2>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              aria-label="Search members by name or phone"
              type="search"
              placeholder="Member name, phone or ID"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setDirectoryPage(1);
                setSelected(null);
                setHistory(null);
              }}
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-teal-500"
            />
          </div>
          {directoryLoading && <p className="mt-3 text-xs text-slate-500">Loading customers...</p>}
          {directoryError && <p role="alert" className="mt-3 text-xs text-rose-700">{directoryError}</p>}
          {!directoryLoading && !directoryError && directory?.data.length === 0 && (
            <p className="mt-4 text-sm text-slate-500">No registered members found. Use the registration form above to create a membership.</p>
          )}
          <div className="mt-3 divide-y divide-slate-100">
            {(directory?.data || []).map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => choose(customer)}
                className={`w-full rounded-lg px-3 py-3 text-left hover:bg-slate-50 ${selected?.id === customer.id ? 'bg-teal-50 ring-1 ring-teal-200' : ''}`}
              >
                <p className="font-semibold text-slate-900">{customer.name}</p>
                <p className="text-xs text-slate-600">{customer.phone} {customer.membershipNumber && `| ${customer.membershipNumber}`}</p>
                {customer.address && <p className="text-xs text-slate-500">{customer.address}</p>}
                <p className="mt-1 text-[11px] text-slate-400">
                  {customer._count?.bills ?? 0} linked bills Â· {customer._count?.patients ?? 0} linked OPD records
                </p>
              </button>
            ))}
          </div>
          {directory && directory.pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between gap-2 text-xs">
              <button type="button" aria-label="Previous customer page" disabled={directoryPage <= 1} onClick={() => setDirectoryPage(p => p - 1)} className="rounded border px-2 py-1 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
              <span>Page {directoryPage} of {directory.pagination.totalPages} Â· {directory.pagination.total} customers</span>
              <button type="button" aria-label="Next customer page" disabled={directoryPage >= directory.pagination.totalPages} onClick={() => setDirectoryPage(p => p + 1)} className="rounded border px-2 py-1 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
            </div>
          )}
        </section>

        <section className="min-w-0 space-y-4">
          {!selected ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Select a registered member to view verified POS and OPD history.</div>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-extrabold text-slate-900">{selected.name}</h2>
                <p className="text-sm text-slate-600">Member ID: {selected.membershipNumber || 'Not assigned'}</p>
                <p className="text-sm text-slate-600">Phone: {selected.phone}</p>
                <p className="text-sm text-slate-600">Address: {selected.address || 'Not recorded'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2 font-bold"><CalendarDays className="h-4 w-4 text-teal-700" /> Transaction date filter</div>
                <div className="flex flex-wrap gap-2">
                  {([
                    ['all', 'All'], ['today', 'Today'], ['week', 'This Week'],
                    ['month', 'This Month'], ['year', 'This Year'], ['custom', 'Custom'],
                  ] as Array<[Period, string]>).map(([key, label]) => (
                    <button key={key} type="button" onClick={() => changePeriod(key)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${period === key ? 'bg-teal-700 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{label}</button>
                  ))}
                </div>
                {period === 'custom' && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-semibold">From date
                      <input type="date" value={from} max={to || undefined} onChange={e => { setFrom(e.target.value); setHistoryPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
                    </label>
                    <label className="text-xs font-semibold">To date
                      <input type="date" value={to} min={from || undefined} onChange={e => { setTo(e.target.value); setHistoryPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
                    </label>
                  </div>
                )}
                {invalidRange && <p role="alert" className="mt-2 text-xs text-rose-700">From date must not be later than To date.</p>}
              </div>
              {historyLoading && <p className="text-sm text-slate-500">Loading transaction history...</p>}
              {historyError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{historyError}</p>}
              {history && !historyLoading && (
                <>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs text-slate-500">Outstanding credit on displayed POS page</p>
                    <p className="text-xl font-extrabold text-amber-900">{money(pageDue)}</p>
                    <p className="text-[11px] text-slate-500">This is not a lifetime total if more pages exist.</p>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <h3 className="border-b bg-slate-50 px-4 py-3 font-bold">POS purchase history ({history.pagination.posTotal})</h3>
                    {history.pos.length === 0 && <p className="p-4 text-sm text-slate-500">No POS bills in this date range.</p>}
                    <div className="divide-y divide-slate-100">
                      {history.pos.map((bill) => (
                        <div key={bill.id} className="p-4 text-sm">
                          <div className="flex flex-wrap justify-between gap-3">
                            <div>
                              <p className="font-bold">{bill.invoiceNumber}</p>
                              <p className="text-xs text-slate-500">{showDate(bill.date)} Â· Billed as {bill.billedAs || 'Unspecified'}</p>
                              <p className="text-xs text-slate-600">{bill.paymentMethod} Â· {bill.paymentStatus}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">Bill: {money(bill.grandTotal)}</p>
                              <p className="text-xs">Recorded received: {money(bill.recordedAmountReceived)}</p>
                              <p className="text-xs text-amber-800">Outstanding: {money(bill.outstanding)}</p>
                              {bill.returnedAmount > 0 && <p className="text-xs text-blue-700">Returns: {money(bill.returnedAmount)}</p>}
                            </div>
                          </div>
                          <details className="mt-2 text-xs">
                            <summary className="cursor-pointer font-semibold text-teal-700">View medicines ({bill.medicines.length})</summary>
                            <ul className="mt-2 space-y-1 pl-4">
                              {bill.medicines.map((med, index) => <li key={index}>{med.name} Â· {med.packs} pack(s), {med.units} unit(s) Â· {money(med.netItemPrice)}</li>)}
                            </ul>
                          </details>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <h3 className="border-b bg-slate-50 px-4 py-3 font-bold">OPD visit history ({history.pagination.opdTotal})</h3>
                    {history.opd.length === 0 && <p className="p-4 text-sm text-slate-500">No OPD visits in this date range.</p>}
                    <div className="divide-y divide-slate-100">
                      {history.opd.map((visit) => (
                        <div key={visit.id} className="flex flex-wrap justify-between gap-3 p-4 text-sm">
                          <div>
                            <p className="font-bold">Visit #{visit.id} Â· {visit.patientName}</p>
                            <p className="text-xs text-slate-500">{showDate(visit.date)} Â· Dr. {visit.doctorName}</p>
                            <p className="text-xs text-slate-500">Status: {visit.status}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">Charge: {money(visit.totalCharge)}</p>
                            <p className="text-xs">Consultation: {money(visit.consultationFee)}</p>
                            <p className="text-xs">Additional: {money(visit.additionalCharge)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="border-t bg-slate-50 px-4 py-2 text-[11px] text-slate-600">OPD amounts are recorded charges, not confirmed payment receipts.</p>
                  </div>
                  {history.pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-xs">
                      <button type="button" disabled={historyPage <= 1} onClick={() => setHistoryPage(p => p - 1)} className="rounded border px-3 py-1.5 disabled:opacity-40">Previous</button>
                      <span>History page {historyPage} of {history.pagination.totalPages} (POS and OPD paged separately)</span>
                      <button type="button" disabled={historyPage >= history.pagination.totalPages} onClick={() => setHistoryPage(p => p + 1)} className="rounded border px-3 py-1.5 disabled:opacity-40">Next</button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};
