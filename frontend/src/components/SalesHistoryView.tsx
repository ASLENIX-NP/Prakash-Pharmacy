import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Search, 
  Printer, 
  Download, 
  Calendar, 
  User, 
  Filter, 
  Eye, 
  CheckCircle2, 
  Banknote, 
  QrCode, 
  CreditCard,
  RotateCcw
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { useDialog } from '../context/DialogContext';
import { SaleInvoice } from '../types/pharmacy';
import { exportSalesBookToExcel } from '../utils/excelUtils';
import { salesDemoInvoices } from '../data/salesDemoData';
import { SalesReturnModal } from './SalesReturnModal';

export const SalesHistoryView: React.FC = () => {
  const { showToast } = useDialog();
  const {
    salesInvoices,
    isSalesDemoDataActive,
    clearSalesDemoData,
    setActiveInvoiceToPrint,
    settings,
  } = usePharmacy();

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | '7days' | 'month'>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<SaleInvoice | null>(null);
  const [returningInvoice, setReturningInvoice] = useState<SaleInvoice | null>(null);

  const registerInvoices = useMemo(
    () => isSalesDemoDataActive
      ? [...salesInvoices, ...salesDemoInvoices]
      : salesInvoices,
    [isSalesDemoDataActive, salesInvoices]
  );

  // Filter sales
  const filteredSales = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    return registerInvoices.filter(inv => {
      // Search
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || 
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        (inv.customerPhone && inv.customerPhone.includes(q)) ||
        (inv.doctorName && inv.doctorName.toLowerCase().includes(q)) ||
        inv.items.some(it => it.medicineName.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // Date
      if (dateFilter === 'today') return inv.date === todayStr;
      if (dateFilter === 'yesterday') return inv.date === yesterdayStr;
      if (dateFilter === '7days') return new Date(inv.date) >= sevenDaysAgo;
      if (dateFilter === 'month') return new Date(inv.date) >= firstOfMonth;

      return true;
    });
  }, [registerInvoices, searchQuery, dateFilter]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalRevenue = filteredSales.reduce((acc, s) => acc + s.grandTotal, 0);
    const totalVat = filteredSales.reduce((acc, s) => acc + s.vatAmount, 0);
    const totalExempt = filteredSales.reduce((acc, s) => acc + s.vatExemptSubtotal, 0);
    const totalTaxable = filteredSales.reduce((acc, s) => acc + s.taxableBaseSubtotal, 0);
    return { totalRevenue, totalVat, totalExempt, totalTaxable };
  }, [filteredSales]);

  return (
    <div className="space-y-5 pb-3">
      {isSalesDemoDataActive && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950 shadow-sm"
        >
          <div>
            <strong className="font-extrabold">Demo sales are active.</strong>
            <span className="ml-1 text-amber-800">
              Sample invoices are only visible in this register and cannot be printed as statutory bills.
            </span>
          </div>
          <button
            type="button"
            onClick={clearSalesDemoData}
            className="rounded-xl border border-amber-300 bg-white px-3 py-1.5 font-bold text-amber-900 transition hover:bg-amber-100"
          >
            Remove demo data
          </button>
        </div>
      )}

      {/* View Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.02)]">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-teal-50 text-teal-800 ring-1 ring-teal-100">
            <FileText className="h-5 w-5" strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
              Sales Register &amp; Statutory Tax Invoices
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm">
              Billing audit log and sales history for IRD Nepal VAT compliance
            </p>
          </div>
        </div>

        <button
          onClick={() => exportSalesBookToExcel(filteredSales, settings.storeName)}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export Sales Book (.xlsx)</span>
        </button>
      </div>

      {/* Aggregate Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Total Revenue',
            value: stats.totalRevenue,
            detail: `${filteredSales.length} bills completed`,
            accent: 'teal',
            icon: <Banknote className="h-4 w-4" />
          },
          {
            label: 'VAT-Free Sales',
            value: stats.totalExempt,
            detail: '0% VAT therapeutic drugs',
            accent: 'emerald',
            icon: <CheckCircle2 className="h-4 w-4" />
          },
          {
            label: 'Taxable Base',
            value: stats.totalTaxable,
            detail: 'Subject to 13% VAT',
            accent: 'blue',
            icon: <Filter className="h-4 w-4" />
          },
          {
            label: '13% VAT Collected',
            value: stats.totalVat,
            detail: 'Payable to IRD Nepal',
            accent: 'indigo',
            icon: <QrCode className="h-4 w-4" />
          }
        ].map((card) => (
          <div
            key={card.label}
            className={`rounded-[20px] border p-4 shadow-[0_1px_0_rgba(15,23,42,0.02)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
              card.accent === 'teal'
                ? 'border-teal-100 bg-teal-50/80'
                : card.accent === 'emerald'
                  ? 'border-emerald-100 bg-emerald-50/80'
                  : card.accent === 'blue'
                    ? 'border-blue-100 bg-blue-50/80'
                    : 'border-indigo-100 bg-indigo-50/80'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ring-1 ${
                card.accent === 'teal'
                  ? 'bg-white text-teal-700 ring-teal-100'
                  : card.accent === 'emerald'
                    ? 'bg-white text-emerald-700 ring-emerald-100'
                    : card.accent === 'blue'
                      ? 'bg-white text-blue-700 ring-blue-100'
                      : 'bg-white text-indigo-700 ring-indigo-100'
              }`}>
                {card.icon}
              </span>
              <span className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${
                card.accent === 'teal'
                  ? 'text-teal-700'
                  : card.accent === 'emerald'
                    ? 'text-emerald-700'
                    : card.accent === 'blue'
                      ? 'text-blue-700'
                      : 'text-indigo-700'
              }`}>
                Summary
              </span>
            </div>
            <div className="mt-5">
              <div className="text-[11px] font-medium text-slate-500">{card.label}</div>
              <div className={`mt-2 font-mono text-[1.75rem] font-extrabold leading-none tracking-[-0.05em] tabular-nums ${
                card.accent === 'teal'
                  ? 'text-teal-800'
                  : card.accent === 'emerald'
                    ? 'text-emerald-800'
                    : card.accent === 'blue'
                      ? 'text-blue-800'
                      : 'text-indigo-800'
              }`}>
                Rs. {card.value.toFixed(2)}
              </div>
              <div className="mt-2 text-[11px] leading-relaxed text-slate-500">{card.detail}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-slate-200 bg-white p-3 shadow-[0_1px_0_rgba(15,23,42,0.02)]">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: 'all', label: `All Time (${registerInvoices.length})`, active: dateFilter === 'all' },
            { key: 'today', label: 'Today', active: dateFilter === 'today' },
            { key: 'yesterday', label: 'Yesterday', active: dateFilter === 'yesterday' },
            { key: '7days', label: 'Last 7 Days', active: dateFilter === '7days' },
            { key: 'month', label: 'This Month', active: dateFilter === 'month' }
          ].map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setDateFilter(filter.key as 'all' | 'today' | 'yesterday' | '7days' | 'month')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                filter.active
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[260px] flex-1 sm:max-w-[320px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search invoice #, customer, doctor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      {/* Sales Invoices Table */}
      <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_1px_0_rgba(15,23,42,0.02)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em]">Date &amp; Time</th>
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em]">Tax Invoice #</th>
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em]">Patient / Customer</th>
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em]">Items Sold</th>
                <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-[0.08em]">0% VAT Exempt</th>
                <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-[0.08em]">Taxable Base</th>
                <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-[0.08em]">13% VAT</th>
                <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-[0.08em]">Payment</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.08em]">Grand Total</th>
                <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-[0.08em]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.map((inv) => (
                <tr key={inv.id} className="transition-colors hover:bg-slate-50/70">
                  <td className="px-4 py-3 align-top text-slate-500">
                    <div className="text-[11px] font-semibold text-slate-700">{inv.date}</div>
                    <div className="mt-1 text-[10px] text-slate-400">{inv.time}</div>
                  </td>

                  <td className="px-3 py-3 align-top font-mono text-[11px] font-bold text-slate-900">
                    {inv.invoiceNumber}
                  </td>

                  <td className="px-3 py-3 align-top">
                    <div className="font-semibold text-slate-900">{inv.customerName}</div>
                    {inv.doctorName && (
                      <div className="mt-1 text-[10px] text-slate-500">Dr: {inv.doctorName}</div>
                    )}
                  </td>

                  <td className="px-3 py-3 align-top text-slate-600">
                    <div className="font-medium text-slate-700">{inv.items.length} item{inv.items.length > 1 ? 's' : ''}</div>
                    <div className="mt-1 max-w-[180px] truncate text-[10px] text-slate-400">
                      {inv.items.map((it) => it.medicineName).join(', ')}
                    </div>
                  </td>

                  <td className="px-3 py-3 align-top text-right font-mono text-[11px] font-semibold text-emerald-700">
                    Rs. {inv.vatExemptSubtotal.toFixed(2)}
                  </td>

                  <td className="px-3 py-3 align-top text-right font-mono text-[11px] text-slate-700">
                    Rs. {inv.taxableBaseSubtotal.toFixed(2)}
                  </td>

                  <td className="px-3 py-3 align-top text-right font-mono text-[11px] font-bold text-blue-700">
                    Rs. {inv.vatAmount.toFixed(2)}
                  </td>

                  <td className="px-3 py-3 align-top text-center">
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-700">
                      {inv.paymentMode.replace('_', ' ')}
                    </span>
                  </td>

                  <td className="px-4 py-3 align-top text-right font-mono text-sm font-extrabold text-slate-900">
                    Rs. {inv.grandTotal.toFixed(2)}
                  </td>

                  <td className="px-3 py-3 align-top text-right">
                    {inv.id.startsWith('demo-sale-') ? (
                      <span className="inline-flex rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-amber-700">
                        Demo
                      </span>
                    ) : (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setReturningInvoice(inv)}
                          className="inline-flex items-center justify-center gap-1 rounded-xl border border-teal-200 bg-teal-50 px-2.5 py-2 text-[11px] font-semibold text-teal-800 transition hover:border-teal-300 hover:bg-teal-100"
                          title="Process customer return / refund"
                        >
                          <RotateCcw className="h-3 w-3 text-teal-600" />
                          <span>Return</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveInvoiceToPrint(inv)}
                          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                          title="View official VAT Tax Invoice"
                        >
                          <span>View</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}

              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    No sales invoices found matching the current search or filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sales Return Modal */}
      {returningInvoice && (
        <SalesReturnModal
          invoice={returningInvoice}
          onClose={() => setReturningInvoice(null)}
          onSuccess={(refund) => {
            showToast(`Sales return processed successfully! Refund amount: Rs. ${refund.toFixed(2)}`, 'success', 'Return Processed');
            setReturningInvoice(null);
          }}
        />
      )}
    </div>
  );
};
