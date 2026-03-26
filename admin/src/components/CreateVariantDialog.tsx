export function CreateVariantDialog(props: {
  open: boolean;
  busy: boolean;
  createMethod: string;
  setCreateMethod: (value: string) => void;
  createPath: string;
  setCreatePath: (value: string) => void;
  createVariantId: string;
  setCreateVariantId: (value: string) => void;
  createStatus: number;
  setCreateStatus: (value: number) => void;
  createBody: string;
  setCreateBody: (value: string) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  if (!props.open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-zinc-700 bg-zinc-900 p-4">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold">Create endpoint / variant</h3>
            <p className="mt-1 text-sm text-zinc-400">
              Create a new endpoint or add a new variant to an existing
              endpoint.
            </p>
          </div>
          <button
            onClick={props.onClose}
            className="rounded border border-zinc-700 px-3 py-2 text-xs"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            <span>HTTP method</span>
            <select
              value={props.createMethod}
              onChange={(e) => props.setCreateMethod(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            >
              <option>GET</option>
              <option>POST</option>
              <option>PUT</option>
              <option>PATCH</option>
              <option>DELETE</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-400 md:col-span-2">
            <span>Endpoint path</span>
            <input
              value={props.createPath}
              onChange={(e) => props.setCreatePath(e.target.value)}
              placeholder="/api/new-endpoint"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            <span>Variant id</span>
            <input
              value={props.createVariantId}
              onChange={(e) => props.setCreateVariantId(e.target.value)}
              placeholder="variant id"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[12rem_minmax(0,1fr)]">
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            <span>Response status</span>
            <input
              type="number"
              value={props.createStatus}
              onChange={(e) => props.setCreateStatus(Number(e.target.value))}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-400">
            Response bodies are stored as JSON and created with an
            application/json content type.
          </div>
        </div>

        <label className="mt-3 flex flex-col gap-1 text-xs text-zinc-400">
          <span>Response body JSON</span>
          <textarea
            value={props.createBody}
            onChange={(e) => props.setCreateBody(e.target.value)}
            className="h-64 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs text-zinc-100"
          />
        </label>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={props.onClose}
            className="rounded border border-zinc-700 px-3 py-2 text-xs"
          >
            Cancel
          </button>
          <button
            onClick={props.onCreate}
            disabled={props.busy || !props.createPath.trim()}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
