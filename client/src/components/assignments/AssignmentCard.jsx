import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ChevronRight, UserRound } from 'lucide-react';
import { AssignmentStatusBadge } from './AssignmentStatusBadge.jsx';
import { Wage } from '../jobs/Wage.jsx';
import { JobFacts } from '../jobs/JobFacts.jsx';

/** List item for an assignment, for either role. The whole card links to the details. */
export function AssignmentCard({ assignment, role }) {
  const { t } = useTranslation();
  const other = role === 'worker' ? assignment.employer : assignment.worker;

  return (
    <article className="relative rounded-2xl border border-line bg-white p-4 shadow-sm shadow-forest-900/5 hover:border-forest-300 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 font-sans text-lg leading-snug font-bold text-ink">
          <Link
            to={`/${role}/assignments/${assignment.id}`}
            className="after:absolute after:inset-0 after:rounded-2xl focus:outline-none"
          >
            {assignment.job.title}
          </Link>
        </h3>
        <AssignmentStatusBadge status={assignment.status} />
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
        <UserRound aria-hidden="true" className="size-4" />
        {other.name}
      </p>
      <Wage amount={assignment.payment.agreedAmount} basis={assignment.payment.wageBasis} className="mt-3" />
      <JobFacts job={assignment.job} showVacancies={false} className="mt-2" />
      {/* Highlight only when the other side is waiting for this user's confirmation. */}
      {assignment.status === 'completion_pending' && assignment.actions.includes('complete') && (
        <p className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-amber-100 px-3 py-2 text-sm font-semibold text-ink">
          {t('assignments.actionNeeded')}
          <ChevronRight aria-hidden="true" className="size-4" />
        </p>
      )}
    </article>
  );
}
