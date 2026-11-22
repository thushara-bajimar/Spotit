import { Link, useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Phone } from 'lucide-react';
import { Card } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { PasswordInput } from '../../components/ui/PasswordInput.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { FormError } from '../../components/forms/FormError.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useForm } from '../../hooks/useForm.js';
import { checks, normalizePhone, validate } from '../../utils/validation.js';
import { postLoginPath } from '../../utils/roles.js';

const rules = { phone: checks.phone, password: checks.required };

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const form = useForm({ phone: '', password: '' });

  const onSubmit = (event) =>
    form.submit(
      event,
      (values) => validate(values, rules),
      async (values) => {
        const user = await login({ phone: normalizePhone(values.phone), password: values.password });
        navigate(postLoginPath(user.role, searchParams.get('next')), { replace: true });
      },
    );

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-3xl font-bold text-forest-900">{t('auth.login.title')}</h1>
      <p className="mt-1 text-muted">{t('auth.login.subtitle')}</p>

      <form className="mt-6 space-y-5" noValidate onSubmit={onSubmit}>
        <FormError code={form.formError} />
        <Input
          {...form.field('phone')}
          label={t('auth.fields.phone')}
          hint={t('auth.fields.phoneHint')}
          icon={Phone}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          maxLength={16}
          required
        />
        <PasswordInput
          {...form.field('password')}
          label={t('auth.fields.password')}
          autoComplete="current-password"
          required
        />
        <Button type="submit" size="lg" fullWidth disabled={form.submitting}>
          {form.submitting ? t('auth.login.submitting') : t('auth.login.submit')}
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
