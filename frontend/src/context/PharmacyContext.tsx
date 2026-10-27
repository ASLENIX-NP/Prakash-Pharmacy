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
  RackLocation,
  UserRole
} from '../types/pharmacy';
import {
  initialMedicines,
  initialStockists,
  initialPurchaseInvoices,
  initialStockistLedgers,
  initialAdjustmentLogs,
  initialSalesInvoices,
  initialSettings,
  initialUsers,
  initialRacks
} from '../data/initialData';

interface PharmacyContextType {
  // Authentication & Credentials
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  isAdmin: boolean;
  changeStaffPassword: (userId: string, newPassword: string) => { success: boolean; message: string };
  resetDefaultCredentials: () => void;

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
  batchReconcileRack: (adjustments: {
    medicineId: string;
    countedPacks: number;
    countedLoose: number;
    notes: string;
    reason: StockAdjustmentLog['reason'];
  }[]) => void;

  // Stockists & Wholesalers
  stockists: Stockist[];
  addStockist: (stockist: Omit<Stockist, 'id' | 'currentBalance'>) => Stockist;
  updateStockist: (id: string, updates: Partial<Stockist>) => void;
  
  // Purchase Invoices
  purchaseInvoices: StockistPurchaseInvoice[];
  addPurchaseInvoice: (invoice: Omit<StockistPurchaseInvoice, 'id' | 'createdAt'>) => StockistPurchaseInvoice;

  // Stockist Ledger & Payments
  stockistLedgers: StockistLedgerEntry[];
  addStockistPayment: (
    stockistId: string,
    amount: number,
    paymentMode: string,
    refNumber: string,
    notes: string
  ) => void;

  // Returns to Wholesaler (Damaged / Expired / Breakage)
  stockistReturns: StockistReturnVoucher[];
  recordStockistReturn: (voucher: Omit<StockistReturnVoucher, 'id' | 'createdAt'>) => StockistReturnVoucher;

  // Sales & POS Billing
  salesInvoices: SaleInvoice[];
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
  resetToDefaultData: () => void;
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

export const PharmacyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<PharmacyUser[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Auto-repair any cached user missing password or invalid structure
          const repaired: PharmacyUser[] = parsed.map((u: PharmacyUser) => {
            const def = initialUsers.find(initU => initU.id === u.id || initU.username === u.username);
            return {
              ...u,
              password: u.password || (def ? def.password : (u.role === 'Admin' ? 'admin123' : 'staff123')),
              pinCode: u.pinCode || (def ? def.pinCode : '1234'),
              role: (u.role === 'Admin' ? 'Admin' : 'Staff') as UserRole,
              isActive: u.isActive !== undefined ? u.isActive : true
            };
          });
          // Ensure admin user exists
          if (!repaired.some(u => u.role === 'Admin' || u.username === 'admin')) {
            repaired.unshift(initialUsers[0]);
          }
          return repaired;
        }
      }
      return initialUsers;
    } catch {
      return initialUsers;
    }
  });

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
      return saved || (initialUsers[0] ? initialUsers[0].id : 'usr-1');
    } catch {
      return initialUsers[0] ? initialUsers[0].id : 'usr-1';
    }
  });

  const currentUser = React.useMemo(() => {
    return users.find(u => u.id === currentUserId) || users[0] || initialUsers[0];
  }, [users, currentUserId]);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const token = localStorage.getItem('prakash_auth_token');
      const session = localStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
      return Boolean(token && session === 'true');
    } catch {
      return false;
    }
  });

  const [racks, setRacks] = useState<RackLocation[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.RACKS);
      return saved ? JSON.parse(saved) : initialRacks;
    } catch {
      return initialRacks;
    }
  });

  const isAdmin = currentUser?.role === 'Admin';

  const [medicines, setMedicines] = useState<Medicine[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MEDICINES);
      return saved ? JSON.parse(saved) : initialMedicines;
    } catch {
      return initialMedicines;
    }
  });

  const [stockists, setStockists] = useState<Stockist[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STOCKISTS);
      return saved ? JSON.parse(saved) : initialStockists;
    } catch {
      return initialStockists;
    }
  });

  const [purchaseInvoices, setPurchaseInvoices] = useState<StockistPurchaseInvoice[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.INVOICES);
      return saved ? JSON.parse(saved) : initialPurchaseInvoices;
    } catch {
      return initialPurchaseInvoices;
    }
  });

  const [stockistLedgers, setStockistLedgers] = useState<StockistLedgerEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LEDGERS);
      return saved ? JSON.parse(saved) : initialStockistLedgers;
    } catch {
      return initialStockistLedgers;
    }
  });

  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustmentLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ADJUSTMENTS);
      return saved ? JSON.parse(saved) : initialAdjustmentLogs;
    } catch {
      return initialAdjustmentLogs;
    }
  });

  const [stockistReturns, setStockistReturns] = useState<StockistReturnVoucher[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.RETURNS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [salesInvoices, setSalesInvoices] = useState<SaleInvoice[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SALES);
      return saved ? JSON.parse(saved) : initialSalesInvoices;
    } catch {
      return initialSalesInvoices;
    }
  });

  const [settings, setSettings] = useState<PharmacySettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return saved ? JSON.parse(saved) : initialSettings;
    } catch {
      return initialSettings;
    }
  });

  // Modal states
  const [activeVatInfoMedicine, setActiveVatInfoMedicine] = useState<Medicine | null>(null);
  const [activeAuditMedicine, setActiveAuditMedicine] = useState<Medicine | null>(null);
  const [activeInvoiceToPrint, setActiveInvoiceToPrint] = useState<SaleInvoice | null>(null);
  const [activeDebitNoteToPrint, setActiveDebitNoteToPrint] = useState<StockistReturnVoucher | null>(null);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MEDICINES, JSON.stringify(medicines));
  }, [medicines]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STOCKISTS, JSON.stringify(stockists));
  }, [stockists]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(purchaseInvoices));
  }, [purchaseInvoices]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LEDGERS, JSON.stringify(stockistLedgers));
  }, [stockistLedgers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ADJUSTMENTS, JSON.stringify(stockAdjustments));
  }, [stockAdjustments]);

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
      return;
    }

    let cancelled = false;

    const loadBackendData = async () => {

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
        }
      } catch (error) {
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
        }
      } catch (error) {
        console.error(
          'Error fetching live sales invoices:',
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
    };

    void loadBackendData();

    return () => {
      cancelled = true;
    };

  }, [isAuthenticated, isAdmin]);

  // Auth methods
  const resetDefaultCredentials = () => {
    setUsers(initialUsers);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(initialUsers));
  };

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

  // Stockists
  const addStockist = (stkData: Omit<Stockist, 'id' | 'currentBalance'>): Stockist => {
    const newStockist: Stockist = {
      ...stkData,
      id: `stk-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      currentBalance: 0
    };
    setStockists(prev => [...prev, newStockist]);
    return newStockist;
  };

  const updateStockist = (id: string, updates: Partial<Stockist>) => {
    setStockists(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  // Purchase Invoices (Entry of stockist bill)
  const addPurchaseInvoice = (
    invData: Omit<StockistPurchaseInvoice, 'id' | 'createdAt'>
  ): StockistPurchaseInvoice => {
    const newInvoice: StockistPurchaseInvoice = {
      ...invData,
      id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      createdAt: new Date().toISOString()
    };

    // 1. Update/Add items into inventory
    invData.items.forEach(item => {
      // Find matching item by medicine name and batch
      const existing = medicines.find(
        m => m.name.toLowerCase() === item.medicineName.toLowerCase() &&
             m.batchNumber.toLowerCase() === item.batchNumber.toLowerCase()
      );

      const receivedPacks = (item.packQty || 0) + (item.freePacks || 0);

      if (existing) {
        updateMedicine(existing.id, {
          stockPacks: existing.stockPacks + receivedPacks,
          costPrice: item.costPrice,
          mrpPrice: item.mrpPrice > 0 ? item.mrpPrice : existing.mrpPrice,
          expiryDate: item.expiryDate || existing.expiryDate,
          supplierId: invData.stockistId,
          supplierName: invData.stockistName,
          isVatApplicable: item.isVatApplicable,
          rackLocation: item.rackLocation || existing.rackLocation
        });
      } else {
        // Create new item
        addMedicine({
          name: item.medicineName,
          genericName: item.genericName || item.medicineName,
          category: item.category || 'Tablet',
          batchNumber: item.batchNumber || `BAT-${Date.now().toString().slice(-4)}`,
          expiryDate: item.expiryDate || '2027-12-31',
          stockPacks: receivedPacks,
          stockLooseUnits: 0,
          unitsPerPack: item.unitsPerPack || 10,
          costPrice: item.costPrice,
          mrpPrice: item.mrpPrice || item.costPrice * 1.3,
          supplierId: invData.stockistId,
          supplierName: invData.stockistName,
          reorderLevel: 15,
          rackLocation: item.rackLocation || 'Rack A-1',
          isVatApplicable: item.isVatApplicable,
          notes: `Purchased via Invoice #${invData.invoiceNumber}`
        });
      }
    });

    // 2. Post to Stockist Ledger
    const stockist = stockists.find(s => s.id === invData.stockistId);
    const currentBalance = stockist ? stockist.currentBalance : 0;
    const newBalance = currentBalance + (invData.paymentMode === 'credit' ? invData.grandTotal : 0);

    const ledgerEntry: StockistLedgerEntry = {
      id: `led-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      stockistId: invData.stockistId,
      date: invData.date,
      refType: 'purchase_invoice',
      refId: newInvoice.id,
      refNumber: invData.invoiceNumber,
      description: `Purchase Bill #${invData.invoiceNumber} (${invData.items.length} items, Mode: ${invData.paymentMode.toUpperCase()})`,
      debit: invData.paymentMode === 'cash' ? invData.grandTotal : 0,
      credit: invData.grandTotal,
      balance: newBalance
    };

    setStockistLedgers(prev => [ledgerEntry, ...prev]);

    // 3. Update stockist balance if credit
    if (stockist && invData.paymentMode === 'credit') {
      updateStockist(stockist.id, { currentBalance: newBalance });
    }

    setPurchaseInvoices(prev => [newInvoice, ...prev]);
    return newInvoice;
  };

  // Stockist Payments (Settling balance)
  const addStockistPayment = (
    stockistId: string,
    amount: number,
    paymentMode: string,
    refNumber: string,
    notes: string
  ) => {
    const stockist = stockists.find(s => s.id === stockistId);
    if (!stockist) return;

    const newBalance = stockist.currentBalance - amount;

    const ledgerEntry: StockistLedgerEntry = {
      id: `led-pay-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      stockistId,
      date: new Date().toISOString().split('T')[0],
      refType: 'payment_made',
      refId: `pay-${Date.now()}`,
      refNumber: refNumber || `VOUCHER-${Date.now().toString().slice(-4)}`,
      description: `Payment made via ${paymentMode.toUpperCase()} ${notes ? `(${notes})` : ''}`,
      debit: amount,
      credit: 0,
      balance: newBalance
    };

    setStockistLedgers(prev => [ledgerEntry, ...prev]);
    updateStockist(stockistId, { currentBalance: newBalance });
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
    const invoiceSeq = (salesInvoices.length + 101).toString().padStart(5, '0');
    const invoiceNumber = `${settings.invoicePrefix || 'PP-2081/82-'}${invoiceSeq}`;

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

  const updateSettings = (updates: Partial<PharmacySettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const resetToDefaultData = () => {
    setMedicines(initialMedicines);
    setStockists(initialStockists);
    setPurchaseInvoices(initialPurchaseInvoices);
    setStockistLedgers(initialStockistLedgers);
    setStockAdjustments(initialAdjustmentLogs);
    setStockistReturns([]);
    setSalesInvoices(initialSalesInvoices);
    setSettings(initialSettings);
    setUsers(initialUsers);
    setCurrentUserId(initialUsers[0].id);
    setRacks(initialRacks);
    setIsAuthenticated(false);

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
  };

  return (
    <PharmacyContext.Provider
      value={{
        isAuthenticated,
        login,
        logout,
        isAdmin,
        changeStaffPassword,
        resetDefaultCredentials,

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
        recordStockAdjustment,
        batchReconcileRack,

        stockists,
        addStockist,
        updateStockist,

        purchaseInvoices,
        addPurchaseInvoice,

        stockistLedgers,
        addStockistPayment,

        stockistReturns,
        recordStockistReturn,

        salesInvoices,
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

        resetToDefaultData
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

