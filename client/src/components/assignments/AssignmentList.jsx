import { useCallback } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button.jsx';
import { StateView } from '../ui/StateView.jsx';
import { AssignmentCard } from './AssignmentCard.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { fetchAssignments } from '../../services/assignmentService.js';
import { cx } from '../../utils/cx.js';

const GROUPS = ['active', 'completed', 'cancelled'];

/** Assignments for one role, with Active / Completed / Cancelled tabs. */
export function AssignmentList({ role, group, onGroupChange }) {
  const { t } = useTranslation();
  const fetcher = useCallback(({ signal }) => fetchAssignments(role, { group }, { signal }), [role, group]);
  const { status, data, error, retry } = useApiData(fetcher);

  return (
    <div>
      <ul className="flex flex-wrap gap-2" aria-label={t('applications.filterLabel')}>
        {GROUPS.map((g) => (
          <li key={g}>
            <button
              type="button"
              aria-pressed={g === group}
              onClick={() => onGroupChange(g)}
              className={cx(
                'min-h-10 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors',
                g === group ? 'border-forest-700 bg-forest-700 text-white' : 'border-line bg-white text-ink hover:bg-forest-50',
              )}
            >
              {t(`assignments.groups.${g}`)}
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4">
        {status === 'loading' && !data && <StateView variant="loading" title={t('common.loading')} />}
        {status === 'error' && (
          <StateView
            variant="error"
            title={t('assignments.loadError')}
            description={t(`errors.${error.code}`, { defaultValue: t('errors.generic') })}
            action={
              <Button variant="secondary" onClick={retry}>
                {t('common.retry')}
              </Button>
            }
          />
        )}
        {data && status !== 'error' && data.length === 0 && (
          <StateView
            variant="empty"
            title={t(`assignments.empty.${group}.${role}`)}
            action={
              group === 'active' ? (
                <Button as={Link} to={role === 'worker' ? '/worker/jobs' : '/employer/applicants?status=pending'}>
                  {t(`assignments.emptyAction.${role}`)}
                </Button>
              ) : null
            }
          />
        )}
        {data && status !== 'error' && data.length > 0 && (
          <ul className="space-y-3">
            {data.map((assignment) => (
              <li key={assignment.id}>
                <AssignmentCard assignment={assignment} role={role} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
