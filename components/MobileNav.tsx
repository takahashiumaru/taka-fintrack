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
    <nav className="taka-mobile-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 items-stretch justify-items-center gap-0 border-t border-white/80 bg-white/96 px-2 pt-1.5 shadow-[0_-16px_42px_rgba(37,99,235,0.14)] backdrop-blur-xl lg:hidden dark:border-sky-400/20 dark:bg-slate-950/96">
      {navItems.map((item) => {
        const isCenterAction = item.key === "scan";
        const isActive = activeView === item.key;

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={clsx(
              "grid min-h-0 min-w-0 place-items-center gap-0.5 text-[10px] font-black transition active:scale-95",
              isCenterAction
                ? "-mt-6 h-[56px] w-[56px] justify-self-center rounded-[22px] bg-gradient-to-br from-[#0EA5E9] to-[#2563EB] p-0 text-white shadow-[0_14px_34px_rgba(14,165,233,0.34)]"
                : "h-[52px] w-full rounded-t-[18px] rounded-b-none px-1 py-1.5",
              !isCenterAction && (isActive ? "bg-[#EFF6FF] text-[#2563EB] dark:bg-sky-500/16 dark:text-sky-100" : "text-slate-500 dark:text-slate-300"),
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
