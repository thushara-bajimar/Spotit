import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, ChevronRight } from 'lucide-react';
import { CategoryIcon } from '../common/CategoryIcon.jsx';
import { Wage } from './Wage.jsx';
import { JobFacts } from './JobFacts.jsx';
import { ApplicationStatusBadge } from './ApplicationStatusBadge.jsx';
import { localName } from '../../utils/format.js';
import { RatingSummary } from '../ui/Rating.jsx';

/** Marketplace job card. The whole card is one link to the job details. */
export function JobCard({ job }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage;

  return (
    <article className="relative flex flex-col rounded-2xl border border-line bg-white p-5 shadow-sm shadow-forest-900/5 transition-colors focus-within:border-forest-500 hover:border-forest-300">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-forest-50 text-forest-700">
          <CategoryIcon name={job.category.icon} className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted">{localName(job.category, language)}</p>
          <h2 className="font-sans text-lg leading-snug font-bold text-ink">
            {/* Stretched link: the whole card is clickable, but only one link is announced. */}
            <Link to={`/worker/jobs/${job.id}`} className="after:absolute after:inset-0 after:rounded-2xl focus:outline-none">
              {job.title}
            </Link>
          </h2>
        </div>
        <ApplicationStatusBadge status={job.myApplicationStatus} className="shrink-0" />
      </div>

      <Wage amount={job.wageAmount} basis={job.wageBasis} className="mt-4" />
      <JobFacts job={job} className="mt-3 border-t border-line pt-3" />

      <div className="mt-4 flex items-center justify-between gap-3 text-sm">
        <span className="flex min-w-0 items-center gap-1.5 text-muted">
          {job.employer.verified && <BadgeCheck aria-hidden="true" className="size-4 shrink-0 text-forest-500" />}
          <span className="truncate">{job.employer.name}</span>
          {job.employer.rating?.count > 0 && <RatingSummary rating={job.employer.rating} className="shrink-0" />}
        </span>
        <span className="flex shrink-0 items-center gap-1 font-semibold text-forest-700">
          {t('jobs.viewDetails')}
          <ChevronRight aria-hidden="true" className="size-4" />
        </span>
      </div>
    </article>
  );
}
