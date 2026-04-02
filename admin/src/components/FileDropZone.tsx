import { useRef } from "react";
import { Upload, X, File } from "lucide-react";

export function FileDropZone(props: {
  file: File | null;
  onFile: (f: File | null) => void;
  accept: string;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) props.onFile(f);
  }

  return (
    <div
      className="relative flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-950/50 px-3 py-5 text-center cursor-pointer hover:border-zinc-500 hover:bg-zinc-900/60 transition-colors"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={props.accept}
        className="sr-only"
        onChange={(e) => props.onFile(e.target.files?.[0] ?? null)}
      />
      {props.file ? (
        <>
          <File className="h-6 w-6 text-brand-400 shrink-0" />
          <span className="text-xs text-zinc-200 break-all leading-snug">{props.file.name}</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); props.onFile(null); }}
            className="absolute top-2 right-2 rounded-full p-0.5 text-zinc-500 hover:text-zinc-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      ) : (
        <>
          <Upload className="h-6 w-6 text-zinc-600 shrink-0" />
          <span className="text-xs text-zinc-500">{props.label}</span>
        </>
      )}
    </div>
  );
}
