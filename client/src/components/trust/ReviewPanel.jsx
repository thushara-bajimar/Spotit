import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';
import { Textarea } from '../ui/Textarea.jsx';
import { Stars, StarInput } from '../ui/Rating.jsx';
import { FormError } from '../forms/FormError.jsx';
import { submitReviewRequest } from '../../services/trustService.js';
import { formatTimestamp } from '../../utils/format.js';

function ReviewView({ review, title }) {
  const { t, i18n } = useTranslation();
  return (
    <div>
      <p className="text-sm font-semibold text-muted">{title}</p>
      <Stars value={review.rating} className="mt-1" />
      {review.comment && <p className="mt-1 whitespace-pre-line text-ink">“{review.comment}”</p>}
      <p className="text-xs text-muted">{formatTimestamp(review.createdAt, i18n.resolvedLanguage)}</p>
      {review.hidden && <p className="mt-1 text-xs text-danger-700">{t('ratings.hiddenByAdmin')}</p>}
    </div>
  );
}

/** Two-way rating after completed work: my rating form/result and theirs. */
export function ReviewPanel({ role, assignment, onChange }) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const otherRole = role === 'worker' ? 'employer' : 'worker';

  if (assignment.status !== 'completed') return null;

  const submit = async (event) => {
    event.preventDefault();
    if (!rating) {
      setError({ field: true });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onChange(await submitReviewRequest(role, assignment.id, { rating, comment: comment.trim() }), 'review');
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <h2 className="font-sans text-lg font-bold text-ink">{t('ratings.title')}</h2>
      {assignment.myReview ? (
        <ReviewView review={assignment.myReview} title={t('ratings.yourRating')} />
      ) : (
        assignment.canReview && (
          <form onSubmit={submit} noValidate className="space-y-3">
            <StarInput
              label={t(`ratings.rateThe.${otherRole}`)}
              value={rating}
              onChange={setRating}
              error={error?.field ? t('ratings.pickStars') : undefined}
            />
            <Textarea label={t('ratings.comment')} optionalLabel={t('common.optional')} hint={t('ratings.commentHint')}
              value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={3} />
            {error && !error.field && <FormError code={error.code} />}
            <Button type="submit" disabled={busy}>
              {t('ratings.submit')}
            </Button>
          </form>
        )
      )}
      {assignment.theirReview ? (
        <ReviewView review={assignment.theirReview} title={t(`ratings.theirRating.${otherRole}`)} />
      ) : (
        <p className="text-sm text-muted">{t(`ratings.notYetRated.${otherRole}`)}</p>
      )}
    </Card>
  );
}
