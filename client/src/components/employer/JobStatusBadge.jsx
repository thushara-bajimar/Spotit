import { useTranslation } from 'react-i18next';
import { Badge } from '../ui/Badge.jsx';

/**
 * One clear status for the employer, combining admin approval and lifecycle:
 * an open job is "Waiting for approval", "Live" or "Not approved"; otherwise
 * the lifecycle status (filled, closed, expired …) is shown.
 */
export function employerJobStatus(job) {
  if (job.status === 'open') {
    if (job.approvalStatus === 'pending') return 'pending_approval';
    if (job.approvalStatus === 'rejected') return 'rejected';
    return 'live';
  }
  return job.status;
}

const TONES = {
  pending_approval: 'warning',
  rejected: 'danger',
  live: 'success',
  filled: 'success',
  in_progress: 'success',
  completed: 'neutral',
  closed: 'neutral',
  cancelled: 'neutral',
  expired: 'neutral',
  draft: 'neutral',
};

export function JobStatusBadge({ job, className }) {
  const { t } = useTranslation();
  const status = employerJobStatus(job);
  return (
    <Badge tone={TONES[status] ?? 'neutral'} className={className}>
      {t(`employer.jobStatus.${status}`)}
    </Badge>
  );
}
