import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Lock, Phone } from 'lucide-react';
import { Card } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Notice } from '../../components/ui/Notice.jsx';

/**
 * Login screen layout. PHASE 1: not connected to the API — the submit button
 * is disabled and a notice says so. Real login arrives in Phase 2.
 */
export function LoginPage() {
  const { t } = useTranslation();

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-3xl font-bold text-forest-900">{t('auth.login.title')}</h1>
      <p className="mt-1 text-muted">{t('auth.login.subtitle')}</p>

      <Notice tone="warning" className="mt-5">
        {t('auth.login.notice')}
      </Notice>

      <form className="mt-6 space-y-5" noValidate onSubmit={(event) => event.preventDefault()}>
        <Input
          label={t('auth.login.phone')}
          hint={t('auth.login.phoneHint')}
          icon={Phone}
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={10}
        />
        <Input
          label={t('auth.login.password')}
          icon={Lock}
          name="password"
          type="password"
          autoComplete="current-password"
        />
        <Button type="submit" size="lg" fullWidth disabled>
          {t('auth.login.submit')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {t('auth.login.noAccount')}{' '}
        <Link to="/register" className="font-semibold text-forest-700 underline underline-offset-2">
          {t('auth.login.registerLink')}
        </Link>
      </p>
    </Card>
  );
}
