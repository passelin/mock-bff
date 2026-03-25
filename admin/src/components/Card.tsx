import type { ReactNode } from "react";

export function Card(props: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
  tone?: "default" | "highlight";
}) {
  const toneClass =
    props.tone === "highlight"
      ? "border-brand-500/40 bg-gradient-to-b from-zinc-900 to-zinc-950"
      : "border-zinc-800 bg-zinc-900/70";
  return (
    <section className={`rounded-2xl border ${toneClass} shadow-glow p-5`}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{props.title}</h2>
          {props.subtitle ? (
            <p className="mt-1 text-sm text-zinc-400">{props.subtitle}</p>
          ) : null}
        </div>
        {props.actions}
      </div>
      {props.children}
    </section>
  );
}
