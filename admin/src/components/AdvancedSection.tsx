import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export function AdvancedSection(props: {
  label?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const label = props.label ?? "Advanced";

  return (
    <div className="mt-4 border-t border-zinc-800 pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {open ? `Hide ${label}` : `Show ${label}`}
      </button>
      {open && <div className="mt-4 space-y-4">{props.children}</div>}
    </div>
  );
}
