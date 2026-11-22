import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Input } from '../../components/ui/Input.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { StateView } from '../../components/ui/StateView.jsx';
import { JobCard } from '../../components/jobs/JobCard.jsx';
import { JobFilters } from '../../components/jobs/JobFilters.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { fetchJobs } from '../../services/workerService.js';
import { cx } from '../../utils/cx.js';

const FILTER_KEYS = ['category', 'district', 'wageBasis', 'minWage', 'duration', 'date'];
const SORTS = ['newest', 'soonest', 'wage_high', 'wage_low'];

/**
 * Job marketplace. All search/filter/sort/page state lives in the URL, so
 * results survive refresh, the back button works and links can be shared.
 */
export function JobsPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);

  const value = (key) => params.get(key) ?? '';
  const [query, setQuery] = useState(value('q'));
  const urlQuery = value('q');
  useEffect(() => setQuery(urlQuery), [urlQuery]);

  const paramsKey = params.toString();
  const fetcher = useCallback(
    ({ signal }) => fetchJobs(Object.fromEntries(new URLSearchParams(paramsKey)), { signal }),
    [paramsKey],
  );
  const { status, data, error, retry } = useApiData(fetcher);

  /** Applies changes to the URL; any filter change returns to page 1. */
  const update = (changes) => {
    const next = new URLSearchParams(params);
    for (const [key, v] of Object.entries(changes)) {
      if (v === '' || v == null) next.delete(key);
      else next.set(key, String(v));
    }
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: !('page' in changes) });
  };

  const clearFilters = () => update(Object.fromEntries(FILTER_KEYS.map((k) => [k, ''])));
  const activeFilters = FILTER_KEYS.filter((k) => value(k)).length;
  const filterValues = Object.fromEntries(FILTER_KEYS.map((k) => [k, value(k)]));

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-bold text-forest-900">{t('jobs.title')}</h1>
      <p className="mt-1 text-muted">{t('jobs.subtitle')}</p>

      <form
        role="search"
        className="mt-5 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          update({ q: query.trim() });
        }}
      >
        <Input
          label={t('jobs.searchLabel')}
          className="flex-1 [&>label]:sr-only"
          icon={Search}
          type="search"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('jobs.searchPlaceholder')}
          maxLength={100}
          enterKeyHint="search"
        />
        <Button type="submit" className="shrink-0 self-start">
          {t('jobs.search')}
        </Button>
      </form>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <Button
          variant="secondary"
          size="sm"
          className="lg:hidden"
          aria-expanded={showFilters}
          aria-controls="job-filters"
          onClick={() => setShowFilters((s) => !s)}
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          {showFilters ? t('jobs.filters.hide') : t('jobs.filters.show')}
          {activeFilters > 0 && (
            <span className="grid size-5 place-items-center rounded-full bg-forest-700 text-xs text-white">
              {activeFilters}
            </span>
          )}
        </Button>
        <p role="status" className="text-sm font-semibold text-ink lg:order-first">
          {data ? t('jobs.resultCount', { count: data.total }) : ''}
        </p>
        <Select
          label={t('jobs.sort.label')}
          className="w-full sm:w-56 [&>label]:text-xs"
          value={value('sort') || 'newest'}
          onChange={(event) => update({ sort: event.target.value === 'newest' ? '' : event.target.value })}
          options={SORTS.map((s) => ({ value: s, label: t(`jobs.sort.${s}`) }))}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside
          id="job-filters"
          aria-label={t('jobs.filters.title')}
          className={cx('rounded-2xl border border-line bg-white p-4 lg:block lg:self-start', !showFilters && 'hidden')}
        >
          <JobFilters values={filterValues} onChange={(name, v) => update({ [name]: v })} onClear={clearFilters} />
        </aside>

        <section aria-label={t('jobs.resultsLabel')} aria-busy={status === 'loading'}>
          {status === 'error' && (
            <StateView
              variant="error"
              title={t('jobs.loadError')}
              description={t(`errors.${error.code}`, { defaultValue: t('errors.generic') })}
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="secondary" onClick={retry}>
                    {t('common.retry')}
                  </Button>
                  <Button variant="ghost" onClick={() => setParams(new URLSearchParams())}>
                    {t('jobs.filters.clear')}
                  </Button>
                </div>
              }
            />
          )}

          {status === 'loading' && !data && <StateView variant="loading" title={t('common.loading')} />}

          {data && status !== 'error' && data.jobs.length === 0 && (
            <StateView
              variant="empty"
              title={t('jobs.empty')}
              description={t('jobs.emptyHint')}
              action={
                activeFilters > 0 || value('q') ? (
                  <Button variant="secondary" onClick={() => setParams(new URLSearchParams())}>
                    {t('jobs.filters.clear')}
                  </Button>
                ) : null
              }
            />
          )}

          {data && status !== 'error' && data.jobs.length > 0 && (
            <>
              <ul className={cx('grid grid-cols-1 gap-4 xl:grid-cols-2', status === 'loading' && 'opacity-60')}>
                {data.jobs.map((job) => (
                  <li key={job.id}>
                    <JobCard job={job} />
                  </li>
                ))}
              </ul>
              {data.totalPages > 1 && (
                <nav aria-label={t('jobs.pagination')} className="mt-6 flex items-center justify-between gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={data.page <= 1}
                    onClick={() => update({ page: data.page - 1 === 1 ? '' : data.page - 1 })}
                  >
                    {t('jobs.previous')}
                  </Button>
                  <span className="text-sm text-muted">
                    {t('jobs.pageOf', { page: data.page, total: data.totalPages })}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={data.page >= data.totalPages}
                    onClick={() => update({ page: data.page + 1 })}
                  >
                    {t('jobs.next')}
                  </Button>
                </nav>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
