import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

// ─── Public handle (for gamepad integration) ───────────────────────────────────

export interface ComboboxHandle {
  /** Whether the suggestion dropdown is currently visible. */
  isDropdownOpen: () => boolean;
  /** Move the highlighted row up or down. Opens the dropdown if it was closed. */
  navigate: (dir: 'up' | 'down') => void;
  /** Confirm the currently highlighted suggestion. */
  confirm: () => void;
  /** Close the dropdown without selecting anything. */
  close: () => void;
  /** Programmatically focus the text input. */
  focus: () => void;
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  /** Full list of suggestion strings — the component filters them internally. */
  options: string[];
  placeholder?: string;
  /** Maximum suggestions shown at once (default 8). */
  maxResults?: number;
  /** Red border when true. */
  error?: boolean;
  /** Extra classes on the wrapper div. */
  className?: string;
  /** Extra classes applied to the <input> element directly. */
  inputClassName?: string;
  /** Called when the input receives focus (e.g. to sync parent focusedIndex). */
  onFocus?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const Combobox = forwardRef<ComboboxHandle, ComboboxProps>(
  (
    {
      value,
      onChange,
      options,
      placeholder,
      maxResults = 8,
      error = false,
      className,
      inputClassName,
      onFocus,
    },
    ref,
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIdx, setHighlightedIdx] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    // Compute filtered suggestions
    const filtered = options
      .filter((o) => o.toLowerCase().includes(value.toLowerCase()))
      .slice(0, maxResults);

    // Reset highlight whenever the visible list changes
    useEffect(() => {
      setHighlightedIdx(0);
    }, [value]);

    // Scroll highlighted row into view
    useEffect(() => {
      if (!isOpen || !listRef.current) return;
      const el = listRef.current.children[highlightedIdx] as HTMLElement | undefined;
      el?.scrollIntoView({ block: 'nearest' });
    }, [highlightedIdx, isOpen]);

    const select = useCallback(
      (option: string) => {
        onChange(option);
        setIsOpen(false);
      },
      [onChange],
    );

    // ── Gamepad / parent handle ──────────────────────────────────────────────

    useImperativeHandle(
      ref,
      () => ({
        isDropdownOpen: () => isOpen,
        navigate: (dir) => {
          if (!isOpen) {
            setIsOpen(filtered.length > 0);
            return;
          }
          setHighlightedIdx((i) =>
            dir === 'down'
              ? Math.min(filtered.length - 1, i + 1)
              : Math.max(0, i - 1),
          );
        },
        confirm: () => {
          const opt = filtered[highlightedIdx];
          if (isOpen && opt) select(opt);
        },
        close: () => setIsOpen(false),
        focus: () => inputRef.current?.focus(),
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [isOpen, filtered, highlightedIdx, select],
    );

    // ── Keyboard handling ────────────────────────────────────────────────────

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (!isOpen) setIsOpen(filtered.length > 0);
          else setHighlightedIdx((i) => Math.min(filtered.length - 1, i + 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIdx((i) => Math.max(0, i - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (isOpen && filtered[highlightedIdx]) select(filtered[highlightedIdx]);
          break;
        case 'Escape':
          setIsOpen(false);
          break;
      }
    };

    return (
      <div className={`relative ${className ?? ''}`}>
        <input
          ref={inputRef}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(filtered.length > 0);
            onFocus?.();
          }}
          onBlur={() => {
            // Small delay so onMouseDown on a list item fires first
            setTimeout(() => setIsOpen(false), 100);
          }}
          onKeyDown={handleKeyDown}
          className={
            inputClassName ??
            `w-full bg-card border rounded-lg px-4 py-3 text-foreground outline-none transition-colors ${
              error
                ? 'border-red-500 focus:border-red-500'
                : 'border-border focus:border-ring'
            }`
          }
          style={error ? { borderColor: 'rgb(239 68 68)' } : undefined}
        />

        {isOpen && filtered.length > 0 && (
          <ul
            ref={listRef}
            className="absolute z-50 left-0 right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-xl overflow-y-auto max-h-52"
          >
            {filtered.map((option, idx) => (
              <li
                key={option}
                // onMouseDown + preventDefault keeps the input focused so
                // onBlur doesn't fire before the selection registers
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(option);
                }}
                onMouseEnter={() => setHighlightedIdx(idx)}
                className={`px-4 py-2.5 cursor-pointer text-sm font-medium transition-colors select-none ${
                  highlightedIdx === idx
                    ? 'bg-ring/15 text-foreground'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                }`}
              >
                {option}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  },
);

Combobox.displayName = 'Combobox';

export { Combobox };
