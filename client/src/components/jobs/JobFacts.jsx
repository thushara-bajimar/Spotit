import { useTranslation } from 'react-i18next';
import { Calendar, Clock, Hourglass, MapPin, Users } from 'lucide-react';
import { formatDateRange, formatTime, localName } from '../../utils/format.js';
import { cx } from '../../utils/cx.js';

/**
 * Location, date, timings, duration and places left — in the same order and
 * with the same icons everywhere, so workers learn where to look.
 */
export function JobFacts({ job, className, showVacancies = true }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage;

  const facts = [
    { icon: MapPin, label: t('jobs.facts.location'), text: `${job.locality}, ${localName(job.district, language)}` },
    { icon: Calendar, label: t('jobs.facts.date'), text: formatDateRange(job.startDate, job.endDate, language) },
    {
      icon: Clock,
      label: t('jobs.facts.timings'),
      text: `${formatTime(job.startTime, language)} – ${formatTime(job.endTime, language)}`,
    },
    { icon: Hourglass, label: t('jobs.facts.duration'), text: t(`duration.${job.durationType}`) },
  ];
  if (showVacancies) {
    facts.push({
      icon: Users,
      label: t('jobs.facts.places'),
      text: t('jobs.vacancies', { count: job.vacancies }),
    });
  }

  return (
    <dl className={cx('grid gap-2 text-sm text-ink', className)}>
      {facts.map(({ icon: Icon, label, text }) => (
        <div key={label} className="flex items-start gap-2.5">
          <dt className="pt-0.5">
            <Icon aria-hidden="true" className="size-4.5 shrink-0 text-forest-500" />
            <span className="sr-only">{label}</span>
          </dt>
          <dd>{text}</dd>
        </div>
      ))}
    </dl>
  );
}
