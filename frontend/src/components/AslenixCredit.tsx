import React from 'react';

// Public ASLENIX-NP organization logo. Text stays visible if the image fails.
const ASLENIX_LOGO_URL =
  'https://avatars.githubusercontent.com/u/284898536?s=200&v=4';

interface AslenixCreditProps {
  className?: string;
  compact?: boolean;
}

export const AslenixCredit: React.FC<AslenixCreditProps> = ({
  className = '',
  compact = false,
}) => (
  <div
    className={`flex items-center justify-center gap-2 text-slate-500 ${
      compact ? 'text-[10.5px]' : 'text-[11.5px]'
    } ${className}`}
  >
    <img
      src={ASLENIX_LOGO_URL}
      alt="Aslenix logo"
      referrerPolicy="no-referrer"
      loading="lazy"
      className={`${compact ? 'h-5 w-5' : 'h-6 w-6'} shrink-0 rounded-md object-contain`}
      onError={(event) => { event.currentTarget.style.display = 'none'; }}
    />
    <span className="leading-tight">
      Powered by <strong className="font-semibold text-slate-700">Aslenix Tech and Solution</strong>
    </span>
  </div>
);
