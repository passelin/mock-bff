import { Upload } from "lucide-react";
import { Card } from "./Card";
import { FileDropZone } from "./FileDropZone";

export function HarUploadCard(props: {
  busy: boolean;
  harFile: File | null;
  setHarFile: (f: File | null) => void;
  uploadFile: (route: string, file: File | null, successMsg: string) => void;
}) {
  return (
    <Card title="Import HAR" subtitle="Upload real traffic captures to generate endpoint variants.">
      <FileDropZone
        file={props.harFile}
        onFile={props.setHarFile}
        accept=".har,.json"
        label="Click or drag a .har file here"
      />
      <button
        disabled={props.busy || !props.harFile}
        onClick={() => props.uploadFile("/-/api/har", props.harFile, "HAR imported")}
        className="mt-3 w-full rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium disabled:opacity-40 inline-flex items-center justify-center gap-2"
      >
        <Upload className="h-4 w-4" />
        Upload HAR
      </button>
    </Card>
  );
}
