import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { MapPin, MessageSquare, Phone, UserRound } from 'lucide-react';
import { ApplicationStatusBadge } from '../jobs/ApplicationStatusBadge.jsx';
import { CategoryIcon } from '../common/CategoryIcon.jsx';
import { Button } from '../ui/Button.jsx';
import { FormError } from '../forms/FormError.jsx';
import { acceptApplicationRequest, rejectApplicationRequest } from '../../services/employerService.js';
import { formatTimestamp, localName } from '../../utils/format.js';
import { cx } from '../../utils/cx.js';
import { RatingSummary } from '../ui/Rating.jsx';

/** Accept / reject with an inline confirmation step. */
function DecisionControls({ applicant, onDecided }) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(null); // 'accept' | 'reject'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const decide = async () => {
    setBusy(true);
    setError(null);
    try {
      const request = confirming === 'accept' ? acceptApplicationRequest : rejectApplicationRequest;
      const result = await request(applicant.job.id, applicant.id);
      onDecided?.(confirming, { ...result, workerName: applicant.worker.name });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  const errorText =
    error?.code === 'JOB_UNAVAILABLE' && error.details?.reason
      ? t(`jobs.unavailable.${error.details.reason}`)
      : null;

  if (!confirming) {
    return (
      <div className="mt-4 flex flex-wrap gap-2">
        {applicant.canAccept && (
          <Button size="sm" onClick={() => setConfirming('accept')}>
            {t('employer.applicants.accept')}
          </Button>
        )}
        {applicant.canReject && (
          <Button size="sm" variant="secondary" onClick={() => setConfirming('reject')}>
            {t('employer.applicants.reject')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cx(
        'mt-4 rounded-xl border p-3',
        confirming === 'accept' ? 'border-forest-200 bg-forest-50' : 'border-amber-300 bg-amber-100',
      )}
    >
      <p className="text-sm font-semibold text-ink">
        {t(`employer.applicants.${confirming}Confirm`, { name: applicant.worker.name })}
      </p>
      <p className="mt-1 text-sm text-ink">{t(`employer.applicants.${confirming}Explain`)}</p>
      {error && (errorText ? <p className="mt-2 text-sm font-medium text-danger-700">{errorText}</p> : <FormError code={error.code} className="mt-2" />)}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={decide} disabled={busy}>
          {t(`employer.applicants.${confirming}Yes`)}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(null)} disabled={busy}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}

/**
 * One applicant, as an employer sees them: name, area, the work they can do
 * and their message. The phone number appears once they are accepted.
 */
export function ApplicantCard({ applicant, categories, showJob = false, onDecided }) {
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
            <h3 className="flex flex-wrap items-center gap-2 font-sans text-base font-bold text-ink">
              {worker.name}
              <RatingSummary rating={worker.rating} />
            </h3>
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

      {worker.phone && (
        <p className="mt-3 flex items-center gap-2 text-sm">
          <Phone aria-hidden="true" className="size-4 text-forest-500" />
          <a href={`tel:+91${worker.phone}`} className="font-semibold text-forest-700 underline">
            {worker.phone}
          </a>
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          {t('applications.appliedOn', { date: formatTimestamp(applicant.appliedAt, language) })}
        </p>
        {applicant.assignment && (
          <Link
            to={`/employer/assignments/${applicant.assignment.id}`}
            className="text-sm font-semibold text-forest-700 hover:underline"
          >
            {t('employer.applicants.viewAssignment')}
          </Link>
        )}
      </div>

      {(applicant.canAccept || applicant.canReject) && <DecisionControls applicant={applicant} onDecided={onDecided} />}
      {applicant.status === 'pending' && !applicant.canAccept && (
        <p className="mt-3 text-sm text-muted">{t('employer.applicants.cannotAcceptNow')}</p>
      )}
    </article>
  );
}
