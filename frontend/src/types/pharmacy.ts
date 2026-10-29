export type MedicineCategory =
  | 'Tablet'
  | 'Capsule'
  | 'Syrup'
  | 'Suspension'
  | 'Injection'
  | 'Ointment'
  | 'Cream'
  | 'Drops'
  | 'Inhaler'
  | 'Antiseptic Solution'
  | 'Medicated Gel'
  | 'Device / Surgical'
  | 'OTC Cosmetic'
  | 'Other';

export interface Medicine {
  id: string;
  name: string; // Brand Name e.g. "Augmentin 625 Duo"
  genericName: string; // e.g. "Amoxicillin + Clavulanic Acid"
  category: MedicineCategory;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  stockPacks: number; // Full packs in stock (integer or float)
  stockLooseUnits: number; // Loose tablets/capsules available outside full packs
  unitsPerPack: number; // e.g. 10 tablets per strip/pack
  costPrice: number; // Purchase price per pack (NPR)
  mrpPrice: number; // Selling Price / MRP per pack (NPR)
  supplierId: string;
  supplierName: string;
  reorderLevel: number; // Low stock threshold (in packs)
  rackLocation: string; // e.g. "Rack A-1", "Syrup Bay 2", "Cold Storage"
  isVatApplicable: boolean; // false = VAT Free / 0% Exempt, true = 13% VAT Applicable
  barcode?: string;
  notes?: string;
  providedFields?: Record<string, boolean>;
}

export type AuditAdjustmentType = 'reconcile' | 'add' | 'deduce';

export type AuditReason =
  | 'Physical Count Audit'
  | 'Damaged / Broken Strip'
  | 'Expired Medicine Disposal'
  | 'Found Unrecorded Stock / Bonus'
  | 'Theft / Shrinkage Loss'
  | 'Supplier Return / Correction'
  | 'Breakage in Transit'
  | 'Sample / Free Dispensation'
  | 'Other Adjustment';

export interface StockAdjustmentLog {
  id: string;
  medicineId: string;
  medicineName: string;
  genericName: string;
  batchNumber: string;
  type: AuditAdjustmentType;
  previousPacks: number;
  previousLoose: number;
  previousTotalUnits: number;
  addedPacks: number;
  addedLoose: number;
  newPacks: number;
  newLoose: number;
  newTotalUnits: number;
  netVarianceUnits: number; // positive = surplus, negative = shortage
  reason: AuditReason;
  notes: string;
  timestamp: string;
  recordedBy: string;
}

export interface Stockist {
  id: string;
  name: string;
  panNumber: string;
  phone: string;
  email: string;
  address: string;
  contactPerson: string;
  creditLimit: number;
  currentBalance: number; // Positive = we owe them (payable), Negative = advance
  notes?: string;
}

export interface StockistInvoiceItem {
  id: string;
  medicineId?: string;
  medicineName: string;
  genericName: string;
  category: MedicineCategory;
  batchNumber: string;
  expiryDate: string;
  packQty: number;
  looseUnits?: number; // Loose tablets/units outside full packs
  freePacks: number;
  unitsPerPack: number;
  costPrice: number; // Price per pack before discount
  discountPercent: number; // Trade discount %
  isVatApplicable: boolean;
  mrpPrice: number;
  rackLocation: string;
  lineTotal: number;
}

export interface StockistPurchaseInvoice {
  id: string;
  invoiceNumber: string; // Wholesaler's bill number
  stockistId: string;
  stockistName: string;
  stockistPan: string;
  date: string; // YYYY-MM-DD
  paymentMode: 'credit' | 'cash';
  dueDate?: string;
  items: StockistInvoiceItem[];
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  vatAmount: number; // 13% on taxable items
  grandTotal: number;
  paidAmount: number;
  paymentStatus: 'paid' | 'pending' | 'partial';
  notes?: string;
  createdAt: string;
}

export type StockistLedgerType = 'purchase_invoice' | 'payment_made' | 'return_debit_note';

export interface StockistLedgerEntry {
  id: string;
  stockistId: string;
  date: string;
  refType: StockistLedgerType;
  refId: string;
  refNumber: string; // e.g. Bill # or Receipt # or Debit Note #
  description: string;
  debit: number; // We paid or returned items -> reduces our payable liability
  credit: number; // We purchased on credit -> increases our liability
  balance: number; // Running balance
  createdAt?: string;
  ledgerId?: number;
}

export type StockistReturnReason =
  | 'Expired Medicine'
  | 'Damaged / Broken Strip'
  | 'Breakage in Transit'
  | 'Manufacturer Recall'
  | 'Slow Moving / Near Expiry Return'
  | 'Other';

export interface StockistReturnItem {
  medicineId: string;
  medicineName: string;
  batchNumber: string;
  expiryDate: string;
  packs: number;
  looseUnits: number;
  unitsPerPack: number;
  unitCost: number; // per pack cost
  totalReturnAmount: number;
  reason: StockistReturnReason;
}

export interface StockistReturnVoucher {
  id: string;
  debitNoteNumber: string; // e.g. "DN-2081-001"
  stockistId: string;
  stockistName: string;
  date: string;
  items: StockistReturnItem[];
  totalAmount: number;
  notes?: string;
  createdAt: string;
}

export interface SaleItem {
  medicineId: string;
  id?: string;
  billItemId?: number;
  inventoryId?: number;
  medicineName: string;
  genericName: string;
  category: MedicineCategory;
  batchNumber: string;
  expiryDate: string;
  isLooseUnit: boolean; // false = full packs, true = per tablet/capsule
  quantity: number; // packs or loose tablets count
  alreadyReturnedQuantity?: number;
  returnableQuantity?: number;
  unitsPerPack: number;
  unitPrice: number; // Price per item (pack price or loose tablet price)
  costPrice: number; // Cost price per item
  isVatApplicable: boolean;
  rackLocation: string;
  lineTotal: number;
  taxBase: number; // Taxable base portion if 13% VAT
  vatAmount: number; // 13% VAT portion if applicable
}

export interface CustomerSalesReturn {
  id: number;
  creditNoteNumber: string;

  invoiceId: number;
  invoiceNumber: string;

  customerName: string;
  customerPhone?: string;

  originalInvoiceTotal: number;

  returnDate: string;
  refundAmount: number;

  reason?: string;
  recordedBy?: string;

  invoice?: {
    id: number;
    invoiceNumber: string;
    customerName?: string;
    customerPhone?: string;
    totalAmount?: number;
  };

  items: Array<{
    id: number;

    medicineName: string;
    batchNumber: string;

    quantityInPack: number;
    quantityInUnit: number;

    refundAmount: number;

    inventory?: {
      brandName?: string;
      batchNumber?: string;
    };
  }>;
}

export interface SaleInvoice {
  id: string;
  invoiceNumber: string; // e.g. "PP-2081/82-00101"
  fiscalYear: string; // e.g. "2081/82"
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  customerName: string;
  customerPhone?: string;
  customerPan?: string; // Optional buyer PAN for statutory tax invoices
  doctorName?: string;
  patientAge?: string;
  patientGender?: string;
  items: SaleItem[];
  salesReturns?: Array<{
    id: number;
    creditNoteNumber: string;
    returnDate: string;
    refundAmount: number;
    reason: string;
    recordedBy: string;
  }>;
  grossSubtotal: number; // Total sum of lines before bill discount
  vatExemptSubtotal: number; // 0% VAT items total
  taxableBaseSubtotal: number; // Base of 13% VAT items
  vatAmount: number; // 13% of taxableBaseSubtotal
  discountType: 'percent' | 'flat';
  discountValue: number;
  discountAmount: number;
  grandTotal: number;
  paymentMode: 'cash' | 'fonepay_qr' | 'card' | 'credit';
  cashTendered: number;
  changeGiven: number;
  cashierName?: string;
  cashierId?: string;
  createdAt: string;
}

export type UserRole =
  | 'Admin'
  | 'Staff';

export interface PharmacyUser {
  id: string;
  name: string;
  username: string;
  password: string; // Securely verified credential
  phone?: string;
  email?: string;
  role: UserRole;
  pinCode?: string;
  isActive: boolean;
  shiftTiming?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface RackLocation {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
}

export interface PharmacySettings {
  storeName: string;
  address: string;
  phoneNumber: string;
  emailId: string;
  panNumber: string;
  ddaLicenceNumber: string;
  vatRegistered: boolean;
  storeLogo: string;
  pharmacistName: string;
  pharmacistCouncilRegNumber: string;
  ddaLicenceExpiryDate: string;
  currency: string;
  fiscalYear: string;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  defaultInvoiceSize: 'A5' | 'Thermal';
  invoiceDateFormat: 'BS' | 'AD';
  receiptFooterNote: string;
  defaultLowStockThreshold: number;
  nearExpiryThresholdMonths: number;
}
