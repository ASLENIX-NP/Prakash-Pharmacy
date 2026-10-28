import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import {
  Medicine,
  StockAdjustmentLog,
  Stockist,
  StockistPurchaseInvoice,
  StockistLedgerEntry,
  StockistReturnVoucher,
  SaleInvoice,
  PharmacySettings,
  PharmacyUser,
  RackLocation
} from '../types/pharmacy';
import { defaultSettings } from '../data/defaultSettings';
import {
  stockistDemoData,
  STOCKIST_DEMO_STATUS_KEY,
} from '../data/stockistDemoData';
import { SALES_DEMO_STATUS_KEY } from '../data/salesDemoData';

interface PharmacyContextType {
  // Authentication & Credentials
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  isAdmin: boolean;
  changeStaffPassword: (userId: string, newPassword: string) => { success: boolean; message: string };

  // Users & Roles
  users: PharmacyUser[];
  currentUser: PharmacyUser | null;
  setCurrentUser: (user: PharmacyUser) => void;
  addUser: (user: Omit<PharmacyUser, 'id' | 'createdAt'>) => PharmacyUser;
  updateUser: (id: string, updates: Partial<PharmacyUser>) => void;
  deleteUser: (id: string) => void;

  // Racks Management (Admin can Add or Deduce)
  racks: RackLocation[];
  addRack: (name: string, description?: string) => Promise<{ success: boolean; message: string }>;
  deduceRack: (rackId: string) => Promise<{ success: boolean; message: string }>;

  // Medicines & Inventory
  medicines: Medicine[];
  addMedicine: (medicine: Omit<Medicine, 'id'>) => Medicine;
  updateMedicine: (id: string, updates: Partial<Medicine>) => void;
  deleteMedicine: (id: string) => void;
  bulkImportMedicines: (
    newMedicines: Medicine[],
    mode?: 'merge' | 'replace' | 'skip'
  ) => Promise<{
    success: boolean;
    message: string;
    summary?: {
      received: number;
      created: number;
      updated: number;
      skipped: number;
      errors: number;
    };
    data?: {
      created: any[];
      updated: any[];
      skipped: any[];
      errors: any[];
    };
  }>;

  // Physical Stock Count & Audits
  stockAdjustments: StockAdjustmentLog[];
  inventoryBackendStatus: 'idle' | 'loading' | 'connected' | 'error';
  inventoryBackendError: string;
  stockAdjustmentHistoryBackendStatus: 'idle' | 'loading' | 'connected' | 'error';
  stockAdjustmentHistoryBackendError: string;
  recordStockAdjustment: (data: {
    medicineId: string;
    type: 'reconcile' | 'add' | 'deduce';
    countedPacks?: number;
    countedLoose?: number;
    addedPacks?: number;
    addedLoose?: number;
    reason: StockAdjustmentLog['reason'];
    notes: string;
    recordedBy?: string;
  }) => void;
  submitStockAdjustment: (data: {
    medicineId: string;
    type: 'reconcile' | 'add' | 'deduce';
    countedPacks?: number;
    countedLoose?: number;
    addedPacks?: number;
    addedLoose?: number;
    reason: StockAdjustmentLog['reason'];
    notes: string;
  }) => Promise<void>;
  batchReconcileRack: (adjustments: {
    medicineId: string;
    countedPacks: number;
    countedLoose: number;
    notes: string;
    reason: StockAdjustmentLog['reason'];
  }[]) => void;

  // Stockists & Wholesalers
  stockists: Stockist[];
  addStockist: (stockist: Omit<Stockist, 'id' | 'currentBalance'>) => Promise<Stockist>;
  updateStockist: (id: string, updates: Partial<Stockist>) => Promise<void>;
  
  // Purchase Invoices
  purchaseInvoices: StockistPurchaseInvoice[];
  addPurchaseInvoice: (invoice: Omit<StockistPurchaseInvoice, 'id' | 'createdAt'>) => Promise<StockistPurchaseInvoice>;

  // Stockist Ledger & Payments
  stockistLedgers: StockistLedgerEntry[];
  addStockistPayment: (
    stockistId: string,
    amount: number,
    paymentMode: string,
    refNumber: string,
    notes: string
  ) => Promise<void>;

  // Returns to Wholesaler (Damaged / Expired / Breakage)
  stockistReturns: StockistReturnVoucher[];
  recordStockistReturn: (voucher: Omit<StockistReturnVoucher, 'id' | 'createdAt'>) => StockistReturnVoucher;

  // Sales & POS Billing
  salesInvoices: SaleInvoice[];
  isSalesDemoDataActive: boolean;
  clearSalesDemoData: () => void;
  completeSale: (sale: Omit<SaleInvoice, 'id' | 'invoiceNumber' | 'createdAt' | 'fiscalYear'>) => SaleInvoice;

  // Settings
  settings: PharmacySettings;
  updateSettings: (updates: Partial<PharmacySettings>) => void;

  // Active Modals state
  activeVatInfoMedicine: Medicine | null;
  setActiveVatInfoMedicine: (med: Medicine | null) => void;
  activeAuditMedicine: Medicine | null;
  setActiveAuditMedicine: (med: Medicine | null) => void;
  activeInvoiceToPrint: SaleInvoice | null;
  setActiveInvoiceToPrint: (inv: SaleInvoice | null) => void;
  activeDebitNoteToPrint: StockistReturnVoucher | null;
  setActiveDebitNoteToPrint: (dn: StockistReturnVoucher | null) => void;

  // Reset
  clearLocalData: () => void;
}

const PharmacyContext = createContext<PharmacyContextType | undefined>(undefined);

const STORAGE_KEYS = {
  AUTH_SESSION: 'prakash_pharmacy_auth_v2',
  RACKS: 'prakash_pharmacy_racks_v2',
  USERS: 'prakash_pharmacy_users_v2',
  CURRENT_USER_ID: 'prakash_pharmacy_current_user_v2',
  MEDICINES: 'prakash_pharmacy_medicines_v2',
  STOCKISTS: 'prakash_pharmacy_stockists_v2',
  INVOICES: 'prakash_pharmacy_purchase_invoices_v2',
  LEDGERS: 'prakash_pharmacy_stockist_ledgers_v2',
  ADJUSTMENTS: 'prakash_pharmacy_stock_adjustments_v2',
  SALES: 'prakash_pharmacy_sales_invoices_v2',
  RETURNS: 'prakash_pharmacy_stockist_returns_v2',
  SETTINGS: 'prakash_pharmacy_settings_v2',
};

const LEGACY_DEMO_IDS = new Set([
  ...Array.from({ length: 23 }, (_, index) => `med-${index + 1}`),
  ...Array.from({ length: 4 }, (_, index) => `stk-${index + 1}`),
  'inv-101',
  'inv-102',
  ...Array.from({ length: 7 }, (_, index) => `led-${index + 1}`),
  'adj-1',
  'adj-2',
  'sal-101',
  'sal-102',
  ...Array.from({ length: 3 }, (_, index) => `usr-${index + 1}`),
  ...Array.from({ length: 12 }, (_, index) => `rck-${index + 1}`),
]);

function mapBackendAdjustment(item: any): StockAdjustmentLog {
  const variance = Number(item.netVarianceUnits ?? 0);
  const backendType = String(item.type ?? item.adjustmentType ?? '').toLowerCase();
  const type: StockAdjustmentLog['type'] =
    backendType === 'audit' || backendType === 'reconcile'
      ? 'reconcile'
      : variance >= 0
        ? 'add'
        : 'deduce';

  return {
    id: String(item.id ?? `adj-${item.adjustmentId}`),
    medicineId: String(item.medicineId),
    medicineName: String(item.medicineName ?? 'Medicine'),
    genericName: String(item.genericName ?? ''),
    batchNumber: String(item.batchNumber ?? ''),
    type,
    previousPacks: Number(item.previousPacks ?? 0),
    previousLoose: Number(item.previousLoose ?? item.previousLooseUnits ?? 0),
    previousTotalUnits: Number(item.previousTotalUnits ?? 0),
    addedPacks: Number(item.addedPacks ?? item.variancePacks ?? 0),
    addedLoose: Number(item.addedLoose ?? item.varianceLooseUnits ?? 0),
    newPacks: Number(item.newPacks ?? 0),
    newLoose: Number(item.newLoose ?? item.newLooseUnits ?? 0),
    newTotalUnits: Number(item.newTotalUnits ?? 0),
    netVarianceUnits: variance,
    reason: item.reason as StockAdjustmentLog['reason'],
    notes: String(item.notes ?? item.reason ?? ''),
    timestamp: String(item.timestamp ?? item.createdAt ?? new Date().toISOString()),
    recordedBy: String(item.recordedBy ?? 'Unknown'),
  };
}

function readStoredCollection<T extends { id: string }>(key: string): T[] {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) {
      return [];
    }

    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const collection = parsed.filter(
      (item): item is T =>
        Boolean(
          item &&
          typeof item === 'object' &&
          typeof item.id === 'string' &&
          !LEGACY_DEMO_IDS.has(item.id)
        )
    );

    return collection;
  } catch (error) {
    console.error(`Unable to load cached data for ${key}:`, error);
    return [];
  }
}

function initializeStockistDemoData(): Stockist[] {
  const savedStockists = readStoredCollection<Stockist>(STORAGE_KEYS.STOCKISTS);
  const savedInvoices = readStoredCollection<StockistPurchaseInvoice>(STORAGE_KEYS.INVOICES);
  const savedLedgers = readStoredCollection<StockistLedgerEntry>(STORAGE_KEYS.LEDGERS);
  const demoStatus = localStorage.getItem(STOCKIST_DEMO_STATUS_KEY);

  if (
    savedStockists.length === 0 &&
    savedInvoices.length === 0 &&
    savedLedgers.length === 0 &&
    demoStatus !== 'active' &&
    demoStatus !== 'dismissed'
  ) {
    localStorage.setItem(STORAGE_KEYS.STOCKISTS, JSON.stringify(stockistDemoData.stockists));
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(stockistDemoData.invoices));
    localStorage.setItem(STORAGE_KEYS.LEDGERS, JSON.stringify(stockistDemoData.ledgers));
    localStorage.setItem(STOCKIST_DEMO_STATUS_KEY, 'active');
    return stockistDemoData.stockists;
  }

  return savedStockists;
}

function initializeSalesDemoStatus(): boolean {
  const savedSales = readStoredCollection<SaleInvoice>(STORAGE_KEYS.SALES);
  const demoStatus = localStorage.getItem(SALES_DEMO_STATUS_KEY);

  if (savedSales.length === 0 && demoStatus !== 'active' && demoStatus !== 'dismissed') {
    localStorage.setItem(SALES_DEMO_STATUS_KEY, 'active');
    return true;
  }

  return demoStatus === 'active' && savedSales.length === 0;
}

function readStoredSettings(): PharmacySettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!saved) {
      return defaultSettings;
    }

    const settings: PharmacySettings = {
      ...defaultSettings,
      ...JSON.parse(saved),
    };
    const legacySettings: PharmacySettings = {
      storeName: 'Prakash Pharmacy',
      address: 'Hetauda-5, Sanopokhara, Makwanpur, Nepal',
      phoneNumber: '+977-057-521480',
      emailId: 'prakashpharmacy2021@gmail.com',
      panNumber: '123798907',
      ddaLicenceNumber: '3780516073935',
      vatRegistered: true,
      storeLogo: '',
      pharmacistName: '',
      pharmacistCouncilRegNumber: '',
      ddaLicenceExpiryDate: '',
      currency: 'NPR',
      fiscalYear: '2081/82',
      invoicePrefix: 'PP-2081/82-',
      nextInvoiceNumber: 101,
      defaultInvoiceSize: 'A5',
      invoiceDateFormat: 'BS',
      receiptFooterNote:
        'Thank you for choosing Prakash Pharmacy! Medicines cannot be refunded after 7 days without bill.',
      defaultLowStockThreshold: 15,
      nearExpiryThresholdMonths: 6,
    };

    for (const key of Object.keys(legacySettings) as (keyof PharmacySettings)[]) {
      if (settings[key] === legacySettings[key]) {
        Object.assign(settings, { [key]: defaultSettings[key] });
      }
    }

    return settings;
  } catch (error) {
    console.error('Unable to load cached pharmacy settings:', error);
    return defaultSettings;
  }
}

export const PharmacyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<PharmacyUser[]>(() => {
    return readStoredCollection<PharmacyUser>(STORAGE_KEYS.USERS).map(user => ({
      ...user,
      password: '',
    }));
  });

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
      if (saved && LEGACY_DEMO_IDS.has(saved)) {
        return '';
      }
      return saved || '';
    } catch (error) {
      console.error('Unable to load the cached current user:', error);
      return '';
    }
  });

  const currentUser = React.useMemo<PharmacyUser | null>(() => {
    return users.find(u => u.id === currentUserId) || users[0] || null;
  }, [users, currentUserId]);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const token = localStorage.getItem('prakash_auth_token');
      const session = localStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
      return (
        Boolean(token) &&
        session === 'true' &&
        Boolean(localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID)) &&
        !LEGACY_DEMO_IDS.has(
          localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID) || ''
        )
      );
    } catch (error) {
      console.error('Unable to load the cached authentication state:', error);
      return false;
    }
  });

  const [racks, setRacks] = useState<RackLocation[]>(() =>
    readStoredCollection<RackLocation>(STORAGE_KEYS.RACKS)
  );

  const isAdmin = currentUser?.role === 'Admin';

  const [medicines, setMedicines] = useState<Medicine[]>(() =>
    readStoredCollection<Medicine>(STORAGE_KEYS.MEDICINES)
  );

  const [stockists, setStockists] = useState<Stockist[]>([]);

  const [purchaseInvoices, setPurchaseInvoices] = useState<StockistPurchaseInvoice[]>([]);

  const [stockistLedgers, setStockistLedgers] = useState<StockistLedgerEntry[]>([]);

  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustmentLog[]>([]);

  const [stockistReturns, setStockistReturns] = useState<StockistReturnVoucher[]>(() =>
    readStoredCollection<StockistReturnVoucher>(STORAGE_KEYS.RETURNS)
  );

  const [salesInvoices, setSalesInvoices] = useState<SaleInvoice[]>(() =>
    readStoredCollection<SaleInvoice>(STORAGE_KEYS.SALES)
  );
  const [isSalesDemoDataActive, setIsSalesDemoDataActive] = useState(
    initializeSalesDemoStatus
  );

  const [settings, setSettings] = useState<PharmacySettings>(readStoredSettings);

  // Modal states
  const [activeVatInfoMedicine, setActiveVatInfoMedicine] = useState<Medicine | null>(null);
  const [activeAuditMedicine, setActiveAuditMedicine] = useState<Medicine | null>(null);
  const [activeInvoiceToPrint, setActiveInvoiceToPrint] = useState<SaleInvoice | null>(null);
  const [activeDebitNoteToPrint, setActiveDebitNoteToPrint] = useState<StockistReturnVoucher | null>(null);

  useEffect(() => {
    const savedUserId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
    if (savedUserId && LEGACY_DEMO_IDS.has(savedUserId)) {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_ID);
      localStorage.removeItem('prakash_auth_token');
    }
  }, []);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MEDICINES, JSON.stringify(medicines));
  }, [medicines]);


  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RETURNS, JSON.stringify(stockistReturns));
  }, [stockistReturns]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(salesInvoices));
  }, [salesInvoices]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, isAuthenticated ? 'true' : 'false');
  }, [isAuthenticated]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RACKS, JSON.stringify(racks));
  }, [racks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }, [settings]);


  // ==========================================================
  // LIVE BACKEND DATA LOADER
  // ==========================================================
  useEffect(() => {
    if (!isAuthenticated) {
      setInventoryBackendStatus('idle');
      setInventoryBackendError('');
      setStockAdjustmentHistoryBackendStatus('idle');
      setStockAdjustmentHistoryBackendError('');
      return;
    }

    let cancelled = false;

    const loadBackendData = async () => {
      setInventoryBackendStatus('loading');
      setInventoryBackendError('');
      setStockAdjustmentHistoryBackendStatus('loading');
      setStockAdjustmentHistoryBackendError('');

      // ------------------------------------------------------
      // INVENTORY
      // ------------------------------------------------------
      try {
        const res = await apiRequest<{ data: any[] }>(
          '/inventory?limit=all'
        );

        if (!cancelled) {
          const liveMedicines: Medicine[] = res.data.map(
            (item: any) => ({
              ...item,

              // Backend already provides frontend aliases.
              // Supplier is not yet part of backend inventory DTO.
              supplierId: item.supplierId || '',
              supplierName: item.supplierName || ''
            })
          );

          setMedicines(liveMedicines);
          setInventoryBackendStatus('connected');
        }
      } catch (error) {
        if (!cancelled) {
          setInventoryBackendStatus('error');
          setInventoryBackendError(
            error instanceof Error ? error.message : 'Unable to load inventory from the backend.'
          );
        }
        console.error(
          'Error fetching live inventory:',
          error
        );
      }


      // ------------------------------------------------------
      // RACKS
      // ------------------------------------------------------
      try {
        const res = await apiRequest<{ data: any[] }>(
          '/racks'
        );

        if (!cancelled) {
          const liveRacks: RackLocation[] = res.data.map(
            (rack: any) => ({
              id: rack.id,
              name: rack.name,
              description: rack.description || '',
              createdAt:
                rack.createdAt ||
                new Date().toISOString()
            })
          );

          setRacks(liveRacks);
        }
      } catch (error) {
        console.error(
          'Error fetching live racks:',
          error
        );
      }


      // ------------------------------------------------------
      // BILLS & SALES INVOICES
      // ------------------------------------------------------
      try {
        const res = await apiRequest<{ data: SaleInvoice[] }>(
          '/bills?limit=all'
        );

        if (!cancelled && res.data && res.data.length > 0) {
          setSalesInvoices(res.data);
          localStorage.setItem(SALES_DEMO_STATUS_KEY, 'dismissed');
          setIsSalesDemoDataActive(false);
        }
      } catch (error) {
        console.error(
          'Error fetching live sales invoices:',
          error
        );
      }

      // ------------------------------------------------------
      // STOCK ADJUSTMENT HISTORY
      // ------------------------------------------------------
      try {
        const res = await apiRequest<{ data: any[] }>(
          '/inventory/adjustments?limit=all'
        );

        if (!cancelled) {
          setStockAdjustments(res.data.map(mapBackendAdjustment));
          setStockAdjustmentHistoryBackendStatus('connected');
        }
      } catch (error) {
        if (!cancelled) {
          setStockAdjustmentHistoryBackendStatus('error');
          setStockAdjustmentHistoryBackendError(
            error instanceof Error
              ? error.message
              : 'Unable to load stock adjustment history from the backend.'
          );
        }
        console.error(
          'Error fetching stock adjustment history:',
          error
        );
      }


      // ------------------------------------------------------
      // STAFF ? ADMIN ONLY
      // ------------------------------------------------------
      if (isAdmin) {
        try {
          const res = await apiRequest<{
            users: any[];
          }>('/auth/users');

          if (!cancelled) {
            const liveUsers: PharmacyUser[] =
              res.users.map((user: any) => ({
                ...user,

                // Password is intentionally never returned
                // by the backend.
                password: ''
              }));

            setUsers(liveUsers);
          }
        } catch (error) {
          console.error(
            'Error fetching live staff:',
            error
          );
        }
      }

      // ------------------------------------------------------
      // DISTRIBUTORS / STOCKISTS
      // ------------------------------------------------------
      let liveDistributors: Stockist[] = [];

      try {
        const distRes =
          await apiRequest<{ data: Stockist[] }>(
            '/distributors?limit=all'
          );

        liveDistributors =
          Array.isArray(distRes.data) ? distRes.data : [];

        if (!cancelled) {
          setStockists(liveDistributors);
        }
      } catch (error) {
        console.error('Error fetching live stockists:', error);
      }

      // ------------------------------------------------------
      // SUPPLIER LEDGERS
      // ------------------------------------------------------
      try {
        const ledgerGroups =
          await Promise.all(
            liveDistributors.map(async stockist => {
              const ledgerRes =
                await apiRequest<{ data: any[] }>(
                  '/distributors/' +
                    encodeURIComponent(stockist.id) +
                    '/ledger'
                );

              return (
                Array.isArray(ledgerRes.data)
                  ? ledgerRes.data
                  : []
              ).map(item => ({
                ...item,
                stockistId: stockist.id,
                refId: item.refId || String(item.id)
              })) as StockistLedgerEntry[];
            })
          );

        if (!cancelled) {
          setStockistLedgers(ledgerGroups.flat());
        }
      } catch (error) {
        console.error('Error fetching supplier ledgers:', error);
      }

      // ------------------------------------------------------
      // INWARD PURCHASE INVOICES
      // ------------------------------------------------------
      try {
        const purchaseRes =
          await apiRequest<{
            data: StockistPurchaseInvoice[];
          }>('/purchases?limit=all');

        if (
          !cancelled &&
          Array.isArray(purchaseRes.data)
        ) {
          setPurchaseInvoices(purchaseRes.data);
        }
      } catch (error) {
        console.error('Error fetching live purchase bills:', error);
      }

      // ------------------------------------------------------
      // PHYSICAL STOCK AUDIT HISTORY
      // ------------------------------------------------------
      try {
        const adjustmentRes =
          await apiRequest<{ data: any[] }>(
            '/inventory/adjustments?limit=all'
          );

        if (
          !cancelled &&
          Array.isArray(adjustmentRes.data)
        ) {
          const liveAdjustments: StockAdjustmentLog[] =
            adjustmentRes.data.map(item => {
              const rawType =
                String(item.type || '').toLowerCase();

              const type: StockAdjustmentLog['type'] =
                rawType === 'reconcile' ||
                rawType === 'audit' ||
                rawType === 'correction'
                  ? 'reconcile'
                  : rawType === 'add'
                    ? 'add'
                    : rawType === 'deduce'
                      ? 'deduce'
                      : Number(item.netVarianceUnits || 0) >= 0
                        ? 'add'
                        : 'deduce';

              return {
                ...item,
                type
              };
            });

          setStockAdjustments(liveAdjustments);
        }
      } catch (error) {
        console.error(
          'Error fetching physical stock audit history:',
          error
        );
      }

    };

    void loadBackendData();

    return () => {
      cancelled = true;
    };

  }, [isAuthenticated, isAdmin]);

  // Auth methods
  const login = async (username: string, password: string) => {
    try {
      const res = await apiRequest<{
        success: boolean;
        token: string;
        user: PharmacyUser;
        message?: string;
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: username.trim(),
          password
        }),
      });

      if (!res.success || !res.token || !res.user) {
        return {
          success: false,
          message: res.message || 'Invalid credentials'
        };
      }

      // Backend never sends password hashes/plain passwords.
      // Keep frontend type compatible without storing the real password.
      const liveUser: PharmacyUser = {
        ...res.user,
        password: res.user.password || ''
      };

      localStorage.setItem('prakash_auth_token', res.token);

      // Keep current frontend user model working.
      setUsers(prev => {
        const exists = prev.some(user => user.id === liveUser.id);

        if (exists) {
          return prev.map(user =>
            user.id === liveUser.id
              ? { ...user, ...liveUser }
              : user
          );
        }

        return [...prev, liveUser];
      });

      setCurrentUserId(liveUser.id);

      localStorage.setItem(
        STORAGE_KEYS.CURRENT_USER_ID,
        liveUser.id
      );

      localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, 'true');
      setIsAuthenticated(true);

      return { success: true };

    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to connect to the pharmacy server';

      return {
        success: false,
        message
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('prakash_auth_token');
    setIsAuthenticated(false);
    localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, 'false');
  };

  const changeStaffPassword = (userId: string, newPassword: string) => {
    if (!isAdmin) {
      return { success: false, message: 'Access Denied: Only Admin can change passwords!' };
    }
    if (!newPassword || newPassword.trim().length < 4) {
      return { success: false, message: 'Password must be at least 4 characters long!' };
    }

    updateUser(userId, { password: newPassword.trim() });
    return { success: true, message: 'Password updated successfully!' };
  };

  // Racks management (Admin can Add or Deduce)
  const addRack = async (
    name: string,
    description?: string
  ): Promise<{ success: boolean; message: string }> => {

    if (!isAdmin) {
      return {
        success: false,
        message:
          'Only Admin can add new inventory racks!'
      };
    }

    const cleanName =
      name.trim();

    if (!cleanName) {
      return {
        success: false,
        message:
          'Rack name cannot be empty!'
      };
    }

    const exists =
      racks.some(
        rack =>
          rack.name
            .toLowerCase() ===
          cleanName.toLowerCase()
      );

    if (exists) {
      return {
        success: false,
        message:
          `Rack "${cleanName}" already exists!`
      };
    }

    try {

      const res =
        await apiRequest<{
          success: boolean;
          message?: string;
          data: {
            id: string;
            rackCode?: string;
            name: string;
            description?: string;
            itemCount?: number;
            createdAt?: string;
          };
        }>('/racks', {
          method: 'POST',

          body: JSON.stringify({
            name:
              cleanName,

            description:
              description?.trim() ||
              'Shelf storage rack'
          })
        });


      const createdRack: RackLocation = {
        id:
          res.data.id,

        name:
          res.data.name,

        description:
          res.data.description ||
          '',

        createdAt:
          res.data.createdAt ||
          new Date().toISOString()
      };


      setRacks(prev => {

        const withoutDuplicate =
          prev.filter(
            rack =>
              rack.id !==
                createdRack.id &&
              rack.name
                .toLowerCase() !==
                createdRack.name
                  .toLowerCase()
          );

        return [
          ...withoutDuplicate,
          createdRack
        ];
      });


      return {
        success: true,

        message:
          res.message ||
          `Rack "${cleanName}" added to inventory successfully!`
      };

    } catch (error) {

      console.error(
        'Error creating rack:',
        error
      );

      return {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : 'Failed to create rack.'
      };
    }
  };


  const deduceRack = async (
    rackId: string
  ): Promise<{ success: boolean; message: string }> => {

    if (!isAdmin) {
      return {
        success: false,
        message:
          'Only Admin can deduce/remove inventory racks!'
      };
    }


    const targetRack =
      racks.find(
        rack =>
          rack.id === rackId
      );


    if (!targetRack) {
      return {
        success: false,
        message:
          'Rack not found!'
      };
    }


    // General Shelf is our persistent fallback location.
    if (
      targetRack.name
        .trim()
        .toLowerCase() ===
      'general shelf'
    ) {
      return {
        success: false,
        message:
          'General Shelf is the default fallback rack and cannot be removed.'
      };
    }


    const medicinesInRack =
      medicines.filter(
        medicine =>
          medicine.rackLocation
            .toLowerCase() ===
          targetRack.name
            .toLowerCase()
      );


    try {

      // ------------------------------------------------------
      // Ensure General Shelf exists in PostgreSQL.
      // ------------------------------------------------------

      let generalShelf =
        racks.find(
          rack =>
            rack.name
              .trim()
              .toLowerCase() ===
            'general shelf'
        );


      if (
        medicinesInRack.length > 0 &&
        !generalShelf
      ) {

        const shelfResponse =
          await apiRequest<{
            success: boolean;
            message?: string;
            data: {
              id: string;
              rackCode?: string;
              name: string;
              description?: string;
              createdAt?: string;
            };
          }>('/racks', {
            method:
              'POST',

            body:
              JSON.stringify({
                name:
                  'General Shelf',

                description:
                  'Default inventory shelf for unassigned medicines'
              })
          });


        generalShelf = {
          id:
            shelfResponse.data.id,

          name:
            shelfResponse.data.name,

          description:
            shelfResponse.data.description ||
            'Default inventory shelf for unassigned medicines',

          createdAt:
            shelfResponse.data.createdAt ||
            new Date().toISOString()
        };


        const newGeneralShelf =
          generalShelf;


        setRacks(prev => {

          const alreadyExists =
            prev.some(
              rack =>
                rack.id ===
                  newGeneralShelf.id ||
                rack.name
                  .trim()
                  .toLowerCase() ===
                  'general shelf'
            );

          return alreadyExists
            ? prev
            : [
                ...prev,
                newGeneralShelf
              ];
        });
      }


      // ------------------------------------------------------
      // Persist every affected medicine to General Shelf
      // BEFORE deleting its previous rack.
      //
      // This preserves existing pharmacy business logic and
      // avoids backend onDelete:SetNull changing them to
      // unassigned.
      // ------------------------------------------------------

      for (
        const medicine of
        medicinesInRack
      ) {

        await apiRequest<{
          success: boolean;
          message?: string;
          data: Medicine;
        }>(
          `/inventory/${encodeURIComponent(
            medicine.id
          )}`,
          {
            method:
              'PUT',

            body:
              JSON.stringify({
                rackLocation:
                  'General Shelf'
              })
          }
        );


        // Update local state only after PostgreSQL succeeds.
        setMedicines(prev =>
          prev.map(item =>
            item.id ===
            medicine.id
              ? {
                  ...item,
                  rackLocation:
                    'General Shelf'
                }
              : item
          )
        );
      }


      // ------------------------------------------------------
      // Delete the old rack from PostgreSQL.
      // ------------------------------------------------------

      const deleteResponse =
        await apiRequest<{
          success: boolean;
          message?: string;
        }>(
          `/racks/${encodeURIComponent(
            rackId
          )}`,
          {
            method:
              'DELETE'
          }
        );


      // Remove rack locally only after backend confirms delete.
      setRacks(prev =>
        prev.filter(
          rack =>
            rack.id !==
            rackId
        )
      );


      return {
        success: true,

        message:
          medicinesInRack.length > 0
            ? `Rack "${targetRack.name}" removed successfully. (${medicinesInRack.length} items moved to General Shelf).`
            : (
                deleteResponse.message ||
                `Rack "${targetRack.name}" removed successfully.`
              )
      };

    } catch (error) {

      console.error(
        'Error removing rack:',
        error
      );


      return {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : 'Failed to remove rack.'
      };
    }
  };


  // User actions
  const setCurrentUser = (user: PharmacyUser) => {
    setCurrentUserId(user.id);
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, user.id);
  };

  const addUser = (
    userData: Omit<PharmacyUser, 'id' | 'createdAt'>
  ): PharmacyUser => {

    const temporaryId =
      `tmp-user-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 6)}`;

    const temporaryUser: PharmacyUser = {
      ...userData,
      id: temporaryId,
      createdAt: new Date().toISOString()
    };

    // Optimistic UI update.
    setUsers(prev => [...prev, temporaryUser]);

    void apiRequest<{
      success: boolean;
      message?: string;
      user: PharmacyUser;
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    })
      .then(res => {
        const serverUser = {
          ...res.user,

          // Backend intentionally never sends passwords.
          password: ''
        } as PharmacyUser;

        setUsers(prev =>
          prev.map(user =>
            user.id === temporaryId
              ? serverUser
              : user
          )
        );
      })
      .catch(error => {
        // Roll back optimistic row if database write fails.
        setUsers(prev =>
          prev.filter(user => user.id !== temporaryId)
        );

        console.error(
          'Failed to create staff user:',
          error
        );

        alert(
          error instanceof Error
            ? error.message
            : 'Failed to create staff user.'
        );
      });

    return temporaryUser;
  };

  const updateUser = (
    id: string,
    updates: Partial<PharmacyUser>
  ) => {

    const previousUser =
      users.find(user => user.id === id);

    // Preserve existing immediate UI behaviour.
    setUsers(prev =>
      prev.map(user =>
        user.id === id
          ? { ...user, ...updates }
          : user
      )
    );

    void apiRequest<{
      success: boolean;
      message?: string;
      user: PharmacyUser;
    }>(`/auth/users/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
      .then(res => {
        const serverUser = {
          ...res.user,
          password: ''
        } as PharmacyUser;

        setUsers(prev =>
          prev.map(user =>
            user.id === id
              ? serverUser
              : user
          )
        );
      })
      .catch(error => {
        // Roll back if backend rejects the update.
        if (previousUser) {
          setUsers(prev =>
            prev.map(user =>
              user.id === id
                ? previousUser
                : user
            )
          );
        }

        console.error(
          'Failed to update staff user:',
          error
        );

        alert(
          error instanceof Error
            ? error.message
            : 'Failed to update staff user.'
        );
      });
  };

  const deleteUser = (id: string) => {
    if (users.length <= 1) {
      alert(
        'Cannot delete the only existing staff account!'
      );
      return;
    }

    if (currentUserId === id) {
      alert(
        'You cannot delete the account that is currently signed in.'
      );
      return;
    }

    const deletedUser =
      users.find(user => user.id === id);

    const previousUsers = [...users];

    // Optimistic removal.
    setUsers(prev =>
      prev.filter(user => user.id !== id)
    );

    void apiRequest<{
      success: boolean;
      message?: string;
    }>(`/auth/users/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
      .catch(error => {
        // Restore list if database delete fails.
        setUsers(previousUsers);

        console.error(
          'Failed to delete staff user:',
          error
        );

        alert(
          error instanceof Error
            ? error.message
            : `Failed to delete ${
                deletedUser?.name || 'staff user'
              }.`
        );
      });
  };

  // Inventory actions
  const addMedicine = (
    medData: Omit<Medicine, 'id'>
  ): Medicine => {

    const temporaryId =
      `tmp-med-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 6)}`;

    const temporaryMedicine: Medicine = {
      ...medData,
      id: temporaryId
    };

    // Preserve existing immediate UI behaviour.
    setMedicines(prev => [
      temporaryMedicine,
      ...prev
    ]);

    void apiRequest<{
      success: boolean;
      message?: string;
      data: Medicine;
    }>('/inventory', {
      method: 'POST',
      body: JSON.stringify(medData),
    })
      .then(res => {
        const serverMedicine = {
          ...res.data,

          // Supplier fields are not yet in the backend DTO.
          supplierId:
            res.data.supplierId ||
            medData.supplierId ||
            '',

          supplierName:
            res.data.supplierName ||
            medData.supplierName ||
            ''
        } as Medicine;

        setMedicines(prev =>
          prev.map(medicine =>
            medicine.id === temporaryId
              ? serverMedicine
              : medicine
          )
        );
      })
      .catch(error => {
        // Remove temporary medicine if database insert fails.
        setMedicines(prev =>
          prev.filter(
            medicine =>
              medicine.id !== temporaryId
          )
        );

        console.error(
          'Failed to create medicine:',
          error
        );

        alert(
          error instanceof Error
            ? error.message
            : 'Failed to create medicine.'
        );
      });

    return temporaryMedicine;
  };

  const updateMedicine = (
    id: string,
    updates: Partial<Medicine>
  ) => {

    const previousMedicine =
      medicines.find(medicine => medicine.id === id);

    // Existing synchronous local behaviour remains intact.
    setMedicines(prev =>
      prev.map(medicine =>
        medicine.id === id
          ? { ...medicine, ...updates }
          : medicine
      )
    );

    // Temporary records have not received their DB MED-xxx
    // identifier yet. Their POST request will create them.
    if (id.startsWith('tmp-med-')) {
      return;
    }

    void apiRequest<{
      success: boolean;
      message?: string;
      data: Medicine;
    }>(`/inventory/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
      .then(res => {
        setMedicines(prev =>
          prev.map(medicine => {
            if (medicine.id !== id) {
              return medicine;
            }

            return {
              ...medicine,
              ...res.data,

              supplierId:
                res.data.supplierId ||
                medicine.supplierId ||
                '',

              supplierName:
                res.data.supplierName ||
                medicine.supplierName ||
                ''
            } as Medicine;
          })
        );
      })
      .catch(error => {
        // Restore previous record if database update fails.
        if (previousMedicine) {
          setMedicines(prev =>
            prev.map(medicine =>
              medicine.id === id
                ? previousMedicine
                : medicine
            )
          );
        }

        console.error(
          'Failed to update medicine:',
          error
        );

        alert(
          error instanceof Error
            ? error.message
            : 'Failed to update medicine.'
        );
      });
  };

  const deleteMedicine = (id: string) => {
    const previousMedicines = [...medicines];

    // Existing immediate UI behaviour.
    setMedicines(prev =>
      prev.filter(medicine => medicine.id !== id)
    );

    // Unsaved temporary medicine can simply be removed locally.
    if (id.startsWith('tmp-med-')) {
      return;
    }

    void apiRequest<{
      success: boolean;
      message?: string;
    }>(`/inventory/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
      .catch(error => {
        // Restore inventory if backend delete fails.
        setMedicines(previousMedicines);

        console.error(
          'Failed to delete medicine:',
          error
        );

        alert(
          error instanceof Error
            ? error.message
            : 'Failed to delete medicine.'
        );
      });
  };

  const bulkImportMedicines = async (
    newMeds: Medicine[],
    mode: 'merge' | 'replace' | 'skip' = 'merge'
  ) => {
    const res = await apiRequest<{
      success: boolean;
      message: string;
      mode: string;
      summary: {
        received: number;
        created: number;
        updated: number;
        skipped: number;
        errors: number;
      };
      data: {
        created: any[];
        updated: any[];
        skipped: any[];
        errors: any[];
      };
    }>('/inventory/bulk', {
      method: 'POST',
      body: JSON.stringify({
        mode,
        items: newMeds,
      }),
    });

    // Re-fetch fresh live inventory from PostgreSQL
    try {
      const invRes = await apiRequest<{ data: any[] }>('/inventory?limit=all');
      if (Array.isArray(invRes.data)) {
        const liveMedicines: Medicine[] = invRes.data.map((item: any) => ({
          ...item,
          supplierId: item.supplierId || '',
          supplierName: item.supplierName || '',
        }));
        setMedicines(liveMedicines);
      }
    } catch (fetchErr) {
      console.error('Failed to reload inventory after bulk import:', fetchErr);
    }

    return res;
  };

  // Physical Stock Count & Audits (Reconcile / Add / Deduce)
  const recordStockAdjustment = (data: {
    medicineId: string;
    type: 'reconcile' | 'add' | 'deduce';
    countedPacks?: number;
    countedLoose?: number;
    addedPacks?: number;
    addedLoose?: number;
    reason: StockAdjustmentLog['reason'];
    notes: string;
    recordedBy?: string;
  }) => {
    const target = medicines.find(m => m.id === data.medicineId);
    if (!target) return;

    const prevPacks = target.stockPacks;
    const prevLoose = target.stockLooseUnits;
    const prevTotalUnits = (prevPacks * target.unitsPerPack) + prevLoose;

    let newPacks = prevPacks;
    let newLoose = prevLoose;
    let netVarianceUnits = 0;
    let deltaPacks = 0;
    let deltaLoose = 0;

    if (data.type === 'reconcile') {
      newPacks = Math.max(0, data.countedPacks ?? prevPacks);
      newLoose = Math.max(0, data.countedLoose ?? prevLoose);
      const newTotalUnits = (newPacks * target.unitsPerPack) + newLoose;
      netVarianceUnits = newTotalUnits - prevTotalUnits;
      deltaPacks = newPacks - prevPacks;
      deltaLoose = newLoose - prevLoose;
    } else if (data.type === 'add') {
      deltaPacks = data.addedPacks || 0;
      deltaLoose = data.addedLoose || 0;
      let totalUnits = prevTotalUnits + (deltaPacks * target.unitsPerPack) + deltaLoose;
      if (totalUnits < 0) totalUnits = 0;
      
      newPacks = Math.floor(totalUnits / target.unitsPerPack);
      newLoose = totalUnits % target.unitsPerPack;
      netVarianceUnits = totalUnits - prevTotalUnits;
    } else if (data.type === 'deduce') {
      deltaPacks = -(data.addedPacks || 0);
      deltaLoose = -(data.addedLoose || 0);
      let totalUnits = prevTotalUnits + (deltaPacks * target.unitsPerPack) + deltaLoose;
      if (totalUnits < 0) totalUnits = 0;

      newPacks = Math.floor(totalUnits / target.unitsPerPack);
      newLoose = totalUnits % target.unitsPerPack;
      netVarianceUnits = totalUnits - prevTotalUnits;
    }

    // Update medicine stock
    updateMedicine(target.id, {
      stockPacks: newPacks,
      stockLooseUnits: newLoose
    });

    // Record adjustment log
    const log: StockAdjustmentLog = {
      id: `adj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      medicineId: target.id,
      medicineName: target.name,
      genericName: target.genericName,
      batchNumber: target.batchNumber,
      type: data.type,
      previousPacks: prevPacks,
      previousLoose: prevLoose,
      previousTotalUnits: prevTotalUnits,
      addedPacks: deltaPacks,
      addedLoose: deltaLoose,
      newPacks,
      newLoose,
      newTotalUnits: (newPacks * target.unitsPerPack) + newLoose,
      netVarianceUnits,
      reason: data.reason,
      notes: data.notes,
      timestamp: new Date().toISOString(),
      recordedBy: data.recordedBy || currentUser?.name || 'Pharmacist'
    };

    setStockAdjustments(prev => [log, ...prev]);
  };

  const submitStockAdjustment = async (data: {
    medicineId: string;
    type: 'reconcile' | 'add' | 'deduce';
    countedPacks?: number;
    countedLoose?: number;
    addedPacks?: number;
    addedLoose?: number;
    reason: StockAdjustmentLog['reason'];
    notes: string;
  }) => {
    const target = medicines.find(medicine => medicine.id === data.medicineId);
    if (!target) {
      throw new Error('The selected medicine is no longer in inventory.');
    }

    const currentUnits =
      target.stockPacks * target.unitsPerPack + target.stockLooseUnits;
    let newPacks: number;
    let newLooseUnits: number;

    if (data.type === 'reconcile') {
      newPacks = Math.max(0, data.countedPacks ?? target.stockPacks);
      newLooseUnits = Math.max(0, data.countedLoose ?? target.stockLooseUnits);
    } else {
      const packChange = Math.max(0, data.addedPacks ?? 0) * target.unitsPerPack;
      const looseChange = Math.max(0, data.addedLoose ?? 0);
      const nextUnits = data.type === 'add'
        ? currentUnits + packChange + looseChange
        : currentUnits - packChange - looseChange;

      if (nextUnits < 0) {
        throw new Error('Stock deduction cannot exceed the current inventory.');
      }

      newPacks = Math.floor(nextUnits / target.unitsPerPack);
      newLooseUnits = nextUnits % target.unitsPerPack;
    }

    const reasonType: Record<StockAdjustmentLog['reason'], string> = {
      'Physical Count Audit': 'AUDIT',
      'Damaged / Broken Strip': 'DAMAGE',
      'Expired Medicine Disposal': 'DISPOSAL',
      'Found Unrecorded Stock / Bonus': 'OTHER',
      'Theft / Shrinkage Loss': 'SHRINKAGE',
      'Supplier Return / Correction': 'CORRECTION',
      'Breakage in Transit': 'CORRECTION',
      'Sample / Free Dispensation': 'OTHER',
      'Other Adjustment': 'OTHER',
    };

    const response = await apiRequest<{
      data: {
        inventory: any;
        adjustment: any;
      };
    }>(`/inventory/${encodeURIComponent(target.id)}/adjust`, {
      method: 'POST',
      body: JSON.stringify({
        type: reasonType[data.reason],
        newPacks,
        newLooseUnits,
        reason: data.reason,
      }),
    });

    const updatedInventory = response.data.inventory;
    setMedicines(previous =>
      previous.map(medicine =>
        medicine.id === target.id
          ? {
              ...medicine,
              ...updatedInventory,
              supplierId: updatedInventory.supplierId || '',
              supplierName: updatedInventory.supplierName || '',
            }
          : medicine
      )
    );

    const adjustment = mapBackendAdjustment({
      ...response.data.adjustment,
      medicineId: target.id,
      medicineName: target.name,
      genericName: target.genericName,
      batchNumber: target.batchNumber,
      previousTotalUnits: target.stockPacks * target.unitsPerPack + target.stockLooseUnits,
      newTotalUnits: newPacks * target.unitsPerPack + newLooseUnits,
      netVarianceUnits:
        newPacks * target.unitsPerPack +
        newLooseUnits -
        (target.stockPacks * target.unitsPerPack + target.stockLooseUnits),
      notes: data.notes || data.reason,
      timestamp: response.data.adjustment.createdAt,
    });
    setStockAdjustments(previous => [adjustment, ...previous]);
  };

  // Batch shelf worksheet audit
  const batchReconcileRack = (adjustments: {
    medicineId: string;
    countedPacks: number;
    countedLoose: number;
    notes: string;
    reason: StockAdjustmentLog['reason'];
  }[]) => {
    adjustments.forEach(item => {
      recordStockAdjustment({
        medicineId: item.medicineId,
        type: 'reconcile',
        countedPacks: item.countedPacks,
        countedLoose: item.countedLoose,
        reason: item.reason,
        notes: item.notes || 'Batch Shelf Worksheet Audit'
      });
    });
  };

  // Stockists / Distributors - PostgreSQL backend

  const fetchDistributorLedgers = async (
    distributorList: Stockist[]
  ): Promise<StockistLedgerEntry[]> => {

    if (distributorList.length === 0) {
      return [];
    }

    const ledgerGroups =
      await Promise.all(
        distributorList.map(
          async (
            stockist
          ): Promise<StockistLedgerEntry[]> => {

            try {

              const response =
                await apiRequest<{
                  data: any[];
                }>(
                  '/distributors/' +
                    encodeURIComponent(
                      stockist.id
                    ) +
                    '/ledger'
                );

              if (
                !Array.isArray(
                  response.data
                )
              ) {
                return [];
              }

              return response.data.map(
                (
                  item: any
                ): StockistLedgerEntry => ({
                  id:
                    String(item.id),

                  // Always use the stockist ID from the
                  // distributor currently being fetched.
                  // This guarantees frontend filtering matches.
                  stockistId:
                    stockist.id,

                  date:
                    item.date ||
                    new Date()
                      .toISOString()
                      .split('T')[0],

                  refType:
                    item.refType,

                  refId:
                    item.refId ||
                    String(item.id),

                  refNumber:
                    item.refNumber || '',

                  description:
                    item.description || '',

                  debit:
                    Number(
                      item.debit || 0
                    ),

                  credit:
                    Number(
                      item.credit || 0
                    ),

                  balance:
                    Number(
                      item.balance || 0
                    )
                })
              );

            } catch (error) {

              console.error(
                'Failed to load ledger for distributor:',
                stockist.id,
                error
              );

              return [];
            }
          }
        )
      );


    const allLedgers =
      ledgerGroups.flat();


    allLedgers.sort(
      (a, b) =>
        new Date(b.date).getTime() -
        new Date(a.date).getTime()
    );


    return allLedgers;
  };


  const refreshLiveStockists = async (): Promise<Stockist[]> => {
    const response =
      await apiRequest<{ data: Stockist[] }>(
        '/distributors?limit=all'
      );

    const liveStockists =
      Array.isArray(response.data)
        ? response.data
        : [];

    setStockists(liveStockists);

    return liveStockists;
  };

 
  const refreshLiveLedgers = async (
    distributorList: Stockist[]
  ): Promise<StockistLedgerEntry[]> => {

    const liveLedgers =
      await fetchDistributorLedgers(
        distributorList
      );

    setStockistLedgers(
      liveLedgers
    );

    return liveLedgers;
  };


  const refreshLivePurchases =
    async (): Promise<StockistPurchaseInvoice[]> => {

      const response =
        await apiRequest<{
          data: StockistPurchaseInvoice[];
        }>(
          '/purchases?limit=all'
        );

      const livePurchases =
        Array.isArray(response.data)
          ? response.data
          : [];

      setPurchaseInvoices(livePurchases);

      return livePurchases;
    };


  const refreshLiveInventory = async () => {
    const response =
      await apiRequest<{ data: any[] }>(
        '/inventory?limit=all'
      );

    if (!Array.isArray(response.data)) {
      return;
    }

    const liveMedicines: Medicine[] =
      response.data.map((item: any) => ({
        ...item,
        supplierId: item.supplierId || '',
        supplierName: item.supplierName || ''
      }));

    setMedicines(liveMedicines);
  };


  const addStockist = async (
    stkData: Omit<Stockist, 'id' | 'currentBalance'>
  ): Promise<Stockist> => {

    const response =
      await apiRequest<{ data?: Stockist }>(
        '/distributors',
        {
          method: 'POST',
          body: JSON.stringify({
            name: stkData.name,
            phone: stkData.phone,
            panNumber: stkData.panNumber,
            address: stkData.address,
            contactPerson: stkData.contactPerson,
            creditLimit: stkData.creditLimit,
            email: stkData.email
          })
        }
      );

    const liveStockists =
      await refreshLiveStockists();

    const created =
      response.data ||
      liveStockists.find(
        stockist =>
          stockist.name === stkData.name &&
          stockist.panNumber === stkData.panNumber
      );

    if (!created) {
      throw new Error(
        'Distributor was created but could not be reloaded.'
      );
    }

    return created;
  };


  const updateStockist = async (
    id: string,
    updates: Partial<Stockist>
  ): Promise<void> => {

    const payload: Record<string, unknown> = {};

    if (updates.name !== undefined)
      payload.name = updates.name;

    if (updates.phone !== undefined)
      payload.phone = updates.phone;

    if (updates.panNumber !== undefined)
      payload.panNumber = updates.panNumber;

    if (updates.address !== undefined)
      payload.address = updates.address;

    if (updates.contactPerson !== undefined)
      payload.contactPerson = updates.contactPerson;

    if (updates.creditLimit !== undefined)
      payload.creditLimit = updates.creditLimit;

    if (updates.email !== undefined)
      payload.email = updates.email;


    // Some old frontend-only workflows still update only the
    // displayed balance. Do not send an empty PUT to PostgreSQL.
    if (Object.keys(payload).length === 0) {
      setStockists(prev =>
        prev.map(stockist =>
          stockist.id === id
            ? { ...stockist, ...updates }
            : stockist
        )
      );

      return;
    }


    await apiRequest(
      '/distributors/' + encodeURIComponent(id),
      {
        method: 'PUT',
        body: JSON.stringify(payload)
      }
    );

    await refreshLiveStockists();
  };


  // Purchase Invoices - backend transaction is authoritative.
  // Do NOT manually update inventory or supplier balance here.
  const addPurchaseInvoice = async (
    invData: Omit<
      StockistPurchaseInvoice,
      'id' | 'createdAt'
    >
  ): Promise<StockistPurchaseInvoice> => {

    const response =
      await apiRequest<{
        data?: StockistPurchaseInvoice;
      }>(
        '/purchases',
        {
          method: 'POST',
          body: JSON.stringify(invData)
        }
      );


    const [
      livePurchases,
      liveStockists
    ] = await Promise.all([
      refreshLivePurchases(),
      refreshLiveStockists(),
      refreshLiveInventory()
    ]);

    await refreshLiveLedgers(
      liveStockists
    );


    const created =
      response.data ||
      livePurchases.find(
        invoice =>
          invoice.invoiceNumber ===
          invData.invoiceNumber
      );

    if (!created) {
      throw new Error(
        'Purchase was saved but could not be reloaded.'
      );
    }

    return created;
  };


  // Supplier payment - backend updates running balance
  // and creates the debit ledger entry transactionally.
  const addStockistPayment = async (
    stockistId: string,
    amount: number,
    paymentMode: string,
    refNumber: string,
    notes: string
  ): Promise<void> => {

    await apiRequest(
      '/distributors/' +
        encodeURIComponent(stockistId) +
        '/payments',
      {
        method: 'POST',
        body: JSON.stringify({
          amount,
          paymentMode,
          refNumber,
          notes
        })
      }
    );

    const liveStockists =
      await refreshLiveStockists();

    await refreshLiveLedgers(
      liveStockists
    );
  };


  // Stockist Returns (Return Damaged / Expired / Breakage to wholesaler)
  const recordStockistReturn = (
    voucherData: Omit<StockistReturnVoucher, 'id' | 'createdAt'>
  ): StockistReturnVoucher => {
    const newVoucher: StockistReturnVoucher = {
      ...voucherData,
      id: `ret-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      createdAt: new Date().toISOString()
    };

    // 1. Deduct items from inventory & record audit
    voucherData.items.forEach(item => {
      const med = medicines.find(m => m.id === item.medicineId);
      if (med) {
        recordStockAdjustment({
          medicineId: med.id,
          type: 'deduce',
          addedPacks: item.packs,
          addedLoose: item.looseUnits,
          reason: 'Supplier Return / Correction',
          notes: `Returned to ${voucherData.stockistName} via Debit Note #${voucherData.debitNoteNumber}. Reason: ${item.reason}`,
          recordedBy: 'Pharmacist'
        });
      }
    });

    // 2. Post Debit Note to stockist ledger (Reduces what we owe the wholesaler!)
    const stockist = stockists.find(s => s.id === voucherData.stockistId);
    const currentBalance = stockist ? stockist.currentBalance : 0;
    const newBalance = currentBalance - voucherData.totalAmount;

    const ledgerEntry: StockistLedgerEntry = {
      id: `led-ret-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      stockistId: voucherData.stockistId,
      date: voucherData.date,
      refType: 'return_debit_note',
      refId: newVoucher.id,
      refNumber: voucherData.debitNoteNumber,
      description: `Debit Note #${voucherData.debitNoteNumber}: Return of Damaged/Expired medicines (${voucherData.items.length} items)`,
      debit: voucherData.totalAmount, // Debit reduces our liability
      credit: 0,
      balance: newBalance
    };

    setStockistLedgers(prev => [ledgerEntry, ...prev]);
    if (stockist) {
      updateStockist(stockist.id, { currentBalance: newBalance });
    }

    setStockistReturns(prev => [newVoucher, ...prev]);
    return newVoucher;
  };

  // POS Complete Sale
  const completeSale = (
    saleData: Omit<SaleInvoice, 'id' | 'invoiceNumber' | 'createdAt' | 'fiscalYear'>
  ): SaleInvoice => {
    const now = new Date();
    const invoicePrefix = settings.invoicePrefix || 'PP-2081/82-';
    const lastUsedInvoiceNumber = salesInvoices.reduce((highest, sale) => {
      if (!sale.invoiceNumber.startsWith(invoicePrefix)) return highest;
      const suffix = Number(sale.invoiceNumber.slice(invoicePrefix.length));
      return Number.isInteger(suffix) ? Math.max(highest, suffix) : highest;
    }, 0);
    const invoiceSequence = Math.max(
      settings.nextInvoiceNumber || 101,
      lastUsedInvoiceNumber + 1
    );
    const invoiceSeq = invoiceSequence.toString().padStart(5, '0');
    const invoiceNumber = `${invoicePrefix}${invoiceSeq}`;
    setSettings(prev => ({ ...prev, nextInvoiceNumber: invoiceSequence + 1 }));

    const newInvoice: SaleInvoice = {
      ...saleData,
      id: `sal-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      invoiceNumber,
      fiscalYear: settings.fiscalYear,
      cashierName: saleData.cashierName || currentUser?.name || 'Cashier',
      cashierId: saleData.cashierId || currentUser?.id,
      createdAt: now.toISOString()
    };

    // Do not mutate inventory locally before checkout succeeds.
    // The backend /bills transaction is the single source of truth
    // for FEFO allocation and stock deduction.
    setSalesInvoices(prev => [newInvoice, ...prev]);

    // Reload inventory from PostgreSQL after checkout so the UI always
    // reflects the stock actually committed by the backend FEFO transaction.
    const reloadInventoryAfterSale = async () => {
      const inventoryResponse =
        await apiRequest<{ data: any[] }>(
          '/inventory?limit=all'
        );

      if (Array.isArray(inventoryResponse.data)) {
        const liveMedicines: Medicine[] =
          inventoryResponse.data.map((item: any) => ({
            ...item,
            supplierId: item.supplierId || '',
            supplierName: item.supplierName || '',
          }));

        setMedicines(liveMedicines);
      }
    };

    // Persist sale invoice to backend database.
    // The backend atomically:
    //   1. validates non-expired stock,
    //   2. applies FEFO across batches,
    //   3. deducts inventory,
    //   4. creates bill + bill items.
    void apiRequest<{
      success: boolean;
      data: SaleInvoice;
    }>('/bills', {
      method: 'POST',
      body: JSON.stringify({
        ...saleData,
        invoiceNumber,
        cashierId:
          saleData.cashierId ||
          currentUser?.id,
      }),
    })
      .then(async res => {
        if (res.data) {
          localStorage.setItem(SALES_DEMO_STATUS_KEY, 'dismissed');
          setIsSalesDemoDataActive(false);
          setSalesInvoices(prev =>
            prev.map(inv =>
              inv.id === newInvoice.id ||
              inv.invoiceNumber ===
                newInvoice.invoiceNumber
                ? res.data
                : inv
            )
          );
        }

        try {
          await reloadInventoryAfterSale();
        } catch (reloadError) {
          console.error(
            'Sale succeeded but inventory refresh failed:',
            reloadError
          );
        }
      })
      .catch(async error => {
        // The backend transaction failed, therefore remove the
        // optimistic invoice from the local sales list.
        setSalesInvoices(prev =>
          prev.filter(
            inv =>
              inv.id !== newInvoice.id &&
              inv.invoiceNumber !==
                newInvoice.invoiceNumber
          )
        );

        // Reload real stock from PostgreSQL in case the UI was stale.
        try {
          await reloadInventoryAfterSale();
        } catch (reloadError) {
          console.error(
            'Failed to reload inventory after rejected sale:',
            reloadError
          );
        }

        console.error(
          'Failed to persist sales bill to database:',
          error
        );

        alert(
          error instanceof Error
            ? error.message
            : 'Sale could not be completed.'
        );
      });
    return newInvoice;
  };

  const clearSalesDemoData = () => {
    localStorage.setItem(SALES_DEMO_STATUS_KEY, 'dismissed');
    setIsSalesDemoDataActive(false);
  };

  const updateSettings = (updates: Partial<PharmacySettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const clearLocalData = () => {
    setMedicines([]);
    setStockists([]);
    setPurchaseInvoices([]);
    setStockistLedgers([]);
    setStockAdjustments([]);
    setStockistReturns([]);
    setSalesInvoices([]);
    setSettings(defaultSettings);
    setUsers([]);
    setCurrentUserId('');
    setRacks([]);
    setIsAuthenticated(false);
    localStorage.removeItem('prakash_auth_token');

    localStorage.removeItem(STORAGE_KEYS.MEDICINES);
    localStorage.removeItem(STORAGE_KEYS.STOCKISTS);
    localStorage.removeItem(STORAGE_KEYS.INVOICES);
    localStorage.removeItem(STORAGE_KEYS.LEDGERS);
    localStorage.removeItem(STORAGE_KEYS.ADJUSTMENTS);
    localStorage.removeItem(STORAGE_KEYS.RETURNS);
    localStorage.removeItem(STORAGE_KEYS.SALES);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.USERS);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_ID);
    localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
    localStorage.removeItem(STORAGE_KEYS.RACKS);
    localStorage.setItem(STOCKIST_DEMO_STATUS_KEY, 'dismissed');
    setIsStockistDemoDataActive(false);
    localStorage.setItem(SALES_DEMO_STATUS_KEY, 'dismissed');
    setIsSalesDemoDataActive(false);
  };

  return (
    <PharmacyContext.Provider
      value={{
        isAuthenticated,
        login,
        logout,
        isAdmin,
        changeStaffPassword,

        users,
        currentUser,
        setCurrentUser,
        addUser,
        updateUser,
        deleteUser,

        racks,
        addRack,
        deduceRack,

        medicines,
        addMedicine,
        updateMedicine,
        deleteMedicine,
        bulkImportMedicines,

        stockAdjustments,
        inventoryBackendStatus,
        inventoryBackendError,
        stockAdjustmentHistoryBackendStatus,
        stockAdjustmentHistoryBackendError,
        recordStockAdjustment,
        submitStockAdjustment,
        batchReconcileRack,

        stockists,
        isStockistDemoDataActive,
        clearStockistDemoData,
        addStockist,
        updateStockist,

        purchaseInvoices,
        addPurchaseInvoice,

        stockistLedgers,
        addStockistPayment,

        stockistReturns,
        recordStockistReturn,

        salesInvoices,
        isSalesDemoDataActive,
        clearSalesDemoData,
        completeSale,

        settings,
        updateSettings,

        activeVatInfoMedicine,
        setActiveVatInfoMedicine,
        activeAuditMedicine,
        setActiveAuditMedicine,
        activeInvoiceToPrint,
        setActiveInvoiceToPrint,
        activeDebitNoteToPrint,
        setActiveDebitNoteToPrint,

        clearLocalData
      }}
    >
      {children}
    </PharmacyContext.Provider>
  );
};

export const usePharmacy = () => {
  const context = useContext(PharmacyContext);
  if (!context) {
    throw new Error('usePharmacy must be used within a PharmacyProvider');
  }
  return context;
};
