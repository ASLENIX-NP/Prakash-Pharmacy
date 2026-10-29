import React, { useMemo, useState } from 'react';
import {
  Minus,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';

import { usePharmacy } from '../context/PharmacyContext';
import { useDialog } from '../context/DialogContext';
import { decimalInputValue, digitsOnlyUpTo, normalizePhoneNumber, parseDecimalInput, parseIntegerInput, preventInvalidNumberKeys } from '../utils/inputValidation';
import {
  Medicine,
  SaleItem,
} from '../types/pharmacy';

export const PosView: React.FC = () => {
  const { showToast, confirmDialog } = useDialog();
  const {
    medicines,
    completeSale,
    currentUser,
    setActiveInvoiceToPrint,
  } = usePharmacy();

  // ============================================================
  // SEARCH
  // ============================================================

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenericFilter, setSelectedGenericFilter] =
    useState<string | null>(null);

  // ============================================================
  // CART
  // ============================================================

  const [cart, setCart] = useState<SaleItem[]>([]);

  // ============================================================
  // CUSTOMER
  // ============================================================

  const [customerName, setCustomerName] =
    useState('Counter Customer');

  const [customerPhone, setCustomerPhone] =
    useState('');

  const [customerPan, setCustomerPan] =
    useState('');

  const [doctorName, setDoctorName] =
    useState('');

  const [patientAge, setPatientAge] =
    useState('');

  const [patientGender] =
    useState('N/A');

  // ============================================================
  // DISCOUNT / PAYMENT
  // ============================================================

  const [discountType, setDiscountType] =
    useState<'percent' | 'flat'>('flat');

  const [discountValue, setDiscountValue] =
    useState<number>(0);

  const [paymentMode, setPaymentMode] =
    useState<
      'cash' |
      'fonepay_qr' |
      'card' |
      'credit'
    >('cash');

  const [cashTendered, setCashTendered] =
    useState<number>(0);

  // ============================================================
  // SEARCH RESULTS
  // ============================================================

  const searchResults = useMemo(() => {
    if (!searchQuery.trim() && !selectedGenericFilter) {
      return [];
    }

    const filtered = medicines.filter((medicine) => {
      // Hide completely out-of-stock batches from POS.
      // They remain visible in Inventory for history/audit purposes.
      const hasStock =
        medicine.stockPacks > 0 ||
        medicine.stockLooseUnits > 0;

      if (!hasStock) {
        return false;
      }
      if (selectedGenericFilter) {
        return (
          medicine.genericName.toLowerCase() ===
          selectedGenericFilter.toLowerCase()
        );
      }

      const query =
        searchQuery.trim().toLowerCase();

      return (
        medicine.name
          .toLowerCase()
          .includes(query) ||
        medicine.genericName
          .toLowerCase()
          .includes(query) ||
        medicine.batchNumber
          .toLowerCase()
          .includes(query) ||
        medicine.rackLocation
          .toLowerCase()
          .includes(query)
      );
    });

    // FEFO (First Expired, First Out): show earliest expiry date first
    return filtered.sort((a, b) => {
      const timeA = new Date(a.expiryDate).getTime() || 0;
      const timeB = new Date(b.expiryDate).getTime() || 0;
      return timeA - timeB;
    });
  }, [
    medicines,
    searchQuery,
    selectedGenericFilter,
  ]);

  // ============================================================
  // ADD TO CART
  // ============================================================

  const handleAddToCart = (
    medicine: Medicine,
    isLoose = false
  ) => {
    const isExpired =
      new Date(medicine.expiryDate).getTime() <
      Date.now();

    if (isExpired) {
      showToast(
        `Cannot sell ${medicine.name}. Batch ${medicine.batchNumber} expired on ${medicine.expiryDate}.`,
        'error',
        'Expired Drug'
      );
      return;
    }

    const currentTotalUnits =
      medicine.stockPacks *
        medicine.unitsPerPack +
      medicine.stockLooseUnits;

    if (currentTotalUnits <= 0) {
      showToast(
        `${medicine.name} is out of stock.`,
        'warning',
        'Out of Stock'
      );
      return;
    }

    const unitPrice = isLoose
      ? medicine.unitsPerPack > 1
        ? medicine.mrpPrice /
          medicine.unitsPerPack
        : medicine.mrpPrice
      : medicine.mrpPrice;

    const costUnitPrice = isLoose
      ? medicine.unitsPerPack > 1
        ? medicine.costPrice /
          medicine.unitsPerPack
        : medicine.costPrice
      : medicine.costPrice;

    const existingIndex =
      cart.findIndex(
        (item) =>
          item.medicineId === medicine.id &&
          item.isLooseUnit === isLoose
      );

    if (existingIndex >= 0) {
      const updated = [...cart];

      const newQty =
        updated[existingIndex].quantity + 1;

      const totalUnitsNeeded = isLoose
        ? newQty
        : newQty * medicine.unitsPerPack;

      if (
        totalUnitsNeeded >
        currentTotalUnits
      ) {
        showToast(
          `Cannot add more. Only ${currentTotalUnits} units available in stock.`,
          'warning',
          'Stock Limit'
        );
        return;
      }

      const lineTotal =
        newQty * unitPrice;

      const taxBase =
        medicine.isVatApplicable
          ? lineTotal / 1.13
          : lineTotal;

      const vatAmount =
        medicine.isVatApplicable
          ? lineTotal - taxBase
          : 0;

      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: newQty,
        lineTotal,
        taxBase,
        vatAmount,
      };

      setCart(updated);
      return;
    }

    const lineTotal = unitPrice;

    const taxBase =
      medicine.isVatApplicable
        ? lineTotal / 1.13
        : lineTotal;

    const vatAmount =
      medicine.isVatApplicable
        ? lineTotal - taxBase
        : 0;

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
      isVatApplicable:
        medicine.isVatApplicable,
      rackLocation:
        medicine.rackLocation,
      lineTotal,
      taxBase,
      vatAmount,
    };

    setCart((previous) => [
      ...previous,
      newItem,
    ]);
  };

  // ============================================================
  // QUANTITY
  // ============================================================

  const handleUpdateQty = (
    index: number,
    newQty: number
  ) => {
    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }

    const item = cart[index];

    const medicine =
      medicines.find(
        (med) =>
          med.id === item.medicineId
      );

    if (!medicine) {
      return;
    }

    const currentTotalUnits =
      medicine.stockPacks *
        medicine.unitsPerPack +
      medicine.stockLooseUnits;

    const unitsNeeded =
      item.isLooseUnit
        ? newQty
        : newQty *
          item.unitsPerPack;

    if (
      unitsNeeded >
      currentTotalUnits
    ) {
      showToast(
        `Requested quantity exceeds available stock (${currentTotalUnits} units).`,
        'warning',
        'Stock Limit'
      );
      return;
    }

    const updated = [...cart];

    const lineTotal =
      newQty * item.unitPrice;

    const taxBase =
      item.isVatApplicable
        ? lineTotal / 1.13
        : lineTotal;

    const vatAmount =
      item.isVatApplicable
        ? lineTotal - taxBase
        : 0;

    updated[index] = {
      ...item,
      quantity: newQty,
      lineTotal,
      taxBase,
      vatAmount,
    };

    setCart(updated);
  };

  // ============================================================
  // PACK / LOOSE
  // ============================================================

  const handleToggleLoose = (
    index: number
  ) => {
    const item = cart[index];

    const medicine =
      medicines.find(
        (med) =>
          med.id === item.medicineId
      );

    if (!medicine) {
      return;
    }

    const newIsLoose =
      !item.isLooseUnit;

    const newUnitPrice =
      newIsLoose
        ? medicine.unitsPerPack > 1
          ? medicine.mrpPrice /
            medicine.unitsPerPack
          : medicine.mrpPrice
        : medicine.mrpPrice;

    const newCostPrice =
      newIsLoose
        ? medicine.unitsPerPack > 1
          ? medicine.costPrice /
            medicine.unitsPerPack
          : medicine.costPrice
        : medicine.costPrice;

    const updated = [...cart];

    const lineTotal =
      item.quantity *
      newUnitPrice;

    const taxBase =
      item.isVatApplicable
        ? lineTotal / 1.13
        : lineTotal;

    const vatAmount =
      item.isVatApplicable
        ? lineTotal - taxBase
        : 0;

    updated[index] = {
      ...item,
      isLooseUnit:
        newIsLoose,
      unitPrice:
        newUnitPrice,
      costPrice:
        newCostPrice,
      lineTotal,
      taxBase,
      vatAmount,
    };

    setCart(updated);
  };

  // ============================================================
  // REMOVE
  // ============================================================

  const handleRemoveItem = (
    index: number
  ) => {
    setCart(
      cart.filter(
        (_, currentIndex) =>
          currentIndex !== index
      )
    );
  };

  // ============================================================
  // CLEAR
  // ============================================================

  const handleClearCart = async () => {
    if (cart.length === 0) return;

    const confirmed = await confirmDialog({
      title: 'Clear Current Bill',
      message: 'Are you sure you want to remove all items from the current bill?',
      confirmLabel: 'Clear Bill',
      cancelLabel: 'Keep Items',
      type: 'warning',
    });

    if (confirmed) {
      setCart([]);
      setDiscountValue(0);
      setCashTendered(0);
      showToast('Billing cart cleared.', 'info', 'Cart');
    }
  };

  // ============================================================
  // TOTALS
  // ============================================================

  const totals = useMemo(() => {
    const grossSubtotal =
      cart.reduce(
        (total, item) =>
          total + item.lineTotal,
        0
      );

    const vatExemptSubtotal =
      cart
        .filter(
          (item) =>
            !item.isVatApplicable
        )
        .reduce(
          (total, item) =>
            total +
            item.lineTotal,
          0
        );

    const taxableGross =
      cart
        .filter(
          (item) =>
            item.isVatApplicable
        )
        .reduce(
          (total, item) =>
            total +
            item.lineTotal,
          0
        );

    const taxableBaseSubtotal =
      taxableGross > 0
        ? taxableGross / 1.13
        : 0;

    const vatAmount =
      taxableGross > 0
        ? taxableGross -
          taxableBaseSubtotal
        : 0;

    let discountAmount = 0;

    if (
      discountType ===
      'percent'
    ) {
      discountAmount =
        (grossSubtotal *
          (discountValue || 0)) /
        100;
    } else {
      discountAmount =
        discountValue || 0;
    }

    if (
      discountAmount >
      grossSubtotal
    ) {
      discountAmount =
        grossSubtotal;
    }

    const grandTotal =
      Math.max(
        0,
        grossSubtotal -
          discountAmount
      );

    const changeGiven =
      Math.max(
        0,
        (cashTendered || 0) -
          grandTotal
      );

    return {
      grossSubtotal,
      vatExemptSubtotal,
      taxableBaseSubtotal,
      vatAmount,
      discountAmount,
      grandTotal,
      changeGiven,
    };
  }, [
    cart,
    discountType,
    discountValue,
    cashTendered,
  ]);

  // ============================================================
  // COMPLETE SALE
  // ============================================================

  const handleCompleteSale = () => {
    if (cart.length === 0) {
      showToast(
        'Cart is empty. Add medicines before checkout.',
        'warning',
        'Empty Cart'
      );
      return;
    }

    if (customerPhone && !/^\d{7,10}$/.test(customerPhone)) {
      showToast('Customer phone number must contain between 7 and 10 digits.', 'warning', 'Validation');
      return;
    }

    if (customerPan && !/^\d{9}$/.test(customerPan)) {
      showToast('Buyer PAN must contain exactly 9 digits.', 'warning', 'Validation');
      return;
    }

    const saleRecord =
      completeSale({
        date: new Date()
          .toISOString()
          .split('T')[0],

        time: new Date()
          .toTimeString()
          .split(' ')[0],

        customerName:
          customerName.trim() ||
          'Counter Patient',

        customerPhone:
          customerPhone.trim() ||
          undefined,

        customerPan:
          customerPan.trim() ||
          undefined,

        doctorName:
          doctorName.trim() ||
          undefined,

        patientAge:
          patientAge.trim() ||
          undefined,

        patientGender:
          patientGender !== 'N/A'
            ? patientGender
            : undefined,

        items: cart,

        grossSubtotal:
          totals.grossSubtotal,

        vatExemptSubtotal:
          totals.vatExemptSubtotal,

        taxableBaseSubtotal:
          totals.taxableBaseSubtotal,

        vatAmount:
          totals.vatAmount,

        discountType,
        discountValue,

        discountAmount:
          totals.discountAmount,

        grandTotal:
          totals.grandTotal,

        paymentMode,

        cashTendered:
          paymentMode === 'cash'
            ? cashTendered ||
              totals.grandTotal
            : totals.grandTotal,

        changeGiven:
          paymentMode === 'cash'
            ? totals.changeGiven
            : 0,

        cashierName:
          currentUser?.name ||
          'Cashier',

        cashierId:
          currentUser?.username ||
          currentUser?.id ||
          'admin',
      });

    setCart([]);

    setCustomerName(
      'Counter Customer'
    );

    setCustomerPhone('');
    setCustomerPan('');
    setDoctorName('');
    setPatientAge('');

    setDiscountValue(0);
    setCashTendered(0);

    setActiveInvoiceToPrint(
      saleRecord
    );
  };

  // ============================================================
  // QUICK GENERICS
  // ============================================================

  const quickGenerics = [
    'Paracetamol',
    'Amoxicillin',
    'Pantoprazole',
    'Cetirizine',
    'Azithromycin',
  ];

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(400px,1fr)]">

      {/* ======================================================
          LEFT SIDE
      ======================================================= */}

      <div className="min-w-0 space-y-4">

        {/* MEDICINE SEARCH */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[16px] font-extrabold text-slate-900">
              Medicine Search
            </h2>

            <span className="text-[12px] font-medium text-slate-400">
              Barcode scanner ready
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              type="text"
              autoFocus
              value={searchQuery}
              placeholder="Search medicine, generic, barcode, batch or rack..."
              onChange={(event) => {
                setSearchQuery(
                  event.target.value
                );

                if (
                  selectedGenericFilter
                ) {
                  setSelectedGenericFilter(
                    null
                  );
                }
              }}
              className="h-[50px] w-full rounded-xl border border-slate-300 bg-white pl-11 pr-4 text-[15px] font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-semibold text-slate-500">
              Quick Generic:
            </span>

            {quickGenerics.map(
              (generic) => (
                <button
                  key={generic}
                  type="button"
                  onClick={() => {
                    setSearchQuery(
                      generic
                    );

                    setSelectedGenericFilter(
                      null
                    );
                  }}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] font-semibold text-slate-600 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
                >
                  {generic}
                </button>
              )
            )}

            {selectedGenericFilter && (
              <button
                type="button"
                onClick={() =>
                  setSelectedGenericFilter(
                    null
                  )
                }
                className="flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[12px] font-semibold text-rose-600"
              >
                {selectedGenericFilter}

                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </section>


        {/* STOCK RESULTS */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-[15px] font-extrabold text-slate-900">
              Stock Results
            </h2>

            <span className="text-[12px] font-medium text-slate-400">
              {searchResults.length > 0
                ? `${searchResults.length} batch${searchResults.length === 1 ? '' : 'es'} found`
                : searchQuery
                  ? 'No stock found'
                  : 'Search above'}
            </span>
          </div>

          <div className="max-h-[430px] divide-y divide-slate-100 overflow-y-auto">

            {searchResults.map(
              (medicine) => {
                const isExpired =
                  new Date(
                    medicine.expiryDate
                  ).getTime() <
                  Date.now();

                const isLowStock =
                  medicine.stockPacks <=
                  medicine.reorderLevel;

                return (
                  <div
                    key={medicine.id}
                    className="grid grid-cols-[minmax(0,1fr)_170px_105px_130px] items-center gap-4 px-4 py-3 transition hover:bg-slate-50/60"
                  >

                    {/* MEDICINE */}
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-extrabold text-slate-900">
                        {medicine.name}
                      </p>

                      <p className="mt-1 truncate text-[11px] text-slate-500">
                        {medicine.genericName}
                        <span className="mx-1.5 text-slate-300">
                          •
                        </span>
                        Batch {medicine.batchNumber}
                        <span className="mx-1.5 text-slate-300">
                          •
                        </span>
                        Rack {medicine.rackLocation}
                        <span className="mx-1.5 text-slate-300">
                          •
                        </span>

                        <span
                          className={
                            medicine.isVatApplicable
                              ? 'text-blue-600'
                              : 'text-emerald-600'
                          }
                        >
                          {medicine.isVatApplicable
                            ? '13% VAT'
                            : 'VAT Exempt'}
                        </span>
                      </p>
                    </div>


                    {/* STOCK */}
                    <div className="text-right">
                      <p
                        className={`text-[13px] font-bold ${
                          isExpired
                            ? 'text-rose-600'
                            : isLowStock
                              ? 'text-amber-700'
                              : 'text-teal-700'
                        }`}
                      >
                        {medicine.stockPacks} packs
                        {' + '}
                        {medicine.stockLooseUnits} units
                        {isExpired
                          ? ' · Expired'
                          : isLowStock
                            ? ' · Low'
                            : ''}
                      </p>

                      <p className="mt-1 text-[11px] text-slate-400">
                        Exp {medicine.expiryDate}
                      </p>
                    </div>


                    {/* PRICE */}
                    <div className="text-right">
                      <p className="font-mono text-[13px] font-black text-slate-900">
                        Rs. {medicine.mrpPrice.toFixed(2)}
                      </p>

                      <p className="mt-0.5 text-[10px] font-medium text-slate-500">
                        {medicine.unitsPerPack > 1 ? (
                          <>
                            Pack · <span className="font-bold text-teal-700 font-mono">Rs. {(medicine.mrpPrice / medicine.unitsPerPack).toFixed(2)}</span> / tab
                          </>
                        ) : (
                          'MRP / pack'
                        )}
                      </p>
                    </div>


                    {/* PACK / TAB ADD OPTIONS */}
                    <div className="flex items-center justify-end gap-1.5">

                      {/* ADD FULL PACK */}
                      <button
                        type="button"
                        disabled={isExpired || medicine.stockPacks <= 0}
                        onClick={() =>
                          handleAddToCart(
                            medicine,
                            false
                          )
                        }
                        className="
                          min-w-[58px]
                          rounded-lg
                          bg-teal-700
                          px-2.5
                          py-2
                          text-[11px]
                          font-bold
                          text-white
                          transition
                          hover:bg-teal-800
                          disabled:cursor-not-allowed
                          disabled:bg-slate-200
                          disabled:text-slate-400
                        "
                      >
                        Pack
                      </button>

                      {/* ADD SINGLE TAB / LOOSE UNIT */}
                      {medicine.unitsPerPack > 1 && (
                        <button
                          type="button"
                          title={`Add Tab at Rs. ${(medicine.mrpPrice / medicine.unitsPerPack).toFixed(2)} (${medicine.mrpPrice} / ${medicine.unitsPerPack} units)`}
                          disabled={
                            isExpired ||
                            (
                              medicine.stockPacks <= 0 &&
                              medicine.stockLooseUnits <= 0
                            )
                          }
                          onClick={() =>
                            handleAddToCart(
                              medicine,
                              true
                            )
                          }
                          className="
                            min-w-[62px]
                            rounded-lg
                            border
                            border-teal-300
                            bg-teal-50
                            px-2
                            py-2
                            text-[11px]
                            font-bold
                            text-teal-800
                            transition
                            hover:border-teal-400
                            hover:bg-teal-100
                            disabled:cursor-not-allowed
                            disabled:border-slate-200
                            disabled:bg-slate-100
                            disabled:text-slate-400
                          "
                        >
                          Tab (Rs. {(medicine.mrpPrice / medicine.unitsPerPack).toFixed(1)})
                        </button>
                      )}

                    </div>
                  </div>
                );
              }
            )}

            {searchResults.length ===
              0 && (
              <div className="flex min-h-[120px] items-center justify-center px-6 text-center">
                <p className="text-[14px] font-medium text-slate-400">
                  {searchQuery
                    ? `No available stock found for "${searchQuery}".`
                    : 'Search for a medicine to view available stock.'}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>


      {/* ======================================================
          RIGHT SIDE
      ======================================================= */}

      <div className="min-w-0 space-y-4">

        {/* CUSTOMER DETAILS */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-[16px] font-extrabold text-slate-900">
              Customer Details
            </h2>

            <span className="max-w-[230px] truncate rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
              Cashier: {currentUser?.name}{' '}
              ({currentUser?.role})
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                Customer / Patient Name
              </label>

              <input
                type="text"
                value={customerName}
                onChange={(event) =>
                  setCustomerName(
                    event.target.value
                  )
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-[13px] font-medium text-slate-800 outline-none focus:border-teal-400 focus:bg-white"
              />
            </div>


            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                Phone Number
              </label>

              <input
                type="tel"
                inputMode="numeric"
                value={customerPhone}
                placeholder="e.g. 9845012345"
                onChange={(event) =>
                  setCustomerPhone(
                    normalizePhoneNumber(event.target.value)
                  )
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-[13px] font-medium text-slate-800 outline-none focus:border-teal-400 focus:bg-white"
              />
            </div>


            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                Prescribing Doctor
              </label>

              <input
                type="text"
                value={doctorName}
                placeholder="Dr. Name (Hetauda Hosp)"
                onChange={(event) =>
                  setDoctorName(
                    event.target.value
                  )
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-[13px] font-medium text-slate-800 outline-none focus:border-teal-400 focus:bg-white"
              />
            </div>


            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                Buyer PAN (optional)
              </label>

              <input
                type="text"
                inputMode="numeric"
                maxLength={9}
                value={customerPan}
                placeholder="Buyer PAN"
                onChange={(event) =>
                  setCustomerPan(
                    digitsOnlyUpTo(event.target.value, 9)
                  )
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-[13px] font-medium text-slate-800 outline-none focus:border-teal-400 focus:bg-white"
              />
            </div>

          </div>
        </section>


        {/* CURRENT CART */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          {/* CART HEADER */}
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-extrabold text-slate-900">
                Current Cart
              </h2>

              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-700">
                {cart.length}{' '}
                {cart.length === 1
                  ? 'item'
                  : 'items'}
              </span>
            </div>

            {cart.length > 0 && (
              <button
                type="button"
                onClick={handleClearCart}
                className="text-[12px] font-semibold text-rose-600 hover:text-rose-800"
              >
                Clear Cart
              </button>
            )}
          </div>


          {/* CART HEADINGS */}
          {cart.length > 0 && (
            <div className="grid grid-cols-[minmax(0,1fr)_100px_80px_90px_24px] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-400">
              <span>Medicine</span>
              <span className="text-center">
                Qty
              </span>
              <span className="text-right">
                Rate
              </span>
              <span className="text-right">
                Total
              </span>
              <span />
            </div>
          )}


          {/* CART ITEMS */}
          <div className="max-h-[240px] divide-y divide-slate-100 overflow-y-auto">

            {cart.map(
              (item, index) => (
                <div
                  key={`${item.medicineId}-${item.isLooseUnit}`}
                  className="grid grid-cols-[minmax(0,1fr)_100px_80px_90px_24px] items-center gap-3 px-4 py-3"
                >

                  {/* NAME */}
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-extrabold text-slate-900">
                      {item.medicineName}
                    </p>

                    <div className="mt-1 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleLoose(
                            index
                          )
                        }
                        title="Click to toggle between Packet and Tab"
                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase transition ${
                          item.isLooseUnit
                            ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                            : 'bg-teal-100 text-teal-800 border border-teal-300 hover:bg-teal-200'
                        }`}
                      >
                        {item.isLooseUnit ? 'Tab (Loose)' : 'Packet'}
                      </button>

                      <span className="text-[10px] font-mono text-slate-400">
                        {item.batchNumber}
                      </span>
                    </div>
                  </div>


                  {/* QTY */}
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateQty(
                          index,
                          item.quantity - 1
                        )
                      }
                      className="flex h-5 w-5 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100"
                    >
                      <Minus className="h-3 w-3" />
                    </button>

                    <input
                      type="number"
                      min="1"
                      inputMode="numeric"
                      value={item.quantity}
                      onKeyDown={(event) => preventInvalidNumberKeys(event, false)}
                      onChange={(event) =>
                        handleUpdateQty(
                          index,
                          parseIntegerInput(event.target.value, 6) ?? 1
                        )
                      }
                      className="h-6 w-8 rounded-md border border-slate-200 text-center font-mono text-[11px] font-bold outline-none"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateQty(
                          index,
                          item.quantity + 1
                        )
                      }
                      className="flex h-5 w-5 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>


                  {/* RATE */}
                  <div className="text-right">
                    <span className="font-mono text-[11px] font-semibold text-slate-700">
                      {item.unitPrice.toFixed(2)}
                    </span>
                    <span className="block text-[9px] text-slate-400">
                      {item.isLooseUnit ? '/ tab' : '/ pack'}
                    </span>
                  </div>


                  {/* TOTAL */}
                  <div className="text-right font-mono text-[12px] font-black text-slate-900">
                    {item.lineTotal.toFixed(2)}
                  </div>


                  {/* REMOVE */}
                  <button
                    type="button"
                    onClick={() =>
                      handleRemoveItem(
                        index
                      )
                    }
                    className="text-slate-300 transition hover:text-rose-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>

                </div>
              )
            )}

            {cart.length === 0 && (
              <div className="flex min-h-[105px] items-center justify-center px-6 text-center">
                <p className="text-[13px] font-medium text-slate-400">
                  Your cart is empty. Add medicines from the stock results.
                </p>
              </div>
            )}
          </div>


          {/* ==================================================
              BILL SUMMARY
          =================================================== */}

          <div className="border-t border-slate-200 bg-white px-4 py-4">

            <div className="space-y-2 text-[12px]">

              <div className="flex items-center justify-between text-slate-600">
                <span>Subtotal</span>

                <span className="font-mono font-bold text-slate-800">
                  Rs. {totals.grossSubtotal.toFixed(2)}
                </span>
              </div>


              <div className="flex items-center justify-between text-slate-500">
                <span>VAT Exempt</span>

                <span className="font-mono font-semibold text-slate-700">
                  Rs. {totals.vatExemptSubtotal.toFixed(2)}
                </span>
              </div>


              <div className="flex items-center justify-between text-slate-500">
                <span>Taxable Amount</span>

                <span className="font-mono font-semibold text-slate-700">
                  Rs. {totals.taxableBaseSubtotal.toFixed(2)}
                </span>
              </div>


              <div className="flex items-center justify-between text-slate-500">
                <span>VAT (13%)</span>

                <span className="font-mono font-semibold text-slate-700">
                  Rs. {totals.vatAmount.toFixed(2)}
                </span>
              </div>

            </div>


            {/* DISCOUNT */}
            <div className="mt-3 border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between gap-3">

                <span className="text-[12px] font-semibold text-slate-600">
                  Bill Discount
                </span>

                <div className="flex items-center gap-2">

                  <div className="flex overflow-hidden rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() =>
                        setDiscountType(
                          'flat'
                        )
                      }
                      className={`px-2.5 py-1.5 text-[11px] font-bold ${
                        discountType ===
                        'flat'
                          ? 'bg-teal-700 text-white'
                          : 'bg-white text-slate-500'
                      }`}
                    >
                      Rs.
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setDiscountType(
                          'percent'
                        )
                      }
                      className={`px-2.5 py-1.5 text-[11px] font-bold ${
                        discountType ===
                        'percent'
                          ? 'bg-teal-700 text-white'
                          : 'bg-white text-slate-500'
                      }`}
                    >
                      %
                    </button>
                  </div>


                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    step="1"
                    value={discountValue || ''}
                    placeholder="0"
                    onKeyDown={(event) => preventInvalidNumberKeys(event, false)}
                    onChange={(event) =>
                      setDiscountValue(parseIntegerInput(event.target.value, 6) ?? 0)
                    }
                    className="h-8 w-20 rounded-lg border border-slate-200 px-2 text-right font-mono text-[12px] font-bold outline-none focus:border-teal-400"
                  />

                </div>
              </div>

              {totals.discountAmount > 0 && (
                <div className="mt-2 flex justify-between text-[11px] text-slate-400">
                  <span>
                    Discount applied
                  </span>

                  <span className="font-mono">
                    - Rs. {totals.discountAmount.toFixed(2)}
                  </span>
                </div>
              )}
            </div>


            {/* GRAND TOTAL */}
            <div className="mt-3 flex items-center justify-between border-t-2 border-slate-300 pt-3">
              <span className="text-[15px] font-black text-slate-900">
                Grand Total
              </span>

              <span className="font-mono text-[22px] font-black tracking-tight text-teal-700">
                Rs. {totals.grandTotal.toFixed(2)}
              </span>
            </div>


            {/* PAYMENT */}
            <div className="mt-4">
              <p className="mb-2 text-[12px] font-semibold text-slate-600">
                Payment Mode
              </p>

              <div className="grid grid-cols-4 gap-2">

                {[
                  ['cash', 'Cash'],
                  ['fonepay_qr', 'Fonepay QR'],
                  ['card', 'Card'],
                  ['credit', 'Credit (Udharo)'],
                ].map(
                  ([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setPaymentMode(
                          value as
                            | 'cash'
                            | 'fonepay_qr'
                            | 'card'
                            | 'credit'
                        )
                      }
                      className={`min-h-[42px] rounded-lg border px-2 py-2 text-[11px] font-bold transition ${
                        paymentMode ===
                        value
                          ? 'border-teal-700 bg-teal-700 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {label}
                    </button>
                  )
                )}

              </div>
            </div>


            {/* CASH */}
            {paymentMode === 'cash' && (
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-500">
                    Cash Tendered (Rs.)
                  </label>

                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={cashTendered || ''}
                    placeholder="0"
                    onKeyDown={(event) => preventInvalidNumberKeys(event, false)}
                    onChange={(event) =>
                      setCashTendered(parseIntegerInput(event.target.value, 8) ?? 0)
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 px-3 font-mono text-[13px] font-bold outline-none focus:border-teal-400"
                  />
                </div>


                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-500">
                    Change to Return
                  </label>

                  <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-[14px] font-black text-emerald-700">
                    Rs. {totals.changeGiven.toFixed(2)}
                  </div>
                </div>

              </div>
            )}


            {/* COMPLETE */}
            <button
              type="button"
              disabled={cart.length === 0}
              onClick={handleCompleteSale}
              className="mt-4 h-[50px] w-full rounded-xl bg-teal-700 px-4 text-[15px] font-extrabold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              Complete Bill &amp; Print VAT Invoice
            </button>

          </div>
        </section>
      </div>
    </div>
  );
};
