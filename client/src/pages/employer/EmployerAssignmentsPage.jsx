import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AssignmentList } from '../../components/assignments/AssignmentList.jsx';

const GROUPS = ['active', 'completed', 'cancelled'];

/** All confirmed workers across the employer's jobs. */
export function EmployerAssignmentsPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const group = GROUPS.includes(params.get('group')) ? params.get('group') : 'active';

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold text-forest-900">{t('assignments.employerTitle')}</h1>
      <p className="mt-1 text-muted">{t('assignments.employerSubtitle')}</p>
      <div className="mt-5">
        <AssignmentList
          role="employer"
          group={group}
          onGroupChange={(g) => setParams(g === 'active' ? {} : { group: g }, { replace: true })}
        />
      </div>
    </div>
  );
}
