import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight, HardHat, Store } from 'lucide-react';
import { Container } from '../ui/Container.jsx';
import { Button } from '../ui/Button.jsx';

/** Separate calls to action for workers and employers. */
export function AudienceCtaSection() {
  const { t } = useTranslation();

  return (
    <section aria-label={t('common.register')} className="py-14 sm:py-20">
      <Container className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col rounded-3xl bg-forest-700 p-7 text-white sm:p-10">
          <span className="grid size-12 place-items-center rounded-xl bg-amber-500 text-ink">
            <HardHat aria-hidden="true" className="size-6" />
          </span>
          <h2 className="mt-5 text-3xl font-bold">{t('landing.cta.worker.title')}</h2>
          <p className="mt-3 flex-1 text-forest-100">{t('landing.cta.worker.text')}</p>
          <Button as={Link} to="/register?role=worker" variant="accent" size="lg" className="mt-7 self-start">
            {t('landing.cta.worker.action')}
            <ArrowRight aria-hidden="true" className="size-5" />
          </Button>
        </div>

        <div
          id="employers"
          className="flex scroll-mt-20 flex-col rounded-3xl border border-amber-300 bg-amber-100 p-7 sm:p-10"
        >
          <span className="grid size-12 place-items-center rounded-xl bg-forest-700 text-cream-100">
            <Store aria-hidden="true" className="size-6" />
          </span>
          <h2 className="mt-5 text-3xl font-bold text-forest-900">{t('landing.cta.employer.title')}</h2>
          <p className="mt-3 flex-1 text-ink">{t('landing.cta.employer.text')}</p>
          <Button as={Link} to="/register?role=employer" size="lg" className="mt-7 self-start">
            {t('landing.cta.employer.action')}
            <ArrowRight aria-hidden="true" className="size-5" />
          </Button>
        </div>
      </Container>
    </section>
  );
}
