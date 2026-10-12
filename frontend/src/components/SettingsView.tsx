import React, { useState } from 'react';
import { 
  Settings, 
  Building2, 
  Save, 
  RotateCcw, 
  Download, 
  Upload, 
  ShieldCheck, 
  Check, 
  AlertTriangle 
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';
import { PharmacySettings } from '../types/pharmacy';

export const SettingsView: React.FC = () => {
  const { 
    settings, 
    updateSettings, 
    resetToDefaultData, 
    medicines, 
    stockists, 
    purchaseInvoices, 
    stockistLedgers, 
    stockAdjustments, 
    salesInvoices,
    users
  } = usePharmacy();

  const [formData, setFormData] = useState<PharmacySettings>({ ...settings });
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
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
          {saveSuccess && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>Settings updated successfully!</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Store / Pharmacy Name: *
            </label>
            <input
              type="text"
              required
              value={formData.storeName}
              onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold text-slate-900 focus:bg-white focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Address (Makwanpur, Nepal): *
            </label>
            <input
              type="text"
              required
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 focus:bg-white focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Permanent Account Number (PAN): *
            </label>
            <input
              type="text"
              required
              value={formData.panNumber}
              onChange={(e) => setFormData({ ...formData, panNumber: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900 focus:bg-white focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Department of Drug Administration (DDA) Licence No: *
            </label>
            <input
              type="text"
              required
              value={formData.ddaLicenceNumber}
              onChange={(e) => setFormData({ ...formData, ddaLicenceNumber: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900 focus:bg-white focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Official Phone Number: *
            </label>
            <input
              type="text"
              required
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 focus:bg-white focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Official Email ID: *
            </label>
            <input
              type="email"
              required
              value={formData.emailId}
              onChange={(e) => setFormData({ ...formData, emailId: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono text-slate-900 focus:bg-white focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Fiscal Year (Nepal Bikram Sambat):
            </label>
            <input
              type="text"
              value={formData.fiscalYear}
              onChange={(e) => setFormData({ ...formData, fiscalYear: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono text-slate-900 focus:bg-white focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Invoice Prefix (e.g. PP-2081/82-):
            </label>
            <input
              type="text"
              value={formData.invoicePrefix}
              onChange={(e) => setFormData({ ...formData, invoicePrefix: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono text-slate-900 focus:bg-white focus:outline-hidden"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">
              Receipt Bottom Disclaimer / Note:
            </label>
            <input
              type="text"
              value={formData.receiptFooterNote}
              onChange={(e) => setFormData({ ...formData, receiptFooterNote: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 focus:bg-white focus:outline-hidden"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>Save Store Credentials</span>
          </button>
        </div>
      </form>

      {/* Database Backup & Restore */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-slate-900">
          Data Backup, Export &amp; Factory Reset
        </h3>
        <p className="text-xs text-slate-500">
          Export your entire pharmacy database (inventory, stock adjustments, purchase bills, and sales invoices) to keep local offline archives or restore demo dataset.
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
              if (confirm('Reset all pharmacy data back to initial Prakash Pharmacy sample dataset? Any unsaved edits will be refreshed.')) {
                resetToDefaultData();
                setFormData({ ...settings });
                alert('System restored to default sample dataset!');
              }
            }}
            className="bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ml-auto"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset to Authentic Default Demo Data</span>
          </button>
        </div>
      </div>
    </div>
  );
};
