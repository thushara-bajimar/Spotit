import { useTranslation } from 'react-i18next';
import { Badge } from '../ui/Badge.jsx';

const TONES = {
  confirmed: 'success',
  in_progress: 'success',
  completion_pending: 'warning',
  completed: 'neutral',
  cancelled: 'neutral',
  disputed: 'danger',
};

export function AssignmentStatusBadge({ status, className }) {
  const { t } = useTranslation();
  return (
    <Badge tone={TONES[status] ?? 'neutral'} className={className}>
      {t(`assignments.status.${status}`)}
    </Badge>
  );
}
