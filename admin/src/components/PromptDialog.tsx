export function PromptDialog({
  prompt,
  onClose,
  showToast,
}: {
  prompt: string;
  onClose: () => void;
  showToast: (msg: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl rounded-2xl border border-zinc-700 bg-zinc-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Stored AI Prompt</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                const text = prompt;
                try {
                  if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(text);
                    showToast("Prompt copied");
                    return;
                  }
                } catch {
                  // fall through
                }

                try {
                  const ta = document.createElement("textarea");
                  ta.value = text;
                  ta.style.position = "fixed";
                  ta.style.opacity = "0";
                  ta.style.pointerEvents = "none";
                  document.body.appendChild(ta);
                  ta.focus();
                  ta.select();
                  const ok = document.execCommand("copy");
                  document.body.removeChild(ta);
                  showToast(ok ? "Prompt copied" : "Failed to copy prompt");
                } catch {
                  showToast("Failed to copy prompt");
                }
              }}
              className="rounded border border-zinc-700 px-2 py-1 text-xs"
            >
              Copy
            </button>
            <button
              onClick={onClose}
              className="rounded border border-zinc-700 px-2 py-1 text-xs"
            >
              Close
            </button>
          </div>
        </div>
        <pre className="max-h-[70vh] overflow-auto rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs whitespace-pre-wrap">
          {prompt}
        </pre>
      </div>
    </div>
  );
}
