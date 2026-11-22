import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Card } from '../ui/Card.jsx';

/** Frame shared by the worker and employer registration forms. */
export function RegistrationCard({ title, subtitle, children }) {
  const { t } = useTranslation();
  return (
    <Card className="p-6 sm:p-8">
      <Link
        to="/register"
        className="-mt-1 mb-3 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-forest-700 hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t('auth.fields.changeType')}
      </Link>
      <h1 className="text-3xl font-bold text-forest-900">{title}</h1>
      <p className="mt-1 text-muted">{subtitle}</p>
      {children}
      <p className="mt-6 text-center text-sm text-muted">
        {t('auth.register.haveAccount')}{' '}
        <Link to="/login" className="font-semibold text-forest-700 underline underline-offset-2">
          {t('auth.register.loginLink')}
        </Link>
      </p>
    </Card>
  );
}
