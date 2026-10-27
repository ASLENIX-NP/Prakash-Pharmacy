import { PharmacySettings } from '../types/pharmacy';

export const defaultSettings: PharmacySettings = {
  storeName: '',
  address: '',
  phoneNumber: '',
  emailId: '',
  panNumber: '',
  ddaLicenceNumber: '',
  currency: 'NPR',
  fiscalYear: '',
  invoicePrefix: '',
  receiptFooterNote: '',
  defaultLowStockThreshold: 15,
  nearExpiryThresholdMonths: 6,
};
