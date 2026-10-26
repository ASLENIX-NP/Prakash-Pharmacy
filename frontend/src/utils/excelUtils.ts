import * as XLSX from 'xlsx';
import { Medicine, StockAdjustmentLog, StockistLedgerEntry, SaleInvoice } from '../types/pharmacy';

// Download pre-formatted Medicine Excel Import Template
export function downloadMedicineExcelTemplate(): void {
  const headers = [
    {
      'Medicine Name': 'Amoxicillin 500mg Cap',
      'Generic Salt / Molecule': 'Amoxicillin 500mg',
      'Category': 'Capsule',
      'Batch Number': 'AMX2024',
      'Expiry Date (YYYY-MM-DD)': '2027-06-30',
      'Packs In Stock': 50,
      'Loose Tablets (Units)': 0,
      'Units Per Pack': 10,
      'Purchase Cost Price': 75.00,
      'MRP / Selling Price': 105.00,
      'Stockist / Supplier': 'Kathmandu Pharma Distributors',
      'Reorder Alert Level': 15,
      'Shelf / Rack Location': 'Rack A-2',
      '13% VAT Applicable (YES/NO)': 'NO',
      'Barcode': '8901083001234',
      'Notes': 'Example row - replace or add below'
    },
    {
      'Medicine Name': 'Volini Gel 30g',
      'Generic Salt / Molecule': 'Diclofenac Diethylamine Gel',
      'Category': 'Medicated Gel',
      'Batch Number': 'VOL8901',
      'Expiry Date (YYYY-MM-DD)': '2027-04-15',
      'Packs In Stock': 25,
      'Loose Tablets (Units)': 0,
      'Units Per Pack': 1,
      'Purchase Cost Price': 115.00,
      'MRP / Selling Price': 165.00,
      'Stockist / Supplier': 'Kathmandu Pharma Distributors',
      'Reorder Alert Level': 8,
      'Shelf / Rack Location': 'Ointment Shelf 1',
      '13% VAT Applicable (YES/NO)': 'YES',
      'Barcode': '8901083003456',
      'Notes': '13% VAT applicable item example'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(headers);

  // Set nice column widths
  const colWidths = [
    { wch: 25 }, // Medicine Name
    { wch: 32 }, // Generic Salt
    { wch: 16 }, // Category
    { wch: 16 }, // Batch
    { wch: 22 }, // Expiry Date
    { wch: 16 }, // Packs
    { wch: 20 }, // Loose units
    { wch: 16 }, // Units per pack
    { wch: 18 }, // Cost price
    { wch: 20 }, // MRP
    { wch: 30 }, // Supplier
    { wch: 18 }, // Reorder Level
    { wch: 22 }, // Rack Location
    { wch: 26 }, // VAT status
    { wch: 18 }, // Barcode
    { wch: 30 }, // Notes
  ];
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Medicine_Template');
  XLSX.writeFile(wb, 'Prakash_Pharmacy_Medicine_Import_Template.xlsx');
}

function normalizeHeaderKey(str: string): string {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const FIELD_ALIASES = {
  name: [
    'medicinename', 'medicine', 'brandname', 'brand', 'itemname', 'item',
    'particulars', 'productname', 'product', 'drugname', 'drug', 'description', 'name'
  ],
  genericName: [
    'genericsaltmolecule', 'genericsalt', 'genericname', 'generic',
    'saltmolecule', 'salt', 'molecule', 'composition', 'saltcomposition'
  ],
  category: [
    'category', 'dosageform', 'form', 'type', 'itemtype'
  ],
  batchNumber: [
    'batchnumber', 'batchno', 'batchnum', 'batch', 'bno', 'bnum', 'lotnumber', 'lotno', 'lot'
  ],
  expiryDate: [
    'expirydateyyyymmdd', 'expirydate', 'expdate', 'expiry', 'exp', 'validity'
  ],
  stockPacks: [
    'packsinstock', 'stockpacks', 'packstock', 'packs', 'stock',
    'qty', 'quantity', 'totalpacks', 'currentstock', 'availablestock', 'boxes', 'box'
  ],
  stockLooseUnits: [
    'stocklooseunits', 'loosetabletsunits', 'loosetablets', 'looseunits', 'looseqty', 'loose', 'tabs', 'units'
  ],
  unitsPerPack: [
    'unitsperpack', 'packsize', 'unitsinpack', 'packing', 'pack', 'stripsize', 'tabsinpack'
  ],
  costPrice: [
    'purchasecostprice', 'costprice', 'purchaseprice', 'purchaserate', 'cost', 'buyprice', 'cp'
  ],
  mrpPrice: [
    'mrpprice', 'mrpsellingprice', 'sellingprice', 'salesprice', 'salerate', 'mrp', 'rate', 'price', 'sp'
  ],
  supplierName: [
    'stockistsupplier', 'suppliername', 'supplier', 'stockist', 'distributor', 'vendor'
  ],
  reorderLevel: [
    'reorderalertlevel', 'reorderlevel', 'alertlevel', 'minstock', 'minimumstock'
  ],
  rackLocation: [
    'shelfracklocation', 'racklocation', 'rackloc', 'rack', 'shelf', 'location', 'rackno'
  ],
  isVatApplicable: [
    'isvatapplicable', '13vatapplicableyesno', '13vatapplicable', 'vatapplicable', 'vatstatus', 'vat', 'taxable', 'hasvat'
  ],
  barcode: [
    'barcode', 'barcodenumber', 'qrcode', 'upc', 'ean', 'code'
  ],
  notes: [
    'notes', 'remarks', 'comment', 'comments', 'note'
  ]
};

function findRowValue(rowMap: Map<string, any>, aliases: string[]): { found: boolean; value: any } {
  for (const alias of aliases) {
    if (rowMap.has(alias)) {
      const val = rowMap.get(alias);
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return { found: true, value: val };
      }
    }
  }
  return { found: false, value: undefined };
}

function parseFlexibleDate(val: any): { found: boolean; formatted: string } {
  if (val === undefined || val === null || String(val).trim() === '') {
    return { found: false, formatted: '' };
  }

  // If numeric Excel date serial (e.g. 45678)
  if (typeof val === 'number') {
    try {
      const dateObj = XLSX.SSF.parse_date_code(val);
      if (dateObj && dateObj.y && dateObj.m && dateObj.d) {
        const y = dateObj.y;
        const m = String(dateObj.m).padStart(2, '0');
        const d = String(dateObj.d).padStart(2, '0');
        return { found: true, formatted: `${y}-${m}-${d}` };
      }
    } catch {
      // fallback
    }
  }

  const str = String(val).trim();

  // YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})$/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return { found: true, formatted: `${y}-${m}-${d}` };
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return { found: true, formatted: `${y}-${m}-${d}` };
  }

  // MM/YYYY or MM-YYYY (e.g. 11/2027)
  const myMatch = str.match(/^(\d{1,2})[-/. ](\d{4})$/);
  if (myMatch) {
    const m = parseInt(myMatch[1], 10);
    const y = parseInt(myMatch[2], 10);
    if (m >= 1 && m <= 12) {
      const lastDay = new Date(y, m, 0).getDate();
      return {
        found: true,
        formatted: `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      };
    }
  }

  // MM/YY or MM-YY (e.g. 11/27 -> 2027-11-30)
  const my2Match = str.match(/^(\d{1,2})[-/. ](\d{2})$/);
  if (my2Match) {
    const m = parseInt(my2Match[1], 10);
    let y = parseInt(my2Match[2], 10);
    y = y < 70 ? 2000 + y : 1900 + y;
    if (m >= 1 && m <= 12) {
      const lastDay = new Date(y, m, 0).getDate();
      return {
        found: true,
        formatted: `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      };
    }
  }

  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    return {
      found: true,
      formatted: d.toISOString().split('T')[0]
    };
  }

  return { found: true, formatted: str };
}

function parseCleanNumber(val: any): { found: boolean; value: number } {
  if (val === undefined || val === null || String(val).trim() === '') {
    return { found: false, value: 0 };
  }
  const clean = String(val).replace(/[^0-9.-]/g, '');
  if (!clean) return { found: false, value: 0 };
  const num = parseFloat(clean);
  if (isNaN(num)) return { found: false, value: 0 };
  return { found: true, value: num };
}

function parseVat(val: any): { found: boolean; value: boolean } {
  if (val === undefined || val === null || String(val).trim() === '') {
    return { found: false, value: false };
  }
  const s = String(val).trim().toUpperCase();
  if (s === 'YES' || s === 'TRUE' || s === '1' || s === '13%' || s === '13' || s === 'Y' || s === 'TAXABLE') {
    return { found: true, value: true };
  }
  if (s === 'NO' || s === 'FALSE' || s === '0' || s === '0%' || s === 'N' || s === 'EXEMPT' || s === 'FREE') {
    return { found: true, value: false };
  }
  return { found: false, value: false };
}

// Parse uploaded Excel / CSV file
export async function parseMedicinesFromExcel(file: File): Promise<{
  success: Medicine[];
  errors: { row: number; reason: string }[];
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        const validMedicines: Medicine[] = [];
        const errorList: { row: number; reason: string }[] = [];

        rows.forEach((row, idx) => {
          const rowNum = idx + 2; // Accounting for 1-based index + header

          // Build normalized key lookup map for current row
          const rowMap = new Map<string, any>();
          for (const key of Object.keys(row)) {
            const norm = normalizeHeaderKey(key);
            if (norm) {
              rowMap.set(norm, row[key]);
            }
          }

          const nameResult = findRowValue(rowMap, FIELD_ALIASES.name);
          const genericResult = findRowValue(rowMap, FIELD_ALIASES.genericName);
          const categoryResult = findRowValue(rowMap, FIELD_ALIASES.category);
          const batchResult = findRowValue(rowMap, FIELD_ALIASES.batchNumber);
          const expiryRawResult = findRowValue(rowMap, FIELD_ALIASES.expiryDate);
          const stockPacksResult = findRowValue(rowMap, FIELD_ALIASES.stockPacks);
          const stockLooseResult = findRowValue(rowMap, FIELD_ALIASES.stockLooseUnits);
          const unitsPerPackResult = findRowValue(rowMap, FIELD_ALIASES.unitsPerPack);
          const costPriceResult = findRowValue(rowMap, FIELD_ALIASES.costPrice);
          const mrpPriceResult = findRowValue(rowMap, FIELD_ALIASES.mrpPrice);
          const supplierResult = findRowValue(rowMap, FIELD_ALIASES.supplierName);
          const reorderLevelResult = findRowValue(rowMap, FIELD_ALIASES.reorderLevel);
          const rackResult = findRowValue(rowMap, FIELD_ALIASES.rackLocation);
          const vatResult = findRowValue(rowMap, FIELD_ALIASES.isVatApplicable);
          const barcodeResult = findRowValue(rowMap, FIELD_ALIASES.barcode);
          const notesResult = findRowValue(rowMap, FIELD_ALIASES.notes);

          const rawName = nameResult.found ? String(nameResult.value).trim() : '';
          if (!rawName) {
            errorList.push({ row: rowNum, reason: 'Medicine Name is required' });
            return;
          }

          // Do NOT generate random BAT-xxxx when missing; keep empty so backend can preserve existing batch
          const batchNumber = batchResult.found ? String(batchResult.value).trim() : '';
          const parsedExpiry = parseFlexibleDate(expiryRawResult.value);
          const expiryDate = parsedExpiry.found ? parsedExpiry.formatted : '';

          const stockPacks = parseCleanNumber(stockPacksResult.value).value;
          const stockLooseUnits = parseCleanNumber(stockLooseResult.value).value;
          const unitsPerPack = unitsPerPackResult.found
            ? Math.max(1, Math.round(parseCleanNumber(unitsPerPackResult.value).value))
            : 10;
          const costPrice = parseCleanNumber(costPriceResult.value).value;
          const mrpPrice = parseCleanNumber(mrpPriceResult.value).value;

          const providedFields: Record<string, boolean> = {
            name: true,
            batchNumber: batchResult.found,
            expiryDate: parsedExpiry.found,
            genericName: genericResult.found,
            category: categoryResult.found,
            rackLocation: rackResult.found,
            stockPacks: stockPacksResult.found,
            stockLooseUnits: stockLooseResult.found,
            unitsPerPack: unitsPerPackResult.found,
            costPrice: costPriceResult.found,
            mrpPrice: mrpPriceResult.found,
            reorderLevel: reorderLevelResult.found,
            isVatApplicable: vatResult.found,
            barcode: barcodeResult.found,
            notes: notesResult.found,
            supplierName: supplierResult.found,
          };

          const medicine: Medicine = {
            id: `med-imp-${Date.now()}-${idx}`,
            name: rawName,
            genericName: genericResult.found ? String(genericResult.value).trim() : '',
            category: (categoryResult.found ? String(categoryResult.value).trim() : 'Tablet') as any,
            batchNumber,
            expiryDate,
            stockPacks,
            stockLooseUnits,
            unitsPerPack,
            costPrice,
            mrpPrice,
            supplierId: 'stk-import',
            supplierName: supplierResult.found ? String(supplierResult.value).trim() : 'General Wholesaler',
            reorderLevel: reorderLevelResult.found
              ? Math.round(parseCleanNumber(reorderLevelResult.value).value)
              : 15,
            rackLocation: rackResult.found ? String(rackResult.value).trim() : '',
            isVatApplicable: parseVat(vatResult.value).value,
            barcode: barcodeResult.found ? String(barcodeResult.value).trim() : undefined,
            notes: notesResult.found ? String(notesResult.value).trim() : undefined,
            providedFields,
          };

          validMedicines.push(medicine);
        });

        resolve({ success: validMedicines, errors: errorList });
      } catch (err: any) {
        reject(err);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

// Export Inventory to Excel
export function exportInventoryToExcel(medicines: Medicine[], storeName: string): void {
  const data = medicines.map(m => {
    const totalLoose = (m.stockPacks * m.unitsPerPack) + m.stockLooseUnits;
    const loosePrice = m.unitsPerPack > 1 ? (m.mrpPrice / m.unitsPerPack).toFixed(2) : m.mrpPrice.toFixed(2);
    const stockValuationCost = ((m.stockPacks * m.costPrice) + (m.stockLooseUnits * (m.costPrice / m.unitsPerPack))).toFixed(2);
    const stockValuationMRP = ((m.stockPacks * m.mrpPrice) + (m.stockLooseUnits * (m.mrpPrice / m.unitsPerPack))).toFixed(2);

    return {
      'Medicine Name': m.name,
      'Generic Molecule / Salt': m.genericName,
      'Category': m.category,
      'Batch Number': m.batchNumber,
      'Expiry Date': m.expiryDate,
      'Packs in Stock': m.stockPacks,
      'Loose Tablets / Units': m.stockLooseUnits,
      'Units Per Pack': m.unitsPerPack,
      'Total Equivalent Units': totalLoose,
      'Purchase Cost / Pack (NPR)': m.costPrice,
      'Selling MRP / Pack (NPR)': m.mrpPrice,
      'Per Tablet MRP (NPR)': loosePrice,
      'Inventory Value Cost (NPR)': parseFloat(stockValuationCost),
      'Inventory Value MRP (NPR)': parseFloat(stockValuationMRP),
      'VAT Classification': m.isVatApplicable ? '13% VAT Applicable' : 'VAT Free / 0% Exempt',
      'Rack / Shelf Location': m.rackLocation,
      'Reorder Alert Level': m.reorderLevel,
      'Supplier / Wholesaler': m.supplierName,
      'Remarks / Notes': m.notes || ''
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory_Stock');
  
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${storeName.replace(/\s+/g, '_')}_Inventory_${dateStr}.xlsx`);
}

// Export Physical Stock Audit Log to Excel
export function exportAuditLogToExcel(logs: StockAdjustmentLog[], storeName: string): void {
  const data = logs.map(l => ({
    'Audit Date & Time': new Date(l.timestamp).toLocaleString(),
    'Medicine Name': l.medicineName,
    'Generic Molecule': l.genericName,
    'Batch Number': l.batchNumber,
    'Adjustment Type': l.type.toUpperCase(),
    'Previous Stock (Packs)': l.previousPacks,
    'Previous Loose': l.previousLoose,
    'Packs Change': l.addedPacks,
    'Loose Change': l.addedLoose,
    'New Stock (Packs)': l.newPacks,
    'New Loose': l.newLoose,
    'Net Variance (Units)': l.netVarianceUnits > 0 ? `+${l.netVarianceUnits}` : l.netVarianceUnits,
    'Audit Reason': l.reason,
    'Variance Notes': l.notes,
    'Recorded By': l.recordedBy
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Stock_Audit_Log');
  
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${storeName.replace(/\s+/g, '_')}_Stock_Audit_Reconciliation_${dateStr}.xlsx`);
}

// Export Stockist Ledger to Excel
export function exportStockistLedgerToExcel(
  stockistName: string,
  panNumber: string,
  entries: StockistLedgerEntry[]
): void {
  const data = entries.map(e => ({
    'Date': e.date,
    'Reference Type': e.refType.replace('_', ' ').toUpperCase(),
    'Reference / Bill #': e.refNumber,
    'Particulars / Description': e.description,
    'Debit (Payment / Return NPR)': e.debit || 0,
    'Credit (Purchase Bill NPR)': e.credit || 0,
    'Running Balance (NPR)': e.balance
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Stockist_Ledger');
  
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `Ledger_${stockistName.replace(/\s+/g, '_')}_PAN_${panNumber}_${dateStr}.xlsx`);
}

// Export Sales Register / Tax Invoice Book to Excel
export function exportSalesBookToExcel(invoices: SaleInvoice[], storeName: string): void {
  const data = invoices.map(inv => ({
    'Bill Date': inv.date,
    'Bill Time': inv.time,
    'Tax Invoice #': inv.invoiceNumber,
    'Customer Name': inv.customerName,
    'Customer PAN': inv.customerPan || 'N/A',
    'Customer Phone': inv.customerPhone || 'N/A',
    'Doctor Name': inv.doctorName || 'N/A',
    'Gross Subtotal (NPR)': inv.grossSubtotal,
    'VAT Exempt Sales (0%)': inv.vatExemptSubtotal,
    'Taxable Base Amount': inv.taxableBaseSubtotal,
    '13% VAT Collected': inv.vatAmount,
    'Bill Discount (NPR)': inv.discountAmount,
    'Grand Total (NPR)': inv.grandTotal,
    'Payment Mode': inv.paymentMode.toUpperCase(),
    'Items Count': inv.items.length
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sales_Register');
  
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${storeName.replace(/\s+/g, '_')}_Sales_VAT_Book_${dateStr}.xlsx`);
}

// Export Wholesaler Purchase & Sales Individual Item Analysis
export function exportWholesalerAnalyticsToExcel(
  itemsAnalytics: any[],
  storeName: string
): void {
  const ws = XLSX.utils.json_to_sheet(itemsAnalytics);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Wholesaler_Item_Analytics');
  
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${storeName.replace(/\s+/g, '_')}_Wholesaler_Item_Sales_Analysis_${dateStr}.xlsx`);
}
