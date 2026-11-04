import React, { useState, useMemo } from 'react';
import {
  Search,
  Calendar,
  CreditCard,
  CheckCircle2,
  Clock,
  Phone,
  MapPin,
  Printer,
  FileSpreadsheet,
  Receipt,
  User,
  Pill,
  ChevronDown,
  ChevronUp,
  X,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { SaleInvoice } from '../types/pharmacy';
import { localDateString } from '../utils/date';

export const CustomerCreditView: React.FC = () => {
  const {
    salesInvoices,
    settleCreditInvoice,
    setActiveInvoiceToPrint,
    settings,
  } = usePharmacy();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('unpaid');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'this_week' | 'this_month'>('all');
  const [expandedInvoiceIds, setExpandedInvoiceIds] = useState<Set<string>>(new Set());

  // Settlement Modal State
  const [settlingInvoice, setSettlingInvoice] = useState<SaleInvoice | null>(null);
  const [settlementMethod, setSettlementMethod] = useState<'cash' | 'fonepay_qr' | 'card'>('cash');
  const [isSubmittingSettlement, setIsSubmittingSettlement] = useState(false);
  const [settleError, setSettleError] = useState('');

  const todayStr = localDateString();

  // Filter only credit invoices
  const allCreditInvoices = useMemo(() => {
    return (salesInvoices || []).filter(
      (inv) => inv.paymentMode === 'credit'
    );
  }, [salesInvoices]);

  // Apply search & status & date filters
  const filteredInvoices = useMemo(() => {
    return allCreditInvoices.filter((inv) => {
      // 1. Status Filter
      const isPaid = inv.paymentStatus === 'paid';
      if (statusFilter === 'unpaid' && isPaid) return false;
      if (statusFilter === 'paid' && !isPaid) return false;

      // 2. Date Filter
      const invDate = inv.date || '';
      if (dateFilter === 'today' && invDate !== todayStr) return false;
      if (dateFilter === 'this_week') {
        const d = new Date(invDate);
        const now = new Date();
        const diffDays = (now.getTime() - d.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 7) return false;
      }
      if (dateFilter === 'this_month') {
        const d = new Date(invDate);
        const now = new Date();
        if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) {
          return false;
        }
      }

      // 3. Search Term
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase().trim();
      const matchName = (inv.customerName || '').toLowerCase().includes(q);
      const matchPhone = (inv.customerPhone || '').toLowerCase().includes(q);
      const matchAddress = (inv.customerAddress || '').toLowerCase().includes(q);
      const matchInvoice = (inv.invoiceNumber || '').toLowerCase().includes(q);
      const matchMedicine = (inv.items || []).some(
        (it) => (it.medicineName || '').toLowerCase().includes(q)
      );

      return matchName || matchPhone || matchAddress || matchInvoice || matchMedicine;
    });
  }, [allCreditInvoices, statusFilter, dateFilter, searchTerm, todayStr]);

  // Helper to calculate returns and net due
  const getInvoiceReturns = (inv: SaleInvoice): number => {
    return (inv.salesReturns || []).reduce((sum, r) => sum + (r.refundAmount || 0), 0);
  };

  const getInvoiceNetDue = (inv: SaleInvoice): number => {
    if (inv.paymentStatus === 'paid') return 0;
    const returned = getInvoiceReturns(inv);
    return Math.max(0, (inv.grandTotal || 0) - returned - (inv.cashTendered || 0));
  };

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalOutstanding = 0;
    let totalCreditSales = 0;
    let totalSettled = 0;
    let totalReturnsDeducted = 0;
    let unpaidCount = 0;
    let paidCount = 0;
    const customerSet = new Set<string>();

    allCreditInvoices.forEach((inv) => {
      const grand = inv.grandTotal || 0;
      const returned = getInvoiceReturns(inv);
      const netDue = getInvoiceNetDue(inv);

      totalCreditSales += grand;
      totalReturnsDeducted += returned;

      if (inv.paymentStatus === 'paid' || netDue <= 0.001) {
        totalSettled += (grand - returned);
        paidCount++;
      } else {
        totalOutstanding += netDue;
        unpaidCount++;
        customerSet.add((inv.customerPhone || inv.customerName || '').toLowerCase().trim());
      }
    });

    return {
      totalOutstanding,
      totalCreditSales,
      totalSettled,
      totalReturnsDeducted,
      unpaidCount,
      paidCount,
      totalCustomers: customerSet.size,
    };
  }, [allCreditInvoices]);

  const toggleExpand = (invoiceId: string) => {
    setExpandedInvoiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(invoiceId)) {
        next.delete(invoiceId);
      } else {
        next.add(invoiceId);
      }
      return next;
    });
  };

  const handleOpenSettleModal = (inv: SaleInvoice) => {
    setSettlingInvoice(inv);
    setSettlementMethod('cash');
    setSettleError('');
  };

  const handleConfirmSettlement = async () => {
    if (!settlingInvoice) return;
    try {
      setIsSubmittingSettlement(true);
      setSettleError('');
      await settleCreditInvoice(settlingInvoice.id, settlementMethod);
      setSettlingInvoice(null);
    } catch (err: any) {
      setSettleError(err?.message || 'Failed to settle credit bill.');
    } finally {
      setIsSubmittingSettlement(false);
    }
  };

  const handleExportCSV = () => {
    if (filteredInvoices.length === 0) return;
    const headers = [
      'Invoice No',
      'Date',
      'Customer Name',
      'Phone',
      'Address',
      'Prescribing Doctor',
      'Grand Total (NPR)',
      'Status',
      'Medicines Taken',
    ];

    const rows = filteredInvoices.map((inv) => {
      const medicinesStr = (inv.items || [])
        .map(
          (it) =>
            `${it.medicineName} (${it.quantity} ${it.isLooseUnit ? 'units' : 'packs'})`
        )
        .join('; ');

      return [
        `"${inv.invoiceNumber}"`,
        `"${inv.date} ${inv.time || ''}"`,
        `"${inv.customerName || ''}"`,
        `"${inv.customerPhone || ''}"`,
        `"${inv.customerAddress || ''}"`,
        `"${inv.doctorName || ''}"`,
        (inv.grandTotal || 0).toFixed(2),
        `"${inv.paymentStatus === 'paid' ? 'Settled' : 'Unpaid (Due)'}"`,
        `"${medicinesStr.replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `customer_credit_report_${todayStr}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Customer Credit & Udhaaro Ledger
          </h1>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Track unpaid credit balances, customer medicine reports, and record debt settlements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Outstanding Credit */}
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-white to-amber-50/60 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800">Total Outstanding (Due)</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-amber-950">
            Rs. {metrics.totalOutstanding.toFixed(2)}
          </p>
          <p className="mt-1.5 text-[11px] font-semibold text-amber-700">
            {metrics.unpaidCount} unpaid invoices across {metrics.totalCustomers} customers
          </p>
        </div>

        {/* Total Settled */}
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800">Total Settled / Recovered</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-emerald-950">
            Rs. {metrics.totalSettled.toFixed(2)}
          </p>
          <p className="mt-1.5 text-[11px] font-semibold text-emerald-700">
            {metrics.paidCount} credit invoices cleared
          </p>
        </div>

        {/* Total Credit Sales Given */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Total Credit Sales (All Time)</span>
            <Receipt className="h-4 w-4 text-slate-500" />
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-slate-900">
            Rs. {metrics.totalCreditSales.toFixed(2)}
          </p>
          <p className="mt-1.5 text-[11px] font-medium text-slate-500">
            {allCreditInvoices.length} total credit bills generated
          </p>
        </div>

        {/* Recovery Rate */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Credit Recovery Rate</span>
            <CreditCard className="h-4 w-4 text-teal-600" />
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-teal-700">
            {metrics.totalCreditSales > 0
              ? ((metrics.totalSettled / metrics.totalCreditSales) * 100).toFixed(1)
              : '100'}
            %
          </p>
          <p className="mt-1.5 text-[11px] font-medium text-slate-500">
            Collected of total credit issued
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search customer name, phone, address, invoice #, medicine..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-xs font-medium text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setStatusFilter('unpaid')}
              className={`rounded-lg px-3 py-1.5 transition ${
                statusFilter === 'unpaid'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Due Only ({metrics.unpaidCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('paid')}
              className={`rounded-lg px-3 py-1.5 transition ${
                statusFilter === 'paid'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Settled ({metrics.paidCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`rounded-lg px-3 py-1.5 transition ${
                statusFilter === 'all'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({allCreditInvoices.length})
            </button>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="this_week">Last 7 Days</option>
              <option value="this_month">This Month</option>
            </select>
          </div>
        </div>
      </div>

      {/* Credit Invoices Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {filteredInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <CreditCard className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-bold text-slate-800">No credit invoices found</p>
            <p className="mt-1 text-xs text-slate-500">
              {statusFilter === 'unpaid'
                ? 'All customer credit accounts are currently settled!'
                : 'No credit transactions match the current filter criteria.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredInvoices.map((inv) => {
              const returnsTotal = getInvoiceReturns(inv);
              const netDue = getInvoiceNetDue(inv);
              const isPaid = inv.paymentStatus === 'paid' || netDue <= 0.001;
              const isExpanded = expandedInvoiceIds.has(inv.id);
              const itemsCount = inv.items?.length || 0;

              return (
                <div key={inv.id} className="transition hover:bg-slate-50/60">
                  {/* Summary Row */}
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3.5">
                      <button
                        type="button"
                        onClick={() => toggleExpand(inv.id)}
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-200"
                        title={isExpanded ? 'Collapse medicines' : 'Expand medicine report'}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-extrabold text-slate-900">
                            {inv.invoiceNumber}
                          </span>
                          <span className="text-[11px] font-medium text-slate-500">
                            {inv.date} {inv.time ? `· ${inv.time}` : ''}
                          </span>
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 ring-1 ring-emerald-200">
                              <CheckCircle2 className="h-3 w-3" /> {netDue <= 0.001 && returnsTotal > 0 ? 'Cleared via Return' : 'Settled'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-extrabold text-amber-800 ring-1 ring-amber-300">
                              <Clock className="h-3 w-3" /> Due / Unpaid
                            </span>
                          )}
                          {returnsTotal > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-extrabold text-blue-700 ring-1 ring-blue-200">
                              <RotateCcw className="h-2.5 w-2.5" /> Return Reduced: Rs. {returnsTotal.toFixed(2)}
                            </span>
                          )}
                        </div>

                        {/* Customer Info */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                          <div className="flex items-center gap-1 font-bold text-slate-900">
                            <User className="h-3.5 w-3.5 text-slate-500" />
                            {inv.customerName || 'Unknown Customer'}
                          </div>
                          {inv.customerPhone && (
                            <div className="flex items-center gap-1 font-mono text-slate-600">
                              <Phone className="h-3.5 w-3.5 text-slate-400" />
                              <a
                                href={`tel:${inv.customerPhone}`}
                                className="hover:text-teal-700 hover:underline"
                              >
                                {inv.customerPhone}
                              </a>
                            </div>
                          )}
                          {inv.customerAddress && (
                            <div className="flex items-center gap-1 text-slate-600">
                              <MapPin className="h-3.5 w-3.5 text-rose-500" />
                              <span>{inv.customerAddress}</span>
                            </div>
                          )}
                          {inv.doctorName && (
                            <div className="text-[11px] text-slate-500">
                              Dr: <strong className="text-slate-700">{inv.doctorName}</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Amount & Actions */}
                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <div className="text-right">
                        <span className="text-[11px] font-semibold text-slate-500">
                          {returnsTotal > 0 ? 'Remaining Due' : 'Total Due'}
                        </span>
                        <p
                          className={`font-mono text-base font-black ${
                            isPaid ? 'text-slate-700 line-through' : 'text-amber-900'
                          }`}
                        >
                          Rs. {netDue.toFixed(2)}
                        </p>
                        {returnsTotal > 0 && (
                          <p className="text-[10px] text-slate-400 font-medium">
                            Orig: Rs. {(inv.grandTotal || 0).toFixed(2)} (-{returnsTotal.toFixed(2)})
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {!isPaid && netDue > 0.001 && (
                          <button
                            type="button"
                            onClick={() => handleOpenSettleModal(inv)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:brightness-105"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Settle Payment
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setActiveInvoiceToPrint(inv)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                          title="View / Print Tax Invoice"
                        >
                          <Printer className="h-3.5 w-3.5 text-slate-600" />
                          Bill
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Medicines Taken (Credit Medicine Report Details) */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/80 px-6 py-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                          <Pill className="h-3.5 w-3.5 text-teal-600" />
                          Medicines Taken on Credit ({itemsCount} item{itemsCount > 1 ? 's' : ''}):
                        </h4>
                        <span className="text-[11px] text-slate-500">
                          Billed by: <strong className="text-slate-700">{inv.cashierName || 'Cashier'}</strong>
                        </span>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
                            <tr>
                              <th className="px-3.5 py-2">Medicine Name</th>
                              <th className="px-3.5 py-2">Batch</th>
                              <th className="px-3.5 py-2">Quantity</th>
                              <th className="px-3.5 py-2 text-right">Pack / Unit Price</th>
                              <th className="px-3.5 py-2 text-right">Line Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(inv.items || []).map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="px-3.5 py-2 font-bold text-slate-800">
                                  {item.medicineName}
                                </td>
                                <td className="px-3.5 py-2 font-mono text-slate-600">
                                  {item.batchNumber || '—'}
                                </td>
                                <td className="px-3.5 py-2 text-slate-700">
                                  <span className="font-semibold">{item.quantity}</span>{' '}
                                  <span className="text-[10px] text-slate-500">
                                    {item.isLooseUnit ? 'loose tab(s)' : 'pack(s)'}
                                  </span>
                                </td>
                                <td className="px-3.5 py-2 text-right font-mono text-slate-700">
                                  Rs. {(item.unitPrice || 0).toFixed(2)}
                                </td>
                                <td className="px-3.5 py-2 text-right font-mono font-bold text-slate-900">
                                  Rs. {(item.lineTotal || 0).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Customer Returns Deducted from this bill */}
                      {inv.salesReturns && inv.salesReturns.length > 0 && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 mb-2">
                            <RotateCcw className="h-3.5 w-3.5 text-blue-700" />
                            <span>Customer Returns / Credit Notes Deducted From This Debt:</span>
                          </div>
                          <div className="divide-y divide-blue-100 rounded-lg border border-blue-200 bg-white">
                            {inv.salesReturns.map((sr, srIdx) => (
                              <div key={srIdx} className="flex items-center justify-between p-2 text-xs">
                                <div>
                                  <span className="font-mono font-bold text-blue-950">{sr.creditNoteNumber}</span>
                                  <span className="ml-2 text-[11px] text-slate-500">
                                    {sr.returnDate ? (sr.returnDate.includes('T') ? sr.returnDate.split('T')[0] : sr.returnDate) : ''} · {sr.reason || 'Customer Return'}
                                  </span>
                                </div>
                                <span className="font-mono font-bold text-rose-700">
                                  - Rs. {(sr.refundAmount || 0).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Settle Credit Modal */}
      {settlingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-600" />
                <h3 className="text-sm font-extrabold text-slate-900">
                  Settle Customer Credit
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSettlingInvoice(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5 text-xs">
              {settleError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800 flex items-center gap-2 font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{settleError}</span>
                </div>
              )}

              {(() => {
                const sReturns = getInvoiceReturns(settlingInvoice);
                const sNetDue = getInvoiceNetDue(settlingInvoice);
                return (
                  <>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Customer:</span>
                        <strong className="text-slate-900">{settlingInvoice.customerName}</strong>
                      </div>
                      {settlingInvoice.customerPhone && (
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-medium">Phone:</span>
                          <span className="font-mono text-slate-800">{settlingInvoice.customerPhone}</span>
                        </div>
                      )}
                      {settlingInvoice.customerAddress && (
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-medium">Address:</span>
                          <span className="text-slate-800">{settlingInvoice.customerAddress}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Invoice No:</span>
                        <span className="font-mono font-bold text-slate-900">{settlingInvoice.invoiceNumber}</span>
                      </div>

                      <div className="flex justify-between border-t border-slate-200 pt-2 text-xs">
                        <span className="text-slate-600 font-medium">Original Invoice Total:</span>
                        <span className="font-mono font-bold text-slate-800">
                          Rs. {(settlingInvoice.grandTotal || 0).toFixed(2)}
                        </span>
                      </div>

                      {sReturns > 0 && (
                        <div className="flex justify-between text-xs text-rose-700 font-semibold">
                          <span>Returns Deducted:</span>
                          <span className="font-mono">- Rs. {sReturns.toFixed(2)}</span>
                        </div>
                      )}

                      <div className="flex justify-between border-t border-slate-200 pt-2">
                        <span className="text-slate-800 font-bold">Remaining Balance Due:</span>
                        <span className="font-mono text-base font-black text-amber-900">
                          Rs. {sNetDue.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block font-bold text-slate-700">
                        Payment Collection Method:
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setSettlementMethod('cash')}
                          className={`rounded-xl border p-2.5 text-center font-bold transition ${
                            settlementMethod === 'cash'
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-400'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          💵 Cash
                        </button>
                        <button
                          type="button"
                          onClick={() => setSettlementMethod('fonepay_qr')}
                          className={`rounded-xl border p-2.5 text-center font-bold transition ${
                            settlementMethod === 'fonepay_qr'
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-400'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          📱 Fonepay QR
                        </button>
                        <button
                          type="button"
                          onClick={() => setSettlementMethod('card')}
                          className={`rounded-xl border p-2.5 text-center font-bold transition ${
                            settlementMethod === 'card'
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-400'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          💳 Card / POS
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl bg-amber-50 p-2.5 text-[11px] text-amber-800 border border-amber-200">
                      Settling this credit will mark the bill as paid and collect <strong>Rs. {sNetDue.toFixed(2)}</strong> into current counter revenue.
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3.5">
              <button
                type="button"
                onClick={() => setSettlingInvoice(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingSettlement}
                onClick={handleConfirmSettlement}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {isSubmittingSettlement ? 'Settling...' : 'Confirm Payment Received'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
