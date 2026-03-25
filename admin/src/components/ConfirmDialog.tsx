export function ConfirmDialog(props: {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!props.open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-4">
        <h3 className="text-sm font-semibold">{props.title ?? "Confirm action"}</h3>
        <p className="mt-2 text-sm text-zinc-300 whitespace-pre-wrap">{props.message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={props.onCancel} className="rounded border border-zinc-700 px-3 py-2 text-xs">{props.cancelLabel ?? "Cancel"}</button>
          <button onClick={props.onConfirm} className="rounded bg-rose-600 px-3 py-2 text-xs text-white">{props.confirmLabel ?? "Confirm"}</button>
        </div>
      </div>
    </div>
  );
}
