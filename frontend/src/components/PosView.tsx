import React, { useState, useMemo } from 'react';
import { 
  ShoppingCart, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Percent, 
  Printer, 
  CheckCircle2, 
  AlertTriangle, 
  User, 
  Phone, 
  UserCheck, 
  Info, 
  Sparkles, 
  Layers, 
  QrCode, 
  CreditCard, 
  Banknote, 
  Receipt,
  FileText,
  X
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { Medicine, SaleItem, SaleInvoice } from '../types/pharmacy';

export const PosView: React.FC = () => {
  const { 
    medicines, 
    completeSale, 
    settings, 
    currentUser,
    setActiveInvoiceToPrint, 
    setActiveVatInfoMedicine 
  } = usePharmacy();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenericFilter, setSelectedGenericFilter] = useState<string | null>(null);

  // Cart state
  const [cart, setCart] = useState<SaleItem[]>([]);

  // Customer / Patient Info
  const [customerName, setCustomerName] = useState('Counter Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerPan, setCustomerPan] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('N/A');

  // Discount & Payment
  const [discountType, setDiscountType] = useState<'percent' | 'flat'>('flat');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'fonepay_qr' | 'card' | 'credit'>('cash');
  const [cashTendered, setCashTendered] = useState<number>(0);

  // Filtered search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() && !selectedGenericFilter) return [];
    
    return medicines.filter(m => {
      if (selectedGenericFilter) {
        return m.genericName.toLowerCase() === selectedGenericFilter.toLowerCase();
      }

      const q = searchQuery.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.genericName.toLowerCase().includes(q) ||
        m.batchNumber.toLowerCase().includes(q) ||
        m.rackLocation.toLowerCase().includes(q)
      );
    });
  }, [medicines, searchQuery, selectedGenericFilter]);

  // Add item to cart
  const handleAddToCart = (medicine: Medicine, isLoose: boolean = false) => {
    // Check if expired
    const isExpired = new Date(medicine.expiryDate).getTime() < new Date().getTime();
    if (isExpired) {
      alert(`Cannot sell ${medicine.name}! Batch ${medicine.batchNumber} has expired on ${medicine.expiryDate}.`);
      return;
    }

    // Check stock
    const currentTotalUnits = (medicine.stockPacks * medicine.unitsPerPack) + medicine.stockLooseUnits;
    if (currentTotalUnits <= 0) {
      alert(`Out of stock! ${medicine.name} has 0 available units.`);
      return;
    }

    const unitPrice = isLoose
      ? (medicine.unitsPerPack > 1 ? medicine.mrpPrice / medicine.unitsPerPack : medicine.mrpPrice)
      : medicine.mrpPrice;

    const costUnitPrice = isLoose
      ? (medicine.unitsPerPack > 1 ? medicine.costPrice / medicine.unitsPerPack : medicine.costPrice)
      : medicine.costPrice;

    // Check if item already exists in cart with same unit mode
    const existingIndex = cart.findIndex(
      item => item.medicineId === medicine.id && item.isLooseUnit === isLoose
    );

    if (existingIndex >= 0) {
      const updated = [...cart];
      const newQty = updated[existingIndex].quantity + 1;
      
      // Check total required units against stock
      const totalUnitsNeeded = isLoose 
        ? newQty 
        : newQty * medicine.unitsPerPack;
        
      if (totalUnitsNeeded > currentTotalUnits) {
        alert(`Cannot add more! Total available in stock is ${currentTotalUnits} units.`);
        return;
      }

      const lineTotal = newQty * unitPrice;
      const taxBase = medicine.isVatApplicable ? lineTotal / 1.13 : lineTotal;
      const vatAmount = medicine.isVatApplicable ? lineTotal - taxBase : 0;

      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: newQty,
        lineTotal,
        taxBase,
        vatAmount
      };
      setCart(updated);
    } else {
      const lineTotal = unitPrice;
      const taxBase = medicine.isVatApplicable ? lineTotal / 1.13 : lineTotal;
      const vatAmount = medicine.isVatApplicable ? lineTotal - taxBase : 0;

      const newItem: SaleItem = {
        medicineId: medicine.id,
        medicineName: medicine.name,
        genericName: medicine.genericName,
        category: medicine.category,
        batchNumber: medicine.batchNumber,
        expiryDate: medicine.expiryDate,
        isLooseUnit: isLoose,
        quantity: 1,
        unitsPerPack: medicine.unitsPerPack,
        unitPrice,
        costPrice: costUnitPrice,
        isVatApplicable: medicine.isVatApplicable,
        rackLocation: medicine.rackLocation,
        lineTotal,
        taxBase,
        vatAmount
      };
      setCart([...cart, newItem]);
    }
  };

  // Update item quantity
  const handleUpdateQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }

    const item = cart[index];
    const med = medicines.find(m => m.id === item.medicineId);
    if (!med) return;

    const currentTotalUnits = (med.stockPacks * med.unitsPerPack) + med.stockLooseUnits;
    const unitsNeeded = item.isLooseUnit ? newQty : newQty * item.unitsPerPack;

    if (unitsNeeded > currentTotalUnits) {
      alert(`Requested quantity exceeds available stock (${currentTotalUnits} units)!`);
      return;
    }

    const updated = [...cart];
    const lineTotal = newQty * item.unitPrice;
    const taxBase = item.isVatApplicable ? lineTotal / 1.13 : lineTotal;
    const vatAmount = item.isVatApplicable ? lineTotal - taxBase : 0;

    updated[index] = {
      ...item,
      quantity: newQty,
      lineTotal,
      taxBase,
      vatAmount
    };
    setCart(updated);
  };

  // Toggle loose vs pack inside cart
  const handleToggleLoose = (index: number) => {
    const item = cart[index];
    const med = medicines.find(m => m.id === item.medicineId);
    if (!med) return;

    const newIsLoose = !item.isLooseUnit;
    const newUnitPrice = newIsLoose
      ? (med.unitsPerPack > 1 ? med.mrpPrice / med.unitsPerPack : med.mrpPrice)
      : med.mrpPrice;

    const newCostPrice = newIsLoose
      ? (med.unitsPerPack > 1 ? med.costPrice / med.unitsPerPack : med.costPrice)
      : med.costPrice;

    const updated = [...cart];
    const lineTotal = item.quantity * newUnitPrice;
    const taxBase = item.isVatApplicable ? lineTotal / 1.13 : lineTotal;
    const vatAmount = item.isVatApplicable ? lineTotal - taxBase : 0;

    updated[index] = {
      ...item,
      isLooseUnit: newIsLoose,
      unitPrice: newUnitPrice,
      costPrice: newCostPrice,
      lineTotal,
      taxBase,
      vatAmount
    };
    setCart(updated);
  };

  // Remove item
  const handleRemoveItem = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  // Clear cart
  const handleClearCart = () => {
    if (cart.length > 0 && confirm('Are you sure you want to clear current billing cart?')) {
      setCart([]);
      setDiscountValue(0);
      setCashTendered(0);
    }
  };

  // Statutory VAT Totals calculation
  const totals = useMemo(() => {
    const grossSubtotal = cart.reduce((acc, it) => acc + it.lineTotal, 0);
    
    // Split into VAT-exempt and 13% VAT
    const vatExemptSubtotal = cart
      .filter(it => !it.isVatApplicable)
      .reduce((acc, it) => acc + it.lineTotal, 0);

    const taxableGross = cart
      .filter(it => it.isVatApplicable)
      .reduce((acc, it) => acc + it.lineTotal, 0);

    // In retail MRP pricing with 13% inclusive VAT:
    // Taxable base = taxableGross / 1.13
    // VAT Amount = taxableGross - Taxable base
    const taxableBaseSubtotal = taxableGross > 0 ? taxableGross / 1.13 : 0;
    const vatAmount = taxableGross > 0 ? taxableGross - taxableBaseSubtotal : 0;

    // End-of-bill discount
    let discountAmount = 0;
    if (discountType === 'percent') {
      discountAmount = (grossSubtotal * (discountValue || 0)) / 100;
    } else {
      discountAmount = discountValue || 0;
    }
    if (discountAmount > grossSubtotal) discountAmount = grossSubtotal;

    const grandTotal = Math.max(0, grossSubtotal - discountAmount);
    const changeGiven = Math.max(0, (cashTendered || 0) - grandTotal);

    return {
      grossSubtotal,
      vatExemptSubtotal,
      taxableBaseSubtotal,
      vatAmount,
      discountAmount,
      grandTotal,
      changeGiven
    };
  }, [cart, discountType, discountValue, cashTendered]);

  // Complete & Print Bill
  const handleCompleteSale = () => {
    if (cart.length === 0) {
      alert('Cart is empty! Add medicines to bill.');
      return;
    }

    const saleRecord = completeSale({
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0],
      customerName: customerName.trim() || 'Counter Patient',
      customerPhone: customerPhone.trim() || undefined,
      customerPan: customerPan.trim() || undefined,
      doctorName: doctorName.trim() || undefined,
      patientAge: patientAge.trim() || undefined,
      patientGender: patientGender !== 'N/A' ? patientGender : undefined,
      items: cart,
      grossSubtotal: totals.grossSubtotal,
      vatExemptSubtotal: totals.vatExemptSubtotal,
      taxableBaseSubtotal: totals.taxableBaseSubtotal,
      vatAmount: totals.vatAmount,
      discountType,
      discountValue,
      discountAmount: totals.discountAmount,
      grandTotal: totals.grandTotal,
      paymentMode,
      cashTendered: paymentMode === 'cash' ? (cashTendered || totals.grandTotal) : totals.grandTotal,
      changeGiven: paymentMode === 'cash' ? totals.changeGiven : 0,
      cashierName: currentUser?.name || 'Cashier',
      cashierId: currentUser?.username || currentUser?.id || 'admin'
    });

    // Reset Form
    setCart([]);
    setCustomerName('Counter Customer');
    setCustomerPhone('');
    setCustomerPan('');
    setDoctorName('');
    setPatientAge('');
    setDiscountValue(0);
    setCashTendered(0);

    // Open Printable VAT Bill Modal immediately
    setActiveInvoiceToPrint(saleRecord);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* LEFT COLUMN: Fast Search & Medicine Selector (7 cols) */}
      <div className="lg:col-span-7 space-y-4">
        {/* Search Header Card */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Search className="w-4 h-4 text-teal-600" />
              <span>Fast Medicine &amp; Barcode Search</span>
            </span>
            {selectedGenericFilter && (
              <button
                onClick={() => setSelectedGenericFilter(null)}
                className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full flex items-center gap-1 hover:bg-rose-100"
              >
                <span>Clear Generic Filter: {selectedGenericFilter}</span>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              autoFocus
              placeholder="Type brand name (Augmentin, Pan 40), generic salt, batch #, or rack location..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (selectedGenericFilter) setSelectedGenericFilter(null);
              }}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden shadow-xs"
            />
          </div>

          {/* Quick Shortcuts */}
          <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500">
            <span className="font-semibold text-slate-600">Quick Molecule:</span>
            {['Paracetamol', 'Amoxicillin', 'Pantoprazole', 'Cetirizine', 'Azithromycin'].map(salt => (
              <button
                key={salt}
                onClick={() => {
                  setSearchQuery(salt);
                  setSelectedGenericFilter(null);
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md transition-colors"
              >
                {salt}
              </button>
            ))}
          </div>
        </div>

        {/* Search Results List */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 font-semibold">
            <span>Live Stock Availability</span>
            <span>
              {searchResults.length > 0 
                ? `${searchResults.length} medicines found` 
                : searchQuery ? 'No items found' : 'Type above to search stock'}
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto">
            {searchResults.map(m => {
              const isLowStock = m.stockPacks <= m.reorderLevel;
              const perTabletMrp = m.unitsPerPack > 1 ? (m.mrpPrice / m.unitsPerPack) : m.mrpPrice;
              const isExpired = new Date(m.expiryDate).getTime() < new Date().getTime();

              return (
                <div 
                  key={m.id}
                  className={`p-3.5 hover:bg-slate-50/90 transition-colors flex flex-wrap items-center justify-between gap-3 ${
                    isExpired ? 'opacity-60 bg-rose-50/30' : ''
                  }`}
                >
                  {/* Left Info */}
                  <div className="space-y-1 max-w-[55%]">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{m.name}</span>
                      <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded text-[10px] font-mono">
                        {m.batchNumber}
                      </span>
                      {/* Click to know VAT badge */}
                      <button
                        type="button"
                        onClick={() => setActiveVatInfoMedicine(m)}
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold border flex items-center gap-0.5 ${
                          m.isVatApplicable
                            ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        }`}
                        title="Click to Know: View VAT and Tax breakdown"
                      >
                        <span>{m.isVatApplicable ? '13% VAT' : 'VAT Free'}</span>
                        <Info className="w-2.5 h-2.5 opacity-70" />
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-500 font-medium">
                      {m.genericName}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>Rack: <strong className="text-slate-700">{m.rackLocation}</strong></span>
                      <span>•</span>
                      <span>Exp: <strong className={isExpired ? 'text-rose-600 font-bold' : 'text-slate-600'}>{m.expiryDate}</strong></span>
                      <span>•</span>
                      <span>Pack: {m.unitsPerPack} u</span>
                    </div>

                    {/* Bio-equivalent Suggestion shortcut */}
                    <div className="pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedGenericFilter(m.genericName);
                          setSearchQuery('');
                        }}
                        className="text-[10px] font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1 hover:underline"
                        title="See all in-stock brands with same generic molecule"
                      >
                        <Sparkles className="w-2.5 h-2.5 text-teal-600" />
                        <span>Find Bio-Equivalent Brands ({m.genericName.split(' ')[0]})</span>
                      </button>
                    </div>
                  </div>

                  {/* Stock & Price */}
                  <div className="text-right space-y-0.5">
                    <div className="text-xs font-mono font-bold text-slate-900">
                      Rs. {m.mrpPrice.toFixed(2)} <span className="text-[10px] font-normal text-slate-500">/pack</span>
                    </div>
                    {m.unitsPerPack > 1 && (
                      <div className="text-[11px] font-mono text-teal-700 font-medium">
                        Rs. {perTabletMrp.toFixed(2)} /tab
                      </div>
                    )}
                    <div className="text-[11px] font-mono">
                      Stock: <strong className={isLowStock ? 'text-rose-600' : 'text-slate-800'}>
                        {m.stockPacks} pk
                      </strong>
                      {m.stockLooseUnits > 0 && (
                        <span className="text-teal-700 ml-1">+{m.stockLooseUnits} tab</span>
                      )}
                    </div>
                  </div>

                  {/* Add Buttons: Strip vs Loose */}
                  <div className="flex items-center gap-1.5">
                    {/* Add Full Pack */}
                    <button
                      type="button"
                      disabled={isExpired || (m.stockPacks === 0 && m.stockLooseUnits < m.unitsPerPack)}
                      onClick={() => handleAddToCart(m, false)}
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1 transition-all"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+ Pack</span>
                    </button>

                    {/* Add Loose Tablet */}
                    {m.unitsPerPack > 1 && (
                      <button
                        type="button"
                        disabled={isExpired || (m.stockPacks === 0 && m.stockLooseUnits === 0)}
                        onClick={() => handleAddToCart(m, true)}
                        className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 disabled:opacity-40 text-teal-800 border border-teal-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                        title="Bill individual loose tablet/capsule (auto derives fractional pack stock deduction)"
                      >
                        <Plus className="w-3 h-3" />
                        <span>+ 1 Tab</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {searchResults.length === 0 && searchQuery && (
              <div className="p-8 text-center text-slate-400 text-xs">
                No active stock found for "{searchQuery}". Try searching generic salt name.
              </div>
            )}

            {searchResults.length === 0 && !searchQuery && !selectedGenericFilter && (
              <div className="p-8 text-center text-slate-400 text-xs">
                Enter medicine name or generic composition in search box above to browse stock and add items to cart.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: POS Billing Cart & 13% Statutory VAT Invoice (5 cols) */}
      <div className="lg:col-span-5 space-y-4">
        {/* Patient / Customer Details Card */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-teal-600" />
              <span>Customer &amp; Doctor Information</span>
            </span>
            <span className="text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
              Cashier: <strong>{currentUser?.name}</strong> <span className="font-mono text-[10px] text-emerald-700">(@{currentUser?.username})</span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                Patient / Customer Name:
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Patient Name"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                Phone Number:
              </label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="e.g. 9845012345"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                Prescribing Doctor:
              </label>
              <input
                type="text"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                placeholder="Dr. Name (Hetauda Hosp)"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                Buyer PAN (Tax Invoice):
              </label>
              <input
                type="text"
                value={customerPan}
                onChange={(e) => setCustomerPan(e.target.value)}
                placeholder="Optional Buyer PAN"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-mono focus:bg-white focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Cart Line Items */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3 bg-slate-900 text-white flex items-center justify-between text-xs">
            <span className="font-bold flex items-center gap-1.5">
              <ShoppingCart className="w-4 h-4 text-emerald-400" />
              <span>Current Cart ({cart.length} items)</span>
            </span>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={handleClearCart}
                className="text-[11px] text-rose-300 hover:text-white transition-colors"
              >
                Clear Cart
              </button>
            )}
          </div>

          {/* Cart Table */}
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {cart.map((item, idx) => (
              <div key={`${item.medicineId}-${item.isLooseUnit}`} className="p-3 hover:bg-slate-50/60 text-xs space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-900">{item.medicineName}</div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                      <span className="font-mono">{item.batchNumber}</span>
                      <span>•</span>
                      {/* Clickable VAT badge in cart line item */}
                      <button
                        type="button"
                        onClick={() => {
                          const med = medicines.find(m => m.id === item.medicineId);
                          if (med) setActiveVatInfoMedicine(med);
                        }}
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold border flex items-center gap-0.5 ${
                          item.isVatApplicable
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                        title="Click to view VAT portion of this cart line"
                      >
                        <span>{item.isVatApplicable ? '13% VAT' : '0% Exempt'}</span>
                        <Info className="w-2.5 h-2.5 opacity-70" />
                      </button>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-bold font-mono text-slate-900 text-sm">
                      Rs. {item.lineTotal.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      @ Rs. {item.unitPrice.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Controls: Pack vs Loose Toggle, Qty Counter */}
                <div className="flex items-center justify-between pt-1">
                  {/* Mode badge: Pack vs Loose Tablet */}
                  <div className="flex items-center gap-1.5">
                    {item.unitsPerPack > 1 ? (
                      <button
                        type="button"
                        onClick={() => handleToggleLoose(idx)}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border transition-colors ${
                          item.isLooseUnit
                            ? 'bg-teal-100 text-teal-800 border-teal-300 font-bold'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                        title="Toggle Full Pack vs Loose Tablet billing"
                      >
                        {item.isLooseUnit ? 'Loose Tablet Billing' : 'Full Pack Billing'}
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400">Pack (Unit)</span>
                    )}
                  </div>

                  {/* Quantity adjust buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(idx, item.quantity - 1)}
                      className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleUpdateQty(idx, parseInt(e.target.value, 10) || 1)}
                      className="w-12 text-center border border-slate-200 rounded py-0.5 text-xs font-bold font-mono text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(idx, item.quantity + 1)}
                      className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1 hover:bg-rose-50 text-rose-500 rounded ml-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {cart.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-xs">
                Your cart is currently empty. Add items from the left catalog.
              </div>
            )}
          </div>

          {/* Statutory VAT Tax Breakdown & Summary Box */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Gross Subtotal:</span>
              <span className="font-mono font-bold text-slate-800">
                Rs. {totals.grossSubtotal.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between text-emerald-800 bg-emerald-50/60 px-2 py-1 rounded">
              <span>VAT Free / Exempt Sales (0%):</span>
              <span className="font-mono font-semibold">
                Rs. {totals.vatExemptSubtotal.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between text-blue-900 bg-blue-50/60 px-2 py-1 rounded">
              <span>Taxable Base Amount:</span>
              <span className="font-mono font-semibold">
                Rs. {totals.taxableBaseSubtotal.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between text-blue-900 bg-blue-50/60 px-2 py-1 rounded">
              <span>13% VAT (Value Added Tax):</span>
              <span className="font-mono font-bold">
                Rs. {totals.vatAmount.toFixed(2)}
              </span>
            </div>

            {/* End of bill discount */}
            <div className="pt-1 border-t border-slate-200/80 flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-700">Total Bill Discount:</span>
              <div className="flex items-center gap-1.5">
                <div className="flex bg-slate-200 p-0.5 rounded text-[10px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setDiscountType('flat')}
                    className={`px-1.5 py-0.5 rounded ${discountType === 'flat' ? 'bg-white text-slate-900' : 'text-slate-600'}`}
                  >
                    Rs.
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('percent')}
                    className={`px-1.5 py-0.5 rounded ${discountType === 'percent' ? 'bg-white text-slate-900' : 'text-slate-600'}`}
                  >
                    %
                  </button>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountValue || ''}
                  placeholder="0"
                  onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                  className="w-16 bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-right text-slate-900 focus:outline-hidden"
                />
                <span className="text-slate-400 text-[11px] font-mono">
                  (- Rs. {totals.discountAmount.toFixed(2)})
                </span>
              </div>
            </div>

            {/* Grand Total */}
            <div className="pt-2 border-t-2 border-slate-300 flex justify-between items-center text-sm">
              <span className="font-extrabold text-slate-900">Grand Total Payable:</span>
              <span className="font-extrabold font-mono text-xl text-teal-800">
                Rs. {totals.grandTotal.toFixed(2)}
              </span>
            </div>

            {/* Payment Method Selector */}
            <div className="pt-2 space-y-1.5">
              <span className="block text-[11px] font-semibold text-slate-700">
                Settlement Payment Mode:
              </span>
              <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setPaymentMode('cash')}
                  className={`py-2 rounded-lg flex flex-col items-center gap-1 transition-all ${
                    paymentMode === 'cash'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span className="text-[10px]">Cash</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode('fonepay_qr')}
                  className={`py-2 rounded-lg flex flex-col items-center gap-1 transition-all ${
                    paymentMode === 'fonepay_qr'
                      ? 'bg-rose-700 text-white shadow-xs'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span className="text-[10px]">Fonepay QR</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode('card')}
                  className={`py-2 rounded-lg flex flex-col items-center gap-1 transition-all ${
                    paymentMode === 'card'
                      ? 'bg-blue-700 text-white shadow-xs'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span className="text-[10px]">Card</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode('credit')}
                  className={`py-2 rounded-lg flex flex-col items-center gap-1 transition-all ${
                    paymentMode === 'credit'
                      ? 'bg-amber-700 text-white shadow-xs'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="text-[10px]">Credit (Udharo)</span>
                </button>
              </div>
            </div>

            {/* Cash Tendered & Change Return */}
            {paymentMode === 'cash' && (
              <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                    Cash Tendered (Rs.):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={cashTendered || ''}
                    placeholder={totals.grandTotal.toFixed(0)}
                    onChange={(e) => setCashTendered(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-900 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                    Change to Return:
                  </label>
                  <div className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono font-bold text-emerald-700 text-sm">
                    Rs. {totals.changeGiven.toFixed(2)}
                  </div>
                </div>
              </div>
            )}

            {/* Complete Sale & Print Button */}
            <div className="pt-3">
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={handleCompleteSale}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-md shadow-teal-700/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
              >
                <Printer className="w-4 h-4" />
                <span>Complete Bill &amp; Print VAT Tax Invoice (कर बीजक)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
