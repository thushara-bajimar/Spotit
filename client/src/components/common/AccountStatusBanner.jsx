import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext.jsx';
import { cx } from '../../utils/cx.js';

/**
 * Explains account restrictions at the top of the dashboard.
 * Currently: employers awaiting admin approval or rejected.
 */
export function AccountStatusBanner() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const status = user?.employer?.verificationStatus;

  if (status !== 'pending' && status !== 'rejected') return null;

  const rejected = status === 'rejected';
  return (
    <p
      role="status"
      className={cx(
        'border-t px-4 py-2 text-center text-xs sm:text-sm',
        rejected ? 'border-danger-700/30 bg-danger-50 text-danger-700' : 'border-amber-300 bg-amber-100 text-ink',
      )}
    >
      {rejected
        ? t('dashboard.employerRejected', { reason: user.employer.rejectionReason })
        : t('dashboard.employerPending')}
    </p>
  );
}
