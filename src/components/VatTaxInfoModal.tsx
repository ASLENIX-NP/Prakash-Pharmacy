import React from 'react';
import { X, Info, ShieldCheck, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { Medicine } from '../types/pharmacy';

interface VatTaxInfoModalProps {
  medicine: Medicine | null;
  onClose: () => void;
}

export const VatTaxInfoModal: React.FC<VatTaxInfoModalProps> = ({ medicine, onClose }) => {
  if (!medicine) return null;

  const perUnitMrp = medicine.unitsPerPack > 1 ? medicine.mrpPrice / medicine.unitsPerPack : medicine.mrpPrice;

  // For 13% VAT items:
  // MRP includes 13% VAT. Taxable base = MRP / 1.13. VAT amount = MRP - Taxable Base
  const taxableBasePack = medicine.isVatApplicable ? medicine.mrpPrice / 1.13 : medicine.mrpPrice;
  const vatAmountPack = medicine.isVatApplicable ? medicine.mrpPrice - taxableBasePack : 0;

  const taxableBaseUnit = medicine.isVatApplicable ? perUnitMrp / 1.13 : perUnitMrp;
  const vatAmountUnit = medicine.isVatApplicable ? perUnitMrp - taxableBaseUnit : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div 
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 py-4 flex items-center justify-between text-white ${
          medicine.isVatApplicable 
            ? 'bg-gradient-to-r from-blue-700 to-indigo-800' 
            : 'bg-gradient-to-r from-emerald-700 to-teal-800'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-lg">
              <Info className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                Product VAT &amp; Tax Information
              </h3>
              <p className="text-xs text-white/80">
                Statutory Nepal VAT Classification (Inland Revenue Department)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Product Overview */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-bold text-slate-900 text-base">{medicine.name}</h4>
                <p className="text-xs text-slate-600 font-medium">{medicine.genericName}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                medicine.isVatApplicable
                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}>
                {medicine.isVatApplicable ? '13% VAT Applicable' : 'VAT Free (0% Exempt)'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-xs text-slate-600">
              <div>Category: <strong className="text-slate-800">{medicine.category}</strong></div>
              <div>Batch: <strong className="text-slate-800 font-mono">{medicine.batchNumber}</strong></div>
              <div>Pack Size: <strong className="text-slate-800">{medicine.unitsPerPack} units/pack</strong></div>
              <div>Rack Shelf: <strong className="text-slate-800">{medicine.rackLocation}</strong></div>
            </div>
          </div>

          {/* Pricing & VAT Breakdown */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-100/70 px-4 py-2 font-semibold text-xs text-slate-700 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Full Pack vs. Loose Tablet Tax Breakdown (NPR)</span>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 px-3 text-left">Unit Type</th>
                  <th className="py-2 px-3 text-right">Selling MRP</th>
                  <th className="py-2 px-3 text-right">Taxable Base</th>
                  <th className="py-2 px-3 text-right">13% VAT Portion</th>
                  <th className="py-2 px-3 text-right">VAT Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-slate-800">Full Pack (1 Strip)</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">Rs. {medicine.mrpPrice.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-700">Rs. {taxableBasePack.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-medium">
                    {medicine.isVatApplicable ? `Rs. ${vatAmountPack.toFixed(2)}` : 'Rs. 0.00'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold">
                    {medicine.isVatApplicable ? <span className="text-blue-700">13%</span> : <span className="text-emerald-700">0% (Exempt)</span>}
                  </td>
                </tr>
                {medicine.unitsPerPack > 1 && (
                  <tr className="bg-slate-50/50">
                    <td className="py-2.5 px-3 font-semibold text-slate-800">Per Loose Tablet / Unit</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">Rs. {perUnitMrp.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">Rs. {taxableBaseUnit.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-medium">
                      {medicine.isVatApplicable ? `Rs. ${vatAmountUnit.toFixed(2)}` : 'Rs. 0.00'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold">
                      {medicine.isVatApplicable ? <span className="text-blue-700">13%</span> : <span className="text-emerald-700">0% (Exempt)</span>}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Statutory Explanation */}
          <div className="rounded-xl p-4 text-xs space-y-2 border border-slate-200 bg-amber-50/40">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <ShieldCheck className="w-4 h-4 text-amber-700" />
              <span>Statutory Legal Basis (Nepal Value Added Tax Act 2052 &amp; IRD):</span>
            </div>
            {medicine.isVatApplicable ? (
              <p className="text-slate-700 leading-relaxed">
                This item is classified as a <strong>13% VAT Applicable Product</strong> under Schedule 1 of the Nepal VAT Act (e.g., antiseptic lotions, medicated topical pain gels, OTC cosmetics, diagnostic equipment, devices, and surgical dressings). When invoiced, it must be itemized under the <em>Taxable Sales</em> register and charged 13% Value Added Tax.
              </p>
            ) : (
              <p className="text-slate-700 leading-relaxed">
                This medicine is classified as a <strong>Statutory VAT-Free / Exempt (0% VAT)</strong> essential pharmaceutical formulation under Schedule 1, Group 4 (Medicines &amp; Health Equipment) of the Nepal Value Added Tax Act 2052. All registered allopathic oral pills, antibiotics, injections, and syrups prescribed for therapeutic cure are strictly 0% VAT exempt.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs"
          >
            Close Information
          </button>
        </div>
      </div>
    </div>
  );
};
