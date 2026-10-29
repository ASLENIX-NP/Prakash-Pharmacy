import React, { useState } from 'react';
import {
  BarChart3,
  ClipboardPlus,
  History,
  ShieldCheck,
  Stethoscope,
  UsersRound,
} from 'lucide-react';

import { usePharmacy } from '../context/PharmacyContext';
import { DoctorManagementPanel } from './DoctorManagementPanel';
import { NewOpdPanel } from './NewOpdPanel';
import { OpdRecordsPanel } from './OpdRecordsPanel';
import { ClinicReportsPanel } from './ClinicReportsPanel';

type ClinicTab =
  | 'new_opd'
  | 'records'
  | 'doctors'
  | 'reports';

export const ClinicView: React.FC = () => {
  const { isAdmin } = usePharmacy();

  const [activeClinicTab, setActiveClinicTab] =
    useState<ClinicTab>('new_opd');

  const tabs = [
    {
      id: 'new_opd' as const,
      label: 'New OPD',
      icon: ClipboardPlus,
      adminOnly: false,
    },
    {
      id: 'records' as const,
      label: 'OPD Records',
      icon: History,
      adminOnly: false,
    },
    {
      id: 'doctors' as const,
      label: 'Doctors',
      icon: UsersRound,
      adminOnly: true,
    },
    {
      id: 'reports' as const,
      label: 'Clinic Reports',
      icon: BarChart3,
      adminOnly: true,
    },
  ];

  const visibleTabs = tabs.filter(
    (tab) => !tab.adminOnly || isAdmin
  );

  return (
    <div className="space-y-5">
      {/* Page Heading */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-700 ring-1 ring-teal-100">
              <Stethoscope className="h-6 w-6" />
            </div>

            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
                Clinic / OPD
              </h1>

              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500 sm:text-sm">
                Manage OPD visits, patients, doctors, clinic charges,
                sticker printing and clinic revenue records.
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-[11px] font-bold text-teal-800">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>
              {isAdmin
                ? 'Admin clinic access'
                : 'Staff OPD access'}
            </span>
          </div>
        </div>
      </div>

      {/* Clinic Sub Navigation */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex min-w-max items-center gap-1">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const active =
              activeClinicTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() =>
                  setActiveClinicTab(tab.id)
                }
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
                  active
                    ? 'bg-teal-700 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* New OPD */}
      {activeClinicTab === 'new_opd' && (
        <NewOpdPanel />
      )}

      {/* OPD Records */}
      {activeClinicTab === 'records' && (
        <OpdRecordsPanel />
      )}

      {/* Doctor Management - Admin Only */}
      {activeClinicTab === 'doctors' && isAdmin && (
        <DoctorManagementPanel />
      )}

      {/* Reports - Admin Only */}
      {activeClinicTab === 'reports' && isAdmin && (
        <ClinicReportsPanel />
      )}

    </div>
  );
};
