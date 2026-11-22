import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Logo } from '../common/Logo.jsx';
import { LanguageToggle } from '../common/LanguageToggle.jsx';
import { Button } from '../ui/Button.jsx';
import { Container } from '../ui/Container.jsx';

const SECTION_LINKS = [
  { href: '/#how-it-works', labelKey: 'landing.header.howItWorks' },
  { href: '/#employers', labelKey: 'landing.header.forEmployers' },
];

export function SiteHeader() {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-cream-50">
      <Container className="flex h-16 items-center gap-2 sm:gap-3">
        <Logo />
        <nav aria-label={t('common.mainNavigation')} className="ml-6 hidden items-center gap-1 lg:flex">
          {SECTION_LINKS.map(({ href, labelKey }) => (
            <a
              key={href}
              href={href}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-forest-800 hover:bg-forest-50"
            >
              {t(labelKey)}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <LanguageToggle />
          <Button as={Link} to="/login" variant="ghost" size="sm">
            {t('common.login')}
          </Button>
          {/* Wrapper controls visibility: Button's own `inline-flex` would override `hidden`. */}
          <span className="hidden sm:block">
            <Button as={Link} to="/register" size="sm">
              {t('common.register')}
            </Button>
          </span>
        </div>
      </Container>
    </header>
  );
}
