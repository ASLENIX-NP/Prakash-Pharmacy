import React, { useState, useEffect } from 'react';
import { PharmacyProvider, usePharmacy } from './context/PharmacyContext';
import { Header, ActiveTab } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { InventoryView } from './components/InventoryView';
import { PhysicalStockWorksheetView } from './components/PhysicalStockWorksheetView';
import { PosView } from './components/PosView';
import { StockistManagementView } from './components/StockistManagementView';
import { SalesHistoryView } from './components/SalesHistoryView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { UserManagementView } from './components/UserManagementView';
import { LoginView } from './components/LoginView';
import { VatTaxInfoModal } from './components/VatTaxInfoModal';
import { PhysicalStockAuditModal } from './components/PhysicalStockAuditModal';
import { TaxInvoiceModal } from './components/TaxInvoiceModal';

const PharmacyAppContent: React.FC = () => {
  const { 
    isAuthenticated,
    currentUser,
    isAdmin,
    activeVatInfoMedicine, 
    setActiveVatInfoMedicine,
    activeAuditMedicine,
    setActiveAuditMedicine,
    activeInvoiceToPrint,
    setActiveInvoiceToPrint,
    settings
  } = usePharmacy();

  // Role based default tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  // If user is Staff, ensure they are routed strictly to sales / bill entry tabs
  useEffect(() => {
    if (isAuthenticated) {
      if (!isAdmin) {
        if (activeTab !== 'pos' && activeTab !== 'sales_history') {
          setActiveTab('pos');
        }
      }
    }
  }, [isAuthenticated, isAdmin, activeTab]);

  // Requirement: "OPEN APP WITH LINK BUT ENTER WITH CREDENTIALS"
  if (!isAuthenticated) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900 font-sans">
      {/* Header with Navigation and Credentials */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'dashboard' && (
          isAdmin ? <DashboardView setActiveTab={setActiveTab} /> : <PosView />
        )}
        {activeTab === 'pos' && <PosView />}
        {activeTab === 'inventory' && (
          isAdmin ? <InventoryView /> : <PosView />
        )}
        {activeTab === 'physical_audit' && (
          isAdmin ? <PhysicalStockWorksheetView /> : <PosView />
        )}
        {activeTab === 'stockists' && (
          isAdmin ? <StockistManagementView /> : <PosView />
        )}
        {activeTab === 'sales_history' && <SalesHistoryView />}
        {activeTab === 'reports' && (
          isAdmin ? <ReportsView /> : <PosView />
        )}
        {activeTab === 'users' && (
          isAdmin ? <UserManagementView /> : <PosView />
        )}
        {activeTab === 'settings' && (
          isAdmin ? <SettingsView /> : <PosView />
        )}
      </main>

      {/* Global Modals */}
      {/* 1. "Click to Know" VAT & Tax Breakdown Modal */}
      <VatTaxInfoModal
        medicine={activeVatInfoMedicine}
        onClose={() => setActiveVatInfoMedicine(null)}
      />

      {/* 2. Physical Stock Count & Quick Add/Deduce Adjustment Modal */}
      <PhysicalStockAuditModal
        medicine={activeAuditMedicine}
        onClose={() => setActiveAuditMedicine(null)}
      />

      {/* 3. Official Printable 13% VAT Tax Invoice / Cash Memo (कर बीजक) */}
      <TaxInvoiceModal
        invoice={activeInvoiceToPrint}
        onClose={() => setActiveInvoiceToPrint(null)}
      />

      {/* Bottom Footer (Hidden during printing) */}
      <footer className="bg-white border-t border-slate-200 py-4 px-6 text-xs text-slate-500 print:hidden mt-auto">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">{settings.storeName}</span>
            <span>•</span>
            <span>{settings.address}</span>
            <span>•</span>
            <span className="font-mono">PAN: {settings.panNumber}</span>
            <span>•</span>
            <span className="font-mono">DDA: {settings.ddaLicenceNumber}</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>Logged in: <strong className="text-slate-700 font-mono">@{currentUser?.username}</strong> ({currentUser?.role})</span>
            <span>•</span>
            <span>Fiscal Year: {settings.fiscalYear}</span>
            <span>•</span>
            <span>Nepal VAT Act 2052 &amp; IRD Compliant</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <PharmacyProvider>
      <PharmacyAppContent />
    </PharmacyProvider>
  );
}
