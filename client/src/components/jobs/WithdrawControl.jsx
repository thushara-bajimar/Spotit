import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button.jsx';
import { FormError } from '../forms/FormError.jsx';
import { withdrawApplicationRequest } from '../../services/workerService.js';

/**
 * "Withdraw application" with an inline confirmation step (no pop-up dialog,
 * which is easier on small phones and for screen readers).
 */
export function WithdrawControl({ applicationId, onWithdrawn }) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState(null);

  const withdraw = async () => {
    setBusy(true);
    setErrorCode(null);
    try {
      const application = await withdrawApplicationRequest(applicationId);
      setConfirming(false);
      onWithdrawn?.(application);
    } catch (error) {
      setErrorCode(error.code ?? 'generic');
    } finally {
      setBusy(false);
    }
  };

  if (!confirming) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
        {t('applications.withdraw')}
      </Button>
    );
  }

  return (
    <div role="group" aria-label={t('applications.withdraw')} className="rounded-xl border border-amber-300 bg-amber-100 p-3">
      <p className="text-sm font-semibold text-ink">{t('applications.withdrawConfirm')}</p>
      <FormError code={errorCode} className="mt-2" />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={withdraw} disabled={busy}>
          {t('applications.withdrawYes')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}
