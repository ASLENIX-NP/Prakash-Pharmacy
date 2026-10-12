import React from 'react';
import {
  ShieldCheck,
  MapPin,
  Phone,
} from 'lucide-react';

import { usePharmacy } from '../context/PharmacyContext';

export const TopInfoBar: React.FC = () => {
  const { settings } = usePharmacy();

  return (
    <div className="relative z-50 flex min-h-[32px] w-full shrink-0 flex-wrap items-center justify-between gap-2 bg-slate-900 px-4 py-1.5 text-xs text-slate-100">
      
      {/* LEFT SIDE */}
      <div className="flex flex-wrap items-center gap-4">
        
        {/* DDA */}
        <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />

          <span>DDA Licence No:</span>

          <span className="font-mono tracking-wider text-white">
            {settings.ddaLicenceNumber}
          </span>
        </span>

        <span className="hidden text-slate-500 sm:inline">
          |
        </span>

        {/* PAN */}
        <span className="flex items-center gap-1.5 font-semibold text-amber-400">
          <span>PAN No:</span>

          <span className="font-mono tracking-wider text-white">
            {settings.panNumber}
          </span>
        </span>

        <span className="hidden text-slate-500 md:inline">
          |
        </span>

        {/* ADDRESS */}
        <span className="hidden items-center gap-1 text-slate-300 md:flex">
          <MapPin className="h-3 w-3 text-slate-400" />

          {settings.address}
        </span>

      </div>

      {/* RIGHT SIDE */}
      <div className="flex items-center gap-3 text-slate-300">

        {/* PHONE */}
        <span className="hidden items-center gap-1 sm:flex">
          <Phone className="h-3 w-3 text-slate-400" />

          {settings.phoneNumber}
        </span>

        {/* FISCAL YEAR */}
        <span className="hidden font-mono text-slate-400 lg:inline">
          FY: {settings.fiscalYear}
        </span>

        {/* VAT */}
        <span className="rounded border border-emerald-500/30 bg-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
          13% VAT &amp; IRD Ready
        </span>

      </div>
    </div>
  );
};
