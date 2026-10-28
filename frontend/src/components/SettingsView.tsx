import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Building2, 
  Save, 
  RotateCcw, 
  Download, 
  Upload, 
  ShieldCheck, 
  Check, 
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { PharmacySettings } from '../types/pharmacy';
import { defaultSettings } from '../data/defaultSettings';

export const SettingsView: React.FC = () => {
  const { 
    settings, 
    updateSettings, 
    clearLocalData,
    medicines, 
    stockists, 
    purchaseInvoices, 
    stockistLedgers, 
    stockAdjustments, 
    salesInvoices,
    users
  } = usePharmacy();

  const [formData, setFormData] = useState<PharmacySettings>({
    ...settings,
    phoneNumber: (settings.phoneNumber || '').replace(/\D/g, '').slice(0, 10),
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Sync form data whenever live settings finish loading from PostgreSQL backend
  useEffect(() => {
    setFormData({
      ...settings,
      phoneNumber: (settings.phoneNumber || '').replace(/\D/g, '').slice(0, 10),
    });
  }, [settings]);

  const handleChange = (field: keyof PharmacySettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // 1. Store Name
    const store = formData.storeName.trim();
    if (!store) {
      errors.storeName = 'Store / Pharmacy name is required.';
    } else if (store.length < 2) {
      errors.storeName = 'Store name must be at least 2 characters.';
    }

    // 2. Address
    if (!formData.address.trim()) {
      errors.address = 'Store address is required.';
    }

    // 3. PAN Number (Exactly 9 digits)
    const cleanPan = formData.panNumber.trim();
    if (!cleanPan) {
      errors.panNumber = 'Permanent Account Number (PAN) is required.';
    } else if (!/^\d{9}$/.test(cleanPan)) {
      errors.panNumber = 'PAN must be exactly 9 numeric digits (e.g. 600123456).';
    }

    // 4. DDA Licence Number
    if (!formData.ddaLicenceNumber.trim()) {
      errors.ddaLicenceNumber = 'DDA Licence number is required.';
    }

    // 5. Official Phone Number (Simple rule: between 8 and 10 digits)
    const cleanPhone = formData.phoneNumber.trim().replace(/\D/g, '');
    if (!cleanPhone) {
      errors.phoneNumber = 'Official phone number is required.';
    } else if (cleanPhone.length < 8 || cleanPhone.length > 10) {
      errors.phoneNumber = 'Phone number must be between 8 and 10 digits.';
    }

    // 6. Official Email ID (standard email format)
    const cleanEmail = formData.emailId.trim();
    if (!cleanEmail) {
      errors.emailId = 'Official email ID is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errors.emailId = 'Please enter a valid email format (e.g. contact@pharmacy.com).';
    }

    // 7. Fiscal Year (Format: YYYY/YY)
    const cleanFiscal = formData.fiscalYear.trim();
    if (cleanFiscal && !/^\d{4}\/\d{2}$/.test(cleanFiscal)) {
      errors.fiscalYear = 'Fiscal year format should be YYYY/YY (e.g. 2081/82).';
    }

    // 8. Invoice Prefix
    const cleanPrefix = formData.invoicePrefix.trim();
    if (cleanPrefix && cleanPrefix.length < 2) {
      errors.invoicePrefix = 'Invoice prefix must be at least 2 characters.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      setErrorMessage('Please correct the highlighted validation errors below.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const cleanPhone = formData.phoneNumber.trim().replace(/\D/g, '');
      const payloadToSave: PharmacySettings = {
        ...formData,
        phoneNumber: cleanPhone,
      };
      await updateSettings(payloadToSave);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      console.error('Error saving pharmacy settings:', err);
      setErrorMessage(err?.message || 'Failed to save store settings to server.');
    } finally {
      setIsSaving(false);
    }
  };

  // Export full JSON backup
  const handleExportBackup = () => {
    const backupData = {
      timestamp: new Date().toISOString(),
      settings,
      users,
      medicines,
      stockists,
      purchaseInvoices,
      stockistLedgers,
      stockAdjustments,
      salesInvoices
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Prakash_Pharmacy_Full_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-slate-100 text-slate-800 rounded-xl">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Pharmacy Credentials &amp; Store Configuration
            </h2>
            <p className="text-xs text-slate-500">
              Manage official DDA licence, PAN, store contact details, tax rates, and database backup
            </p>
          </div>
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-teal-700" />
            <span>Store Identity &amp; Statutory Credentials</span>
          </h3>
          <div className="flex items-center gap-2">
            {saveSuccess && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1 border border-emerald-200">
                <Check className="w-3.5 h-3.5" />
                <span>Settings saved to database!</span>
              </span>
            )}
            {errorMessage && (
              <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full flex items-center gap-1 border border-rose-200">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{errorMessage}</span>
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Store / Pharmacy Name: *
            </label>
            <input
              type="text"
              value={formData.storeName}
              onChange={(e) => handleChange('storeName', e.target.value)}
              placeholder="e.g. Prakash Pharmacy"
              className={`w-full border rounded-lg p-2 font-bold text-slate-900 transition-colors focus:outline-hidden ${
                fieldErrors.storeName
                  ? 'border-rose-400 bg-rose-50/30 focus:border-rose-500'
                  : 'border-slate-300 bg-slate-50 focus:bg-white focus:border-slate-500'
              }`}
            />
            {fieldErrors.storeName && (
              <p className="mt-1 text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                <span>{fieldErrors.storeName}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Address (Makwanpur, Nepal): *
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="e.g. Hetauda-5, Makwanpur"
              className={`w-full border rounded-lg p-2 text-slate-900 transition-colors focus:outline-hidden ${
                fieldErrors.address
                  ? 'border-rose-400 bg-rose-50/30 focus:border-rose-500'
                  : 'border-slate-300 bg-slate-50 focus:bg-white focus:border-slate-500'
              }`}
            />
            {fieldErrors.address && (
              <p className="mt-1 text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                <span>{fieldErrors.address}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Permanent Account Number (PAN): *
            </label>
            <input
              type="text"
              maxLength={9}
              value={formData.panNumber}
              onChange={(e) => handleChange('panNumber', e.target.value.replace(/\D/g, ''))}
              placeholder="9 digits (e.g. 600123456)"
              className={`w-full border rounded-lg p-2 font-mono font-bold text-slate-900 transition-colors focus:outline-hidden ${
                fieldErrors.panNumber
                  ? 'border-rose-400 bg-rose-50/30 focus:border-rose-500'
                  : 'border-slate-300 bg-slate-50 focus:bg-white focus:border-slate-500'
              }`}
            />
            {fieldErrors.panNumber ? (
              <p className="mt-1 text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                <span>{fieldErrors.panNumber}</span>
              </p>
            ) : (
              <p className="mt-1 text-[10px] text-slate-400">Must be exactly 9 numeric digits.</p>
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Department of Drug Administration (DDA) Licence No: *
            </label>
            <input
              type="text"
              value={formData.ddaLicenceNumber}
              onChange={(e) => handleChange('ddaLicenceNumber', e.target.value)}
              placeholder="e.g. DDA-MAK-1042"
              className={`w-full border rounded-lg p-2 font-mono font-bold text-slate-900 transition-colors focus:outline-hidden ${
                fieldErrors.ddaLicenceNumber
                  ? 'border-rose-400 bg-rose-50/30 focus:border-rose-500'
                  : 'border-slate-300 bg-slate-50 focus:bg-white focus:border-slate-500'
              }`}
            />
            {fieldErrors.ddaLicenceNumber && (
              <p className="mt-1 text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                <span>{fieldErrors.ddaLicenceNumber}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Official Phone Number: *
            </label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={formData.phoneNumber}
              onChange={(e) => handleChange('phoneNumber', e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="e.g. 9845012345 or 057521480"
              className={`w-full border rounded-lg p-2 font-mono text-slate-900 transition-colors focus:outline-hidden ${
                fieldErrors.phoneNumber
                  ? 'border-rose-400 bg-rose-50/30 focus:border-rose-500'
                  : 'border-slate-300 bg-slate-50 focus:bg-white focus:border-slate-500'
              }`}
            />
            {fieldErrors.phoneNumber ? (
              <p className="mt-1 text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                <span>{fieldErrors.phoneNumber}</span>
              </p>
            ) : (
              <p className="mt-1 text-[10px] text-slate-400">Must be 8 to 10 digits (numbers only).</p>
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Official Email ID: *
            </label>
            <input
              type="text"
              value={formData.emailId}
              onChange={(e) => handleChange('emailId', e.target.value)}
              placeholder="e.g. contact@prakashpharmacy.com"
              className={`w-full border rounded-lg p-2 font-mono text-slate-900 transition-colors focus:outline-hidden ${
                fieldErrors.emailId
                  ? 'border-rose-400 bg-rose-50/30 focus:border-rose-500'
                  : 'border-slate-300 bg-slate-50 focus:bg-white focus:border-slate-500'
              }`}
            />
            {fieldErrors.emailId ? (
              <p className="mt-1 text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                <span>{fieldErrors.emailId}</span>
              </p>
            ) : (
              <p className="mt-1 text-[10px] text-slate-400">Must follow standard email format (name@domain.com).</p>
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Fiscal Year (Nepal Bikram Sambat):
            </label>
            <input
              type="text"
              value={formData.fiscalYear}
              onChange={(e) => handleChange('fiscalYear', e.target.value)}
              placeholder="e.g. 2081/82"
              className={`w-full border rounded-lg p-2 font-mono text-slate-900 transition-colors focus:outline-hidden ${
                fieldErrors.fiscalYear
                  ? 'border-rose-400 bg-rose-50/30 focus:border-rose-500'
                  : 'border-slate-300 bg-slate-50 focus:bg-white focus:border-slate-500'
              }`}
            />
            {fieldErrors.fiscalYear ? (
              <p className="mt-1 text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                <span>{fieldErrors.fiscalYear}</span>
              </p>
            ) : (
              <p className="mt-1 text-[10px] text-slate-400">Format: YYYY/YY (e.g., 2081/82).</p>
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Invoice Prefix (e.g. PP-2081/82-):
            </label>
            <input
              type="text"
              value={formData.invoicePrefix}
              onChange={(e) => handleChange('invoicePrefix', e.target.value)}
              placeholder="e.g. PP-2081/82-"
              className={`w-full border rounded-lg p-2 font-mono text-slate-900 transition-colors focus:outline-hidden ${
                fieldErrors.invoicePrefix
                  ? 'border-rose-400 bg-rose-50/30 focus:border-rose-500'
                  : 'border-slate-300 bg-slate-50 focus:bg-white focus:border-slate-500'
              }`}
            />
            {fieldErrors.invoicePrefix && (
              <p className="mt-1 text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                <span>{fieldErrors.invoicePrefix}</span>
              </p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">
              Receipt Bottom Disclaimer / Note:
            </label>
            <input
              type="text"
              value={formData.receiptFooterNote}
              onChange={(e) => handleChange('receiptFooterNote', e.target.value)}
              placeholder="e.g. Thank you for your visit. Medicines once sold cannot be returned without bill."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 focus:bg-white focus:outline-hidden"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving to Server...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Store Credentials</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Database Backup & Restore */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-slate-900">
          Data Backup &amp; Local Data Reset
        </h3>
        <p className="text-xs text-slate-500">
          Export the pharmacy data currently cached in this browser. Reset clears this browser's cached data and signs you out; it does not delete database records.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleExportBackup}
            className="bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Download Full JSON Backup</span>
          </button>

          <button
            onClick={() => {
              if (confirm('Clear locally cached pharmacy data and sign out? This does not delete database records.')) {
                clearLocalData();
                setFormData({ ...defaultSettings });
                alert('Locally cached pharmacy data has been cleared.');
              }
            }}
            className="bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ml-auto"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Clear Local Data</span>
          </button>
        </div>
      </div>
    </div>
  );
};
