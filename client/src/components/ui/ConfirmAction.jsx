import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button.jsx';
import { Textarea } from './Textarea.jsx';
import { FormError } from '../forms/FormError.jsx';
import { cx } from '../../utils/cx.js';

/**
 * A button that opens an inline confirmation step, optionally asking for a
 * reason/note. `onConfirm(reason)` must return a promise; API errors are shown
 * inline and the step stays open.
 *
 *   reason: 'none' | 'optional' | 'required'
 *   tone:   'positive' (green panel) | 'caution' (amber panel)
 */
export function ConfirmAction({
  label,
  title,
  explain,
  yesLabel,
  reasonLabel,
  reason = 'none',
  tone = 'caution',
  variant = 'secondary',
  fullWidth = true,
  onConfirm,
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!open) {
    return (
      <Button variant={variant} fullWidth={fullWidth} onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }

  const submit = async () => {
    if (reason === 'required' && text.trim().length < 3) {
      setError({ field: true });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(text.trim() || undefined);
      setOpen(false);
      setText('');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={cx(
        'w-full rounded-xl border p-4',
        tone === 'positive' ? 'border-forest-200 bg-forest-50' : 'border-amber-300 bg-amber-100',
      )}
    >
      <p className="font-semibold text-ink">{title}</p>
      {explain && <p className="mt-1 text-sm text-ink">{explain}</p>}
      {reason !== 'none' && (
        <Textarea
          className="mt-3"
          label={reasonLabel ?? t('assignments.reason')}
          optionalLabel={reason === 'optional' ? t('common.optional') : undefined}
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={500}
          rows={2}
          error={error?.field ? t('validation.required') : undefined}
        />
      )}
      {error && !error.field && <FormError code={error.code} className="mt-2" />}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={submit} disabled={busy}>
          {yesLabel}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}
