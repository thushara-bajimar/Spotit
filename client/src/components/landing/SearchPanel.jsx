import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Search } from 'lucide-react';
import { Input } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Badge } from '../ui/Badge.jsx';
import { cx } from '../../utils/cx.js';

/**
 * Job search UI — PLACEHOLDER in Phase 1. It does not search anything yet;
 * a visible "Preview" note says so. Real search (Phase 3) will navigate to
 * the jobs page with these values as filters.
 */
export function SearchPanel({ className }) {
  const { t } = useTranslation();
  const [attempted, setAttempted] = useState(false);

  return (
    <form
      role="search"
      aria-label={t('landing.search.label')}
      onSubmit={(event) => {
        event.preventDefault();
        setAttempted(true);
      }}
      className={cx('rounded-2xl border border-line bg-white p-4 shadow-sm shadow-forest-900/5', className)}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Input
          label={t('landing.search.whatLabel')}
          placeholder={t('landing.search.whatPlaceholder')}
          icon={Search}
          name="q"
          autoComplete="off"
        />
        <Input
          label={t('landing.search.whereLabel')}
          placeholder={t('landing.search.wherePlaceholder')}
          icon={MapPin}
          name="location"
          autoComplete="address-level2"
        />
        <Button type="submit">{t('landing.search.submit')}</Button>
      </div>
      <p
        role="status"
        className={cx(
          'mt-3 flex flex-wrap items-center gap-2 rounded-lg text-sm transition-colors',
          attempted ? 'bg-amber-100 px-3 py-2 text-ink' : 'text-muted',
        )}
      >
        <Badge tone="warning">{t('common.preview')}</Badge>
        {t('landing.search.previewNote')}
      </p>
    </form>
  );
}
