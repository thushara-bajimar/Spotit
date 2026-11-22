import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flag } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { Select } from '../ui/Select.jsx';
import { Textarea } from '../ui/Textarea.jsx';
import { Notice } from '../ui/Notice.jsx';
import { FormError } from '../forms/FormError.jsx';
import { submitReportRequest } from '../../services/trustService.js';

const CATEGORIES = ['misleading_job', 'unpaid_wage', 'misconduct', 'harassment', 'fake_account', 'spam', 'other'];

/**
 * "Report a problem" — collapsed link that opens a small form.
 * `target` = { type: 'job'|'assignment'|'review'|'none', id }. The server
 * decides who the report is about from the target.
 */
export function ReportForm({ target, categories = CATEGORIES, defaultCategory, label, onReported }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(defaultCategory ?? '');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (done) return <Notice role="status">{t('reports.sent')}</Notice>;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-danger-700 hover:underline"
      >
        <Flag aria-hidden="true" className="size-4" />
        {label ?? t('reports.open')}
      </button>
    );
  }

  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!category) next.category = 'required';
    if (description.trim().length < 10) next.description = description.trim() ? 'too_short' : 'required';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setFormError(null);
    try {
      await submitReportRequest({ category, description: description.trim(), target });
      setDone(true);
      onReported?.();
    } catch (error) {
      setFormError(error.code ?? 'generic');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-3 rounded-xl border border-line bg-cream-50 p-4">
      <p className="font-semibold text-ink">{label ?? t('reports.open')}</p>
      <p className="text-sm text-muted">{t('reports.explain')}</p>
      <Select
        label={t('reports.category')}
        placeholder={t('common.select')}
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        options={categories.map((c) => ({ value: c, label: t(`admin.reports.categories.${c}`) }))}
        error={errors.category ? t(`validation.${errors.category}`) : undefined}
      />
      <Textarea
        label={t('reports.description')}
        hint={t('reports.descriptionHint')}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={2000}
        rows={3}
        error={errors.description ? t(`validation.${errors.description}`) : undefined}
      />
      <FormError code={formError} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {t('reports.submit')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}
