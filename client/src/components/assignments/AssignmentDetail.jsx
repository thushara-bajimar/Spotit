import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CircleCheck, CircleDot, MapPin, Phone, UserRound } from 'lucide-react';
import { Card } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';
import { Notice } from '../ui/Notice.jsx';
import { Textarea } from '../ui/Textarea.jsx';
import { StateView } from '../ui/StateView.jsx';
import { FormError } from '../forms/FormError.jsx';
import { CategoryIcon } from '../common/CategoryIcon.jsx';
import { Wage } from '../jobs/Wage.jsx';
import { JobFacts } from '../jobs/JobFacts.jsx';
import { AssignmentStatusBadge } from './AssignmentStatusBadge.jsx';
import { PaymentPanel } from '../trust/PaymentPanel.jsx';
import { ReviewPanel } from '../trust/ReviewPanel.jsx';
import { ReportForm } from '../trust/ReportForm.jsx';
import { RatingSummary } from '../ui/Rating.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { assignmentActionRequest, fetchAssignment } from '../../services/assignmentService.js';
import { formatTimestamp, localName } from '../../utils/format.js';
import { cx } from '../../utils/cx.js';

const NEEDS_REASON = ['cancel', 'dispute'];
const ACTION_ORDER = ['start', 'complete', 'dispute', 'cancel'];

/** One action button with an inline confirmation step (and reason box when needed). */
function ActionControl({ action, role, assignmentId, onDone }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const needsReason = NEEDS_REASON.includes(action);
  const primary = action === 'complete' || action === 'start';

  const run = async () => {
    if (needsReason && reason.trim().length < 3) {
      setError({ field: true });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await assignmentActionRequest(role, assignmentId, action, needsReason ? reason.trim() : undefined);
      onDone(action);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button variant={primary ? 'primary' : 'secondary'} fullWidth onClick={() => setOpen(true)}>
        {t(`assignments.actions.${action}.button`)}
      </Button>
    );
  }

  return (
    <div className={cx('rounded-xl border p-4', primary ? 'border-forest-200 bg-forest-50' : 'border-amber-300 bg-amber-100')}>
      <p className="font-semibold text-ink">{t(`assignments.actions.${action}.confirm`)}</p>
      <p className="mt-1 text-sm text-ink">{t(`assignments.actions.${action}.explain.${role}`)}</p>
      {needsReason && (
        <Textarea
          className="mt-3"
          label={t('assignments.reason')}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={500}
          rows={2}
          error={error?.field ? t('validation.required') : undefined}
        />
      )}
      {error && !error.field && <FormError code={error.code} className="mt-2" />}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={run} disabled={busy}>
          {t(`assignments.actions.${action}.yes`)}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}

/** Ordered list of what has happened so far. */
function Timeline({ assignment }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage;
  const steps = [
    ['confirmed', assignment.confirmedAt],
    ['started', assignment.startedAt],
    ['workerConfirmed', assignment.workerConfirmedAt],
    ['employerConfirmed', assignment.employerConfirmedAt],
    ['completed', assignment.completedAt],
    ['cancelled', assignment.cancelledAt, assignment.cancelledBy],
    ['disputed', assignment.disputedAt, assignment.disputedBy],
  ].filter(([, at]) => at);

  return (
    <ol className="space-y-3">
      {steps.map(([key, at, by]) => (
        <li key={key} className="flex gap-3">
          <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-forest-500" />
          <div>
            <p className="text-sm font-semibold text-ink">
              {t(`assignments.timeline.${key}`)}
              {by && <span className="font-normal text-muted"> · {t(`assignments.by.${by}`)}</span>}
            </p>
            <p className="text-xs text-muted">{formatTimestamp(at, language)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * Assignment details for a worker or an employer (`role`). Shows the agreed
 * terms, the other party's contact, history and the allowed next actions.
 */
export function AssignmentDetail({ role }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage;
  const { assignmentId } = useParams();
  const fetcher = useCallback(({ signal }) => fetchAssignment(role, assignmentId, { signal }), [role, assignmentId]);
  const { status, data: assignment, error, retry } = useApiData(fetcher);
  const [flash, setFlash] = useState(null);

  const backTo = role === 'worker' ? '/worker/my-work' : '/employer/assignments';
  const back = (
    <Link to={backTo} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-forest-700 hover:underline">
      <ArrowLeft aria-hidden="true" className="size-4" />
      {t(`assignments.back.${role}`)}
    </Link>
  );

  if (status === 'loading' && !assignment) return <StateView variant="loading" title={t('common.loading')} />;
  if (status === 'error') {
    return (
      <div className="mx-auto max-w-5xl">
        {back}
        <StateView
          className="mt-4"
          variant={error.code === 'ASSIGNMENT_NOT_FOUND' ? 'empty' : 'error'}
          title={error.code === 'ASSIGNMENT_NOT_FOUND' ? t('assignments.notFound') : t('assignments.loadError')}
        />
      </div>
    );
  }

  const { job, payment } = assignment;
  const onPanelChange = (_updated, flashKey) => {
    setFlash(flashKey);
    retry();
  };
  const other = role === 'worker' ? assignment.employer : assignment.worker;
  const actions = ACTION_ORDER.filter((a) => assignment.actions.includes(a));
  const mine = role === 'worker' ? assignment.workerConfirmedAt : assignment.employerConfirmedAt;
  const waitingForOther = assignment.status === 'completion_pending' && mine;

  return (
    <div className="mx-auto max-w-5xl">
      {back}
      {flash && (
        <Notice role="status" className="mt-3">
          {t(`assignments.flash.${flash}`)}
        </Notice>
      )}

      <div className="mt-3 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-forest-50 text-forest-700">
                  <CategoryIcon name={job.category.icon} className="size-6" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted">{localName(job.category, language)}</p>
                  <h1 className="text-2xl font-bold text-forest-900 sm:text-3xl">{job.title}</h1>
                </div>
              </div>
              <AssignmentStatusBadge status={assignment.status} />
            </div>
            <p className="mt-3 text-sm text-ink">
              {waitingForOther ? t(`assignments.waitingFor.${role}`) : t(`assignments.statusHelp.${assignment.status}.${role}`)}
            </p>

            <p className="mt-4 text-sm font-semibold text-muted">{t('assignments.agreedWage')}</p>
            <Wage amount={payment.agreedAmount} basis={payment.wageBasis} size="lg" />

            <JobFacts job={job} showVacancies={false} className="mt-4 border-t border-line pt-4 text-base" />
            <p className="mt-3">
              <Link to={`/${role}/jobs/${job.id}`} className="text-sm font-semibold text-forest-700 hover:underline">
                {t('assignments.viewJob')}
              </Link>
            </p>
          </Card>

          {(assignment.cancellationReason || assignment.disputeReason) && (
            <Notice tone="warning">
              <strong>{t('assignments.reason')}:</strong> {assignment.cancellationReason ?? assignment.disputeReason}
            </Notice>
          )}

          {assignment.status !== 'confirmed' && assignment.status !== 'cancelled' && (
            <PaymentPanel role={role} assignment={assignment} onChange={onPanelChange} />
          )}
          <ReviewPanel role={role} assignment={assignment} onChange={onPanelChange} />

          <Card className="p-5 sm:p-6">
            <h2 className="font-sans text-lg font-bold text-ink">{t(`assignments.contactTitle.${role}`)}</h2>
            <p className="mt-2 flex flex-wrap items-center gap-2 font-semibold text-ink">
              <UserRound aria-hidden="true" className="size-4 text-forest-500" />
              {other.name}
              <RatingSummary rating={other.rating} />
            </p>
            {other.phone && (
              <p className="mt-2 flex items-center gap-2">
                <Phone aria-hidden="true" className="size-4 text-forest-500" />
                <a href={`tel:+91${other.phone}`} className="font-semibold text-forest-700 underline">
                  {other.phone}
                </a>
              </p>
            )}
            {role === 'worker' && job.address && (
              <p className="mt-2 flex items-start gap-2 text-ink">
                <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-forest-500" />
                {job.address}
              </p>
            )}
            {role === 'employer' && (other.locality || other.district) && (
              <p className="mt-2 flex items-center gap-2 text-sm text-muted">
                <MapPin aria-hidden="true" className="size-4" />
                {[other.locality, other.district && localName(other.district, language)].filter(Boolean).join(', ')}
              </p>
            )}
            <div className="mt-4 border-t border-line pt-3">
              <ReportForm
                target={{ type: 'assignment', id: assignment.id }}
                label={t(`reports.reportPerson.${role === 'worker' ? 'employer' : 'worker'}`)}
                categories={['misconduct', 'harassment', 'fake_account', 'unpaid_wage', 'other']}
              />
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="font-sans text-lg font-bold text-ink">{t('assignments.history')}</h2>
            <div className="mt-3">
              <Timeline assignment={assignment} />
            </div>
          </Card>
        </div>

        <Card className="space-y-3 p-5 lg:sticky lg:top-24">
          <h2 className="font-sans text-lg font-bold text-ink">{t('assignments.nextSteps')}</h2>
          {actions.length === 0 ? (
            <p className="flex items-start gap-2 text-sm text-muted">
              <CircleDot aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {assignment.status === 'completed' && assignment.myReview && (payment.workerConfirmedAt || payment.actions.length === 0)
                ? t('assignments.noActions.allDone')
                : t(`assignments.noActions.${assignment.status}`, { defaultValue: t('assignments.noActions.default') })}
            </p>
          ) : (
            actions.map((action) => (
              <ActionControl
                key={`${action}-${assignment.status}`}
                action={action}
                role={role}
                assignmentId={assignment.id}
                onDone={(done) => {
                  setFlash(done);
                  retry();
                }}
              />
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
