import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { ChevronDownIcon } from "./icons";

export interface ComboOption {
  value: string;
  /** Shown in the list in place of the value, such as a plan line's subject beside its reference. */
  label?: string;
  /** A second, quieter line under the label. */
  hint?: string;
}

const asOption = (o: string | ComboOption): ComboOption => (typeof o === "string" ? { value: o } : o);

/**
 * A box to type in or pick from. It looks like an ordinary text box; once it
 * has the cursor, the list drops below it and typing narrows the list to what
 * matches. What is typed is kept whether or not it is in the list.
 */
export default function Combobox({
  id,
  value,
  onChange,
  options,
  onPick,
  placeholder,
  ariaLabel,
  required,
  disabled,
  className = "",
  inputClassName = "",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: (string | ComboOption)[];
  /** Called when an entry is picked from the list, not when one is typed. */
  onPick?: (option: ComboOption) => void;
  placeholder?: string;
  ariaLabel?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const all = useMemo(() => {
    const seen = new Set<string>();
    return options.map(asOption).filter((o) => o.value && !seen.has(o.value) && seen.add(o.value));
  }, [options]);
  // The whole list while the box is empty or holds one of its entries; what matches once typing starts.
  const shown = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q || all.some((o) => o.value.toLowerCase() === q)) return all;
    return all.filter((o) => [o.value, o.label, o.hint].some((t) => t?.toLowerCase().includes(q)));
  }, [all, value]);
  const expanded = open && shown.length > 0;

  // The list is placed against the window, under the box (or over it when
  // there's no room below), so a table or panel that scrolls can't cut it off.
  const [place, setPlace] = useState<CSSProperties>({});
  useLayoutEffect(() => {
    if (!expanded) return;
    const measure = () => {
      const box = inputRef.current?.getBoundingClientRect();
      if (!box) return;
      const room = window.innerHeight - box.bottom;
      const above = room < 260 && box.top > room;
      setPlace({
        left: box.left,
        width: box.width,
        ...(above ? { bottom: window.innerHeight - box.top + 4 } : { top: box.bottom + 4 }),
        maxHeight: Math.max(120, Math.min(240, (above ? box.top : room) - 12)),
      });
    };
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [expanded]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  useEffect(() => {
    if (active >= 0) listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function pick(o: ComboOption) {
    onChange(o.value);
    onPick?.(o);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && expanded && active >= 0 && shown[active]) {
      e.preventDefault();
      pick(shown[active]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete="off"
        className={`input pr-9 ${inputClassName}`}
      />
      {all.length > 0 && !disabled && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Show the list"
          onMouseDown={(e) => {
            e.preventDefault();
            setOpen((o) => !o);
            inputRef.current?.focus();
          }}
          className="absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-400 hover:text-gray-600"
        >
          <ChevronDownIcon className="h-4 w-4" />
        </button>
      )}
      {expanded && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          style={place}
          className="fixed z-50 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 text-left shadow-lg"
        >
          {shown.map((o, i) => (
            <li
              key={`${o.value}-${i}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={o.value === value}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-2 text-sm ${i === active ? "bg-green-50" : ""} ${
                o.value === value ? "font-medium text-green-800" : "text-gray-900"
              }`}
            >
              <span className="block">{o.label ?? o.value}</span>
              {o.hint && <span className="block text-xs font-normal text-gray-500">{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
