import React, { useState, useMemo, useEffect } from 'react';
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
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { useDialog } from '../context/DialogContext';
import { SaleInvoice } from '../types/pharmacy';
import { exportSalesBookToExcel } from '../utils/excelUtils';
import { SalesReturnModal } from './SalesReturnModal';
import {
  instantToNepalDateString,
  localDateString,
  nepalDateDaysAgo,
  nepalMonthStartString,
  NEPAL_TIME_ZONE
} from '../utils/date';

export const SalesHistoryView: React.FC = () => {
  const { showToast } = useDialog();
  const {
    salesInvoices,
    customerSalesReturns,
    setActiveInvoiceToPrint,
    settings,
    isAdmin,
    medicines,
    refreshLiveBills,
    refreshLiveReturns,
  } = usePharmacy();

  const [activeTab, setActiveTab] = useState<'sales' | 'returns'>('sales');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | '7days' | 'month'>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<SaleInvoice | null>(null);
  const [returningInvoice, setReturningInvoice] = useState<SaleInvoice | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-refresh live bills and returns on mount to ensure latest counter transactions are displayed
  useEffect(() => {
    refreshLiveBills?.().catch(console.error);
    refreshLiveReturns?.().catch(console.error);
  }, []);

  // Helper to calculate cost of goods sold (COGS) and realized gross profit per bill
  const calculateInvoiceProfit = (inv: SaleInvoice) => {
    const cogs = (inv.items || []).reduce((acc, it) => {
      let cost = Number(it.costPrice) || 0;
      // Fallback to current inventory costPrice if item snapshot is missing/zero
      if (cost <= 0 && it.medicineName) {
        const match = (medicines || []).find(m => 
          m.name.toLowerCase() === it.medicineName.toLowerCase() ||
          m.id === it.medicineId
        );
        if (match) {
          cost = Number(match.costPrice) || 0;
        }
      }
      const qty = Number(it.quantity) || 0;
      const unitsPerPack = Number(it.unitsPerPack) || 1;
      const lineCost = it.isLooseUnit ? (cost / unitsPerPack) * qty : cost * qty;
      return acc + lineCost;
    }, 0);

    // Net Revenue excluding 13% statutory VAT (since VAT is government liability)
    const subtotalRev = (inv.taxableBaseSubtotal || 0) + (inv.vatExemptSubtotal || 0);
    const netRevenueExVat = subtotalRev > 0 
      ? subtotalRev 
      : Math.max(0, (inv.grandTotal || 0) - (inv.vatAmount || 0));

    const grossProfit = Math.round((netRevenueExVat - cogs) * 100) / 100;
    const marginPct = netRevenueExVat > 0 ? (grossProfit / netRevenueExVat) * 100 : 0;
    return { cogs, netRevenueExVat, grossProfit, marginPct };
  };

  const registerInvoices = salesInvoices;

  // Filter sales invoices
  const filteredSales = useMemo(() => {
    const todayStr = localDateString();
    const yesterdayStr = nepalDateDaysAgo(1);
    const sevenDaysAgoStr = nepalDateDaysAgo(7);
    const firstOfMonthStr = nepalMonthStartString();

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
      if (dateFilter === '7days') return inv.date >= sevenDaysAgoStr && inv.date <= todayStr;
      if (dateFilter === 'month') return inv.date >= firstOfMonthStr && inv.date <= todayStr;

      return true;
    });
  }, [registerInvoices, searchQuery, dateFilter]);

  // Filter customer returns
  const filteredReturns = useMemo(() => {
    const todayStr = localDateString();
    const yesterdayStr = nepalDateDaysAgo(1);
    const sevenDaysAgoStr = nepalDateDaysAgo(7);
    const firstOfMonthStr = nepalMonthStartString();

    return (customerSalesReturns || []).filter(ret => {
      const q = searchQuery.toLowerCase();
      const returnDateStr =
        ret.returnDate
          ? instantToNepalDateString(ret.returnDate)
          : '';
      const invoiceNumber = ret.invoice?.invoiceNumber || ret.invoiceNumber || '';
      const customerName = ret.invoice?.customerName || ret.customerName || '';

      const matchesSearch = !q ||
        ret.creditNoteNumber.toLowerCase().includes(q) ||
        invoiceNumber.toLowerCase().includes(q) ||
        customerName.toLowerCase().includes(q) ||
        (ret.reason && ret.reason.toLowerCase().includes(q)) ||
        ret.items.some(it =>
          (it.inventory?.brandName && it.inventory.brandName.toLowerCase().includes(q)) ||
          (it.inventory?.batchNumber && it.inventory.batchNumber.toLowerCase().includes(q))
        );

      if (!matchesSearch) return false;

      if (dateFilter === 'today') return returnDateStr === todayStr;
      if (dateFilter === 'yesterday') return returnDateStr === yesterdayStr;
      if (dateFilter === '7days') return returnDateStr >= sevenDaysAgoStr && returnDateStr <= todayStr;
      if (dateFilter === 'month') return returnDateStr >= firstOfMonthStr && returnDateStr <= todayStr;

      return true;
    });
  }, [customerSalesReturns, searchQuery, dateFilter]);

  // Aggregate stats for sales invoices
  const salesStats = useMemo(() => {
    const totalGross = filteredSales.reduce((acc, s) => acc + s.grandTotal, 0);
    const totalVat = filteredSales.reduce((acc, s) => acc + s.vatAmount, 0);
    const totalExempt = filteredSales.reduce((acc, s) => acc + s.vatExemptSubtotal, 0);
    const totalTaxable = filteredSales.reduce((acc, s) => acc + s.taxableBaseSubtotal, 0);
    const totalRefunded = filteredReturns.reduce((acc, r) => acc + (r.refundAmount || 0), 0);
    const netRealized = Math.max(0, totalGross - totalRefunded);

    // COGS and Gross Profit across all filtered sales
    let totalCogs = 0;
    filteredSales.forEach(inv => {
      const { cogs } = calculateInvoiceProfit(inv);
      totalCogs += cogs;
    });

    const netSalesExVat = Math.max(0, (totalExempt + totalTaxable) - totalRefunded);
    const totalGrossProfit = Math.max(0, netSalesExVat - totalCogs);
    const overallMarginPct = netSalesExVat > 0 ? (totalGrossProfit / netSalesExVat) * 100 : 0;

    return { 
      totalRevenue: totalGross, 
      totalGross, 
      totalVat, 
      totalExempt, 
      totalTaxable, 
      totalRefunded, 
      netRealized,
      totalCogs,
      totalGrossProfit,
      overallMarginPct
    };
  }, [filteredSales, filteredReturns]);

  // Aggregate stats for returns
  const returnStats = useMemo(() => {
    const totalRefunded = filteredReturns.reduce((acc, r) => acc + (r.refundAmount || 0), 0);
    const totalPacks = filteredReturns.reduce(
      (acc, r) => acc + r.items.reduce((s, it) => s + (it.quantityInPack || 0), 0),
      0
    );
    const totalUnits = filteredReturns.reduce(
      (acc, r) => acc + r.items.reduce((s, it) => s + (it.quantityInUnit || 0), 0),
      0
    );
    return { totalRefunded, totalPacks, totalUnits, count: filteredReturns.length };
  }, [filteredReturns]);

  const [salesPage, setSalesPage] = useState(1);
  const [returnsPage, setReturnsPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    setSalesPage(1);
    setReturnsPage(1);
  }, [searchQuery, dateFilter]);

  const totalSalesPages = Math.max(1, Math.ceil(filteredSales.length / PAGE_SIZE));
  const paginatedSales = useMemo(() => {
    const start = (salesPage - 1) * PAGE_SIZE;
    return filteredSales.slice(start, start + PAGE_SIZE);
  }, [filteredSales, salesPage]);

  const salesStartIndex = (salesPage - 1) * PAGE_SIZE;
  const salesEndIndex = Math.min(salesStartIndex + PAGE_SIZE, filteredSales.length);

  const totalReturnsPages = Math.max(1, Math.ceil(filteredReturns.length / PAGE_SIZE));
  const paginatedReturns = useMemo(() => {
    const start = (returnsPage - 1) * PAGE_SIZE;
    return filteredReturns.slice(start, start + PAGE_SIZE);
  }, [filteredReturns, returnsPage]);

  const returnsStartIndex = (returnsPage - 1) * PAGE_SIZE;
  const returnsEndIndex = Math.min(returnsStartIndex + PAGE_SIZE, filteredReturns.length);

  return (
    <div className="premium-sales-shell space-y-5 pb-3">

      {/* View Header */}
      <div className="premium-sales-hero flex flex-wrap items-center justify-between gap-4 rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.02)]">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-teal-50 text-teal-800 ring-1 ring-teal-100">
            <FileText className="h-5 w-5" strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
              Sales Register &amp; Statutory Tax Invoices
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm">
              Billing audit log, customer returns &amp; credit notes for IRD Nepal VAT compliance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isRefreshing}
            onClick={async () => {
              try {
                setIsRefreshing(true);
                await Promise.all([refreshLiveBills?.(), refreshLiveReturns?.()]);
                showToast('Sales register updated with latest live bills.', 'success', 'Refreshed');
              } catch (err) {
                showToast('Could not refresh bills from server.', 'error', 'Error');
              } finally {
                setIsRefreshing(false);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-60 cursor-pointer"
            title="Reload live sales invoices from database"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isRefreshing ? 'animate-spin text-teal-600' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>

          {activeTab === 'sales' && (
            <button
              onClick={() => exportSalesBookToExcel(filteredSales, settings.storeName)}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Sales Book (.xlsx)</span>
            </button>
          )}
        </div>
      </div>

      {/* Register Tab Navigation */}
      <div className="premium-sales-tabs flex gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_1px_0_rgba(15,23,42,0.02)]">
        <button
          type="button"
          onClick={() => setActiveTab('sales')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === 'sales'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Sales Invoices ({registerInvoices.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('returns')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === 'returns'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <RotateCcw className="h-4 w-4 text-teal-500" />
          <span>Customer Returns &amp; Credit Notes ({(customerSalesReturns || []).length})</span>
        </button>
      </div>

      {/* Aggregate Stats Cards */}
      {activeTab === 'sales' ? (
        <div className="space-y-3">
          <div className={`premium-sales-kpis grid grid-cols-1 gap-4 sm:grid-cols-2 ${isAdmin ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
            {[
              {
                label: 'Gross Billed Sales',
                value: salesStats.totalRevenue,
                detail: salesStats.totalRefunded > 0
                  ? `Net: Rs. ${salesStats.netRealized.toFixed(2)} (-Rs. ${salesStats.totalRefunded.toFixed(2)} refunds)`
                  : `${filteredSales.length} bills completed`,
                accent: 'teal',
                badge: 'Gross Revenue',
                icon: <Banknote className="h-4 w-4" />
              },
              {
                label: 'VAT-Free Sales',
                value: salesStats.totalExempt,
                detail: '0% VAT therapeutic drugs',
                accent: 'emerald',
                badge: '0% Exempt',
                icon: <CheckCircle2 className="h-4 w-4" />
              },
              {
                label: 'Taxable Base',
                value: salesStats.totalTaxable,
                detail: 'Subject to 13% VAT',
                accent: 'blue',
                badge: 'Tax Base',
                icon: <Filter className="h-4 w-4" />
              },
              {
                label: '13% VAT Collected',
                value: salesStats.totalVat,
                detail: 'Payable to IRD Nepal',
                accent: 'indigo',
                badge: 'IRD VAT',
                icon: <QrCode className="h-4 w-4" />
              },
              ...(isAdmin ? [{
                label: 'Gross Profit',
                value: salesStats.totalGrossProfit,
                detail: `${salesStats.overallMarginPct.toFixed(1)}% margin (COGS: Rs. ${salesStats.totalCogs.toFixed(0)})`,
                accent: 'profit',
                badge: 'Admin Audit',
                icon: <TrendingUp className="h-4 w-4" />
              }] : [])
            ].map((card) => (
              <div
                key={card.label}
                className={`premium-sales-kpi rounded-[20px] border p-4 shadow-[0_1px_0_rgba(15,23,42,0.02)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                  card.accent === 'profit'
                    ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50/80 ring-1 ring-emerald-100'
                    : card.accent === 'teal'
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
                    card.accent === 'profit'
                      ? 'bg-emerald-600 text-white ring-emerald-300 shadow-xs'
                      : card.accent === 'teal'
                        ? 'bg-white text-teal-700 ring-teal-100'
                        : card.accent === 'emerald'
                          ? 'bg-white text-emerald-700 ring-emerald-100'
                          : card.accent === 'blue'
                            ? 'bg-white text-blue-700 ring-blue-100'
                            : 'bg-white text-indigo-700 ring-indigo-100'
                  }`}>
                    {card.icon}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-[0.08em] ${
                    card.accent === 'profit'
                      ? 'bg-emerald-100/90 text-emerald-800 px-2 py-0.5 rounded-full ring-1 ring-emerald-200'
                      : card.accent === 'teal'
                        ? 'text-teal-700'
                        : card.accent === 'emerald'
                          ? 'text-emerald-700'
                          : card.accent === 'blue'
                            ? 'text-blue-700'
                            : 'text-indigo-700'
                  }`}>
                    {card.badge}
                  </span>
                </div>
                <div className="mt-5">
                  <div className={`text-[11px] font-medium ${card.accent === 'profit' ? 'text-emerald-900 font-semibold' : 'text-slate-500'}`}>
                    {card.label}
                  </div>
                  <div className={`mt-2 font-mono text-[1.75rem] font-extrabold leading-none tracking-[-0.05em] tabular-nums ${
                    card.accent === 'profit'
                      ? 'text-emerald-900'
                      : card.accent === 'teal'
                        ? 'text-teal-800'
                        : card.accent === 'emerald'
                          ? 'text-emerald-800'
                          : card.accent === 'blue'
                            ? 'text-blue-800'
                            : 'text-indigo-800'
                  }`}>
                    Rs. {card.value.toFixed(2)}
                  </div>
                  <div className={`mt-2 text-[11px] leading-relaxed ${card.accent === 'profit' ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                    {card.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {salesStats.totalRefunded > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50/80 px-4 py-2.5 text-xs text-teal-900 shadow-sm">
              <span className="font-medium">
                Gross Billed: <strong className="font-mono">Rs. {salesStats.totalGross.toFixed(2)}</strong> ({filteredSales.length} bills)
                {'  '}•{'  '}
                Customer Returns: <strong className="font-mono text-rose-700">- Rs. {salesStats.totalRefunded.toFixed(2)}</strong> ({filteredReturns.length} returns)
              </span>
              <span className="font-bold">
                Net Realized Sales: <strong className="font-mono text-sm text-teal-950">Rs. {salesStats.netRealized.toFixed(2)}</strong>
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="premium-sales-kpis grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[20px] border border-teal-100 bg-teal-50/80 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white text-teal-700 ring-1 ring-teal-100">
                <RotateCcw className="h-4 w-4" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-teal-700">Returns</span>
            </div>
            <div className="mt-5">
              <div className="text-[11px] font-medium text-slate-500">Total Customer Returns</div>
              <div className="mt-2 font-mono text-[1.75rem] font-extrabold text-teal-800">
                {returnStats.count}
              </div>
              <div className="mt-2 text-[11px] text-slate-500">Credit notes recorded</div>
            </div>
          </div>

          <div className="rounded-[20px] border border-amber-100 bg-amber-50/80 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white text-amber-700 ring-1 ring-amber-100">
                <Banknote className="h-4 w-4" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700">Refunds</span>
            </div>
            <div className="mt-5">
              <div className="text-[11px] font-medium text-slate-500">Total Refund Paid</div>
              <div className="mt-2 font-mono text-[1.75rem] font-extrabold text-amber-900">
                Rs. {returnStats.totalRefunded.toFixed(2)}
              </div>
              <div className="mt-2 text-[11px] text-slate-500">Paid out to patients</div>
            </div>
          </div>

          <div className="rounded-[20px] border border-blue-100 bg-blue-50/80 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white text-blue-700 ring-1 ring-blue-100">
                <Filter className="h-4 w-4" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-700">Packs Restocked</span>
            </div>
            <div className="mt-5">
              <div className="text-[11px] font-medium text-slate-500">Returned Full Packs</div>
              <div className="mt-2 font-mono text-[1.75rem] font-extrabold text-blue-800">
                {returnStats.totalPacks}
              </div>
              <div className="mt-2 text-[11px] text-slate-500">Restocked to batch inventory</div>
            </div>
          </div>

          <div className="rounded-[20px] border border-purple-100 bg-purple-50/80 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white text-purple-700 ring-1 ring-purple-100">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-purple-700">Units Restocked</span>
            </div>
            <div className="mt-5">
              <div className="text-[11px] font-medium text-slate-500">Returned Loose Units</div>
              <div className="mt-2 font-mono text-[1.75rem] font-extrabold text-purple-800">
                {returnStats.totalUnits}
              </div>
              <div className="mt-2 text-[11px] text-slate-500">Restocked to batch inventory</div>
            </div>
          </div>
        </div>
      )}

      {/* Filter & Search Toolbar */}
      <div className="premium-sales-filters flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-slate-200 bg-white p-3 shadow-[0_1px_0_rgba(15,23,42,0.02)]">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            {
              key: 'all',
              label: `All Time (${activeTab === 'sales' ? registerInvoices.length : (customerSalesReturns || []).length})`,
              active: dateFilter === 'all'
            },
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
            placeholder={
              activeTab === 'sales'
                ? 'Search invoice #, customer, doctor...'
                : 'Search credit note #, invoice, customer, medicine...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="premium-sales-search w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      {/* Main Table: Sales Invoices vs Customer Returns */}
      {activeTab === 'sales' ? (
        <div className="premium-sales-table-card overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_1px_0_rgba(15,23,42,0.02)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/50 px-5 py-3">
            <span className="text-xs font-semibold text-slate-500">
              Showing {filteredSales.length === 0 ? '0' : `${salesStartIndex + 1}–${salesEndIndex}`} of {filteredSales.length} sales
            </span>
            {totalSalesPages > 1 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 mr-1">
                  Page {salesPage} of {totalSalesPages}
                </span>
                <button
                  type="button"
                  disabled={salesPage <= 1}
                  onClick={() => setSalesPage(p => Math.max(1, p - 1))}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={salesPage >= totalSalesPages}
                  onClick={() => setSalesPage(p => Math.min(totalSalesPages, p + 1))}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="premium-sales-table w-full min-w-[1100px] text-left text-xs">
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
                  {isAdmin && (
                    <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-800 bg-emerald-50/50">
                      Gross Profit
                    </th>
                  )}
                  <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-[0.08em]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedSales.map((inv) => (
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

                    {isAdmin && (() => {
                      const { grossProfit, marginPct, cogs } = calculateInvoiceProfit(inv);
                      return (
                        <td className="px-3 py-3 align-top text-right bg-emerald-50/20">
                          <div className={`font-mono text-[11px] font-bold ${grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            Rs. {grossProfit.toFixed(2)}
                          </div>
                          <div className="mt-0.5 text-[10px] font-semibold text-emerald-600" title={`COGS: Rs. ${cogs.toFixed(2)}`}>
                            {marginPct.toFixed(0)}% margin
                          </div>
                        </td>
                      );
                    })()}

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
                    <td colSpan={isAdmin ? 11 : 10} className="py-12 text-center text-slate-500">
                      No sales invoices found matching the current search or filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalSalesPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-5 py-3">
              <div className="text-xs font-medium text-slate-600">
                Showing <span className="font-bold text-slate-900">{salesStartIndex + 1}</span> to{' '}
                <span className="font-bold text-slate-900">{salesEndIndex}</span> of{' '}
                <span className="font-bold text-slate-900">{filteredSales.length}</span> sales
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={salesPage <= 1}
                  onClick={() => setSalesPage(p => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </button>
                <span className="px-2 text-xs font-bold text-slate-700">
                  {salesPage} / {totalSalesPages}
                </span>
                <button
                  type="button"
                  disabled={salesPage >= totalSalesPages}
                  onClick={() => setSalesPage(p => Math.min(totalSalesPages, p + 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-100 disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Customer Returns & Credit Notes Table */
        <div className="premium-sales-table-card overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_1px_0_rgba(15,23,42,0.02)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/50 px-5 py-3">
            <span className="text-xs font-semibold text-slate-500">
              Showing {filteredReturns.length === 0 ? '0' : `${returnsStartIndex + 1}–${returnsEndIndex}`} of {filteredReturns.length} credit notes
            </span>
            {totalReturnsPages > 1 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 mr-1">
                  Page {returnsPage} of {totalReturnsPages}
                </span>
                <button
                  type="button"
                  disabled={returnsPage <= 1}
                  onClick={() => setReturnsPage(p => Math.max(1, p - 1))}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={returnsPage >= totalReturnsPages}
                  onClick={() => setReturnsPage(p => Math.min(totalReturnsPages, p + 1))}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="premium-sales-table w-full min-w-[1050px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em]">Return Date &amp; Time</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em]">Credit Note #</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em]">Tax Invoice #</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em]">Customer / Patient</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em]">Returned Items &amp; Batches</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em]">Return Reason</th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-[0.08em]">Recorded By</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.08em]">Refund Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedReturns.map((ret) => {
                  const dateObj = new Date(ret.returnDate);
                  const dateFormatted = !isNaN(dateObj.getTime())
                    ? dateObj.toLocaleDateString('en-NP', { timeZone: NEPAL_TIME_ZONE })
                    : ret.returnDate;
                  const timeFormatted = !isNaN(dateObj.getTime())
                    ? dateObj.toLocaleTimeString('en-NP', { timeZone: NEPAL_TIME_ZONE, hour: '2-digit', minute: '2-digit' })
                    : '';

                  return (
                    <tr key={ret.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="px-4 py-3 align-top text-slate-500">
                        <div className="text-[11px] font-semibold text-slate-700">{dateFormatted}</div>
                        <div className="mt-0.5 text-[10px] text-slate-400">{timeFormatted}</div>
                      </td>

                      <td className="px-3 py-3 align-top font-mono text-[11px] font-bold text-teal-800">
                        {ret.creditNoteNumber}
                      </td>

                      <td className="px-3 py-3 align-top font-mono text-[11px] font-semibold text-slate-800">
                        {ret.invoice?.invoiceNumber || (ret as any).invoiceNumber || `#${ret.invoiceId}`}
                      </td>

                      <td className="px-3 py-3 align-top">
                        <div className="font-semibold text-slate-900">
                          {ret.invoice?.customerName || (ret as any).customerName || 'Counter Patient'}
                        </div>
                        {(ret.invoice?.customerPhone || (ret as any).customerPhone) && (
                          <div className="text-[10px] text-slate-400">
                            {ret.invoice?.customerPhone || (ret as any).customerPhone}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-3 align-top text-slate-700">
                        <div className="space-y-1.5">
                          {ret.items.map((it, idx) => {
                            const medName = (it as any).medicineName || it.inventory?.brandName || 'Medicine';
                            const batch = (it as any).batchNumber || it.inventory?.batchNumber;
                            const qtyP = it.quantityInPack > 0 ? `${it.quantityInPack} Pack(s)` : '';
                            const qtyU = it.quantityInUnit > 0 ? `${it.quantityInUnit} Loose` : '';
                            const qtyStr = [qtyP, qtyU].filter(Boolean).join(', ');

                            return (
                              <div key={idx} className="text-[11px]">
                                <span className="font-bold text-slate-800">{medName}</span>
                                {batch && <span className="text-slate-500 text-[10px]"> (B: {batch})</span>}
                                <span className="font-semibold text-amber-700"> — {qtyStr}</span>
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      <td className="px-3 py-3 align-top text-slate-600 max-w-[200px]">
                        <span className="text-[11px]">{ret.reason || 'Customer return / prescription adjustment'}</span>
                      </td>

                      <td className="px-3 py-3 align-top text-center text-slate-600">
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                          {ret.recordedBy || 'Pharmacist'}
                        </span>
                      </td>

                      <td className="px-4 py-3 align-top text-right font-mono text-sm font-extrabold text-amber-900">
                        Rs. {ret.refundAmount.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}

                {filteredReturns.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      No customer returns or credit notes recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalReturnsPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-5 py-3">
              <div className="text-xs font-medium text-slate-600">
                Showing <span className="font-bold text-slate-900">{returnsStartIndex + 1}</span> to{' '}
                <span className="font-bold text-slate-900">{returnsEndIndex}</span> of{' '}
                <span className="font-bold text-slate-900">{filteredReturns.length}</span> returns
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={returnsPage <= 1}
                  onClick={() => setReturnsPage(p => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </button>
                <span className="px-2 text-xs font-bold text-slate-700">
                  {returnsPage} / {totalReturnsPages}
                </span>
                <button
                  type="button"
                  disabled={returnsPage >= totalReturnsPages}
                  onClick={() => setReturnsPage(p => Math.min(totalReturnsPages, p + 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-100 disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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
