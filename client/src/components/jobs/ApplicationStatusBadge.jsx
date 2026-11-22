import { useTranslation } from 'react-i18next';
import { Badge } from '../ui/Badge.jsx';

const TONES = { pending: 'warning', accepted: 'success', rejected: 'danger', withdrawn: 'neutral' };

/** Application status shown as text + colour (never colour alone). */
export function ApplicationStatusBadge({ status, className }) {
  const { t } = useTranslation();
  if (!status) return null;
  return (
    <Badge tone={TONES[status] ?? 'neutral'} className={className}>
      {t(`applicationStatus.${status}`)}
    </Badge>
  );
}
