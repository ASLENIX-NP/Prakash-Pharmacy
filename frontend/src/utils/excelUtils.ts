import writeXlsxFile from 'write-excel-file/browser';
import { readSheet } from 'read-excel-file/browser';
import { Medicine, StockAdjustmentLog, StockistLedgerEntry, SaleInvoice, StockistPurchaseInvoice } from '../types/pharmacy';
import { localDateString } from './date';

const HEADER_STYLE = {
  fontWeight: 'bold' as const,
  backgroundColor: '#EEEEEE',
};

// Download pre-formatted Medicine Excel Import Template
export async function downloadMedicineExcelTemplate(): Promise<void> {
  const data = [
    [
      { value: 'Medicine Name', ...HEADER_STYLE },
      { value: 'Generic Salt / Molecule', ...HEADER_STYLE },
      { value: 'Category', ...HEADER_STYLE },
      { value: 'Batch Number', ...HEADER_STYLE },
      { value: 'Expiry Date (YYYY-MM-DD)', ...HEADER_STYLE },
      { value: 'Packs In Stock', ...HEADER_STYLE },
      { value: 'Loose Tablets (Units)', ...HEADER_STYLE },
      { value: 'Units Per Pack', ...HEADER_STYLE },
      { value: 'Purchase Cost Price', ...HEADER_STYLE },
      { value: 'MRP / Selling Price', ...HEADER_STYLE },
      { value: 'Stockist / Supplier', ...HEADER_STYLE },
      { value: 'Reorder Alert Level', ...HEADER_STYLE },
      { value: 'Shelf / Rack Location', ...HEADER_STYLE },
      { value: '13% VAT Applicable (YES/NO)', ...HEADER_STYLE },
      { value: 'Barcode', ...HEADER_STYLE },
      { value: 'Notes', ...HEADER_STYLE },
    ],
    [
      { type: String, value: 'Amoxicillin 500mg Cap' },
      { type: String, value: 'Amoxicillin 500mg' },
      { type: String, value: 'Capsule' },
      { type: String, value: 'AMX2024' },
      { type: String, value: '2027-06-30' },
      { type: Number, value: 50 },
      { type: Number, value: 0 },
      { type: Number, value: 10 },
      { type: Number, value: 75.00 },
      { type: Number, value: 105.00 },
      { type: String, value: 'Kathmandu Pharma Distributors' },
      { type: Number, value: 15 },
      { type: String, value: 'Rack A-2' },
      { type: String, value: 'NO' },
      { type: String, value: '8901083001234' },
      { type: String, value: 'Example row - replace or add below' },
    ],
    [
      { type: String, value: 'Volini Gel 30g' },
      { type: String, value: 'Diclofenac Diethylamine Gel' },
      { type: String, value: 'Medicated Gel' },
      { type: String, value: 'VOL8901' },
      { type: String, value: '2027-04-15' },
      { type: Number, value: 25 },
      { type: Number, value: 0 },
      { type: Number, value: 1 },
      { type: Number, value: 115.00 },
      { type: Number, value: 165.00 },
      { type: String, value: 'Kathmandu Pharma Distributors' },
      { type: Number, value: 8 },
      { type: String, value: 'Ointment Shelf 1' },
      { type: String, value: 'YES' },
      { type: String, value: '8901083003456' },
      { type: String, value: '13% VAT applicable item example' },
    ]
  ];

  const columns = [
    { width: 25 }, // Medicine Name
    { width: 32 }, // Generic Salt
    { width: 16 }, // Category
    { width: 16 }, // Batch
    { width: 22 }, // Expiry Date
    { width: 16 }, // Packs
    { width: 20 }, // Loose units
    { width: 16 }, // Units per pack
    { width: 18 }, // Cost price
    { width: 20 }, // MRP
    { width: 30 }, // Supplier
    { width: 18 }, // Reorder Level
    { width: 22 }, // Rack Location
    { width: 26 }, // VAT status
    { width: 18 }, // Barcode
    { width: 30 }, // Notes
  ];

  await writeXlsxFile(data, {
    columns,
    sheet: 'Medicine_Template',
  }).toFile('Prakash_Pharmacy_Medicine_Import_Template.xlsx');
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
    'stocklooseunits', 'loosetabletsunits', 'loosetablets', 'looseunits', 'looseqty', 'loose',
    'tabs', 'tab', 'tablets', 'tablet', 'units', 'loosetabs', 'loosetablet', 'looseunit',
    'loosepills', 'pills', 'pill', 'loosecount', 'tabcount', 'loosestock', 'stripunits'
  ],
  unitsPerPack: [
    'unitsperpack', 'packsize', 'unitsinpack', 'packing', 'pack', 'stripsize', 'tabsinpack'
  ],
  costPrice: [
    'purchasecostprice', 'costprice', 'purchaseprice', 'purchaserate', 'cost', 'buyprice', 'cp',
    'purchaseratenpr', 'costpricenpr', 'costnpr', 'costpack', 'costperpack', 'prate', 'ratepack',
    'netrate', 'unitrate', 'unitcost', 'rate', 'price', 'purchaseratepack'
  ],
  amount: [
    'amount', 'netamount', 'totalamount', 'total', 'linetotal', 'itemtotal', 'billamount', 'value', 'netvalue', 'grossamount', 'totalprice'
  ],
  mrpPrice: [
    'mrpprice', 'mrpsellingprice', 'sellingprice', 'salesprice', 'salerate', 'mrp', 'sp', 'retailprice', 'maximumretailprice'
  ],
  supplierName: [
    'stockistsupplier', 'suppliername', 'supplier', 'stockist', 'distributor', 'distributorname', 'vendor', 'wholesaler', 'company', 'agency', 'manufacturer', 'mfg'
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
  creditLimit: [
    'creditlimit', 'distributorcreditlimit', 'distributorcredit', 'suppliercreditlimit',
    'suppliercredit', 'stockistcreditlimit', 'stockistcredit', 'credit', 'creditlimitnpr',
    'maxcredit', 'udharo'
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

  // If already a Date object
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      return { found: true, formatted: `${y}-${m}-${d}` };
    }
  }

  // If numeric Excel date serial (e.g. 45678)
  if (typeof val === 'number') {
    try {
      const d = new Date(Math.round((val - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return { found: true, formatted: `${y}-${m}-${day}` };
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

function parseCsv(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  return lines.map(line => {
    const row: string[] = [];
    let insideQuote = false;
    let entry = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuote && line[i + 1] === '"') {
          entry += '"';
          i++;
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === ',' && !insideQuote) {
        row.push(entry.trim());
        entry = '';
      } else {
        entry += char;
      }
    }
    row.push(entry.trim());
    return row;
  });
}

// Parse uploaded Excel / CSV file
export async function parseMedicinesFromExcel(file: File): Promise<{
  success: Medicine[];
  errors: { row: number; reason: string }[];
}> {
  try {
    let rawRows: any[][];

    if (file.name.toLowerCase().endsWith('.csv')) {
      const text = await file.text();
      rawRows = parseCsv(text);
    } else {
      rawRows = await readSheet(file);
    }

    if (!rawRows || rawRows.length < 2) {
      return { success: [], errors: [{ row: 1, reason: 'File is empty or missing headers.' }] };
    }

    const headerRow = rawRows[0];
    const dataRows = rawRows.slice(1);

    const validMedicines: Medicine[] = [];
    const errorList: { row: number; reason: string }[] = [];

    dataRows.forEach((row, idx) => {
      const rowNum = idx + 2; // Accounting for 1-based index + header

      // Skip completely blank rows
      const hasContent = row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');
      if (!hasContent) return;

      // Build normalized key lookup map for current row
      const rowMap = new Map<string, any>();
      for (let colIdx = 0; colIdx < headerRow.length; colIdx++) {
        const headerKey = String(headerRow[colIdx] || '');
        const norm = normalizeHeaderKey(headerKey);
        if (norm) {
          rowMap.set(norm, row[colIdx]);
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
      const amountResult = findRowValue(rowMap, FIELD_ALIASES.amount);
      const mrpPriceResult = findRowValue(rowMap, FIELD_ALIASES.mrpPrice);
      const supplierResult = findRowValue(rowMap, FIELD_ALIASES.supplierName);
      const reorderLevelResult = findRowValue(rowMap, FIELD_ALIASES.reorderLevel);
      const rackResult = findRowValue(rowMap, FIELD_ALIASES.rackLocation);
      const vatResult = findRowValue(rowMap, FIELD_ALIASES.isVatApplicable);
      const barcodeResult = findRowValue(rowMap, FIELD_ALIASES.barcode);
      const creditLimitResult = findRowValue(rowMap, FIELD_ALIASES.creditLimit);
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

      const rawStockPacks = parseCleanNumber(stockPacksResult.value).value;
      const stockLooseUnits = parseCleanNumber(stockLooseResult.value).value;
      const unitsPerPack = unitsPerPackResult.found
        ? Math.max(1, Math.round(parseCleanNumber(unitsPerPackResult.value).value))
        : 10;

      const rawCost = parseCleanNumber(costPriceResult.value).value;
      const rawMrp = parseCleanNumber(mrpPriceResult.value).value;
      const rawAmount = parseCleanNumber(amountResult.value).value;

      // Default stockPacks to 1 only if BOTH packs and loose units are missing/0
      let stockPacks = rawStockPacks;
      if (stockPacks <= 0 && stockLooseUnits <= 0 && (rawCost > 0 || rawAmount > 0)) {
        stockPacks = 1;
      }

      // Directly calculate costPrice from cost column, line amount (taking packs + tabs into account), or MRP
      let costPrice = rawCost;
      if ((!costPrice || costPrice <= 0) && rawAmount > 0) {
        const effectivePacks = stockPacks + (unitsPerPack > 1 ? stockLooseUnits / unitsPerPack : (stockLooseUnits > 0 ? stockLooseUnits : 0));
        if (effectivePacks > 0) {
          costPrice = Math.round((rawAmount / effectivePacks) * 100) / 100;
        }
      }
      if ((!costPrice || costPrice <= 0) && rawMrp > 0) {
        costPrice = rawMrp;
      }

      // Deduce MRP if not explicitly provided
      let mrpPrice = rawMrp;
      if ((!mrpPrice || mrpPrice <= 0) && costPrice > 0) {
        mrpPrice = Math.round(costPrice * 1.25 * 100) / 100;
      }

      const providedFields: Record<string, boolean> = {
        name: true,
        batchNumber: batchResult.found,
        expiryDate: parsedExpiry.found,
        genericName: genericResult.found,
        category: categoryResult.found,
        rackLocation: rackResult.found,
        stockPacks: stockPacksResult.found || rawAmount > 0,
        stockLooseUnits: stockLooseResult.found,
        unitsPerPack: unitsPerPackResult.found,
        costPrice: costPriceResult.found || rawAmount > 0 || mrpPriceResult.found,
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
        supplierId: '',
        supplierName: supplierResult.found ? String(supplierResult.value).trim() : '',
        reorderLevel: reorderLevelResult.found
          ? Math.round(parseCleanNumber(reorderLevelResult.value).value)
          : 15,
        rackLocation: rackResult.found ? String(rackResult.value).trim() : '',
        isVatApplicable: parseVat(vatResult.value).value,
        barcode: barcodeResult.found ? String(barcodeResult.value).trim() : undefined,
        notes: notesResult.found ? String(notesResult.value).trim() : undefined,
        supplierCreditLimit: creditLimitResult.found ? parseCleanNumber(creditLimitResult.value).value : undefined,
        providedFields,
      };

      validMedicines.push(medicine);
    });

    return { success: validMedicines, errors: errorList };
  } catch (err: any) {
    throw err;
  }
}

// Reusable export helper to write formatted Excel workbooks
async function exportObjectsToExcel(
  fileName: string,
  sheetName: string,
  rows: Array<Record<string, any>>
): Promise<void> {
  if (rows.length === 0) {
    await writeXlsxFile([[{ value: 'No records available' }]], { sheet: sheetName }).toFile(fileName);
    return;
  }

  const headers = Object.keys(rows[0]);
  const headerCells = headers.map(h => ({
    value: h,
    ...HEADER_STYLE,
  }));

  const dataCells = rows.map(row => {
    return headers.map(h => {
      const val = row[h];
      if (typeof val === 'number') {
        return { type: Number, value: val };
      }
      if (typeof val === 'boolean') {
        return { type: Boolean, value: val };
      }
      return { type: String, value: val !== null && val !== undefined ? String(val) : '' };
    });
  });

  await writeXlsxFile([headerCells, ...dataCells], {
    sheet: sheetName,
  }).toFile(fileName);
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

  const dateStr = localDateString();
  const fileName = `${storeName.replace(/\s+/g, '_')}_Inventory_${dateStr}.xlsx`;
  exportObjectsToExcel(fileName, 'Inventory_Stock', data).catch(console.error);
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

  const dateStr = localDateString();
  const fileName = `${storeName.replace(/\s+/g, '_')}_Stock_Audit_Reconciliation_${dateStr}.xlsx`;
  exportObjectsToExcel(fileName, 'Stock_Audit_Log', data).catch(console.error);
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

  const dateStr = localDateString();
  const fileName = `Ledger_${stockistName.replace(/\s+/g, '_')}_PAN_${panNumber}_${dateStr}.xlsx`;
  exportObjectsToExcel(fileName, 'Stockist_Ledger', data).catch(console.error);
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

  const dateStr = localDateString();
  const fileName = `${storeName.replace(/\s+/g, '_')}_Sales_VAT_Book_${dateStr}.xlsx`;
  exportObjectsToExcel(fileName, 'Sales_Register', data).catch(console.error);
}

// Export Wholesaler Purchase & Sales Individual Item Analysis
export function exportWholesalerAnalyticsToExcel(
  itemsAnalytics: any[],
  storeName: string
): void {
  const dateStr = localDateString();
  const fileName = `${storeName.replace(/\s+/g, '_')}_Wholesaler_Item_Sales_Analysis_${dateStr}.xlsx`;
  exportObjectsToExcel(fileName, 'Wholesaler_Item_Analytics', itemsAnalytics).catch(console.error);
}

// Export Inward Purchase Bill Details (Medicines, Batch, Cost Price, MRP, VAT, Line Total)
export function exportPurchaseBillToExcel(
  bill: StockistPurchaseInvoice,
  storeName: string
): void {
  const data = (bill.items || []).map((it, idx) => {
    const margin = it.mrpPrice > 0 
      ? (((it.mrpPrice - it.costPrice) / it.mrpPrice) * 100).toFixed(1) + '%' 
      : '0%';

    return {
      'S.N.': idx + 1,
      'Medicine Name': it.medicineName,
      'Generic Name': it.genericName || 'N/A',
      'Category': it.category || 'Tablet',
      'Batch Number': it.batchNumber || 'N/A',
      'Expiry Date': it.expiryDate || 'N/A',
      'Packs Qty': it.packQty,
      'Free Packs': it.freePacks || 0,
      'Units Per Pack': it.unitsPerPack || 1,
      'Purchase Rate / Cost (NPR)': Number(it.costPrice || 0).toFixed(2),
      'MRP / Selling Price (NPR)': Number(it.mrpPrice || 0).toFixed(2),
      'Profit Margin': margin,
      'Discount %': it.discountPercent || 0,
      '13% VAT': it.isVatApplicable ? 'YES (13%)' : 'NO (0%)',
      'Line Total (NPR)': Number(it.lineTotal || 0).toFixed(2),
      'Rack Location': it.rackLocation || 'N/A'
    };
  });

  const safeStore = (storeName || 'Pharmacy').replace(/\s+/g, '_');
  const safeWholesaler = (bill.stockistName || 'Wholesaler').replace(/\s+/g, '_');
  const fileName = `${safeStore}_Purchase_Bill_${safeWholesaler}_${bill.invoiceNumber || 'INV'}_${bill.date || 'date'}.xlsx`;
  exportObjectsToExcel(fileName, `Bill_${bill.invoiceNumber}`, data).catch(console.error);
}
