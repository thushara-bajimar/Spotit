import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CircleCheck, Lock, MapPin, Phone } from 'lucide-react';
import { Card } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';
import { Notice } from '../ui/Notice.jsx';
import { Textarea } from '../ui/Textarea.jsx';
import { FormError } from '../forms/FormError.jsx';
import { ApplicationStatusBadge } from './ApplicationStatusBadge.jsx';
import { WithdrawControl } from './WithdrawControl.jsx';
import { applyToJobRequest } from '../../services/workerService.js';
import { formatTimestamp } from '../../utils/format.js';

const MESSAGE_MAX = 500;

/**
 * Everything about "me and this job": apply form, my application status,
 * withdrawal, and (once accepted) the employer's contact details.
 * `onChange` reloads the job after an apply/withdraw.
 */
export function ApplyPanel({ job, onChange }) {
  const { t, i18n } = useTranslation();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [flash, setFlash] = useState(null);

  const application = job.myApplication;
  const { canApply, reason } = job.availability;
  const hasActiveApplication = application && application.status !== 'withdrawn';

  const apply = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFlash(null);
    try {
      await applyToJobRequest(job.id, message.trim());
      setMessage('');
      setFlash('applied');
      onChange();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const errorText = () => {
    if (!error) return null;
    if (error.code === 'JOB_UNAVAILABLE' && error.details?.reason) return t(`jobs.unavailable.${error.details.reason}`);
    if (Array.isArray(error.details)) return t(`validation.${error.details[0].code}`);
    return null;
  };

  return (
    <Card className="p-5 sm:p-6">
      {flash === 'applied' && (
        <Notice role="status" className="mb-4">
          {t('applications.applied')}
        </Notice>
      )}
      {flash === 'withdrawn' && (
        <Notice role="status" className="mb-4">
          {t('applications.withdrawn')}
        </Notice>
      )}

      {hasActiveApplication ? (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-sans text-lg font-bold text-ink">{t('applications.yourApplication')}</h2>
            <ApplicationStatusBadge status={application.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {t('applications.appliedOn', { date: formatTimestamp(application.appliedAt, i18n.resolvedLanguage) })}
          </p>
          <p className="mt-3 text-sm text-ink">{t(`applications.statusHelp.${application.status}`)}</p>
          {application.assignmentId && (
            <Button as={Link} to={`/worker/assignments/${application.assignmentId}`} fullWidth className="mt-4">
              {t('applications.viewAssignment')}
            </Button>
          )}
          {application.status === 'pending' && (
            <div className="mt-4">
              <WithdrawControl
                applicationId={application.id}
                onWithdrawn={() => {
                  setFlash('withdrawn');
                  onChange();
                }}
              />
            </div>
          )}
        </div>
      ) : canApply ? (
        <form onSubmit={apply} noValidate>
          <h2 className="font-sans text-lg font-bold text-ink">
            {application?.status === 'withdrawn' ? t('applications.applyAgain') : t('applications.applyTitle')}
          </h2>
          <Textarea
            className="mt-4"
            label={t('applications.messageLabel')}
            optionalLabel={t('common.optional')}
            hint={t('applications.messageHint')}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={MESSAGE_MAX}
          />
          {error && (
            <div className="mt-3">
              {errorText() ? <Notice tone="warning" role="alert">{errorText()}</Notice> : <FormError code={error.code} />}
            </div>
          )}
          <Button type="submit" size="lg" fullWidth className="mt-4" disabled={busy}>
            {busy ? t('applications.applying') : t('applications.apply')}
          </Button>
        </form>
      ) : (
        <div>
          <h2 className="font-sans text-lg font-bold text-ink">{t('applications.unavailableTitle')}</h2>
          <p className="mt-2 text-sm text-muted">{t(`jobs.unavailable.${reason ?? 'closed'}`)}</p>
        </div>
      )}

      <div className="mt-5 border-t border-line pt-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
          {job.contact ? (
            <CircleCheck aria-hidden="true" className="size-4 text-forest-500" />
          ) : (
            <Lock aria-hidden="true" className="size-4 text-muted" />
          )}
          {t('jobDetails.contactTitle')}
        </h3>
        {job.contact ? (
          <dl className="mt-2 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <dt>
                <Phone aria-hidden="true" className="size-4 text-forest-500" />
                <span className="sr-only">{t('jobDetails.contactPhone')}</span>
              </dt>
              <dd>
                <a href={`tel:+91${job.contact.phone}`} className="font-semibold text-forest-700 underline">
                  {job.contact.phone}
                </a>
              </dd>
            </div>
            {job.contact.address && (
              <div className="flex items-start gap-2">
                <dt className="pt-0.5">
                  <MapPin aria-hidden="true" className="size-4 text-forest-500" />
                  <span className="sr-only">{t('jobDetails.contactAddress')}</span>
                </dt>
                <dd>{job.contact.address}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="mt-1 text-sm text-muted">{t('jobDetails.contactHidden')}</p>
        )}
      </div>
    </Card>
  );
}
