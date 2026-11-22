import { useTranslation } from 'react-i18next';
import { Phone, User } from 'lucide-react';
import { Input } from '../ui/Input.jsx';
import { PasswordInput } from '../ui/PasswordInput.jsx';

/** Name, phone and password — shared by the worker and employer sign-up forms. */
export function AccountFields({ form }) {
  const { t } = useTranslation();
  return (
    <>
      <Input
        {...form.field('fullName')}
        label={t('auth.fields.fullName')}
        icon={User}
        autoComplete="name"
        maxLength={100}
        required
      />
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
        hint={t('auth.fields.newPasswordHint')}
        autoComplete="new-password"
        required
      />
    </>
  );
}

/** Client rules matching AccountFields (the server validates again). */
export function accountRules(checks) {
  return { fullName: checks.text(2, 100), phone: checks.phone, password: checks.newPassword };
}
