import React, { useState } from 'react';
import { 
  Settings, 
  Save, 
  RotateCcw, 
  Download, 
  Check,
  ImagePlus,
  Trash2
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { PharmacySettings } from '../types/pharmacy';
import { defaultSettings } from '../data/defaultSettings';
import { digitsOnlyUpTo, isValidEmail, normalizePhoneNumber } from '../utils/inputValidation';

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

  const [formData, setFormData] = useState<PharmacySettings>(() => ({
    ...settings,
    phoneNumber: normalizePhoneNumber(settings.phoneNumber)
  }));
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [formError, setFormError] = useState('');
  const [logoError, setLogoError] = useState('');
  const hasUnsavedChanges = JSON.stringify(formData) !== JSON.stringify(settings);
  const requiredSettings = [
    formData.storeName,
    formData.address,
    formData.panNumber,
    formData.ddaLicenceNumber,
    formData.phoneNumber,
    formData.emailId,
    formData.pharmacistName,
    formData.pharmacistCouncilRegNumber
  ];
  const completedRequiredSettings = requiredSettings.filter(value => value.trim()).length;
  const previewNextInvoiceNumber = Math.max(
    formData.nextInvoiceNumber || 1,
    salesInvoices.reduce((highest, sale) => {
      if (!sale.invoiceNumber.startsWith(formData.invoicePrefix)) return highest;
      const suffix = Number(sale.invoiceNumber.slice(formData.invoicePrefix.length));
      return Number.isInteger(suffix) ? Math.max(highest, suffix + 1) : highest;
    }, 1)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{9}$/.test(formData.panNumber.trim())) {
      setFormError('PAN must be exactly 9 digits.');
      return;
    }

    if (!/^\d{10}$/.test(formData.phoneNumber)) {
      setFormError('Phone number must contain exactly 10 digits.');
      return;
    }

    if (!isValidEmail(formData.emailId)) {
      setFormError('Enter a valid email address.');
      return;
    }

    if (!Number.isInteger(formData.nextInvoiceNumber) || formData.nextInvoiceNumber < 1) {
      setFormError('Next invoice number must be 1 or higher.');
      return;
    }

    setFormError('');
    updateSettings(formData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleDiscardChanges = () => {
    setFormData({ ...settings });
    setSaveSuccess(false);
    setFormError('');
    setLogoError('');
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLogoError('Choose an image file.');
      event.target.value = '';
      return;
    }
    if (file.size > 1_000_000) {
      setLogoError('Choose an image under 1 MB.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const logoData = reader.result;
      if (typeof logoData !== 'string') {
        setLogoError('The selected image could not be read.');
        return;
      }
      setFormData(current => ({ ...current, storeLogo: logoData }));
      setLogoError('');
    };
    reader.onerror = () => setLogoError('The selected image could not be read.');
    reader.readAsDataURL(file);
  };

  const appendReceiptSuggestion = (suggestion: string) => {
    setFormData(current => {
      const currentNote = current.receiptFooterNote.trim();
      const nextNote = `${currentNote ? `${currentNote.replace(/[.\s]+$/, '')}. ` : ''}${suggestion}`;
      return { ...current, receiptFooterNote: nextNote.slice(0, 160) };
    });
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
    <div className="mx-auto max-w-4xl space-y-5 pb-24">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-800 ring-1 ring-teal-100">
              <Settings className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
              Pharmacy Credentials &amp; Store Configuration
            </h2>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500 sm:text-sm">
            Manage official DDA licence, PAN, store contact details, billing settings, and data backup.
          </p>
        </div>
        <span className="inline-flex rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800">Admin only</span>
      </div>

      {saveSuccess && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800" role="status">
          <Check className="h-4 w-4" />
          Settings updated successfully.
        </div>
      )}
      {formError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800" role="alert">
          {formError}
        </div>
      )}

      <form id="store-settings-form" onSubmit={handleSubmit} className="space-y-4">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Store identity &amp; statutory credentials</h3>
              <p className="mt-0.5 text-xs text-slate-500">Printed on invoices and reports</p>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              Profile completeness: {completedRequiredSettings} of {requiredSettings.length} required fields
            </span>
          </div>
          <div className="px-5 pb-5 sm:px-6 sm:pb-6">
            <div className="mb-1 mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-teal-700 transition-[width]"
                style={{ width: `${(completedRequiredSettings / requiredSettings.length) * 100}%` }}
              />
            </div>
            <div className="grid grid-cols-1 gap-x-5 md:grid-cols-2 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Store / Pharmacy Name: *
            </label>
            <input
              type="text"
              required
              value={formData.storeName}
              onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 font-bold text-slate-900 transition-colors focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Address (Makwanpur, Nepal): *
            </label>
            <input
              type="text"
              required
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 transition-colors focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Permanent Account Number (PAN): *
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={9}
              pattern="[0-9]{9}"
              required
              value={formData.panNumber}
              onChange={(e) => setFormData({ ...formData, panNumber: digitsOnlyUpTo(e.target.value, 9) })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 font-mono font-bold text-slate-900 transition-colors focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Department of Drug Administration (DDA) Licence No: *
            </label>
            <input
              type="text"
              required
              value={formData.ddaLicenceNumber}
              onChange={(e) => setFormData({ ...formData, ddaLicenceNumber: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 font-mono font-bold text-slate-900 transition-colors focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Official Phone Number: *
            </label>
            <input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]{7,10}"
              required
              placeholder="7–10 digits"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: normalizePhoneNumber(e.target.value) })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 transition-colors focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Official Email ID: *
            </label>
            <input
              type="email"
              maxLength={254}
              autoComplete="email"
              required
              value={formData.emailId}
              onChange={(e) => setFormData({ ...formData, emailId: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 font-mono text-slate-900 transition-colors focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 focus:outline-hidden"
            />
          </div>
            <div className="md:col-span-2 mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div>
                <strong className="block text-xs text-slate-800">VAT Registration</strong>
                <span className="text-[11px] text-slate-500">Set whether the pharmacy is registered for VAT.</span>
              </div>
              <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1" role="group" aria-label="VAT registration status">
                <button
                  type="button"
                  aria-pressed={formData.vatRegistered}
                  onClick={() => setFormData(current => ({ ...current, vatRegistered: true }))}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    formData.vatRegistered ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  VAT Registered
                </button>
                <button
                  type="button"
                  aria-pressed={!formData.vatRegistered}
                  onClick={() => setFormData(current => ({ ...current, vatRegistered: false }))}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    !formData.vatRegistered ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Not Registered
                </button>
              </div>
            </div>

            <div className="md:col-span-2 mt-4">
              <span className="mb-2 block text-xs font-semibold text-slate-600">Store logo</span>
              <div className="flex flex-wrap items-center gap-4">
                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400">
                  {formData.storeLogo ? (
                    <img src={formData.storeLogo} alt="Store logo preview" className="h-full w-full object-contain" />
                  ) : (
                    <ImagePlus className="h-6 w-6" />
                  )}
                </div>
                <div className="min-w-[220px] flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-teal-800 hover:file:bg-teal-100"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">Shown on invoices and the app header. PNG or JPG, under 1 MB.</p>
                  {logoError && <p className="mt-1 text-[11px] font-medium text-rose-700" role="alert">{logoError}</p>}
                </div>
                {formData.storeLogo && (
                  <button
                    type="button"
                    onClick={() => setFormData(current => ({ ...current, storeLogo: '' }))}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove logo
                  </button>
                )}
              </div>
            </div>

            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Pharmacist in charge &amp; licence</h3>
              <p className="mt-0.5 text-xs text-slate-500">Required by DDA for a registered pharmacy</p>
            </div>
            {(() => {
              if (!formData.ddaLicenceExpiryDate) {
                return <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800">No expiry set</span>;
              }
              const daysRemaining = Math.ceil(
                (new Date(`${formData.ddaLicenceExpiryDate}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) /
                (24 * 60 * 60 * 1000)
              );
              if (daysRemaining < 0) {
                return <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-800">Expired {Math.abs(daysRemaining)} days ago</span>;
              }
              if (daysRemaining <= 60) {
                return <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">Expires in {daysRemaining} days</span>;
              }
              return <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800">Valid · {daysRemaining} days left</span>;
            })()}
          </div>
          <div className="grid grid-cols-1 gap-x-5 px-5 pb-5 text-xs sm:px-6 sm:pb-6 md:grid-cols-2">
            <div>
              <label className="mb-1.5 mt-4 block font-semibold text-slate-600">
                Pharmacist in charge: *
              </label>
              <input
                type="text"
                required
                value={formData.pharmacistName}
                onChange={(e) => setFormData({ ...formData, pharmacistName: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600/15"
              />
            </div>
            <div>
              <label className="mb-1.5 mt-4 block font-semibold text-slate-600">
                Nepal Pharmacy Council registration no.: *
              </label>
              <input
                type="text"
                required
                value={formData.pharmacistCouncilRegNumber}
                onChange={(e) => setFormData({ ...formData, pharmacistCouncilRegNumber: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600/15"
              />
            </div>
            <div>
              <label className="mb-1.5 mt-4 block font-semibold text-slate-600">
                DDA licence expiry date:
              </label>
              <input
                type="date"
                value={formData.ddaLicenceExpiryDate}
                onChange={(e) => setFormData({ ...formData, ddaLicenceExpiryDate: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600/15"
              />
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
            <h3 className="text-base font-extrabold text-slate-900">Billing &amp; invoice settings</h3>
            <p className="mt-0.5 text-xs text-slate-500">Controls invoice numbering and receipt footer</p>
          </div>
          <div className="grid grid-cols-1 gap-x-5 px-5 pb-5 text-xs sm:px-6 sm:pb-6 md:grid-cols-2">
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Fiscal Year (Nepal Bikram Sambat):
            </label>
            <input
              type="text"
              value={formData.fiscalYear}
              onChange={(e) => setFormData({ ...formData, fiscalYear: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 font-mono text-slate-900 transition-colors focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Invoice Prefix (e.g. PP-2081/82-):
            </label>
            <input
              type="text"
              value={formData.invoicePrefix}
              onChange={(e) => setFormData({ ...formData, invoicePrefix: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-slate-900 transition-colors focus:border-teal-600 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600/15"
            />
          </div>

          <div>
            <label className="mb-1.5 mt-4 block font-semibold text-slate-600">
              Next invoice number:
            </label>
            <input
              type="number"
              min={1}
              step={1}
              required
              value={formData.nextInvoiceNumber}
              onChange={(e) => setFormData({ ...formData, nextInvoiceNumber: Number(e.target.value) || 0 })}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600/15"
            />
          </div>

          <div>
            <span className="mb-1.5 mt-4 block font-semibold text-slate-600">Default invoice size</span>
            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Default invoice size">
              {(['A5', 'Thermal'] as const).map(size => (
                <button
                  key={size}
                  type="button"
                  aria-pressed={formData.defaultInvoiceSize === size}
                  onClick={() => setFormData({ ...formData, defaultInvoiceSize: size })}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                    formData.defaultInvoiceSize === size ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {size === 'A5' ? 'A5 invoice' : 'Thermal receipt'}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <span className="mb-1.5 mt-4 block font-semibold text-slate-600">Invoice date format</span>
            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Invoice date format">
              {([
                { value: 'BS', label: 'Nepali (BS)' },
                { value: 'AD', label: 'English (AD)' }
              ] as const).map(format => (
                <button
                  key={format.value}
                  type="button"
                  aria-pressed={formData.invoiceDateFormat === format.value}
                  onClick={() => setFormData({ ...formData, invoiceDateFormat: format.value })}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                    formData.invoiceDateFormat === format.value ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {format.label}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1.5 mt-4 block text-xs font-semibold text-slate-600">
              Receipt Bottom Disclaimer / Note:
            </label>
            <textarea
              rows={2}
              maxLength={160}
              placeholder="e.g. Prescription medicines are not returnable"
              value={formData.receiptFooterNote}
              onChange={(e) => setFormData({ ...formData, receiptFooterNote: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 transition-colors focus:border-teal-600 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600/15"
            />
            <div className="mt-1 text-right text-[11px] text-slate-500">{formData.receiptFooterNote.length}/160</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                'Prescription medicines are not returnable',
                'Goods once sold will not be taken back',
                'Keep medicines away from children',
                'Thank you, visit again'
              ].map(suggestion => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => appendReceiptSuggestion(suggestion)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600 hover:border-teal-600 hover:text-teal-800"
                >
                  + {suggestion}
                </button>
              ))}
            </div>
          </div>
            {formData.invoicePrefix && (
              <div className="md:col-span-2">
                <span className="mb-1.5 mt-4 block text-xs font-semibold text-slate-600">Invoice number preview</span>
                <div className="rounded-lg bg-teal-50 px-3 py-2.5 font-mono text-sm font-medium text-teal-800">
                  {formData.invoicePrefix}{String(previewNextInvoiceNumber).padStart(5, '0')}
                </div>
              </div>
            )}
          </div>
        </section>
      </form>

      {/* Database Backup & Restore */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
          <h3 className="text-base font-extrabold text-slate-900">Data backup &amp; local data reset</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Affects only the data cached in this browser. Clearing local data does not delete database records.
          </p>
        </div>
        <div className="divide-y divide-slate-100 px-5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div>
              <strong className="block text-sm text-slate-800">Full data backup</strong>
              <span className="text-xs text-slate-500">Download current pharmacy data as a JSON file.</span>
            </div>
            <button
              onClick={handleExportBackup}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-teal-700 hover:text-teal-800"
            >
              <Download className="h-4 w-4" />
              <span>Download JSON Backup</span>
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div>
              <strong className="block text-sm text-slate-800">Clear local data</strong>
              <span className="text-xs text-slate-500">Removes this browser’s cached data and signs you out. Back up first.</span>
            </div>
            <button
              onClick={() => {
                if (confirm('Clear locally cached pharmacy data and sign out? This does not delete database records.')) {
                  clearLocalData();
                  setFormData({ ...defaultSettings });
                  alert('Locally cached pharmacy data has been cleared.');
                }
              }}
              className="flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-700 transition-colors hover:border-rose-500 hover:bg-rose-50"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Clear Local Data</span>
            </button>
          </div>
        </div>
      </section>

      {hasUnsavedChanges && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
            <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200">
              Unsaved changes
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDiscardChanges}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                Discard
              </button>
              <button
                type="submit"
                form="store-settings-form"
                className="flex items-center gap-2 rounded-xl border border-teal-700 bg-teal-700 px-4 py-2 text-xs font-bold text-white transition-colors hover:border-teal-800 hover:bg-teal-800"
              >
                <Save className="h-4 w-4" />
                Save Store Credentials
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
