import { PharmacySettings } from '../types/pharmacy';

export const defaultSettings: PharmacySettings = {
  storeName: '',
  address: '',
  phoneNumber: '',
  emailId: '',
  panNumber: '',
  ddaLicenceNumber: '',
  vatRegistered: true,
  storeLogo: '',
  pharmacistName: '',
  pharmacistCouncilRegNumber: '',
  ddaLicenceExpiryDate: '',
  currency: 'NPR',
  fiscalYear: '',
  invoicePrefix: '',
  nextInvoiceNumber: 101,
  defaultInvoiceSize: 'A5',
  invoiceDateFormat: 'BS',
  receiptFooterNote: '',
  defaultLowStockThreshold: 15,
  nearExpiryThresholdMonths: 6,
};
