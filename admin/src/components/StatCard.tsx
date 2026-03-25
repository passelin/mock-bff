export function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-100">{value}</p>
    </div>
  );
}
