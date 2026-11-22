import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import { Logo } from '../common/Logo.jsx';
import { Container } from '../ui/Container.jsx';

const START_LINKS = [
  { to: '/register?role=worker', labelKey: 'landing.cta.worker.action' },
  { to: '/register?role=employer', labelKey: 'landing.cta.employer.action' },
  { to: '/login', labelKey: 'common.login' },
];

const SAFETY_KEYS = ['landing.footer.safety1', 'landing.footer.safety2', 'landing.footer.safety3'];

export function SiteFooter() {
  const { t } = useTranslation();

  return (
    <footer className="bg-forest-900 text-forest-100">
      <Container className="grid gap-10 py-12 md:grid-cols-[1fr_1fr_1.4fr]">
        <div>
          <Logo tone="light" />
          <p className="mt-3 text-sm">{t('brand.tagline')}</p>
        </div>

        <div>
          <h2 className="font-sans text-base font-bold text-white">{t('landing.footer.getStarted')}</h2>
          <ul className="mt-3 space-y-1">
            {START_LINKS.map(({ to, labelKey }) => (
              <li key={to}>
                <Link to={to} className="inline-flex min-h-10 items-center text-sm hover:text-white hover:underline">
                  {t(labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="font-sans text-base font-bold text-white">{t('landing.footer.safetyTitle')}</h2>
          <ul className="mt-3 space-y-3">
            {SAFETY_KEYS.map((key) => (
              <li key={key} className="flex gap-2.5 text-sm">
                <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-300" />
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>
      </Container>

      <div className="border-t border-forest-800">
        <Container className="py-5 text-xs text-forest-200">
          {t('landing.footer.rights', { year: new Date().getFullYear() })}
        </Container>
      </div>
    </footer>
  );
}
