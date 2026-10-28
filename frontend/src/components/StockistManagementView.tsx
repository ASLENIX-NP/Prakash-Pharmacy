import React, { useState, useMemo } from 'react';
import { 
  Truck, 
  FileText, 
  BookOpen, 
  RotateCcw, 
  BarChart2, 
  Plus, 
  Search, 
  Download, 
  Check, 
  AlertTriangle, 
  Building, 
  Phone, 
  Mail, 
  Calendar, 
  DollarSign, 
  Trash2, 
  Printer, 
  CheckCircle2,
  Layers,
  ArrowRight
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { 
  Stockist, 
  StockistPurchaseInvoice, 
  StockistInvoiceItem, 
  StockistLedgerEntry, 
  StockistReturnVoucher, 
  StockistReturnItem,
  StockistReturnReason,
  MedicineCategory
} from '../types/pharmacy';
import { exportStockistLedgerToExcel, exportWholesalerAnalyticsToExcel } from '../utils/excelUtils';
import { digitsOnlyUpTo, isValidEmail, normalizePhoneNumber } from '../utils/inputValidation';

export const StockistManagementView: React.FC = () => {
  const { 
    stockists, 
    isStockistDemoDataActive,
    clearStockistDemoData,
    addStockist, 
    medicines, 
    purchaseInvoices, 
    addPurchaseInvoice, 
    stockistLedgers, 
    addStockistPayment, 
    stockistReturns, 
    recordStockistReturn, 
    salesInvoices,
    settings,
    currentUser
  } = usePharmacy();

  const [activeTab, setActiveTab] = useState<'directory' | 'new_invoice' | 'ledger' | 'return' | 'analytics'>('directory');
  const [selectedStockistId, setSelectedStockistId] = useState<string>(stockists[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'bills' | 'payments'>('all');

  // Add Stockist Modal
  const [showAddStockistModal, setShowAddStockistModal] = useState(false);
  const [stockistFormError, setStockistFormError] = useState('');
  const [newStockistData, setNewStockistData] = useState({
    name: '',
    panNumber: '',
    phone: '',
    email: '',
    address: 'Hetauda, Makwanpur',
    contactPerson: '',
    creditLimit: 200000,
    notes: ''
  });

  // Record Payment Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<string>('Bank Transfer / Cheque');
  const [paymentRefNumber, setPaymentRefNumber] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  // Purchase Invoice Form State
  const [invoiceHeader, setInvoiceHeader] = useState({
    invoiceNumber: '',
    stockistId: stockists[0]?.id || '',
    date: new Date().toISOString().split('T')[0],
    paymentMode: 'credit' as 'credit' | 'cash',
    dueDate: '',
    notes: ''
  });

  const [invoiceItems, setInvoiceItems] = useState<StockistInvoiceItem[]>([
    {
      id: 'row-1',
      medicineName: '',
      genericName: '',
      category: 'Tablet',
      batchNumber: '',
      expiryDate: '2027-12-31',
      packQty: 10,
      freePacks: 0,
      unitsPerPack: 10,
      costPrice: 100,
      discountPercent: 5,
      isVatApplicable: false,
      mrpPrice: 130,
      rackLocation: 'Rack A-1',
      lineTotal: 950
    }
  ]);

  // Return to Stockist (Debit Note) Form State
  const [returnStockistId, setReturnStockistId] = useState<string>(stockists[0]?.id || '');
  const [debitNoteNumber, setDebitNoteNumber] = useState(`DN-${Date.now().toString().slice(-4)}`);
  const [returnItems, setReturnItems] = useState<StockistReturnItem[]>([]);
  const [selectedReturnMedId, setSelectedReturnMedId] = useState<string>('');
  const [returnPacks, setReturnPacks] = useState<number>(1);
  const [returnLoose, setReturnLoose] = useState<number>(0);
  const [returnReason, setReturnReason] = useState<StockistReturnReason>('Expired Medicine');
  const [returnNotes, setReturnNotes] = useState<string>('');

  // Active Stockist for Ledger
  const currentSelectedStockist = useMemo(() => {
    return stockists.find(s => s.id === selectedStockistId) || stockists[0];
  }, [stockists, selectedStockistId]);

  // Ledger entries for active stockist
  const filteredLedgerEntries = useMemo(() => {
    if (!currentSelectedStockist) return [];
    return stockistLedgers
      .filter(entry => entry.stockistId === currentSelectedStockist.id)
      .filter(entry => {
        if (ledgerFilter === 'bills') return entry.refType === 'purchase_invoice';
        if (ledgerFilter === 'payments') return entry.refType === 'payment_made';
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [stockistLedgers, currentSelectedStockist, ledgerFilter]);

  const visibleStockists = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return stockists;
    return stockists.filter(stockist =>
      [stockist.name, stockist.panNumber, stockist.phone, stockist.contactPerson]
        .some(value => value.toLowerCase().includes(query))
    );
  }, [searchQuery, stockists]);

  const directorySummary = useMemo(() => ({
    totalPayable: stockists.reduce((total, stockist) => total + Math.max(0, stockist.currentBalance), 0),
    totalCreditLimit: stockists.reduce((total, stockist) => total + stockist.creditLimit, 0),
    accountsWithDues: stockists.filter(stockist => stockist.currentBalance > 0).length,
  }), [stockists]);

  const ledgerSummary = useMemo(() => {
    const entries = currentSelectedStockist
      ? stockistLedgers.filter(entry => entry.stockistId === currentSelectedStockist.id)
      : [];
    return {
      totalPurchases: entries
        .filter(entry => entry.refType === 'purchase_invoice')
        .reduce((total, entry) => total + entry.credit, 0),
      totalPaidOrReturned: entries.reduce((total, entry) => total + entry.debit, 0),
    };
  }, [currentSelectedStockist, stockistLedgers]);

  const currency = (amount: number) =>
    `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Add Item Row in Purchase Invoice
  const handleAddInvoiceItemRow = () => {
    setInvoiceItems([
      ...invoiceItems,
      {
        id: `row-${Date.now()}`,
        medicineName: '',
        genericName: '',
        category: 'Tablet',
        batchNumber: `BAT-${Math.floor(1000 + Math.random() * 9000)}`,
        expiryDate: '2027-12-31',
        packQty: 10,
        freePacks: 0,
        unitsPerPack: 10,
        costPrice: 100,
        discountPercent: 0,
        isVatApplicable: false,
        mrpPrice: 130,
        rackLocation: 'Rack A-1',
        lineTotal: 1000
      }
    ]);
  };

  // Update Item in Purchase Invoice
  const handleUpdateInvoiceItem = (index: number, updates: Partial<StockistInvoiceItem>) => {
    const updated = [...invoiceItems];
    const current = { ...updated[index], ...updates };

    // Calculate line total: packQty * costPrice * (1 - discountPercent/100)
    const baseAmount = current.packQty * current.costPrice;
    const discountAmt = (baseAmount * (current.discountPercent || 0)) / 100;
    current.lineTotal = Math.max(0, baseAmount - discountAmt);

    updated[index] = current;
    setInvoiceItems(updated);
  };

  // Remove Item from Purchase Invoice
  const handleRemoveInvoiceItem = (index: number) => {
    if (invoiceItems.length > 1) {
      setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
    }
  };

  // Auto-fill from existing medicine in stock
  const handleSelectExistingMedicineForInvoice = (index: number, medId: string) => {
    const med = medicines.find(m => m.id === medId);
    if (!med) return;

    handleUpdateInvoiceItem(index, {
      medicineId: med.id,
      medicineName: med.name,
      genericName: med.genericName,
      category: med.category,
      batchNumber: med.batchNumber,
      expiryDate: med.expiryDate,
      unitsPerPack: med.unitsPerPack,
      costPrice: med.costPrice,
      mrpPrice: med.mrpPrice,
      isVatApplicable: med.isVatApplicable,
      rackLocation: med.rackLocation
    });
  };

  // Totals of Purchase Invoice
  const purchaseInvoiceTotals = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let taxableAmount = 0;
    let vatAmount = 0;

    invoiceItems.forEach(it => {
      const gross = it.packQty * it.costPrice;
      const disc = (gross * (it.discountPercent || 0)) / 100;
      const net = gross - disc;

      subtotal += gross;
      totalDiscount += disc;

      if (it.isVatApplicable) {
        taxableAmount += net;
        vatAmount += net * 0.13;
      }
    });

    const grandTotal = (subtotal - totalDiscount) + vatAmount;

    return {
      subtotal,
      totalDiscount,
      taxableAmount,
      vatAmount,
      grandTotal
    };
  }, [invoiceItems]);

  // Submit Purchase Invoice
  const handleSubmitPurchaseInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceHeader.invoiceNumber.trim()) {
      alert('Invoice Number is required!');
      return;
    }
    if (invoiceItems.some(it => !it.medicineName.trim())) {
      alert('Please fill Medicine Name for all rows.');
      return;
    }

    const stockist = stockists.find(s => s.id === invoiceHeader.stockistId);
    if (!stockist) return;

    addPurchaseInvoice({
      invoiceNumber: invoiceHeader.invoiceNumber,
      stockistId: stockist.id,
      stockistName: stockist.name,
      stockistPan: stockist.panNumber,
      date: invoiceHeader.date,
      paymentMode: invoiceHeader.paymentMode,
      dueDate: invoiceHeader.dueDate || undefined,
      items: invoiceItems,
      subtotal: purchaseInvoiceTotals.subtotal,
      totalDiscount: purchaseInvoiceTotals.totalDiscount,
      taxableAmount: purchaseInvoiceTotals.taxableAmount,
      vatAmount: purchaseInvoiceTotals.vatAmount,
      grandTotal: purchaseInvoiceTotals.grandTotal,
      paidAmount: invoiceHeader.paymentMode === 'cash' ? purchaseInvoiceTotals.grandTotal : 0,
      paymentStatus: invoiceHeader.paymentMode === 'cash' ? 'paid' : 'pending',
      notes: `Entered by: ${currentUser?.name || 'Admin'} (@${currentUser?.username || 'admin'}). ${invoiceHeader.notes || ''}`.trim()
    });

    alert(`Purchase Invoice #${invoiceHeader.invoiceNumber} recorded successfully! Stock and stockist ledger updated.`);
    setInvoiceHeader({
      invoiceNumber: '',
      stockistId: stockists[0]?.id || '',
      date: new Date().toISOString().split('T')[0],
      paymentMode: 'credit',
      dueDate: '',
      notes: ''
    });
    setInvoiceItems([
      {
        id: 'row-1',
        medicineName: '',
        genericName: '',
        category: 'Tablet',
        batchNumber: '',
        expiryDate: '2027-12-31',
        packQty: 10,
        freePacks: 0,
        unitsPerPack: 10,
        costPrice: 100,
        discountPercent: 5,
        isVatApplicable: false,
        mrpPrice: 130,
        rackLocation: 'Rack A-1',
        lineTotal: 950
      }
    ]);
    setActiveTab('ledger');
  };

  // Submit Stockist Payment
  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSelectedStockist || paymentAmount <= 0) return;

    addStockistPayment(
      currentSelectedStockist.id,
      paymentAmount,
      paymentMode,
      paymentRefNumber,
      paymentNotes
    );

    setShowPaymentModal(false);
    setPaymentAmount(0);
    setPaymentRefNumber('');
    setPaymentNotes('');
    alert(`Payment of Rs. ${paymentAmount.toFixed(2)} recorded in ledger!`);
  };

  // Add Item to Return Voucher
  const handleAddReturnItem = () => {
    const med = medicines.find(m => m.id === selectedReturnMedId);
    if (!med) return;

    const unitCost = med.costPrice;
    const looseCost = med.unitsPerPack > 1 ? (med.costPrice / med.unitsPerPack) : med.costPrice;
    const totalReturnAmount = (returnPacks * unitCost) + (returnLoose * looseCost);

    setReturnItems([
      ...returnItems,
      {
        medicineId: med.id,
        medicineName: med.name,
        batchNumber: med.batchNumber,
        expiryDate: med.expiryDate,
        packs: returnPacks,
        looseUnits: returnLoose,
        unitsPerPack: med.unitsPerPack,
        unitCost,
        totalReturnAmount,
        reason: returnReason
      }
    ]);

    setSelectedReturnMedId('');
    setReturnPacks(1);
    setReturnLoose(0);
  };

  // Submit Stockist Return (Debit Note)
  const handleSubmitReturnVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (returnItems.length === 0) {
      alert('Please add at least one item to return!');
      return;
    }

    const stockist = stockists.find(s => s.id === returnStockistId);
    if (!stockist) return;

    const totalAmount = returnItems.reduce((acc, it) => acc + it.totalReturnAmount, 0);

    recordStockistReturn({
      debitNoteNumber,
      stockistId: stockist.id,
      stockistName: stockist.name,
      date: new Date().toISOString().split('T')[0],
      items: returnItems,
      totalAmount,
      notes: returnNotes
    });

    alert(`Debit Note #${debitNoteNumber} issued! Rs. ${totalAmount.toFixed(2)} deducted from ${stockist.name}'s payable balance.`);
    setReturnItems([]);
    setDebitNoteNumber(`DN-${Date.now().toString().slice(-4)}`);
    setReturnNotes('');
    setActiveTab('ledger');
  };

  // Wholesaler Item-Wise Analytics calculation
  // "purchase from wholesaller with their discount invoice number credit or cash and total sales of the wholesaller indivisual item wise"
  const itemAnalytics = useMemo(() => {
    const itemsMap: {
      [key: string]: {
        medicineName: string;
        genericName: string;
        batchNumber: string;
        stockistName: string;
        invoiceNumber: string;
        paymentMode: string;
        costPrice: number;
        discountPercent: number;
        packsPurchased: number;
        freePacks: number;
        packsSold: number;
        totalRevenue: number;
        currentStockPacks: number;
      };
    } = {};

    // 1. Accumulate purchases
    purchaseInvoices.forEach(inv => {
      inv.items.forEach(it => {
        const key = `${it.medicineName}_${it.batchNumber}_${inv.stockistName}`;
        if (!itemsMap[key]) {
          const liveMed = medicines.find(
            m => m.name.toLowerCase() === it.medicineName.toLowerCase() &&
                 m.batchNumber.toLowerCase() === it.batchNumber.toLowerCase()
          );

          itemsMap[key] = {
            medicineName: it.medicineName,
            genericName: it.genericName,
            batchNumber: it.batchNumber,
            stockistName: inv.stockistName,
            invoiceNumber: inv.invoiceNumber,
            paymentMode: inv.paymentMode.toUpperCase(),
            costPrice: it.costPrice,
            discountPercent: it.discountPercent,
            packsPurchased: it.packQty,
            freePacks: it.freePacks,
            packsSold: 0,
            totalRevenue: 0,
            currentStockPacks: liveMed ? liveMed.stockPacks : 0
          };
        } else {
          itemsMap[key].packsPurchased += it.packQty;
          itemsMap[key].freePacks += it.freePacks;
        }
      });
    });

    // 2. Accumulate sales of these medicines
    salesInvoices.forEach(sale => {
      sale.items.forEach(saleItem => {
        // match across items
        Object.keys(itemsMap).forEach(key => {
          const item = itemsMap[key];
          if (item.medicineName.toLowerCase() === saleItem.medicineName.toLowerCase() &&
              item.batchNumber.toLowerCase() === saleItem.batchNumber.toLowerCase()) {
            const soldFraction = saleItem.isLooseUnit 
              ? (saleItem.quantity / saleItem.unitsPerPack) 
              : saleItem.quantity;
            item.packsSold += soldFraction;
            item.totalRevenue += saleItem.lineTotal;
          }
        });
      });
    });

    return Object.values(itemsMap);
  }, [purchaseInvoices, salesInvoices, medicines]);

  return (
    <div className="space-y-6">
      {isStockistDemoDataActive && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950"
        >
          <div>
            <strong className="font-extrabold">Demo data is active.</strong>
            <span className="ml-1">
              These sample stockists, invoices, and ledger entries are stored in this browser only; they are not backend records.
            </span>
          </div>
          <button
            type="button"
            onClick={clearStockistDemoData}
            className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 font-bold text-amber-900 hover:bg-amber-100"
          >
            Remove demo data
          </button>
        </div>
      )}

      {/* View Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 text-indigo-800 rounded-xl">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Stockist Management, Purchase Invoices &amp; Wholesaler Ledger
              </h2>
              <p className="text-xs text-slate-500">
                Manage credit &amp; cash purchase bills, supplier accounts, damaged/expired returns (debit notes), and item-wise sales analysis
              </p>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="bg-slate-100 p-1 rounded-xl flex text-xs font-semibold flex-wrap gap-1">
          <button
            onClick={() => setActiveTab('directory')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'directory' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Stockists Directory
          </button>
          <button
            onClick={() => setActiveTab('new_invoice')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
              activeTab === 'new_invoice' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Plus className="w-3.5 h-3.5 text-teal-600" />
            <span>New Purchase Bill</span>
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
              activeTab === 'ledger' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
            <span>Stockist Ledger</span>
          </button>
          <button
            onClick={() => setActiveTab('return')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
              activeTab === 'return' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
            <span>Damage / Expiry Return</span>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
              activeTab === 'analytics' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Wholesaler Item Sales</span>
          </button>
        </div>
      </div>

      {/* 1. STOCKISTS DIRECTORY */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Registered stockists', value: stockists.length.toString(), color: 'text-slate-900' },
              { label: 'Total payable', value: currency(directorySummary.totalPayable), color: 'text-rose-700' },
              { label: 'Total credit limit', value: currency(directorySummary.totalCreditLimit), color: 'text-teal-800' },
              { label: 'Accounts with dues', value: `${directorySummary.accountsWithDues} of ${stockists.length}`, color: 'text-amber-700' },
            ].map(item => (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                <span className="text-xs font-medium text-slate-500">{item.label}</span>
                <strong className={`mt-1 block font-mono text-xl font-extrabold ${item.color}`}>{item.value}</strong>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-extrabold text-slate-900">
              Registered wholesalers &amp; distributors ({stockists.length})
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  aria-label="Search stockists"
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  placeholder="Search name, PAN, or phone"
                  className="w-full min-w-[220px] rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 sm:w-64"
                />
              </label>
            <button
              onClick={() => {
                setStockistFormError('');
                setShowAddStockistModal(true);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-slate-900 bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New Stockist</span>
            </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {visibleStockists.map((stk, index) => {
              const creditUsed = stk.creditLimit > 0
                ? Math.min(100, Math.max(0, (stk.currentBalance / stk.creditLimit) * 100))
                : 0;
              const initials = stk.name
                .replace(/^DEMO\s*-\s*/i, '')
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map(word => word[0])
                .join('')
                .toUpperCase();
              const avatarStyles = [
                'bg-teal-100 text-teal-800',
                'bg-violet-100 text-violet-800',
                'bg-orange-100 text-orange-800',
                'bg-sky-100 text-sky-800',
              ];

              return (
              <div 
                key={stk.id}
                className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-extrabold ${avatarStyles[index % avatarStyles.length]}`}>
                    {initials || 'ST'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="break-words text-[15px] font-bold leading-snug text-slate-900">{stk.name}</h4>
                    <span className="mt-1 block font-mono text-[11px] text-slate-500">PAN: {stk.panNumber || '—'}</span>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                    stk.currentBalance > 0
                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}>
                    {stk.currentBalance > 0 ? 'Payable' : 'Settled'}
                  </span>
                </div>

                <div className="grid gap-1.5 border-t border-slate-100 pt-3 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span>{stk.phone || 'Phone not provided'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Building className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span>{stk.address || 'Address not provided'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 shrink-0 text-center text-slate-400">@</span>
                    <span>Contact: {stk.contactPerson || 'Not provided'}</span>
                  </div>
                  {stk.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="break-all">{stk.email}</span>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <span className="block text-[10px] font-medium text-slate-500">Current balance</span>
                      <strong className={`mt-0.5 block font-mono text-lg ${stk.currentBalance > 0 ? 'text-rose-700' : 'text-slate-800'}`}>
                        {currency(stk.currentBalance)}
                      </strong>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] font-medium text-slate-500">Credit limit</span>
                      <span className="mt-0.5 block font-mono text-sm font-semibold text-slate-700">{currency(stk.creditLimit)}</span>
                    </div>
                  </div>
                  <div
                    className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200"
                    role="img"
                    aria-label={`${Math.round(creditUsed)} percent of credit limit used`}
                  >
                    <div
                      className={`h-full rounded-full transition-all ${
                        creditUsed > 80 ? 'bg-rose-600' : creditUsed > 50 ? 'bg-amber-500' : 'bg-teal-600'
                      }`}
                      style={{ width: `${creditUsed}%` }}
                    />
                  </div>
                  <span className="mt-1.5 block text-[10px] text-slate-500">{Math.round(creditUsed)}% of credit limit used</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedStockistId(stk.id);
                      setActiveTab('ledger');
                    }}
                    className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-800 transition hover:border-teal-600 hover:bg-teal-50"
                  >
                    View Ledger
                  </button>
                  <button
                    onClick={() => {
                      setSelectedStockistId(stk.id);
                      setShowPaymentModal(true);
                    }}
                    disabled={stk.currentBalance <= 0}
                    className="flex-1 rounded-xl border border-teal-700 bg-teal-50 py-2 text-xs font-bold text-teal-800 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Pay Balance
                  </button>
                </div>
              </div>
              );
            })}
            {visibleStockists.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
                {stockists.length === 0 ? 'No stockists yet. Add a stockist to get started.' : 'No stockists match your search.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. NEW PURCHASE INVOICE ENTRY */}
      {activeTab === 'new_invoice' && (
        <form onSubmit={handleSubmitPurchaseInvoice} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-teal-600" />
              <span>Enter Purchase Invoice from Stockist / Wholesaler</span>
            </h3>
            <span className="text-xs text-slate-500">
              Automatically updates inventory stocks, cost rates, and ledger accounts
            </span>
          </div>

          {/* Invoice Header Details */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Select Wholesaler / Stockist: *</label>
              <select
                value={invoiceHeader.stockistId}
                onChange={(e) => setInvoiceHeader({ ...invoiceHeader, stockistId: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-medium text-slate-900 focus:outline-hidden"
              >
                {stockists.map(s => (
                  <option key={s.id} value={s.id}>{s.name} (PAN: {s.panNumber})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Wholesaler Invoice No: *</label>
              <input
                type="text"
                required
                placeholder="e.g. KPD-INV-9921"
                value={invoiceHeader.invoiceNumber}
                onChange={(e) => setInvoiceHeader({ ...invoiceHeader, invoiceNumber: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Invoice Date: *</label>
              <input
                type="date"
                required
                value={invoiceHeader.date}
                onChange={(e) => setInvoiceHeader({ ...invoiceHeader, date: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-mono focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Payment Mode: *</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setInvoiceHeader({ ...invoiceHeader, paymentMode: 'credit' })}
                  className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                    invoiceHeader.paymentMode === 'credit'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white border border-slate-300 text-slate-700'
                  }`}
                >
                  Credit (Udharo)
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceHeader({ ...invoiceHeader, paymentMode: 'cash' })}
                  className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                    invoiceHeader.paymentMode === 'cash'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white border border-slate-300 text-slate-700'
                  }`}
                >
                  Cash (Nogod)
                </button>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-800">
                Item-Wise Medicine Invoice Details ({invoiceItems.length} items)
              </span>
              <button
                type="button"
                onClick={handleAddInvoiceItemRow}
                className="bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Item Row</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[950px]">
                <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Medicine Name</th>
                    <th className="py-2.5 px-2">Batch #</th>
                    <th className="py-2.5 px-2">Expiry</th>
                    <th className="py-2.5 px-2 text-center">Packs</th>
                    <th className="py-2.5 px-2 text-center">Free/Bonus</th>
                    <th className="py-2.5 px-2">Cost/Pack</th>
                    <th className="py-2.5 px-2">Disc %</th>
                    <th className="py-2.5 px-2">Selling MRP</th>
                    <th className="py-2.5 px-2">Tax</th>
                    <th className="py-2.5 px-3 text-right">Line Total</th>
                    <th className="py-2.5 px-2 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoiceItems.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          required
                          placeholder="Medicine name"
                          value={item.medicineName}
                          onChange={(e) => handleUpdateInvoiceItem(idx, { medicineName: e.target.value })}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-900"
                        />
                        <div className="mt-1 flex items-center gap-1">
                          <select
                            onChange={(e) => handleSelectExistingMedicineForInvoice(idx, e.target.value)}
                            className="text-[10px] bg-slate-100 text-slate-600 rounded p-0.5 border border-slate-200 max-w-[180px]"
                          >
                            <option value="">Or Pick Existing...</option>
                            {medicines.map(m => (
                              <option key={m.id} value={m.id}>{m.name} ({m.genericName.slice(0, 15)}...)</option>
                            ))}
                          </select>
                        </div>
                      </td>

                      <td className="py-2 px-2">
                        <input
                          type="text"
                          placeholder="Batch"
                          value={item.batchNumber}
                          onChange={(e) => handleUpdateInvoiceItem(idx, { batchNumber: e.target.value })}
                          className="w-20 border border-slate-300 rounded px-1.5 py-1 text-xs font-mono"
                        />
                      </td>

                      <td className="py-2 px-2">
                        <input
                          type="date"
                          value={item.expiryDate}
                          onChange={(e) => handleUpdateInvoiceItem(idx, { expiryDate: e.target.value })}
                          className="w-28 border border-slate-300 rounded px-1 py-1 text-xs font-mono"
                        />
                      </td>

                      <td className="py-2 px-2 text-center">
                        <input
                          type="number"
                          min="1"
                          value={item.packQty}
                          onChange={(e) => handleUpdateInvoiceItem(idx, { packQty: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                          className="w-14 border border-slate-300 rounded px-1 py-1 text-xs font-mono font-bold text-center"
                        />
                      </td>

                      <td className="py-2 px-2 text-center">
                        <input
                          type="number"
                          min="0"
                          value={item.freePacks}
                          onChange={(e) => handleUpdateInvoiceItem(idx, { freePacks: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                          className="w-12 border border-slate-300 rounded px-1 py-1 text-xs font-mono text-center text-emerald-700"
                        />
                      </td>

                      <td className="py-2 px-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.costPrice}
                          onChange={(e) => handleUpdateInvoiceItem(idx, { costPrice: parseFloat(e.target.value) || 0 })}
                          className="w-16 border border-slate-300 rounded px-1.5 py-1 text-xs font-mono text-right"
                        />
                      </td>

                      <td className="py-2 px-2">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={item.discountPercent}
                          onChange={(e) => handleUpdateInvoiceItem(idx, { discountPercent: parseFloat(e.target.value) || 0 })}
                          className="w-12 border border-slate-300 rounded px-1 py-1 text-xs font-mono text-right"
                        />
                      </td>

                      <td className="py-2 px-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.mrpPrice}
                          onChange={(e) => handleUpdateInvoiceItem(idx, { mrpPrice: parseFloat(e.target.value) || 0 })}
                          className="w-16 border border-slate-300 rounded px-1.5 py-1 text-xs font-mono text-right font-bold text-slate-800"
                        />
                      </td>

                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleUpdateInvoiceItem(idx, { isVatApplicable: !item.isVatApplicable })}
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            item.isVatApplicable 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {item.isVatApplicable ? '13% VAT' : '0% Free'}
                        </button>
                      </td>

                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        Rs. {item.lineTotal.toFixed(2)}
                      </td>

                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveInvoiceItem(idx)}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Invoice Summary Box */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="max-w-md">
              <label className="block font-semibold text-slate-700 mb-1">Invoice Remarks &amp; Terms:</label>
              <input
                type="text"
                value={invoiceHeader.notes}
                onChange={(e) => setInvoiceHeader({ ...invoiceHeader, notes: e.target.value })}
                placeholder="e.g. Delivery checked, 15 days credit due date"
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs"
              />
            </div>

            <div className="w-64 space-y-1.5 text-right font-mono">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span>Rs. {purchaseInvoiceTotals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-rose-600">
                <span>Total Discount:</span>
                <span>- Rs. {purchaseInvoiceTotals.totalDiscount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-blue-700">
                <span>13% VAT Portion:</span>
                <span>+ Rs. {purchaseInvoiceTotals.vatAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-slate-900 pt-1 border-t border-slate-300">
                <span>Grand Total:</span>
                <span>Rs. {purchaseInvoiceTotals.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-700/20 flex items-center gap-1.5 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Record Purchase Bill &amp; Update Inventory Stock</span>
            </button>
          </div>
        </form>
      )}

      {/* 3. STOCKIST LEDGER */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <label htmlFor="ledger-stockist" className="mb-1.5 block text-xs font-bold text-slate-700">
                Select stockist
              </label>
              <select
                id="ledger-stockist"
                value={selectedStockistId}
                onChange={(e) => setSelectedStockistId(e.target.value)}
                disabled={stockists.length === 0}
                className="min-w-[260px] max-w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-teal-600 disabled:opacity-50"
              >
                {stockists.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} (Balance: {currency(s.currentBalance)})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowPaymentModal(true)}
                disabled={!currentSelectedStockist || currentSelectedStockist.currentBalance <= 0}
                className="flex items-center gap-1.5 rounded-xl border border-transparent bg-gradient-to-r from-teal-800 to-teal-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Record payment (debit)</span>
              </button>
              {currentSelectedStockist && (
                <button
                  onClick={() => exportStockistLedgerToExcel(
                    currentSelectedStockist.name,
                    currentSelectedStockist.panNumber,
                    filteredLedgerEntries
                  )}
                  className="flex items-center gap-1.5 rounded-xl border border-teal-700 bg-teal-50 px-3.5 py-2 text-xs font-semibold text-teal-800 transition hover:bg-teal-100"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export ledger (.xlsx)</span>
                </button>
              )}
            </div>
          </div>

          {currentSelectedStockist && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Total purchases', value: currency(ledgerSummary.totalPurchases), color: 'text-slate-900' },
                { label: 'Total paid / returned', value: currency(ledgerSummary.totalPaidOrReturned), color: 'text-emerald-700' },
                { label: 'Outstanding', value: currency(currentSelectedStockist.currentBalance), color: currentSelectedStockist.currentBalance > 0 ? 'text-rose-700' : 'text-slate-900' },
                { label: 'Credit available', value: currency(Math.max(0, currentSelectedStockist.creditLimit - currentSelectedStockist.currentBalance)), color: 'text-teal-800' },
              ].map(item => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                  <span className="text-xs font-medium text-slate-500">{item.label}</span>
                  <strong className={`mt-1 block font-mono text-lg font-extrabold ${item.color}`}>{item.value}</strong>
                </div>
              ))}
            </div>
          )}

          {currentSelectedStockist && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
                <div>
                  <h4 className="text-lg font-extrabold text-slate-900">{currentSelectedStockist.name}</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    PAN: {currentSelectedStockist.panNumber || '—'} <span className="px-1">·</span>
                    Phone: {currentSelectedStockist.phone || '—'} <span className="px-1">·</span>
                    {currentSelectedStockist.address || 'Address not provided'}
                  </p>
                </div>
                <div className="min-w-44 rounded-xl border border-slate-200 bg-white px-4 py-2.5 sm:text-right">
                  <span className="block text-[11px] text-slate-500">Current outstanding balance</span>
                  <span className={`font-mono text-xl font-extrabold ${
                    currentSelectedStockist.currentBalance > 0 ? 'text-rose-700' : 'text-emerald-700'
                  }`}>
                    {currency(currentSelectedStockist.currentBalance)}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-b border-slate-200 px-4 py-3">
                {([
                  ['all', 'All entries'],
                  ['bills', 'Purchase bills'],
                  ['payments', 'Payments'],
                ] as const).map(([filter, label]) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setLedgerFilter(filter)}
                    aria-pressed={ledgerFilter === filter}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      ledgerFilter === filter
                        ? 'border-teal-700 bg-teal-700 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-teal-600 hover:text-teal-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-left text-xs">
                  <thead className="border-b border-slate-200 bg-white text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3">Date</th>
                      <th className="whitespace-nowrap px-3 py-3">Type</th>
                      <th className="whitespace-nowrap px-3 py-3">Ref / bill #</th>
                      <th className="px-4 py-3">Particulars</th>
                      <th className="whitespace-nowrap px-3 py-3 text-right">Debit (payment / return)</th>
                      <th className="whitespace-nowrap px-3 py-3 text-right">Credit (purchase bill)</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLedgerEntries.map(entry => (
                      <tr key={entry.id} className="transition hover:bg-slate-50">
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-slate-500">{entry.date}</td>
                        <td className="px-3 py-3">
                          <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                            entry.refType === 'payment_made'
                              ? 'bg-emerald-50 text-emerald-800'
                              : entry.refType === 'return_debit_note'
                              ? 'bg-violet-50 text-violet-800'
                              : 'bg-blue-50 text-blue-800'
                          }`}>
                            {entry.refType === 'purchase_invoice'
                              ? 'Purchase invoice'
                              : entry.refType === 'payment_made'
                                ? 'Payment made'
                                : 'Return debit note'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 font-mono font-bold text-slate-900">{entry.refNumber}</td>
                        <td className="px-4 py-3 text-slate-700">{entry.description}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right font-mono font-semibold text-emerald-700">
                          {entry.debit > 0 ? currency(entry.debit) : '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right font-mono font-semibold text-rose-700">
                          {entry.credit > 0 ? currency(entry.credit) : '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-extrabold text-slate-900">
                          {currency(entry.balance)}
                        </td>
                      </tr>
                    ))}
                    {filteredLedgerEntries.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                          {ledgerFilter === 'all'
                            ? 'No ledger transactions recorded for this stockist yet.'
                            : `No ${ledgerFilter === 'bills' ? 'purchase bills' : 'payments'} recorded for this stockist.`}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {stockistLedgers.some(entry => entry.stockistId === currentSelectedStockist.id) && (
                    <tfoot className="border-t border-slate-200 bg-slate-50 font-bold">
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-slate-700">Account totals</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-emerald-700">
                          {currency(ledgerSummary.totalPaidOrReturned)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-rose-700">
                          {currency(ledgerSummary.totalPurchases)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-slate-900">
                          {currency(currentSelectedStockist.currentBalance)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {!currentSelectedStockist && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
              Add a stockist before viewing a ledger.
            </div>
          )}
        </div>
      )}

      {/* 4. RETURN TO STOCKIST (DEBIT NOTE) */}
      {activeTab === 'return' && (
        <form onSubmit={handleSubmitReturnVoucher} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-rose-600" />
              <span>Purchase Return / Debit Note to Wholesaler (Damaged / Broken / Expired)</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              Debit Note #{debitNoteNumber}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Select Wholesaler / Party: *</label>
              <select
                value={returnStockistId}
                onChange={(e) => setReturnStockistId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-medium text-slate-900"
              >
                {stockists.map(s => (
                  <option key={s.id} value={s.id}>{s.name} (Current Bal: Rs. {s.currentBalance.toFixed(2)})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Debit Note Number: *</label>
              <input
                type="text"
                value={debitNoteNumber}
                onChange={(e) => setDebitNoteNumber(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Remarks / Note:</label>
              <input
                type="text"
                placeholder="e.g. Broken strips packed in sealed return box"
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2"
              />
            </div>
          </div>

          {/* Add Item to Return Form */}
          <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-200 space-y-3">
            <span className="text-xs font-bold text-rose-900 block">
              Add Medicine to Return Voucher:
            </span>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Select Medicine from Stock:</label>
                <select
                  value={selectedReturnMedId}
                  onChange={(e) => setSelectedReturnMedId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs text-slate-900"
                >
                  <option value="">-- Choose Medicine --</option>
                  {medicines.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.batchNumber}, Exp: {m.expiryDate}, Stock: {m.stockPacks} pk)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Return Packs:</label>
                <input
                  type="number"
                  min="0"
                  value={returnPacks}
                  onChange={(e) => setReturnPacks(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Return Reason: *</label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value as StockistReturnReason)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs text-slate-900"
                >
                  <option value="Expired Medicine">Expired Medicine</option>
                  <option value="Damaged / Broken Strip">Damaged / Broken Strip</option>
                  <option value="Breakage in Transit">Breakage in Transit</option>
                  <option value="Manufacturer Recall">Manufacturer Recall</option>
                  <option value="Slow Moving / Near Expiry Return">Slow Moving / Near Expiry</option>
                  <option value="Other">Other Reason</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  disabled={!selectedReturnMedId}
                  onClick={handleAddReturnItem}
                  className="w-full py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-colors"
                >
                  + Add to Return
                </button>
              </div>
            </div>
          </div>

          {/* Items to Return List */}
          {returnItems.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                  <tr>
                    <th className="py-2 px-3">Medicine</th>
                    <th className="py-2 px-2">Batch</th>
                    <th className="py-2 px-2">Expiry</th>
                    <th className="py-2 px-2">Quantity</th>
                    <th className="py-2 px-2">Reason</th>
                    <th className="py-2 px-3 text-right">Credit Value (Rs.)</th>
                    <th className="py-2 px-2 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {returnItems.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-bold text-slate-900">{it.medicineName}</td>
                      <td className="py-2 px-2 font-mono">{it.batchNumber}</td>
                      <td className="py-2 px-2 font-mono text-slate-500">{it.expiryDate}</td>
                      <td className="py-2 px-2 font-mono font-bold">{it.packs} packs</td>
                      <td className="py-2 px-2 font-medium text-rose-800">{it.reason}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        Rs. {it.totalReturnAmount.toFixed(2)}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => setReturnItems(returnItems.filter((_, i) => i !== idx))}
                          className="text-rose-500 hover:bg-rose-50 p-1 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="p-3 bg-slate-50 flex justify-between items-center text-xs border-t border-slate-200">
                <span className="font-bold text-slate-700">Total Credit to Deduct from Wholesaler:</span>
                <span className="font-extrabold font-mono text-base text-rose-700">
                  Rs. {returnItems.reduce((acc, it) => acc + it.totalReturnAmount, 0).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={returnItems.length === 0}
              className="px-6 py-2.5 bg-rose-700 hover:bg-rose-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Confirm Return &amp; Deduct from Wholesaler Ledger</span>
            </button>
          </div>
        </form>
      )}

      {/* 5. WHOLESALER ITEM-WISE SALES & PURCHASE ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Wholesaler Purchase &amp; Retail Sales Performance (Item-Wise)
              </h3>
              <p className="text-xs text-slate-500">
                Analyzes purchase invoices, wholesaler discount, credit vs cash status, and sales velocity per individual item
              </p>
            </div>
            <button
              onClick={() => exportWholesalerAnalyticsToExcel(itemAnalytics, settings.storeName)}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Analytics (.xlsx)</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Medicine &amp; Batch</th>
                    <th className="py-2.5 px-3">Wholesaler</th>
                    <th className="py-2.5 px-2">Invoice #</th>
                    <th className="py-2.5 px-2 text-center">Terms</th>
                    <th className="py-2.5 px-2 text-right">Cost Rate</th>
                    <th className="py-2.5 px-2 text-right">Trade Disc %</th>
                    <th className="py-2.5 px-2 text-center">Purchased</th>
                    <th className="py-2.5 px-2 text-center">Sold</th>
                    <th className="py-2.5 px-2 text-center">In Stock</th>
                    <th className="py-2.5 px-3 text-right">Sales Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itemAnalytics.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{row.medicineName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{row.batchNumber}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-700 font-medium">{row.stockistName}</td>
                      <td className="py-3 px-2 font-mono text-slate-800">{row.invoiceNumber}</td>
                      <td className="py-3 px-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          row.paymentMode === 'CREDIT' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'
                        }`}>
                          {row.paymentMode}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right font-mono">Rs. {row.costPrice.toFixed(2)}</td>
                      <td className="py-3 px-2 text-right font-mono text-emerald-700 font-bold">{row.discountPercent}%</td>
                      <td className="py-3 px-2 text-center font-mono font-bold">
                        {row.packsPurchased} pk {row.freePacks > 0 && `(+${row.freePacks} free)`}
                      </td>
                      <td className="py-3 px-2 text-center font-mono font-bold text-teal-800">
                        {row.packsSold.toFixed(1)} pk
                      </td>
                      <td className="py-3 px-2 text-center font-mono font-bold text-slate-800">
                        {row.currentStockPacks} pk
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-900">
                        Rs. {row.totalRevenue.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {itemAnalytics.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        No purchase invoices recorded yet. Record invoices to view analytics.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Stockist Modal */}
      {showAddStockistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-3 flex justify-between items-center">
              <h4 className="font-bold text-sm">Register New Wholesaler / Stockist</h4>
              <button onClick={() => setShowAddStockistModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company / Stockist Name: *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kathmandu Pharma Distributors"
                  value={newStockistData.name}
                  onChange={(e) => setNewStockistData({ ...newStockistData, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 font-semibold text-slate-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">PAN Number: *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={9}
                    pattern="[0-9]{9}"
                    required
                    placeholder="e.g. 301294851"
                    value={newStockistData.panNumber}
                    onChange={(e) => {
                      setNewStockistData({ ...newStockistData, panNumber: digitsOnlyUpTo(e.target.value, 9) });
                      setStockistFormError('');
                    }}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number: *</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]{7,10}"
                    required
                    placeholder="Up to 10 digits"
                    value={newStockistData.phone}
                    onChange={(e) => {
                      setNewStockistData({ ...newStockistData, phone: normalizePhoneNumber(e.target.value) });
                      setStockistFormError('');
                    }}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Address / Depot Location:</label>
                <input
                  type="text"
                  value={newStockistData.address}
                  onChange={(e) => setNewStockistData({ ...newStockistData, address: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email:</label>
                <input
                  type="email"
                  maxLength={254}
                  autoComplete="email"
                  value={newStockistData.email}
                  onChange={(e) => {
                    setNewStockistData({ ...newStockistData, email: e.target.value });
                    setStockistFormError('');
                  }}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contact Person:</label>
                  <input
                    type="text"
                    value={newStockistData.contactPerson}
                    onChange={(e) => setNewStockistData({ ...newStockistData, contactPerson: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Credit Limit (NPR):</label>
                  <input
                    type="number"
                    value={newStockistData.creditLimit}
                    onChange={(e) => setNewStockistData({ ...newStockistData, creditLimit: parseInt(e.target.value, 10) || 0 })}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>
              {stockistFormError && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-700">
                  {stockistFormError}
                </p>
              )}
            </div>
            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setShowAddStockistModal(false)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!newStockistData.name.trim()) {
                    setStockistFormError('Stockist name is required.');
                    return;
                  }
                  if (!/^\d{9}$/.test(newStockistData.panNumber)) {
                    setStockistFormError('PAN must contain exactly 9 digits.');
                    return;
                  }
                  if (!/^\d{7,10}$/.test(newStockistData.phone)) {
                    setStockistFormError('Phone number must contain between 7 and 10 digits.');
                    return;
                  }
                  if (newStockistData.email && !isValidEmail(newStockistData.email)) {
                    setStockistFormError('Enter a valid email address.');
                    return;
                  }
                  addStockist(newStockistData);
                  setStockistFormError('');
                  setShowAddStockistModal(false);
                }}
                className="px-4 py-1.5 bg-teal-700 text-white rounded-lg text-xs font-bold"
              >
                Save Stockist
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && currentSelectedStockist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <form onSubmit={handleRecordPayment} className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-3 flex justify-between items-center">
              <h4 className="font-bold text-sm">Record Payment to {currentSelectedStockist.name}</h4>
              <button type="button" onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between">
                <span>Current Outstanding Balance:</span>
                <strong className="font-mono text-rose-700 text-sm">Rs. {currentSelectedStockist.currentBalance.toFixed(2)}</strong>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Amount (NPR): *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="1"
                  value={paymentAmount || ''}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  placeholder={currentSelectedStockist.currentBalance.toFixed(2)}
                  className="w-full border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Mode: *</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                >
                  <option value="Bank Cheque">Bank Cheque</option>
                  <option value="Bank Transfer / IPS">Bank Transfer / ConnectIPS</option>
                  <option value="Fonepay QR">Fonepay QR</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cheque / Voucher / Reference #:</label>
                <input
                  type="text"
                  placeholder="e.g. CHQ-99201"
                  value={paymentRefNumber}
                  onChange={(e) => setPaymentRefNumber(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes:</label>
                <input
                  type="text"
                  placeholder="Payment remarks"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>
            </div>
            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold"
              >
                Confirm Payment &amp; Post to Ledger
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
