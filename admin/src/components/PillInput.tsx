import { useRef, useState } from "react";
import { X } from "lucide-react";

export function PillInput(props: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function add(raw: string) {
    const val = raw.trim();
    if (!val || props.value.includes(val)) return;
    props.onChange([...props.value, val]);
    setInputValue("");
  }

  function remove(index: number) {
    props.onChange(props.value.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(inputValue);
    } else if (e.key === "Backspace" && inputValue === "" && props.value.length > 0) {
      remove(props.value.length - 1);
    }
  }

  function handleBlur() {
    if (inputValue.trim()) add(inputValue);
  }

  return (
    <div
      className="flex flex-wrap gap-1.5 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 cursor-text min-h-[36px]"
      onClick={() => inputRef.current?.focus()}
    >
      {props.value.map((item, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-200"
        >
          {item}
          {!props.disabled && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(i); }}
              className="text-zinc-400 hover:text-zinc-100"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}
      {!props.disabled && (
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={props.value.length === 0 ? (props.placeholder ?? "Type and press Enter") : ""}
          className="min-w-[120px] flex-1 bg-transparent text-xs text-zinc-100 placeholder-zinc-600 outline-none"
        />
      )}
    </div>
  );
}
