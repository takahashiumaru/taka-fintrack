import clsx from "clsx";

import { navItems } from "./taka-fintrack-helpers";
import type { ViewKey } from "./taka-fintrack-helpers";

type MobileNavProps = {
  activeView: ViewKey;
  onChange: (view: ViewKey) => void;
};
/**
 * Navigational component for mobile view.
 */

export function MobileNav({ activeView, onChange }: MobileNavProps) {
  return (
    <nav className="taka-mobile-nav fixed left-3 right-3 z-40 grid grid-cols-5 items-center justify-items-center gap-1.5 rounded-[30px] border border-white/80 bg-white/92 p-2 shadow-[0_18px_45px_rgba(37,99,235,0.18)] backdrop-blur-xl lg:hidden dark:border-sky-400/20 dark:bg-slate-950/88">
      {navItems.map((item) => {
        const isCenterAction = item.key === "scan";
        const isActive = activeView === item.key;

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={clsx(
              "grid min-h-11 min-w-0 place-items-center gap-1 text-[10px] font-black transition active:scale-95",
              isCenterAction
                ? "-mt-5 h-[58px] w-[58px] justify-self-center rounded-[24px] bg-gradient-to-br from-[#0EA5E9] to-[#2563EB] p-0 text-white shadow-[0_14px_34px_rgba(14,165,233,0.34)]"
                : "w-full rounded-[20px] px-1.5 py-2.5",
              !isCenterAction && (isActive ? "bg-[#EFF6FF] text-[#2563EB] dark:bg-sky-500/16 dark:text-sky-200" : "text-slate-500 dark:text-slate-300"),
            )}
            aria-label={isCenterAction ? "Tambah atau scan transaksi" : item.label}
            aria-current={isActive ? "page" : undefined}
          >
            <item.icon size={isCenterAction ? 24 : 17} />
            {!isCenterAction && <span className="truncate">{item.label}</span>}
          </button>
        );
      })}
    </nav>
  );
}
