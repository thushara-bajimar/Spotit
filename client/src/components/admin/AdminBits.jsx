import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, History } from 'lucide-react';
import { Badge } from '../ui/Badge.jsx';
import { Card } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';
import { StateView } from '../ui/StateView.jsx';
import { formatTimestamp } from '../../utils/format.js';
import { cx } from '../../utils/cx.js';

/** Small building blocks shared by the admin pages. */

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold text-forest-900">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function BackLink({ to, label }) {
  return (
    <Link to={to} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-forest-700 hover:underline">
      <ArrowLeft aria-hidden="true" className="size-4" />
      {label}
    </Link>
  );
}

/** Pill tabs bound to a value; `options` = [{ value, label, count? }]. */
export function FilterTabs({ value, options, onChange, label }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 pb-1">
      <ul className="flex gap-2">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <li key={option.value || 'all'}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onChange(option.value)}
                className={cx(
                  'flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors',
                  active ? 'border-forest-700 bg-forest-700 text-white' : 'border-line bg-white text-ink hover:bg-forest-50',
                )}
              >
                {option.label}
                {option.count != null && <span className={active ? 'text-forest-100' : 'text-muted'}>({option.count})</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const TONES = {
  pending: 'warning', approved: 'success', rejected: 'danger',
  active: 'success', suspended: 'danger',
  under_review: 'warning', resolved: 'success', dismissed: 'neutral',
  visible: 'success', hidden: 'danger',
};

/** Status badge for admin lists; text comes from `admin.status.<value>`. */
export function AdminStatusBadge({ status, className }) {
  const { t } = useTranslation();
  return (
    <Badge tone={TONES[status] ?? 'neutral'} className={className}>
      {t(`admin.status.${status}`)}
    </Badge>
  );
}

/** Loading / error / empty handling for a useApiData result; renders children(data) otherwise. */
export function DataState({ result, emptyTitle, isEmpty = (d) => Array.isArray(d) && d.length === 0, children }) {
  const { t } = useTranslation();
  if (result.status === 'loading' && !result.data) return <StateView variant="loading" title={t('common.loading')} />;
  if (result.status === 'error') {
    const notFound = result.error?.status === 404;
    return (
      <StateView
        variant={notFound ? 'empty' : 'error'}
        title={notFound ? t('admin.notFound') : t('admin.loadError')}
        description={notFound ? null : t(`errors.${result.error?.code}`, { defaultValue: t('errors.generic') })}
        action={
          notFound ? null : (
            <Button variant="secondary" onClick={result.retry}>
              {t('common.retry')}
            </Button>
          )
        }
      />
    );
  }
  if (isEmpty(result.data)) return <StateView variant="empty" title={emptyTitle} />;
  return children(result.data);
}

/** Recent audit entries for one record. */
export function DecisionHistory({ history }) {
  const { t, i18n } = useTranslation();
  if (!history?.length) return null;
  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 font-sans text-lg font-bold text-ink">
        <History aria-hidden="true" className="size-5 text-forest-500" />
        {t('admin.history')}
      </h2>
      <ol className="mt-3 space-y-3">
        {history.map((entry) => (
          <li key={entry.id} className="text-sm">
            <p className="font-semibold text-ink">{t(`admin.actions.${entry.action}`, { defaultValue: entry.action })}</p>
            {entry.reason && <p className="text-ink">“{entry.reason}”</p>}
            <p className="text-xs text-muted">
              {entry.adminName} · {formatTimestamp(entry.createdAt, i18n.resolvedLanguage)}
            </p>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/** Label/value rows for detail pages. */
export function DetailRows({ rows }) {
  return (
    <dl className="divide-y divide-line">
      {rows
        .filter(([, value]) => value !== undefined)
        .map(([label, value]) => (
          <div key={label} className="grid gap-1 py-2.5 sm:grid-cols-[180px_1fr]">
            <dt className="text-sm font-semibold text-muted">{label}</dt>
            <dd className="break-words whitespace-pre-line text-ink">{value || '–'}</dd>
          </div>
        ))}
    </dl>
  );
}
