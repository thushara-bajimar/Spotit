import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleCheck, IndianRupee } from 'lucide-react';
import { Card } from '../ui/Card.jsx';
import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';
import { ConfirmAction } from '../ui/ConfirmAction.jsx';
import { FormError } from '../forms/FormError.jsx';
import { Wage } from '../jobs/Wage.jsx';
import { paymentActionRequest } from '../../services/trustService.js';
import { formatDate, formatRupees, formatTimestamp } from '../../utils/format.js';
import { todayInIndia } from '../../utils/dates.js';

const TONE = { pending: 'warning', paid: 'success', disputed: 'danger' };

/** Employer form: amount actually paid + date (+ optional note). */
function MarkPaidForm({ assignmentId, payment, onDone }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(payment.agreedAmount));
  const [paidOn, setPaidOn] = useState(todayInIndia());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!open) {
    return (
      <Button fullWidth onClick={() => setOpen(true)}>
        {t('payments.markPaid')}
      </Button>
    );
  }

  const fieldError = (field) => {
    const detail = Array.isArray(error?.details) && error.details.find((d) => d.field === field);
    return detail ? t(`validation.${detail.code}`) : undefined;
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const assignment = await paymentActionRequest('employer', assignmentId, 'markPaid', {
        amountPaid: Number(amount),
        paidOn,
        note: note.trim() || undefined,
      });
      onDone(assignment, 'markPaid');
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-3 rounded-xl border border-forest-200 bg-forest-50 p-4">
      <p className="text-sm text-ink">{t('payments.markPaidExplain')}</p>
      <Input label={t('payments.amountPaid')} icon={IndianRupee} type="number" inputMode="numeric" min={1}
        value={amount} onChange={(e) => setAmount(e.target.value)} error={fieldError('amountPaid')} />
      <Input label={t('payments.paidOn')} type="date" max={todayInIndia()} value={paidOn}
        onChange={(e) => setPaidOn(e.target.value)} error={fieldError('paidOn')} />
      <Input label={t('payments.note')} optionalLabel={t('common.optional')} hint={t('payments.noteHint')}
        value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
      {error && !Array.isArray(error.details) && <FormError code={error.code} />}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {t('payments.markPaidYes')}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}

/**
 * Payment record for an assignment. SpotIt only RECORDS payments made
 * outside the app; it never moves money or guarantees payment.
 */
export function PaymentPanel({ role, assignment, onChange }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage;
  const { payment } = assignment;
  const done = (updated, action) => onChange(updated, `payment.${action}`);

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-sans text-lg font-bold text-ink">{t('payments.title')}</h2>
        <Badge tone={TONE[payment.status] ?? 'neutral'}>{t(`assignments.payment.${payment.status}`)}</Badge>
      </div>

      <p className="mt-3 text-sm font-semibold text-muted">{t('assignments.agreedWage')}</p>
      <Wage amount={payment.agreedAmount} basis={payment.wageBasis} />

      {payment.status !== 'pending' && payment.amountPaid != null && (
        <p className="mt-3 text-sm text-ink">
          {t('payments.recorded', {
            amount: formatRupees(payment.amountPaid, language),
            date: formatDate(payment.paidOn, language),
          })}
          {payment.notes && <span className="block text-muted">“{payment.notes}”</span>}
        </p>
      )}
      {payment.workerConfirmedAt && (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-forest-700">
          <CircleCheck aria-hidden="true" className="size-4" />
          {t('payments.workerConfirmed', { date: formatTimestamp(payment.workerConfirmedAt, language) })}
        </p>
      )}
      {payment.status === 'disputed' && (
        <p className="mt-2 rounded-xl bg-danger-50 p-3 text-sm text-danger-700">
          {t('payments.disputed')}: {payment.disputeReason}
        </p>
      )}
      {payment.actions.length === 0 && !payment.workerConfirmedAt && (
        <p className="mt-3 text-sm text-muted">{t(`payments.waiting.${role}.${payment.status}`)}</p>
      )}

      <div className="mt-4 space-y-3">
        {payment.actions.includes('markPaid') && (
          <MarkPaidForm assignmentId={assignment.id} payment={payment} onDone={done} />
        )}
        {payment.actions.includes('confirm') && (
          <ConfirmAction variant="primary" tone="positive" label={t('payments.confirm')}
            title={t('payments.confirmTitle')} explain={t('payments.confirmExplain')} yesLabel={t('payments.confirmYes')}
            onConfirm={async () => done(await paymentActionRequest('worker', assignment.id, 'confirm'), 'confirm')} />
        )}
        {payment.actions.includes('dispute') && (
          <ConfirmAction label={t('payments.dispute')} title={t('payments.disputeTitle')}
            explain={t('payments.disputeExplain')} yesLabel={t('payments.disputeYes')} reason="required"
            onConfirm={async (reason) => done(await paymentActionRequest('worker', assignment.id, 'dispute', { reason }), 'dispute')} />
        )}
      </div>
      <p className="mt-4 text-xs text-muted">{t('payments.disclaimer')}</p>
    </Card>
  );
}
