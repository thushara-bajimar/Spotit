import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react';
import { Container } from '../ui/Container.jsx';
import { TrustPoints } from '../common/TrustPoints.jsx';
import { SearchPanel } from './SearchPanel.jsx';
import { SampleJobCard } from './SampleJobCard.jsx';

export function HeroSection() {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden bg-cream-100">
      {/* Single soft decorative shape — kept subtle on purpose. */}
      <div
        aria-hidden="true"
        className="absolute -top-32 -right-32 hidden size-[28rem] rounded-full bg-amber-300/25 lg:block"
      />
      <Container className="relative grid items-center gap-10 py-10 sm:py-14 lg:grid-cols-[1.2fr_0.8fr] lg:gap-14 lg:py-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-forest-100 bg-white px-3 py-1 text-sm font-semibold text-forest-700">
            <MapPin aria-hidden="true" className="size-4 text-amber-700" />
            {t('brand.tagline')}
          </p>
          <h1 id="hero-title" className="mt-5 text-4xl font-bold text-forest-900 sm:text-5xl lg:text-[3.5rem]">
            {t('landing.hero.title')}
            <span className="block text-amber-700">{t('landing.hero.titleAccent')}</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">{t('landing.hero.subtitle')}</p>

          <SearchPanel className="mt-8" />
          <TrustPoints className="mt-8 grid gap-4 sm:grid-cols-3" />
        </div>

        <SampleJobCard className="mx-auto w-full max-w-md" />
      </Container>
    </section>
  );
}
