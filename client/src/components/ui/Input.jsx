import { useId } from 'react';
import { cx } from '../../utils/cx.js';

/**
 * Labelled text input with optional hint, error, leading icon and a
 * trailing element (e.g. a show-password button).
 * Hint and error text are linked to the input for screen readers.
 */
export function Input({ label, hint, error, icon: Icon, trailing, optionalLabel, className, id, ...props }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
        {optionalLabel && <span className="ml-1 font-normal text-muted">{optionalLabel}</span>}
      </label>
      <div className="relative">
        {Icon && (
          <Icon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted"
          />
        )}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={cx(hintId, errorId) || undefined}
          className={cx(
            'block min-h-12 w-full rounded-xl border bg-white px-4 text-base text-ink placeholder:text-muted/80',
            'focus:border-forest-500 focus:ring-2 focus:ring-forest-200 focus:outline-none',
            'disabled:bg-cream-100',
            Icon && 'pl-11',
            trailing && 'pr-14',
            error ? 'border-danger-700' : 'border-line',
          )}
          {...props}
        />
        {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
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
