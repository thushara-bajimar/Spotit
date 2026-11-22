import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cx } from '../../utils/cx.js';

/**
 * Labelled native <select> (best on phones: uses the system picker).
 * options: [{ value, label }]
 */
export function Select({ label, hint, error, options, placeholder, optionalLabel, className, id, ...props }) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const hintId = hint ? `${selectId}-hint` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;

  return (
    <div className={className}>
      <label htmlFor={selectId} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
        {optionalLabel && <span className="ml-1 font-normal text-muted">{optionalLabel}</span>}
      </label>
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={cx(hintId, errorId) || undefined}
          className={cx(
            'block min-h-12 w-full appearance-none rounded-xl border bg-white pr-11 pl-4 text-base text-ink',
            'focus:border-forest-500 focus:ring-2 focus:ring-forest-200 focus:outline-none',
            'disabled:bg-cream-100',
            error ? 'border-danger-700' : 'border-line',
          )}
          {...props}
        >
          {placeholder !== undefined && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3.5 size-5 -translate-y-1/2 text-muted"
        />
      </div>
      {hint && (
        <p id={hintId} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 text-sm font-medium text-danger-700">
          {error}
        </p>
      )}
    </div>
  );
}
