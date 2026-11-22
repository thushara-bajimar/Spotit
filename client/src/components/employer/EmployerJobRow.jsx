import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Users } from 'lucide-react';
import { JobStatusBadge } from './JobStatusBadge.jsx';
import { Wage } from '../jobs/Wage.jsx';
import { formatDateRange } from '../../utils/format.js';

/** Compact row for the employer's own job lists (dashboard and My Jobs). */
export function EmployerJobRow({ job }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage;

  return (
    <article className="relative rounded-2xl border border-line bg-white p-4 shadow-sm shadow-forest-900/5 hover:border-forest-300 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 font-sans text-base leading-snug font-bold text-ink sm:text-lg">
          <Link to={`/employer/jobs/${job.id}`} className="after:absolute after:inset-0 after:rounded-2xl focus:outline-none">
            {job.title}
          </Link>
        </h3>
        <JobStatusBadge job={job} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        <Wage amount={job.wageAmount} basis={job.wageBasis} className="[&>span:first-child]:text-lg" />
        <span>{formatDateRange(job.startDate, job.endDate, language)}</span>
        <span>{t('employer.jobs.workersSummary', { assigned: job.workersAssigned, required: job.workersRequired })}</span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-1.5 font-semibold text-ink">
          <Users aria-hidden="true" className="size-4 text-forest-500" />
          {t('employer.jobs.applicantsSummary', { count: job.applicants.total, pending: job.applicants.pending })}
        </span>
        <ChevronRight aria-hidden="true" className="size-5 text-forest-700" />
      </div>
    </article>
  );
}
