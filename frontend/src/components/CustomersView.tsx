import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw, Search, Trash2, UsersRound } from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { apiRequest } from '../services/api';
import { MembershipRegistration } from './MembershipRegistration';
import type { MemberDestination, RegisteredMemberHandoff } from '../types/memberHandoff';

type Customer = {
  id: number;
  name: string;
  phone: string;
  address: string | null;
  membershipNumber?: string | null;
  memberSince?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
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
type ProcedureRecord = {
  id: number;
  invoiceNumber: string;
  date: string;
  patientName: string;
  paymentMethod: string;
  totalAmount: number;
  items: Array<{ description: string; amount: number }>;
};
type History = {
  customer: Customer;
  pos: PosRecord[];
  opd: OpdRecord[];
  procedures: ProcedureRecord[];
  pagination: {
    page: number;
    pageSize: number;
    posTotal: number;
    opdTotal: number;
    procTotal: number;
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

type Props = {
  onUseMember?: (member: RegisteredMemberHandoff, destination: MemberDestination) => void;
};

export const CustomersView: React.FC<Props> = ({ onUseMember }) => {
  const { isAdmin } = usePharmacy();
  const [search, setSearch] = useState('');
  // MEMBER_PHONE_SEARCH_129H
  const [phoneSearch, setPhoneSearch] = useState('');
  const [activeDirectorySearch, setActiveDirectorySearch] =
    useState<'name' | 'phone'>('name');
  const [directoryPage, setDirectoryPage] = useState(1);

  // MEMBERSHIP_TABS_129E_R
  const [activeTab, setActiveTab] =
    useState<'register' | 'details' | 'voided'>('register');
  const [directoryRefresh, setDirectoryRefresh] = useState(0);
  const [directory, setDirectory] = useState<DirectoryResponse | null>(null);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState('');
  const [voidedDirectory, setVoidedDirectory] = useState<DirectoryResponse | null>(null);
  const [voidedLoading, setVoidedLoading] = useState(false);
  const [voidedError, setVoidedError] = useState('');
  const [voidedPage, setVoidedPage] = useState(1);
  const [voidingOpen, setVoidingOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voidSubmitting, setVoidSubmitting] = useState(false);
  const [voidNotice, setVoidNotice] = useState('');
  const [voidError, setVoidError] = useState('');
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [period, setPeriod] = useState<Period>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  // HISTORY_LAYOUT_129G
  const [posPage, setPosPage] = useState(1);
  const [opdPage, setOpdPage] = useState(1);
  const [procPage, setProcPage] = useState(1);
  const [historyPanel, setHistoryPanel] =
    useState<'both' | 'pos' | 'opd'>('both');
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

    if (
      activeDirectorySearch === 'phone' &&
      phoneSearch.length > 0 &&
      phoneSearch.length < 7
    ) {
      setDirectory(null);
      setDirectoryError('');
      setDirectoryLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setDirectoryLoading(true);
      setDirectoryError('');
      try {
        const result = await apiRequest<DirectoryResponse>(
          `/customers?search=${encodeURIComponent(
            activeDirectorySearch === 'phone'
              ? phoneSearch
              : search.trim()
          )}&page=${directoryPage}`,
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
  }, [
    isAdmin, search, phoneSearch, activeDirectorySearch,
    directoryPage, directoryRefresh
  ]);

  useEffect(() => {
    if (!isAdmin || !selected) return;
    if (invalidRange) { setHistory(null); return; }
    const controller = new AbortController();
    setHistory(null);
    setHistoryLoading(true);
    setHistoryError('');
    const params = new URLSearchParams({
      posPage: String(posPage),
      opdPage: String(opdPage),
      procPage: String(procPage),
    });
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
  }, [isAdmin, selected, posPage, opdPage, procPage, range.from, range.to, invalidRange]);

  const changePeriod = (next: Period) => { setPeriod(next); setPosPage(1); setOpdPage(1); setProcPage(1); };
  const choose = (customer: Customer) => {
    setHistoryPanel('both');
    setSelected(customer);
    setHistory(null);
    setVoidingOpen(false);
    setVoidReason('');
    setVoidError('');
    setPosPage(1); setOpdPage(1); setProcPage(1);
  };

  useEffect(() => {
    if (!isAdmin || activeTab !== 'voided') return;
    const controller = new AbortController();
    setVoidedLoading(true);
    setVoidedError('');
    apiRequest<DirectoryResponse>(`/customers?status=voided&page=${voidedPage}`, {
      signal: controller.signal,
    })
      .then((res) => setVoidedDirectory(res))
      .catch((err) => {
        if (!controller.signal.aborted) {
          setVoidedError(err instanceof Error ? err.message : 'Unable to load voided members.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setVoidedLoading(false);
      });
    return () => controller.abort();
  }, [isAdmin, activeTab, voidedPage, directoryRefresh]);

  const handleVoidMember = async () => {
    if (!selected || voidSubmitting) return;
    setVoidSubmitting(true);
    setVoidError('');
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(
        `/customers/${selected.id}/void`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: voidReason.trim() || 'Voided by admin' }),
        }
      );
      setVoidNotice(res.message || 'Member voided and stored for 30 days.');
      setSelected(null);
      setHistory(null);
      setVoidingOpen(false);
      setVoidReason('');
      setDirectoryRefresh((v) => v + 1);
    } catch (err) {
      setVoidError(err instanceof Error ? err.message : 'Unable to void member.');
    } finally {
      setVoidSubmitting(false);
    }
  };

  const handleRestoreMember = async (customer: Customer) => {
    if (restoringId !== null) return;
    setRestoringId(customer.id);
    setVoidedError('');
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(
        `/customers/${customer.id}/restore`,
        { method: 'POST' }
      );
      setVoidNotice(res.message || `${customer.name} restored.`);
      setDirectoryRefresh((v) => v + 1);
    } catch (err) {
      setVoidedError(err instanceof Error ? err.message : 'Unable to restore member.');
    } finally {
      setRestoringId(null);
    }
  };
  const pageDue = (history?.pos || []).reduce((sum, bill) => sum + bill.outstanding, 0);
  // Display both types of care in one timeline. Each source retains independent
  // server pagination, so an OPD page change never skips Procedure bills.
  const clinicalRows = useMemo(() => {
    if (!history) return [];
    return [
      ...history.opd.map(visit => ({
        kind: 'opd' as const,
        date: visit.date,
        id: visit.id,
        record: visit,
      })),
      ...(history.procedures || []).map(bill => ({
        kind: 'procedure' as const,
        date: bill.date,
        id: bill.id,
        record: bill,
      })),
    ].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime() ||
      b.id - a.id
    );
  }, [history]);

  if (!isAdmin) return <p className="p-4 text-sm text-rose-700">Customer records are restricted to administrators.</p>;

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <UsersRound className="h-7 w-7 text-teal-700" />
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Membership Management</h1>
            <p className="text-sm text-slate-500">Register members, then send their details straight to POS, OPD or Procedures. Admin access only.</p>
          </div>
        </div>
      </header>
      <div
        role="tablist"
        aria-label="Membership Management"
        className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'register'}
          onClick={() => setActiveTab('register')}
          className={`min-w-[150px] flex-1 rounded-xl px-5 py-3 text-sm font-bold transition ${
            activeTab === 'register'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'bg-slate-50 text-slate-700 hover:bg-teal-50'
          }`}
        >
          Register New Member
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'details'}
          onClick={() => {
            setActiveTab('details');
            setSelected(null);
            setHistory(null);
            setVoidingOpen(false);
            setVoidNotice('');
            setPosPage(1); setOpdPage(1);
          }}
          className={`min-w-[150px] flex-1 rounded-xl px-5 py-3 text-sm font-bold transition ${
            activeTab === 'details'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'bg-slate-50 text-slate-700 hover:bg-teal-50'
          }`}
        >
          Member Details
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'voided'}
          onClick={() => {
            setActiveTab('voided');
            setSelected(null);
            setHistory(null);
            setVoidingOpen(false);
            setVoidNotice('');
            setVoidedPage(1);
          }}
          className={`min-w-[150px] flex-1 rounded-xl px-5 py-3 text-sm font-bold transition ${
            activeTab === 'voided'
              ? 'bg-rose-700 text-white shadow-sm'
              : 'bg-slate-50 text-slate-700 hover:bg-rose-50'
          }`}
        >
          Voided Members (30 Days)
        </button>
      </div>
      {voidNotice && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {voidNotice}
        </div>
      )}

      {activeTab === 'register' && (
      <MembershipRegistration
        onRegistered={(member) => {
          setSearch(member.membershipNumber);
          setActiveDirectorySearch('name');
          setDirectoryPage(1);
          // Show the member immediately; no second lookup required to access the action buttons.
          setSelected({ ...member, createdAt: new Date().toISOString() });
          setHistory(null);
          setPosPage(1); setOpdPage(1);
          setDirectoryRefresh((value) => value + 1);
          setActiveTab('details');
        }}
      />
      )}

      {activeTab === 'details' && (
      <div className="space-y-5">
        <section
          className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${
            selected ? 'hidden' : ''
          }`}
        >
          <div className="mb-4">
            <h2 className="text-lg font-extrabold text-slate-900">
              Find Registered Member
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Search by name, phone number, or Membership ID.
              Click a member to open their full details.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <label
                htmlFor="member-name-search"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Search by Name / Membership ID
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  id="member-name-search"
                  type="search"
                  placeholder="Member name or ID"
                  value={search}
                  onFocus={() => {
                    setActiveDirectorySearch('name');
                    setDirectoryPage(1);
                  }}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setActiveDirectorySearch('name');
                    setDirectoryPage(1);
                    setSelected(null);
                    setHistory(null);
                  }}
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div className="min-w-0">
              <label
                htmlFor="member-phone-search"
                className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700"
              >
                <span>Search by Phone Number</span>
                {phoneSearch.length > 0 && (
                  <span className={`text-[11px] font-normal ${
                    phoneSearch.length < 7 ? 'text-amber-600' : 'text-emerald-600 font-bold'
                  }`}>
                    {phoneSearch.length}/10 digits {phoneSearch.length < 7 ? '(min 7)' : '✓'}
                  </span>
                )}
              </label>
              <input
                id="member-phone-search"
                type="tel"
                inputMode="numeric"
                autoComplete="off"
                maxLength={10}
                placeholder="7-10 digit phone number"
                value={phoneSearch}
                onKeyDown={(e) => {
                  if (
                    ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key) ||
                    (e.ctrlKey || e.metaKey)
                  ) {
                    return;
                  }
                  if (!/^\d$/.test(e.key)) {
                    e.preventDefault();
                  }
                }}
                onFocus={() => {
                  setActiveDirectorySearch('phone');
                  setDirectoryPage(1);
                }}
                onChange={(event) => {
                  setPhoneSearch(
                    event.target.value.replace(/\D/g, '').slice(0, 10)
                  );
                  setActiveDirectorySearch('phone');
                  setDirectoryPage(1);
                  setSelected(null);
                  setHistory(null);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500 font-mono"
              />
              <p className={`mt-1 text-xs ${
                activeDirectorySearch === 'phone' &&
                phoneSearch.length > 0 &&
                phoneSearch.length < 7
                  ? 'text-amber-700'
                  : 'text-slate-500'
              }`}>
                {phoneSearch.length}/10 digits
                {phoneSearch.length > 0 && phoneSearch.length < 7
                  ? ' - at least 7 digits required to search'
                  : ''}
              </p>
            </div>
          </div>
          {directoryLoading && <p className="mt-3 text-xs text-slate-500">Loading customers...</p>}
          {directoryError && <p role="alert" className="mt-3 text-xs text-rose-700">{directoryError}</p>}
          {!directoryLoading && !directoryError && directory?.data.length === 0 && (
            <p className="mt-4 text-sm text-slate-500">No registered members found. Use the Register New Member tab to create a membership.</p>
          )}
          <div className="mt-3 flex flex-col gap-2">
            {(directory?.data || []).map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => choose(customer)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-left transition hover:border-teal-400 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-teal-600"
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

        <section
          className={`min-w-0 space-y-4 ${
            !selected ? 'hidden' : ''
          }`}
        >
          {selected && (
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setHistory(null);
                setPosPage(1); setOpdPage(1);
              }}
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Back to All Members
            </button>
          )}
          {!selected ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Select a registered member to view verified POS and OPD history.</div>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900">{selected.name}</h2>
                    <p className="text-sm text-slate-600">Member ID: {selected.membershipNumber || 'Not assigned'}</p>
                    <p className="text-sm text-slate-600">Phone: {selected.phone}</p>
                    <p className="text-sm text-slate-600">Address: {selected.address || 'Not recorded'}</p>
                  </div>
                  {selected.membershipNumber && !voidingOpen && (
                    <button
                      type="button"
                      onClick={() => {
                        setVoidingOpen(true);
                        setVoidError('');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Void Member
                    </button>
                  )}
                </div>

                {voidingOpen && (
                  <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-3">
                    <p className="text-sm font-bold text-rose-900">
                      Void {selected.name} ({selected.membershipNumber})?
                    </p>
                    <p className="text-xs text-rose-800">
                      The member will be hidden from active lookup and retained in <strong>Voided Members</strong> for <strong>30 days</strong> (with all historical bills/records preserved). You can restore them within 30 days.
                    </p>
                    <input
                      type="text"
                      maxLength={200}
                      placeholder="Reason for voiding (optional, e.g. Duplicate or registered by mistake)"
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                      className="w-full rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-rose-500"
                    />
                    {voidError && (
                      <p role="alert" className="text-xs font-semibold text-rose-700">{voidError}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={voidSubmitting}
                        onClick={() => { void handleVoidMember(); }}
                        className="rounded-lg bg-rose-700 px-4 py-2 text-xs font-bold text-white hover:bg-rose-800 disabled:opacity-50"
                      >
                        {voidSubmitting ? 'Voiding...' : 'Confirm Void (30-Day Retention)'}
                      </button>
                      <button
                        type="button"
                        disabled={voidSubmitting}
                        onClick={() => {
                          setVoidingOpen(false);
                          setVoidError('');
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {selected.membershipNumber && selected.memberSince && onUseMember && (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <p className="mb-2 text-sm font-bold text-slate-800">Use this member in</p>
                    <div className="flex flex-wrap gap-2">
                      {([
                        ['pos', 'Use in POS'],
                        ['opd', 'Use in OPD'],
                        ['procedures', 'Use in Procedures'],
                      ] as const).map(([destination, label]) => (
                        <button
                          key={destination}
                          type="button"
                          onClick={() => onUseMember({
                            id: selected.id,
                            name: selected.name,
                            phone: selected.phone,
                            address: selected.address,
                            membershipNumber: selected.membershipNumber!,
                            memberSince: selected.memberSince!,
                          }, destination)}
                          className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">OPD uses separate Clinic numbers for each patient; shared phone numbers never merge medical histories.</p>
                  </div>
                )}
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
                      <input type="date" value={from} max={to || undefined} onChange={e => { setFrom(e.target.value); setPosPage(1); setOpdPage(1); setProcPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
                    </label>
                    <label className="text-xs font-semibold">To date
                      <input type="date" value={to} min={from || undefined} onChange={e => { setTo(e.target.value); setPosPage(1); setOpdPage(1); setProcPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
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
                  <div className={
                    historyPanel === 'both'
                      ? 'grid gap-4 lg:grid-cols-2 lg:items-start'
                      : 'space-y-4'
                  }>
                    {historyPanel !== 'opd' && (
                    <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-4 py-3">
                        <h3 className="font-bold">
                          POS purchase history ({history.pagination.posTotal})
                        </h3>
                        <button
                          type="button"
                          onClick={() => setHistoryPanel(
                            historyPanel === 'pos' ? 'both' : 'pos'
                          )}
                          className="rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50"
                        >
                          {historyPanel === 'pos' ? 'Show Both Histories' : 'View All POS'}
                        </button>
                      </div>
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
                    <div className="flex items-center justify-between gap-2 border-t bg-slate-50 p-3 text-xs">
                      <button
                        type="button"
                        disabled={posPage <= 1 || historyLoading}
                        onClick={() => setPosPage(p => p - 1)}
                        className="rounded-lg border px-3 py-2 disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <span className="text-center text-slate-600">
                        Page {posPage} of {Math.max(1, Math.ceil(history.pagination.posTotal / history.pagination.pageSize))}
                        {' '} · 10 per page
                      </span>
                      <button
                        type="button"
                        disabled={
                          posPage >= Math.max(1, Math.ceil(history.pagination.posTotal / history.pagination.pageSize)) ||
                          historyLoading
                        }
                        onClick={() => setPosPage(p => p + 1)}
                        className="rounded-lg border px-3 py-2 disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                  )}

                  {historyPanel !== 'pos' && (
                  <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-4 py-3">
                      <h3 className="font-bold">
                        Clinical history: OPD + Procedures ({history.pagination.opdTotal + (history.pagination.procTotal || 0)})
                      </h3>
                      <button
                        type="button"
                        onClick={() => setHistoryPanel(historyPanel === 'opd' ? 'both' : 'opd')}
                        className="rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50"
                      >
                        {historyPanel === 'opd' ? 'Show Both Histories' : 'View All Clinical'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-3 border-b bg-white px-4 py-2 text-xs text-slate-600">
                      <span>OPD visits: <strong>{history.pagination.opdTotal}</strong></span>
                      <span>Procedure bills: <strong>{history.pagination.procTotal || 0}</strong></span>
                    </div>
                    {clinicalRows.length === 0 && (
                      <p className="p-4 text-sm text-slate-500">No linked OPD visits or Procedure bills in this date range.</p>
                    )}
                    <div className="divide-y divide-slate-100">
                      {clinicalRows.map(entry => entry.kind === 'opd' ? (
                        <div key={`opd-${entry.id}`} className="flex flex-wrap justify-between gap-3 p-4 text-sm">
                          <div>
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">OPD visit</span>
                              <p className="font-bold">Visit #{entry.record.id} · {entry.record.patientName}</p>
                            </div>
                            <p className="text-xs text-slate-500">{showDate(entry.record.date)} · Dr. {entry.record.doctorName}</p>
                            <p className="text-xs text-slate-500">Status: {entry.record.status}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">Charge: {money(entry.record.totalCharge)}</p>
                            <p className="text-xs">Consultation: {money(entry.record.consultationFee)}</p>
                            <p className="text-xs">Additional: {money(entry.record.additionalCharge)}</p>
                          </div>
                        </div>
                      ) : (
                        <div key={`procedure-${entry.id}`} className="flex flex-wrap justify-between gap-3 p-4 text-sm">
                          <div>
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <span className="rounded bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-700">Procedure</span>
                              <p className="font-bold">{entry.record.invoiceNumber} · {entry.record.patientName}</p>
                            </div>
                            <p className="text-xs text-slate-500">{showDate(entry.record.date)} · {entry.record.paymentMethod}</p>
                            <p className="mt-1 text-xs text-slate-600">{entry.record.items.map(item => item.description).join(', ')}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-teal-800">Paid: {money(entry.record.totalAmount)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="border-t bg-slate-50 px-4 py-2 text-[11px] text-slate-600">
                      OPD charges are not proof of payment. Procedure bills here are recorded paid invoices. Only explicitly linked member records are shown; no automatic matching by shared phone.
                    </p>
                    <div className="space-y-2 border-t bg-slate-50 p-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <button type="button" aria-label="Previous OPD page"
                          disabled={opdPage <= 1 || historyLoading}
                          onClick={() => setOpdPage(p => p - 1)}
                          className="rounded-lg border px-3 py-2 disabled:opacity-40">Previous</button>
                        <span className="text-center text-slate-600">
                          OPD page {opdPage} of {Math.max(1, Math.ceil(history.pagination.opdTotal / history.pagination.pageSize))}
                        </span>
                        <button type="button" aria-label="Next OPD page"
                          disabled={opdPage >= Math.max(1, Math.ceil(history.pagination.opdTotal / history.pagination.pageSize)) || historyLoading}
                          onClick={() => setOpdPage(p => p + 1)}
                          className="rounded-lg border px-3 py-2 disabled:opacity-40">Next</button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <button type="button" aria-label="Previous Procedure page"
                          disabled={procPage <= 1 || historyLoading}
                          onClick={() => setProcPage(p => p - 1)}
                          className="rounded-lg border px-3 py-2 disabled:opacity-40">Previous</button>
                        <span className="text-center text-slate-600">
                          Procedures page {procPage} of {Math.max(1, Math.ceil((history.pagination.procTotal || 0) / history.pagination.pageSize))}
                        </span>
                        <button type="button" aria-label="Next Procedure page"
                          disabled={procPage >= Math.max(1, Math.ceil((history.pagination.procTotal || 0) / history.pagination.pageSize)) || historyLoading}
                          onClick={() => setProcPage(p => p + 1)}
                          className="rounded-lg border px-3 py-2 disabled:opacity-40">Next</button>
                      </div>
                      <p className="text-[11px] text-slate-500">Newest first among the loaded pages (10 per type). Use the separate page controls to browse the full histories.</p>
                    </div>
                  </div>
                  )}
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>
      )}

      {activeTab === 'voided' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Voided Members (30-Day Retention)</h2>
            <p className="mt-1 text-sm text-slate-500">
              Voided members are stored for up to 30 days and can be restored anytime within that window.
            </p>
          </div>
          {voidedLoading && <p className="text-xs text-slate-500">Loading voided members...</p>}
          {voidedError && <p role="alert" className="text-xs font-semibold text-rose-700">{voidedError}</p>}
          {!voidedLoading && !voidedError && (voidedDirectory?.data.length ?? 0) === 0 && (
            <p className="text-sm text-slate-500">No voided members in the last 30 days.</p>
          )}
          <div className="flex flex-col gap-2">
            {(voidedDirectory?.data || []).map((customer) => {
              const voidedMs = customer.voidedAt ? new Date(customer.voidedAt).getTime() : Date.now();
              const daysLeft = Math.max(
                0,
                30 - Math.floor((Date.now() - voidedMs) / (24 * 60 * 60 * 1000))
              );
              return (
                <div
                  key={customer.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50/40 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{customer.name}</p>
                    <p className="text-xs text-slate-600">
                      {customer.phone} {customer.membershipNumber && `| ${customer.membershipNumber}`}
                    </p>
                    {customer.voidReason && (
                      <p className="mt-0.5 text-xs text-slate-600">Reason: {customer.voidReason}</p>
                    )}
                    <p className="mt-1 text-[11px] text-rose-700 font-medium">
                      Voided {customer.voidedAt ? showDate(customer.voidedAt) : ''} · {daysLeft} day{daysLeft === 1 ? '' : 's'} left to restore
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={restoringId === customer.id}
                    onClick={() => { void handleRestoreMember(customer); }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    {restoringId === customer.id ? 'Restoring...' : 'Restore Member'}
                  </button>
                </div>
              );
            })}
          </div>
          {voidedDirectory && voidedDirectory.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 text-xs">
              <button
                type="button"
                aria-label="Previous voided page"
                disabled={voidedPage <= 1}
                onClick={() => setVoidedPage((p) => p - 1)}
                className="rounded border px-2 py-1 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span>
                Page {voidedPage} of {voidedDirectory.pagination.totalPages} · {voidedDirectory.pagination.total} voided
              </span>
              <button
                type="button"
                aria-label="Next voided page"
                disabled={voidedPage >= voidedDirectory.pagination.totalPages}
                onClick={() => setVoidedPage((p) => p + 1)}
                className="rounded border px-2 py-1 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
