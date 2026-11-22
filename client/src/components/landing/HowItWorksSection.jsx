import { useTranslation } from 'react-i18next';
import { HardHat, Store } from 'lucide-react';
import { Container } from '../ui/Container.jsx';
import { Card } from '../ui/Card.jsx';
import { SectionHeading } from './SectionHeading.jsx';

const AUDIENCES = [
  { key: 'workers', icon: HardHat },
  { key: 'employers', icon: Store },
];
const STEPS = [1, 2, 3];

export function HowItWorksSection() {
  const { t } = useTranslation();

  return (
    <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-20 bg-white py-14 sm:py-20">
      <Container>
        <SectionHeading id="how-title" title={t('landing.how.title')} subtitle={t('landing.how.subtitle')} />

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {AUDIENCES.map(({ key, icon: Icon }) => (
            <Card key={key} className="bg-cream-50 p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-forest-700 text-cream-100">
                  <Icon aria-hidden="true" className="size-6" />
                </span>
                <h3 className="text-2xl font-bold text-forest-900">{t(`landing.how.${key}.title`)}</h3>
              </div>

              <ol className="mt-6 space-y-5">
                {STEPS.map((step) => (
                  <li key={step} className="flex gap-4">
                    <span
                      aria-hidden="true"
                      className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-500 font-bold text-ink"
                    >
                      {step}
                    </span>
                    <div>
                      <p className="font-semibold text-ink">{t(`landing.how.${key}.step${step}Title`)}</p>
                      <p className="mt-0.5 text-sm text-muted">{t(`landing.how.${key}.step${step}Text`)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}
