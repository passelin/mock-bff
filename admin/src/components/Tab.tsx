import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

export function Tab({
  to,
  label,
  icon,
  onClick,
}: {
  to: string;
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition border-b-2 ${
          isActive
            ? "border-brand-400 text-zinc-100"
            : "border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
        }`
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}
