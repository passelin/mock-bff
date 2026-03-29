import { Upload } from "lucide-react";
import { Card } from "./Card";

export function HarUploadCard(props: {
  busy: boolean;
  harFile: File | null;
  setHarFile: (f: File | null) => void;
  uploadFile: (route: string, file: File | null, successMsg: string) => void;
}) {
  return (
    <Card
      title="Import HAR"
      subtitle="Upload real traffic captures to generate endpoint variants."
      tone="highlight"
      actions={
        <button
          disabled={props.busy || !props.harFile}
          onClick={() => props.uploadFile("/-/api/har", props.harFile, "HAR imported")}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"
        >
          <Upload className="h-4 w-4" />
          Upload HAR
        </button>
      }
    >
      <input
        type="file"
        accept=".har,.json"
        onChange={(e) => props.setHarFile(e.target.files?.[0] ?? null)}
        className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-white hover:file:bg-brand-500"
      />
    </Card>
  );
}
