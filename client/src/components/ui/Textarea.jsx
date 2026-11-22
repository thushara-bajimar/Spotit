import { useId } from 'react';
import { cx } from '../../utils/cx.js';

/** Labelled multi-line input with optional hint, error and character counter. */
export function Textarea({ label, hint, error, optionalLabel, maxLength, value, className, id, ...props }) {
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
      <textarea
        id={inputId}
        value={value}
        maxLength={maxLength}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={cx(hintId, errorId) || undefined}
        className={cx(
          'block w-full rounded-xl border bg-white px-4 py-3 text-base text-ink placeholder:text-muted/80',
          'focus:border-forest-500 focus:ring-2 focus:ring-forest-200 focus:outline-none',
          error ? 'border-danger-700' : 'border-line',
        )}
        {...props}
      />
      <div className="mt-1.5 flex justify-between gap-3 text-sm">
        <span>
          {hint && (
            <span id={hintId} className="text-muted">
              {hint}
            </span>
          )}
          {error && (
            <span id={errorId} className="block font-medium text-danger-700">
              {error}
            </span>
          )}
        </span>
        {maxLength && (
          <span className="shrink-0 text-muted" aria-hidden="true">
            {String(value ?? '').length}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
}
