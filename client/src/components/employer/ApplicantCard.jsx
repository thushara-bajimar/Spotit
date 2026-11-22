import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { MapPin, MessageSquare, UserRound } from 'lucide-react';
import { ApplicationStatusBadge } from '../jobs/ApplicationStatusBadge.jsx';
import { CategoryIcon } from '../common/CategoryIcon.jsx';
import { formatTimestamp, localName } from '../../utils/format.js';

/**
 * One applicant, as an employer sees them: name, area, the work they can do
 * and their message. Phone numbers are shared only after acceptance (Phase 5).
 */
export function ApplicantCard({ applicant, categories, showJob = false }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage;
  const { worker } = applicant;
  const skills = worker.skills.map((slug) => categories?.find((c) => c.slug === slug)).filter(Boolean);

  return (
    <article className="rounded-2xl border border-line bg-white p-4 shadow-sm shadow-forest-900/5 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-forest-100 text-forest-700">
            <UserRound aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="font-sans text-base font-bold text-ink">{worker.name}</h3>
            {(worker.locality || worker.district) && (
              <p className="flex items-center gap-1 text-sm text-muted">
                <MapPin aria-hidden="true" className="size-3.5" />
                {[worker.locality, worker.district && localName(worker.district, language)].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        </div>
        <ApplicationStatusBadge status={applicant.status} />
      </div>

      {showJob && (
        <p className="mt-3 text-sm">
          <span className="text-muted">{t('employer.applicants.forJob')} </span>
          <Link to={`/employer/jobs/${applicant.job.id}`} className="font-semibold text-forest-700 hover:underline">
            {applicant.job.title}
          </Link>
        </p>
      )}

      {skills.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t('profile.skills')}>
          {skills.map((c) => (
            <li key={c.slug} className="flex items-center gap-1 rounded-full bg-forest-50 px-2.5 py-1 text-xs font-semibold text-forest-800">
              <CategoryIcon name={c.icon} className="size-3.5" />
              {localName(c, language)}
            </li>
          ))}
        </ul>
      )}

      {applicant.message && (
        <blockquote className="mt-3 flex gap-2 rounded-xl bg-cream-50 p-3 text-sm text-ink">
          <MessageSquare aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-forest-500" />
          {/* Worker-written text is shown exactly as written. */}
          <span className="whitespace-pre-line">{applicant.message}</span>
        </blockquote>
      )}

      <p className="mt-3 text-xs text-muted">
        {t('applications.appliedOn', { date: formatTimestamp(applicant.appliedAt, language) })}
      </p>
    </article>
  );
}
