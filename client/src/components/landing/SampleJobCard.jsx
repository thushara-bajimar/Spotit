import { useTranslation } from 'react-i18next';
import { BadgeCheck, Calendar, Clock, MapPin, Users } from 'lucide-react';
import { Card } from '../ui/Card.jsx';
import { Badge } from '../ui/Badge.jsx';
import { CategoryIcon } from '../common/CategoryIcon.jsx';
import { SAMPLE_JOB } from '../../data/sampleContent.js';
import { formatDate, formatRupees, formatTime } from '../../utils/format.js';
import { cx } from '../../utils/cx.js';

/**
 * Illustrates a job listing using TEMPORARY SAMPLE CONTENT.
 * Always carries the "Sample listing" badge so it is never mistaken for a real job.
 */
export function SampleJobCard({ className }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage;
  const job = SAMPLE_JOB;

  const details = [
    { icon: MapPin, text: t('landing.sample.locality') },
    { icon: Calendar, text: `${formatDate(job.startDate, language)} · ${t(`duration.${job.durationType}`)}` },
    { icon: Clock, text: `${formatTime(job.startTime, language)} – ${formatTime(job.endTime, language)}` },
    {
      icon: Users,
      text: t('landing.sample.spotsLeft', {
        left: job.workersRequired - job.workersAssigned,
        total: job.workersRequired,
      }),
    },
    { icon: BadgeCheck, text: t('landing.sample.employer') },
  ];

  return (
    <Card className={cx('overflow-hidden p-0', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-cream-50 px-5 py-3">
        <Badge tone="sample">{t('landing.sample.badge')}</Badge>
        <span className="text-xs text-muted">{t('landing.sample.caption')}</span>
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-forest-50 text-forest-700">
            <CategoryIcon name={job.categoryIcon} className="size-6" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted">{t('landing.sample.category')}</p>
            <p className="font-display text-xl leading-snug font-bold text-ink">{t('landing.sample.title')}</p>
          </div>
        </div>

        <p className="mt-5 flex items-baseline gap-1.5">
          <span className="font-display text-4xl font-bold text-forest-800">
            {formatRupees(job.wageAmount, language)}
          </span>
          <span className="text-base font-semibold text-muted">{t(`wage.basis.${job.wageBasis}`)}</span>
        </p>

        <ul className="mt-5 space-y-2.5 border-t border-line pt-5 text-sm text-ink">
          {details.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2.5">
              <Icon aria-hidden="true" className="size-4.5 shrink-0 text-forest-500" />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
