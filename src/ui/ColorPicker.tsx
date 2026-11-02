import { Check } from 'lucide-react';
import { cn } from './primitives';

export const SWATCHES = [
  '#a84c26',
  '#c9822b',
  '#8f7a4a',
  '#5f7d4f',
  '#3f6e6a',
  '#4d6f8c',
  '#6d6a8f',
  '#8a5a8c',
  '#a04a5a',
  '#6a6a6a',
];

export function ColorPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (color: string) => void;
  label: string;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {SWATCHES.map((color) => (
          <label
            key={color}
            className={cn(
              'ring-offset-surface grid size-8 cursor-pointer place-items-center rounded-full ring-offset-2 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--c-focus)]',
              value === color && 'ring-text ring-2',
            )}
            style={{ background: color }}
          >
            <input
              type="radio"
              name={label}
              value={color}
              checked={value === color}
              onChange={() => onChange(color)}
              className="sr-only"
              aria-label={color}
            />
            {value === color && <Check className="size-4 text-white" aria-hidden />}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
