import React, { useEffect, useState } from 'react';
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

type SettingsTab =
  | 'profile'
  | 'billing'
  | 'tax'
  | 'inventory'
  | 'payments'
  | 'security'
  | 'notifications'
  | 'backup';

const SETTINGS_TABS: { id: SettingsTab; label: string; description: string }[] = [
  { id: 'profile', label: 'Pharmacy Profile', description: 'Store details, licences, and logo' },
  { id: 'billing', label: 'Billing & Invoices', description: 'Invoice numbering and print format' },
  { id: 'tax', label: 'Tax & VAT', description: 'VAT registration status' },
  { id: 'inventory', label: 'Inventory & Racks', description: 'Inventory preferences' },
  { id: 'payments', label: 'Payments', description: 'Payment preferences' },
  { id: 'security', label: 'Users & Security', description: 'Access and account security' },
  { id: 'notifications', label: 'Notifications', description: 'Alerts and reminders' },
  { id: 'backup', label: 'Backup & Data', description: 'Export backup and clear local data' },
];

type PreviewControl = 'input' | 'select' | 'toggle';

interface PreviewSetting {
  label: string;
  detail: string;
  control: PreviewControl;
  value?: string;
  options?: string[];
  enabled?: boolean;
}

interface PreviewGroup {
  title: string;
  description: string;
  settings: PreviewSetting[];
}

type PreviewValue = string | boolean;
type PreviewValues = Record<string, PreviewValue>;

const PREVIEW_SETTINGS_STORAGE_KEY = 'prakash_pharmacy_settings_preview_v1';
const getPreviewSettingKey = (groupTitle: string, settingLabel: string) => `${groupTitle}::${settingLabel}`;

const SETTINGS_PREVIEW_GROUPS: Partial<Record<SettingsTab, PreviewGroup[]>> = {
  billing: [
    {
      title: 'Point of sale & discounts',
      description: 'Cashier discount limits and common counter options.',
      settings: [
        { label: 'Staff discount limit', detail: 'Discounts above this amount require approval.', control: 'input', value: '22%' },
        { label: 'Discount approval', detail: 'Require an administrator PIN for discounts over the limit.', control: 'select', value: 'Admin PIN only', options: ['Admin PIN only', 'Manager approval'] },
        { label: 'Maximum receipt copies', detail: 'Choose how many invoice copies to print after a sale.', control: 'select', value: '1 copy', options: ['1 copy', '2 copies', '3 copies'] },
        { label: 'Auto-print after sale', detail: 'Print the invoice automatically when a sale completes.', control: 'toggle', enabled: true },
        { label: 'Barcode scanner', detail: 'Enable barcode-based item lookup at the counter.', control: 'toggle', enabled: true },
        { label: 'Customer credit (udhaar)', detail: 'Allow eligible sales to be recorded as customer credit.', control: 'toggle', enabled: true },
      ],
    },
    {
      title: 'Language & print layout',
      description: 'Invoice language, number formatting, and printer layout preferences.',
      settings: [
        { label: 'Interface language', detail: 'Choose the language used across the pharmacy interface.', control: 'select', value: 'English', options: ['English', 'नेपाली'] },
        { label: 'Printed digits', detail: 'Use Nepali or standard digits on printed invoices.', control: 'select', value: 'Standard digits', options: ['Standard digits', 'Nepali digits'] },
        { label: 'Number format', detail: 'Choose standard or lakh/crore grouping.', control: 'select', value: 'Lakh / crore', options: ['Lakh / crore', 'Standard'] },
        { label: 'Printer margins & font size', detail: 'Configure A5 and thermal invoice layout.', control: 'select', value: 'Configure layout', options: ['Configure layout', 'A5 layout', 'Thermal layout'] },
      ],
    },
  ],
  tax: [
    {
      title: 'VAT calculation',
      description: 'Tax defaults for invoices and product categories.',
      settings: [
        { label: 'Default VAT rate', detail: 'Default rate for VAT-applicable items.', control: 'input', value: '13%' },
        { label: 'Product prices', detail: 'Choose whether entered prices include VAT.', control: 'select', value: 'VAT-inclusive', options: ['VAT-inclusive', 'VAT-exclusive'] },
        { label: 'VAT-exempt categories', detail: 'Select medicine categories that are exempt from VAT.', control: 'select', value: 'Manage categories', options: ['Manage categories'] },
        { label: 'Rounding rule', detail: 'Choose how invoice totals are rounded.', control: 'select', value: 'Nearest paisa', options: ['Nearest rupee', 'Nearest paisa'] },
      ],
    },
  ],
  inventory: [
    {
      title: 'Stock & expiry alerts',
      description: 'Thresholds and safeguards for medicine inventory.',
      settings: [
        { label: 'Global low-stock threshold', detail: 'Default reorder alert for medicines without a custom threshold.', control: 'input', value: '15 packs' },
        { label: 'Near-expiry alert window', detail: 'Flag batches approaching their expiry date.', control: 'select', value: '90 days', options: ['30 days', '60 days', '90 days', '180 days'] },
        { label: 'Per-medicine threshold', detail: 'Allow an individual reorder level to override the global threshold.', control: 'toggle', enabled: true },
        { label: 'Rack & shelf locations', detail: 'Organize storage locations and assign medicine batches to racks.', control: 'select', value: 'Manage in Inventory', options: ['Manage in Inventory'] },
        { label: 'Block expired batches', detail: 'Prevent expired medicine from being added to a sale.', control: 'toggle', enabled: true },
        { label: 'FEFO batch selection', detail: 'Prefer batches with the earliest expiry date first.', control: 'toggle', enabled: true },
        { label: 'Allow negative stock', detail: 'Permit a sale when recorded stock is insufficient.', control: 'toggle', enabled: false },
      ],
    },
    {
      title: 'Prescription medicines',
      description: 'Prescription and scheduled medicine record-keeping.',
      settings: [
        { label: 'Prescription-only item flag', detail: 'Mark medicines that require a prescription.', control: 'toggle', enabled: true },
        { label: 'Doctor name on bill', detail: 'Require a doctor’s name when a prescription-only item is sold.', control: 'toggle', enabled: true },
        { label: 'Controlled-drug register', detail: 'Keep a dedicated record of controlled medicine transactions.', control: 'toggle', enabled: true },
        { label: 'Patient details for scheduled drugs', detail: 'Optionally capture patient age and address.', control: 'toggle', enabled: false },
      ],
    },
  ],
  payments: [
    {
      title: 'POS payment methods',
      description: 'Choose which payment options are available to cashiers.',
      settings: [
        { label: 'Cash', detail: 'Accept cash payments at checkout.', control: 'toggle', enabled: true },
        { label: 'Fonepay QR', detail: 'Accept Fonepay QR payments.', control: 'toggle', enabled: true },
        { label: 'eSewa', detail: 'Accept eSewa wallet payments.', control: 'toggle', enabled: true },
        { label: 'Khalti', detail: 'Accept Khalti wallet payments.', control: 'toggle', enabled: true },
        { label: 'Card', detail: 'Accept card payments.', control: 'toggle', enabled: true },
        { label: 'Credit (udhaar)', detail: 'Allow sales to be recorded on customer credit.', control: 'toggle', enabled: true },
      ],
    },
    {
      title: 'Stockist payment defaults',
      description: 'Default terms and reminders for supplier accounts.',
      settings: [
        { label: 'Default credit period', detail: 'Suggested payment term for new stockist purchase bills.', control: 'input', value: '30 days' },
        { label: 'Payment due reminder', detail: 'Show a reminder before a stockist payment is due.', control: 'select', value: '7 days before', options: ['3 days before', '7 days before', '14 days before'] },
      ],
    },
  ],
  security: [
    {
      title: 'Account security',
      description: 'Session and password policies for staff accounts.',
      settings: [
        { label: 'Automatic sign-out', detail: 'Sign out after a period without activity.', control: 'select', value: '15 minutes', options: ['5 minutes', '15 minutes', '30 minutes', 'Never'] },
        { label: 'Password rules', detail: 'Set minimum length and complexity requirements.', control: 'select', value: 'Configure rules', options: ['Configure rules'] },
        { label: 'Sensitive action approval', detail: 'Require admin approval for invoice deletion, price edits, and stock adjustments.', control: 'toggle', enabled: true },
        { label: 'Approval method', detail: 'Choose how an administrator approves a restricted action.', control: 'select', value: 'Admin PIN only', options: ['Admin PIN only'] },
      ],
    },
  ],
  notifications: [
    {
      title: 'Alerts & reminders',
      description: 'Manage the pharmacy’s operational notifications in one place.',
      settings: [
        { label: 'Near-expiry medicines', detail: 'Alert when a batch enters the near-expiry window.', control: 'toggle', enabled: true },
        { label: 'Low stock', detail: 'Alert when stock reaches its reorder threshold.', control: 'toggle', enabled: true },
        { label: 'Stockist payments due', detail: 'Remind staff about upcoming supplier payments.', control: 'toggle', enabled: true },
        { label: 'Licence renewal', detail: 'Warn before DDA or pharmacist council registration expires.', control: 'toggle', enabled: true },
      ],
    },
    {
      title: 'Audit & customer loyalty',
      description: 'Optional tools for accountability and returning customers.',
      settings: [
        { label: 'Audit log viewer', detail: 'Review who changed important records and when.', control: 'select', value: 'View audit log', options: ['View audit log'] },
        { label: 'Customer loyalty', detail: 'Configure points or discount tiers for customers.', control: 'toggle', enabled: false },
      ],
    },
  ],
  backup: [
    {
      title: 'Backup & data tools',
      description: 'Additional backup, restore, export, and demo-data controls.',
      settings: [
        { label: 'Scheduled backup', detail: 'Automatically prepare a backup on a regular schedule.', control: 'select', value: 'Weekly', options: ['Daily', 'Weekly'] },
        { label: 'Restore from backup', detail: 'Restore pharmacy data from a backup file.', control: 'input', value: 'Choose backup file' },
        { label: 'Export format', detail: 'Export data for spreadsheets and accounting.', control: 'select', value: 'Excel or CSV', options: ['Excel', 'CSV'] },
        { label: 'Remove demo data', detail: 'Remove sample records before entering live pharmacy data.', control: 'toggle', enabled: false },
      ],
    },
  ],
};

function getDefaultPreviewValues(): PreviewValues {
  return Object.fromEntries(
    Object.values(SETTINGS_PREVIEW_GROUPS)
      .flat()
      .flatMap(group => group.settings.map(setting => [
        getPreviewSettingKey(group.title, setting.label),
        setting.control === 'toggle' ? Boolean(setting.enabled) : setting.value ?? '',
      ]))
  );
}

function readPreviewValues(): PreviewValues {
  const defaults = getDefaultPreviewValues();
  try {
    const saved = localStorage.getItem(PREVIEW_SETTINGS_STORAGE_KEY);
    if (!saved) return defaults;

    const parsed: unknown = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return defaults;

    const savedValues = parsed as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(defaults).map(([key, defaultValue]) => {
        const savedValue = savedValues[key];
        return [
          key,
          typeof savedValue === typeof defaultValue ? savedValue as PreviewValue : defaultValue,
        ];
      })
    );
  } catch (error) {
    console.error('Unable to load saved Settings preview values:', error);
    return defaults;
  }
}

const SettingsPreviewGroupCard: React.FC<{
  group: PreviewGroup;
  values: PreviewValues;
  onChange: (key: string, value: PreviewValue) => void;
}> = ({ group, values, onChange }) => (
  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
      <div>
        <h3 className="text-base font-extrabold text-slate-900">{group.title}</h3>
        <p className="mt-0.5 text-xs text-slate-500">{group.description}</p>
      </div>
      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-800 ring-1 ring-blue-200">
        Editable · saved in this browser
      </span>
    </div>
    <div className="divide-y divide-slate-100 px-5 sm:px-6">
      {group.settings.map(setting => {
        const key = getPreviewSettingKey(group.title, setting.label);
        const value = values[key];
        return (
        <div key={setting.label} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
          <div className="min-w-[180px] flex-1">
            <p className="text-xs font-bold text-slate-800">{setting.label}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{setting.detail}</p>
          </div>
          {setting.control === 'toggle' ? (
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(value)}
              aria-label={setting.label}
              onClick={() => onChange(key, !Boolean(value))}
              className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-600"
            >
              <span className={`relative h-5 w-9 rounded-full transition-colors ${value ? 'bg-teal-700' : 'bg-slate-300'}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${value ? 'left-[18px]' : 'left-0.5'}`} />
              </span>
              {value ? 'On' : 'Off'}
            </button>
          ) : setting.control === 'select' ? (
            <select
              aria-label={setting.label}
              value={String(value ?? '')}
              onChange={event => onChange(key, event.target.value)}
              className="w-full max-w-[190px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
            >
              {(setting.options ?? [setting.value ?? '']).map(option => <option key={option}>{option}</option>)}
            </select>
          ) : (
            <input
              aria-label={setting.label}
              value={String(value ?? '')}
              onChange={event => onChange(key, event.target.value)}
              className="w-full max-w-[190px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
            />
          )}
        </div>
      );
      })}
    </div>
  </section>
);

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
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>('profile');
  const [previewValues, setPreviewValues] = useState<PreviewValues>(readPreviewValues);
  const [previewStorageError, setPreviewStorageError] = useState('');
  const hasUnsavedChanges = JSON.stringify(formData) !== JSON.stringify(settings);

  useEffect(() => {
    try {
      localStorage.setItem(PREVIEW_SETTINGS_STORAGE_KEY, JSON.stringify(previewValues));
      setPreviewStorageError('');
    } catch (error) {
      console.error('Unable to save Settings preview values:', error);
      setPreviewStorageError('These preview settings could not be saved in this browser.');
    }
  }, [previewValues]);

  const updatePreviewValue = (key: string, value: PreviewValue) => {
    setPreviewValues(current => ({ ...current, [key]: value }));
  };
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
    if (requiredSettings.some(value => !value.trim())) {
      setFormError('Complete all required pharmacy profile and licence fields before saving.');
      setActiveSettingsTab('profile');
      return;
    }

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
    <div className="mx-auto max-w-6xl space-y-5 pb-24">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-800 ring-1 ring-teal-100">
              <Settings className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
              Pharmacy Settings
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
      <div
        className={`rounded-xl border px-4 py-3 text-xs font-medium ${
          previewStorageError
            ? 'border-rose-200 bg-rose-50 text-rose-800'
            : 'border-blue-200 bg-blue-50 text-blue-800'
        }`}
        role={previewStorageError ? 'alert' : 'status'}
      >
        {previewStorageError || 'The new settings below are editable and saved in this browser only. They are not yet connected to POS, inventory, or other workflows.'}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
        <nav
          aria-label="Settings sections"
          className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm lg:sticky lg:top-4 lg:flex-col"
        >
          {SETTINGS_TABS.map(tab => {
            const isActive = activeSettingsTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setActiveSettingsTab(tab.id)}
                className={`min-w-[170px] rounded-xl px-3 py-2.5 text-left transition-colors lg:min-w-0 ${
                  isActive
                    ? 'bg-teal-50 text-teal-900 ring-1 ring-teal-100'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="block whitespace-nowrap text-xs font-bold">{tab.label}</span>
                <span className={`mt-0.5 hidden text-[10px] leading-relaxed lg:block ${isActive ? 'text-teal-700' : 'text-slate-400'}`}>
                  {tab.description}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 space-y-4">
      <form id="store-settings-form" onSubmit={handleSubmit} className="space-y-4">
        {activeSettingsTab === 'profile' && (
          <>
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
          </>
        )}

        {activeSettingsTab === 'billing' && (
          <>
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
        {(SETTINGS_PREVIEW_GROUPS.billing ?? []).map(group => (
          <SettingsPreviewGroupCard key={group.title} group={group} values={previewValues} onChange={updatePreviewValue} />
        ))}
          </>
        )}

        {activeSettingsTab === 'tax' && (
          <>
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
              <h3 className="text-base font-extrabold text-slate-900">Tax registration</h3>
              <p className="mt-0.5 text-xs text-slate-500">Choose whether the pharmacy is registered for VAT.</p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6">
              <div>
                <strong className="block text-xs text-slate-800">VAT Registration</strong>
                <span className="text-[11px] text-slate-500">This status is used on pharmacy invoices.</span>
              </div>
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1" role="group" aria-label="VAT registration status">
                <button
                  type="button"
                  aria-pressed={formData.vatRegistered}
                  onClick={() => setFormData(current => ({ ...current, vatRegistered: true }))}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    formData.vatRegistered ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
                  }`}
                >
                  VAT Registered
                </button>
                <button
                  type="button"
                  aria-pressed={!formData.vatRegistered}
                  onClick={() => setFormData(current => ({ ...current, vatRegistered: false }))}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    !formData.vatRegistered ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
                  }`}
                >
                  Not Registered
                </button>
              </div>
            </div>
          </section>
          {(SETTINGS_PREVIEW_GROUPS.tax ?? []).map(group => (
            <SettingsPreviewGroupCard key={group.title} group={group} values={previewValues} onChange={updatePreviewValue} />
          ))}
          </>
        )}

        {(['inventory', 'payments', 'security', 'notifications'] as SettingsTab[]).includes(activeSettingsTab) && (
          (SETTINGS_PREVIEW_GROUPS[activeSettingsTab] ?? []).map(group => (
            <SettingsPreviewGroupCard key={group.title} group={group} values={previewValues} onChange={updatePreviewValue} />
          ))
        )}
      </form>

      {/* Database Backup & Restore */}
      {activeSettingsTab === 'backup' && (
        <>
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
      {(SETTINGS_PREVIEW_GROUPS.backup ?? []).map(group => (
        <SettingsPreviewGroupCard key={group.title} group={group} values={previewValues} onChange={updatePreviewValue} />
      ))}
        </>
      )}
        </div>
      </div>

      {hasUnsavedChanges && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
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
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
