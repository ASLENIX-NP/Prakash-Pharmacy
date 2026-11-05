import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Menu } from 'lucide-react';

import {
  PharmacyProvider,
  usePharmacy,
} from './context/PharmacyContext';

import {
  Sidebar,
  ActiveTab,
} from './components/Sidebar';
import { LoginView } from './components/LoginView';
import { AslenixCredit } from './components/AslenixCredit';
import { TopInfoBar } from './components/TopInfoBar';
import { VatTaxInfoModal } from './components/VatTaxInfoModal';
import { PhysicalStockAuditModal } from './components/PhysicalStockAuditModal';
import { TaxInvoiceModal } from './components/TaxInvoiceModal';

const DashboardView = lazy(() =>
  import('./components/DashboardView').then(({ DashboardView }) => ({
    default: DashboardView,
  }))
);
const InventoryView = lazy(() =>
  import('./components/InventoryView').then(({ InventoryView }) => ({
    default: InventoryView,
  }))
);
const PhysicalStockWorksheetView = lazy(() =>
  import('./components/PhysicalStockWorksheetView').then(
    ({ PhysicalStockWorksheetView }) => ({
      default: PhysicalStockWorksheetView,
    })
  )
);
const PosView = lazy(() =>
  import('./components/PosView').then(({ PosView }) => ({
    default: PosView,
  }))
);
const StockistManagementView = lazy(() =>
  import('./components/StockistManagementView').then(
    ({ StockistManagementView }) => ({
      default: StockistManagementView,
    })
  )
);
const SalesHistoryView = lazy(() =>
  import('./components/SalesHistoryView').then(({ SalesHistoryView }) => ({
    default: SalesHistoryView,
  }))
);
const ClinicView = lazy(() =>
  import('./components/ClinicView').then(({ ClinicView }) => ({
    default: ClinicView,
  }))
);
const CustomerCreditView = lazy(() =>
  import('./components/CustomerCreditView').then(({ CustomerCreditView }) => ({
    default: CustomerCreditView,
  }))
);

const ReportsView = lazy(() =>
  import('./components/ReportsView').then(({ ReportsView }) => ({
    default: ReportsView,
  }))
);
const SettingsView = lazy(() =>
  import('./components/SettingsView').then(({ SettingsView }) => ({
    default: SettingsView,
  }))
);
const UserManagementView = lazy(() =>
  import('./components/UserManagementView').then(
    ({ UserManagementView }) => ({
      default: UserManagementView,
    })
  )
);

const PharmacyAppContent: React.FC = () => {
  const {
    isAuthenticated,
    isAdmin,

    activeVatInfoMedicine,
    setActiveVatInfoMedicine,

    activeAuditMedicine,
    setActiveAuditMedicine,

    activeInvoiceToPrint,
    setActiveInvoiceToPrint,

    settings,
    updateMedicine,
  } = usePharmacy();

  const [activeTab, setActiveTab] =
    useState<ActiveTab>(() => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const t = params.get('tab') as ActiveTab;
        if (t) return t;
      }
      return 'dashboard';
    });

  const [mobileSidebarOpen, setMobileSidebarOpen] =
    useState(false);

  useEffect(() => {
    (window as any).__setActiveTab = (tab: ActiveTab) => {
      setActiveTab(tab);
    };
    (window as any).__currentActiveTab = activeTab;
  }, [activeTab]);

  /*
   * Staff users should only have access to:
   *
   * - POS
   * - Sales History
   */
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    if (!isAdmin) {
      if (
        activeTab !== 'pos' &&
        activeTab !== 'sales_history' &&
        activeTab !== 'customer_credit' &&
        activeTab !== 'clinic'
      ) {
        setActiveTab('pos');
      }
    }
  }, [
    isAuthenticated,
    isAdmin,
    activeTab,
  ]);

  /*
   * User must authenticate before the main application
   * becomes available.
   */
  if (!isAuthenticated) {
    return <LoginView />;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-100 text-slate-900">
      <TopInfoBar />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* ======================================================
            SIDEBAR
        ======================================================= */}

        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() =>
            setMobileSidebarOpen(false)
          }
        />

        {/* ======================================================
            RIGHT SIDE / APP CONTENT
        ======================================================= */}

        <div className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden">
          {/* --------------------------------------------------
              MOBILE HEADER

              Desktop does not need a top navigation anymore.
          --------------------------------------------------- */}

          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden">
            <button
              type="button"
              onClick={() =>
                setMobileSidebarOpen(true)
              }
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="text-right">
              <p className="text-sm font-extrabold text-slate-900">
                {settings.storeName}
              </p>

              <p className="text-[10px] font-medium text-slate-400">
                Pharmacy Management
              </p>
            </div>
          </header>

          {/* ==================================================
              PAGE CONTENT
          =================================================== */}

          <main className="min-h-0 flex-1 overflow-y-auto">
            <Suspense
              fallback={
                <div
                  className="flex min-h-64 items-center justify-center text-sm text-slate-500"
                  role="status"
                >
                  Loading page…
                </div>
              }
            >
              <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-7 lg:py-7">
                {/* Dashboard */}

                {activeTab === 'dashboard' &&
                  (isAdmin ? (
                    <DashboardView
                      setActiveTab={setActiveTab}
                    />
                  ) : (
                    <PosView />
                  ))}

                {/* POS */}

                {activeTab === 'pos' && (
                  <PosView />
                )}

                {/* Inventory */}

                {activeTab === 'inventory' &&
                  (isAdmin ? (
                    <InventoryView />
                  ) : (
                    <PosView />
                  ))}

                {/* Physical Stock */}

                {activeTab === 'physical_audit' &&
                  (isAdmin ? (
                    <PhysicalStockWorksheetView />
                  ) : (
                    <PosView />
                  ))}

                {/* Stockists */}

                {activeTab === 'stockists' &&
                  (isAdmin ? (
                    <StockistManagementView />
                  ) : (
                    <PosView />
                  ))}

                {/* Sales History */}

                {activeTab === 'sales_history' && (
                  <SalesHistoryView />
                )}

                {/* Customer Credit */}

                {activeTab === 'customer_credit' && (
                  <CustomerCreditView />
                )}

                {/* Clinic / OPD */}

                {activeTab === 'clinic' && (
                  <ClinicView />
                )}

                {/* Reports */}

                {activeTab === 'reports' &&
                  (isAdmin ? (
                    <ReportsView />
                  ) : (
                    <PosView />
                  ))}

                {/* Users */}

                {activeTab === 'users' &&
                  (isAdmin ? (
                    <UserManagementView />
                  ) : (
                    <PosView />
                  ))}

                {/* Settings */}

                {activeTab === 'settings' &&
                  (isAdmin ? (
                    <SettingsView />
                  ) : (
                    <PosView />
                  ))}
              </div>
            </Suspense>
          </main>

          {/* ==================================================
              SMALL FOOTER

              No PAN / DDA / address clutter here.
          =================================================== */}

          <footer className="border-t border-slate-200 bg-white px-6 py-2.5 text-center text-[11px] print:hidden">
            <div className="relative flex flex-col items-center justify-center gap-1 lg:min-h-[24px]">
              <p className="text-slate-500/80">
                &copy; {new Date().getFullYear()} {settings.storeName}. All rights reserved.
              </p>
              {activeTab === 'pos' ? (
                <div className="lg:absolute lg:right-0 lg:top-1/2 lg:-translate-y-1/2">
                  <AslenixCredit compact />
                </div>
              ) : (
                <p className="mt-0.5 text-[10.5px] font-medium tracking-wide text-slate-400/75">
                  Powered by Aslenix tech and Solution
                </p>
              )}
            </div>
          </footer>
        </div>
      </div>

      {/* ======================================================
          GLOBAL MODALS
      ======================================================= */}

      <VatTaxInfoModal
        medicine={activeVatInfoMedicine}
        onClose={() =>
          setActiveVatInfoMedicine(null)
        }
        onUpdateVat={(med, newVat) => {
          updateMedicine(med.id, { isVatApplicable: newVat, hasvat: newVat });
          setActiveVatInfoMedicine({ ...med, isVatApplicable: newVat, hasvat: newVat });
        }}
      />

      <PhysicalStockAuditModal
        medicine={activeAuditMedicine}
        onClose={() =>
          setActiveAuditMedicine(null)
        }
      />

      <TaxInvoiceModal
        invoice={activeInvoiceToPrint}
        onClose={() =>
          setActiveInvoiceToPrint(null)
        }
      />
    </div>
  );
};

import { DialogProvider } from './context/DialogContext';

const App: React.FC = () => {
  return (
    <DialogProvider>
      <PharmacyProvider>
        <PharmacyAppContent />
      </PharmacyProvider>
    </DialogProvider>
  );
};

export default App;