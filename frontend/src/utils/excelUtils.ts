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
    { wch: 30 }, // Notes
  ];
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Medicine_Template');
  XLSX.writeFile(wb, 'Prakash_Pharmacy_Medicine_Import_Template.xlsx');
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

          // Extract fields flexibly handling various possible header names
          const name = (row['Medicine Name'] || row['name'] || row['Item Name'] || row['Medicine'] || '').toString().trim();
          const genericName = (row['Generic Salt / Molecule'] || row['genericName'] || row['Generic Name'] || row['Generic'] || name).toString().trim();
          const categoryRaw = (row['Category'] || row['category'] || 'Tablet').toString().trim();
          const batchNumber = (row['Batch Number'] || row['batchNumber'] || row['Batch'] || `BAT-${Date.now().toString().slice(-4)}`).toString().trim();
          
          let expiryDate = (row['Expiry Date (YYYY-MM-DD)'] || row['expiryDate'] || row['Expiry Date'] || row['Expiry'] || '').toString().trim();
          // If Excel parsed date as serial number:
          if (typeof row['Expiry Date (YYYY-MM-DD)'] === 'number') {
            const dateObj = XLSX.SSF.parse_date_code(row['Expiry Date (YYYY-MM-DD)']);
            expiryDate = `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
          } else if (!expiryDate) {
            expiryDate = '2027-12-31';
          }

          const stockPacks = parseFloat(row['Packs In Stock'] || row['stockPacks'] || row['Stock'] || row['Packs'] || 0) || 0;
          const stockLooseUnits = parseFloat(row['Loose Tablets (Units)'] || row['stockLooseUnits'] || row['Loose'] || 0) || 0;
          const unitsPerPack = Math.max(1, parseInt(row['Units Per Pack'] || row['unitsPerPack'] || row['Pack Size'] || 10, 10));
          const costPrice = parseFloat(row['Purchase Cost Price'] || row['costPrice'] || row['Cost'] || 0) || 0;
          const mrpPrice = parseFloat(row['MRP / Selling Price'] || row['mrpPrice'] || row['MRP'] || row['Selling Price'] || 0) || 0;
          const supplierName = (row['Stockist / Supplier'] || row['supplierName'] || row['Supplier'] || 'General Wholesaler').toString().trim();
          const reorderLevel = parseInt(row['Reorder Alert Level'] || row['reorderLevel'] || 15, 10) || 15;
          const rackLocation = (row['Shelf / Rack Location'] || row['rackLocation'] || row['Rack'] || 'General Shelf').toString().trim();
          
          const vatRaw = (row['13% VAT Applicable (YES/NO)'] || row['isVatApplicable'] || row['VAT'] || '').toString().trim().toUpperCase();
          const isVatApplicable = vatRaw === 'YES' || vatRaw === 'TRUE' || vatRaw === '13%' || vatRaw === 'Y';
          const notes = (row['Notes'] || row['notes'] || '').toString().trim();

          if (!name) {
            errorList.push({ row: rowNum, reason: 'Medicine Name is required' });
            return;
          }

          const medicine: Medicine = {
            id: `med-imp-${Date.now()}-${idx}`,
            name,
            genericName: genericName || name,
            category: (categoryRaw as any) || 'Tablet',
            batchNumber,
            expiryDate,
            stockPacks,
            stockLooseUnits,
            unitsPerPack,
            costPrice,
            mrpPrice: mrpPrice > 0 ? mrpPrice : costPrice * 1.25,
            supplierId: 'stk-import',
            supplierName,
            reorderLevel,
            rackLocation,
            isVatApplicable,
            notes
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
