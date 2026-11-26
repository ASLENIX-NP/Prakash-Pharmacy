import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, Loader2, Plus, Printer, RefreshCw, Trash2 } from 'lucide-react';
import { apiRequest } from '../services/api';
import { ProcedureBillPreview, type ProcedureInvoice } from './ProcedureBillPreview';
import { useDialog } from '../context/DialogContext';
import type { MemberHandoff, RegisteredMemberHandoff } from '../types/memberHandoff';

type Invoice = ProcedureInvoice;
type HistoryResponse = { success: boolean; data: Invoice[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } };
type HistoryFilters = { patientName: string; patientPhone: string; receipt: string };
const emptyHistoryFilters = (): HistoryFilters => ({ patientName: '', patientPhone: '', receipt: '' });
type Line = { key: string; name: string; unitFee: string };
const blankLine = (): Line => ({ key: crypto.randomUUID(), name: '', unitFee: '' });
const validChargeCents = (value: string): number | null => {
  if (!/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
};
const currency = (n: number) => `Rs. ${Number(n).toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cleanPhone = (s: string) => s.replace(/\D/g, '').slice(0, 10);
const newRequestId = () => crypto.randomUUID();

type Props = {
  memberHandoff?: MemberHandoff | null;
  onMemberHandoffConsumed?: () => void;
};

export const ProceduresPanel: React.FC<Props> = ({ memberHandoff, onMemberHandoffConsumed }) => {
  const { confirmDialog } = useDialog();
  const [items, setItems] = useState<Line[]>([blankLine()]);
  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [payment, setPayment] = useState<'cash' | 'fonepay_qr' | 'card'>('cash');
  const [notes, setNotes] = useState('');
  const [requestId, setRequestId] = useState(newRequestId);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [saved, setSaved] = useState<Invoice | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [historyName, setHistoryName] = useState('');
  const [historyPhone, setHistoryPhone] = useState('');
  const [historyReceipt, setHistoryReceipt] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<HistoryFilters>(emptyHistoryFilters);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [section, setSection] = useState<'billing' | 'history'>('billing');
  const [prefilledMemberName, setPrefilledMemberName] = useState('');
  const [memberFound, setMemberFound] = useState<RegisteredMemberHandoff | null>(null);
  const [memberLookupStatus, setMemberLookupStatus] = useState<'idle' | 'loading' | 'found' | 'missing' | 'error'>('idle');
  const [selectedMember, setSelectedMember] = useState<RegisteredMemberHandoff | null>(null);

  useEffect(() => {
    if (!memberHandoff || memberHandoff.destination !== 'procedures') return;
    const member = memberHandoff.member;
    // Prefill a draft. Never associate a Clinic patient solely because of a shared phone.
    setSection('billing');
    setPatientName(member.name);
    setPhone(cleanPhone(member.phone));
    setMemberFound(null);
    // Member came from an authenticated member directory; API verifies again before billing.
    setSelectedMember(member);
    setPrefilledMemberName(`${member.name} (${member.membershipNumber})`);
    setError('');
    setMessage('');
    onMemberHandoffConsumed?.();
  }, [memberHandoff?.nonce]);

  const change = () => { setRequestId(newRequestId()); setSaved(null); };
  const totalCents = useMemo(() => items.reduce((sum, line) => {
    const cents = validChargeCents(line.unitFee);
    return sum + (cents ?? 0);
  }, 0), [items]);
  const total = totalCents / 100;
  const itemsValid = items.length > 0 && items.length <= 20 && items.every(line =>
    line.name.trim().length >= 2 && line.name.trim().length <= 100 &&
    validChargeCents(line.unitFee) !== null && (validChargeCents(line.unitFee) ?? 0) > 0
  ) && totalCents > 0 && totalCents <= 999999999;

  const loadHistory = useCallback(async (p: number, filters: HistoryFilters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (filters.patientName) params.set('patientName', filters.patientName);
      if (filters.patientPhone) params.set('patientPhone', filters.patientPhone);
      if (filters.receipt) params.set('receipt', filters.receipt);
      const response = await apiRequest<HistoryResponse>(`/clinic-procedures?${params}`);
      setInvoices(response.data);
      setPages(response.pagination.totalPages);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load procedure bills.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadHistory(page, appliedFilters); }, [loadHistory, page, appliedFilters]);

  // POS-style live member lookup using the existing patient phone input.
  // No separate search field or Clinic-number lookup in Procedures.
  useEffect(() => {
    setMemberFound(null);
    if (!/^\d{10}$/.test(phone)) {
      setMemberLookupStatus('idle');
      return;
    }
    const controller = new AbortController();
    setMemberLookupStatus('loading');
    const timer = window.setTimeout(async () => {
      try {
        const response = await apiRequest<{ success: boolean; data: RegisteredMemberHandoff | null }>(
          `/customers/lookup?phone=${encodeURIComponent(phone)}`,
          { signal: controller.signal }
        );
        if (controller.signal.aborted) return;
        const member = response.data;
        if (member?.membershipNumber && member.memberSince && member.phone === phone) {
          setMemberFound(member);
          setMemberLookupStatus('found');
        } else {
          setMemberLookupStatus('missing');
        }
      } catch {
        if (!controller.signal.aborted) setMemberLookupStatus('error');
      }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [phone]);

  const useMemberDetails = (member: RegisteredMemberHandoff) => {
    if (member.phone !== phone || !member.membershipNumber || !member.memberSince) return;
    setSelectedMember(member);
    setPatientName(member.name);
    setPrefilledMemberName(`${member.name} (${member.membershipNumber})`);
    setError('');
    change();
  };

  const updateItem = (key: string, patch: Partial<Pick<Line, 'name' | 'unitFee'>>) => {
    setItems(current => current.map(item => item.key === key ? { ...item, ...patch } : item));
    change();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting || confirming) return;
    if (patientName.trim().length < 2) { setError('Enter the patient name.'); return; }
    if (phone && !/^\d{10}$/.test(phone)) { setError('Phone must contain exactly 10 digits.'); return; }
    if (!itemsValid) { setError('Enter a procedure type and valid charge for each line.'); return; }
    setConfirming(true);
    let confirmed = false;
    try {
      const methodLabel = payment === 'fonepay_qr' ? 'Fonepay QR' : payment === 'card' ? 'card' : 'cash';
      confirmed = await confirmDialog({
        title: 'Confirm procedure payment',
        message: `Confirm ${currency(total)} received via ${methodLabel}?\n\nThis records a paid procedure bill. Verify the payment before confirming.`,
        confirmLabel: 'Confirm & Save Bill',
        cancelLabel: 'Review Details',
        type: 'primary',
      });
    } finally {
      setConfirming(false);
    }
    if (!confirmed) return;
    setSubmitting(true);
    setError(''); setMessage('');
    try {
      const response = await apiRequest<{ data: Invoice; duplicate?: boolean }>('/clinic-procedures', {
        method: 'POST',
        body: JSON.stringify({
          clientRequestId: requestId,
          patientId: null,
          // Only use an explicitly selected, current member with matching identity.
          customerId: selectedMember && selectedMember.phone === phone &&
            selectedMember.name.trim().replace(/\s+/g, ' ').toLowerCase() ===
            patientName.trim().replace(/\s+/g, ' ').toLowerCase()
              ? selectedMember.id : null,
          patientName: patientName.trim(),
          patientPhone: phone || null,
          paymentMethod: payment, notes: notes.trim(), items: items.map(({ name, unitFee }) => ({ name: name.trim(), unitFee, quantity: 1 })),
        }),
      });
      setSaved(response.data);
      setPreviewInvoice(response.data);
      setMessage(response.duplicate ? 'Previously recorded payment retrieved. No duplicate created.' : `Paid procedure bill ${response.data.invoiceNumber} saved.`);
      setItems([blankLine()]); setPatientName(''); setPhone(''); setNotes(''); setPrefilledMemberName(''); setMemberFound(null); setSelectedMember(null);
      setRequestId(newRequestId());
      setPage(1); setAppliedFilters(emptyHistoryFilters());
      setHistoryName(''); setHistoryPhone(''); setHistoryReceipt('');
    } catch (err) {
      setError(`${err instanceof Error ? err.message : 'Unable to save procedure bill.'} Check history before attempting payment again.`);
    } finally { setSubmitting(false); }
  };

  return <div className="space-y-5">
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900"><ClipboardList className="h-5 w-5 text-teal-700" /> Pharmacist Procedures</h2>
          <p className="mt-1 text-sm text-slate-500">Services handled by a pharmacist, with separate billing and bill history.</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSection('billing')} className={`rounded-lg px-3 py-2 text-sm font-bold ${section === 'billing' ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-700'}`}>New Procedure Bill</button>
          <button type="button" onClick={() => setSection('history')} className={`rounded-lg px-3 py-2 text-sm font-bold ${section === 'history' ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-700'}`}>Bill History</button>
        </div>
      </div>
    </div>

    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
    {message && <div role="status" className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">{message}</div>}

    {section === 'billing' && <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <form onSubmit={submit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-slate-900">Patient details</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-700">Patient name *
            <input required maxLength={120} disabled={submitting} value={patientName}
              onChange={e => { setPatientName(e.target.value); setSelectedMember(null); setPrefilledMemberName(''); change(); }}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" placeholder="Walk-in patient name" />
          </label>
          <label className="text-xs font-bold text-slate-700">Phone (optional)
            <input type="tel" inputMode="numeric" maxLength={10} disabled={submitting} value={phone}
              onChange={e => { setPhone(cleanPhone(e.target.value)); setSelectedMember(null); setPrefilledMemberName(''); change(); }}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" placeholder="10-digit mobile" />
          </label>
        </div>
        {memberLookupStatus === 'loading' && <p role="status" className="text-xs text-slate-600">Checking registered members...</p>}
        {memberLookupStatus === 'error' && <p role="status" className="text-xs text-amber-800">Unable to verify membership. You can still create a walk-in bill.</p>}
        {memberLookupStatus === 'found' && memberFound && memberFound.phone === phone && (
          <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm">
            <p className="font-bold text-teal-900">Registered Member Found</p>
            <p className="mt-1 text-slate-700">{memberFound.name} | {memberFound.membershipNumber}</p>
            <p className="text-slate-600">Phone: {memberFound.phone}</p>
            <p className="text-slate-600">Address: {memberFound.address || 'Not available'}</p>
            <button type="button" onClick={() => useMemberDetails(memberFound)}
              disabled={submitting}
              className="mt-2 rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-50">
              Use Member Details
            </button>
          </div>
        )}
        {selectedMember && selectedMember.phone === phone && prefilledMemberName && (
          <p role="status" className="rounded-lg border border-teal-300 bg-teal-50 p-3 text-xs font-bold text-teal-900">
            Using verified member: {prefilledMemberName}
          </p>
        )}
        <p className="text-xs text-slate-500">A shared phone number alone never links another person to this membership. Walk-in procedure bills remain available.</p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-slate-900">Procedure details & charges</h3>
          <span className="text-xs text-slate-500">Type the procedure and set the charge for this bill</span>
        </div>
        <div className="space-y-3">
          {items.map((item, index) => <div key={item.key} className="grid items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(145px,180px)_38px]">
            <label className="block text-xs font-bold text-slate-700">Procedure type *
              <input required minLength={2} maxLength={100} disabled={submitting} value={item.name}
                onChange={e => updateItem(item.key, { name: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm font-normal"
                placeholder="e.g. Wound dressing - large" />
            </label>
            <label className="block text-xs font-bold text-slate-700">Charge (Rs.) *
              <input required type="number" inputMode="decimal" min="0.01" max="9999999.99" step="0.01" disabled={submitting} value={item.unitFee}
                onChange={e => updateItem(item.key, { unitFee: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm font-normal" placeholder="0.00" />
            </label>
            <button type="button" aria-label={`Remove procedure ${index + 1}`} disabled={submitting || items.length === 1}
              onClick={() => { setItems(current => current.filter(line => line.key !== item.key)); change(); }}
              className="flex h-10 items-center justify-center rounded-lg border border-rose-200 text-rose-700 disabled:opacity-40" title="Remove this line"><Trash2 size={16} /></button>
          </div>)}
        </div>
        <button type="button" disabled={submitting || items.length >= 20} onClick={() => { setItems(current => [...current, blankLine()]); change(); }}
          className="inline-flex items-center gap-2 rounded-lg border border-teal-300 px-3 py-2 text-sm font-bold text-teal-800 disabled:opacity-50"><Plus size={16} /> Add another procedure</button>
        <label className="block text-xs font-bold text-slate-700">Notes (optional)
          <textarea maxLength={300} value={notes} onChange={e => { setNotes(e.target.value); change(); }} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" rows={2} />
        </label>
        <div className="rounded-xl bg-slate-50 p-4"><div className="flex items-center justify-between text-sm"><span>Procedure total</span><strong className="text-xl text-teal-800">{currency(total)}</strong></div></div>
        <div><label className="block text-xs font-bold text-slate-700">Payment received by *</label>
          <div className="mt-2 flex flex-wrap gap-2">{(['cash', 'fonepay_qr', 'card'] as const).map(m => <button key={m} type="button" disabled={submitting} onClick={() => { setPayment(m); change(); }} className={`rounded-lg px-4 py-2 text-sm font-semibold ${payment === m ? 'bg-teal-700 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}>{m === 'fonepay_qr' ? 'Fonepay QR' : m === 'card' ? 'Card' : 'Cash'}</button>)}</div>
        </div>
        <button type="submit" disabled={submitting || confirming || !itemsValid} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 p-3 font-bold text-white disabled:opacity-50">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Confirm Payment & Save Bill
        </button>
      </form>
      <aside className="space-y-4">
        {saved ? <div className="rounded-2xl border border-teal-300 bg-teal-50 p-5">
          <h3 className="font-bold text-teal-900">Payment recorded</h3><p className="mt-2 font-mono text-lg">{saved.invoiceNumber}</p>
          <p className="mt-1 text-sm">{saved.patientName} · {currency(saved.totalAmount)}</p>
          <button type="button" onClick={() => setPreviewInvoice(saved)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white"><Printer size={16} /> View / Print Bill</button>
        </div> : <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Procedure bills are saved separately from doctor consultation and medicine POS sales.</div>}
        <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold" type="button" onClick={() => { setSection('history'); void loadHistory(page, appliedFilters); }}><RefreshCw size={16} /> View procedure history</button>
      </aside>
    </div>}

    {section === 'history' && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900">Procedure Bill History</h3>
      <p className="mt-1 text-xs text-slate-500">Completed payments only. Recorded bills cannot be edited or deleted here.</p>
      <form className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] xl:items-end"
        onSubmit={e => {
          e.preventDefault();
          setError('');
          setPage(1);
          setAppliedFilters({
            patientName: historyName.trim(),
            patientPhone: historyPhone,
            receipt: historyReceipt.trim(),
          });
        }}>
        <label className="block min-w-0 text-xs font-semibold text-slate-700">Patient name
          <input type="search" value={historyName} maxLength={120} onChange={e => setHistoryName(e.target.value)}
            className="mt-1 block w-full min-w-0 rounded-lg border border-slate-300 p-2 text-sm font-normal"
            placeholder="Search by name" />
        </label>
        <label className="block min-w-0 text-xs font-semibold text-slate-700">Phone number
          <input type="tel" inputMode="numeric" maxLength={10} pattern="[0-9]*"
            value={historyPhone} onChange={e => setHistoryPhone(cleanPhone(e.target.value))}
            className="mt-1 block w-full min-w-0 rounded-lg border border-slate-300 p-2 text-sm font-normal"
            placeholder="Up to 10 digits" />
        </label>
        <label className="block min-w-0 text-xs font-semibold text-slate-700">Receipt number (optional)
          <input type="search" value={historyReceipt} maxLength={32} onChange={e => setHistoryReceipt(e.target.value)}
            className="mt-1 block w-full min-w-0 rounded-lg border border-slate-300 p-2 text-sm font-normal"
            placeholder="PRC-000001" />
        </label>
        <button className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white" type="submit">Search</button>
        <button type="button" onClick={() => {
          setHistoryName(''); setHistoryPhone(''); setHistoryReceipt('');
          setAppliedFilters(emptyHistoryFilters()); setPage(1); setError('');
        }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Reset</button>
      </form>
      {loading && <p className="mt-3 text-sm text-slate-500">Loading receipts...</p>}
      <div className="mt-4 space-y-3">{invoices.map(invoice => <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
        <div><p className="font-mono text-sm font-bold">{invoice.invoiceNumber} <span className="ml-2 font-sans text-xs font-semibold text-teal-700">PAID</span></p>
          <p className="mt-1 text-sm font-semibold">{invoice.patientName} {invoice.clinicNumber && <span className="font-normal text-slate-500">({invoice.clinicNumber})</span>}</p>
          <p className="mt-1 text-xs text-slate-500">{new Date(invoice.createdAt).toLocaleString('en-NP', { timeZone: 'Asia/Kathmandu' })} · {invoice.items.map(i => i.serviceName).join(', ')}</p>
          <p className="mt-1 text-xs text-slate-500">Collected by: {invoice.createdBy?.name || 'Staff'} · {invoice.paymentMethod.replace(/_/g, ' ')}</p></div>
        <div className="flex items-center gap-3"><strong className="text-teal-800">{currency(invoice.totalAmount)}</strong>
          <button type="button" onClick={() => setPreviewInvoice(invoice)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"><Printer size={16} /> Bill</button></div>
      </div>)}</div>
      {!loading && invoices.length === 0 && <p className="mt-4 text-sm text-slate-500">No procedure bills found.</p>}
      <div className="mt-4 flex items-center justify-end gap-2 text-sm"><button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40" type="button">Previous</button><span>{page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40" type="button">Next</button></div>
    </section>}

    <ProcedureBillPreview invoice={previewInvoice} onClose={() => setPreviewInvoice(null)} />
  </div>;
};
