import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { MapPin, ShieldCheck } from 'lucide-react';
import { Input } from '../../components/ui/Input.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { AccountFields, accountRules } from '../../components/forms/AccountFields.jsx';
import { DistrictSelect } from '../../components/forms/DistrictSelect.jsx';
import { SkillPicker } from '../../components/forms/SkillPicker.jsx';
import { FormError } from '../../components/forms/FormError.jsx';
import { RegistrationCard } from '../../components/forms/RegistrationCard.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useForm } from '../../hooks/useForm.js';
import { checks, normalizePhone, validate } from '../../utils/validation.js';
import { homePathForRole } from '../../utils/roles.js';

const rules = {
  ...accountRules(checks),
  district: checks.required,
  locality: checks.text(2, 100),
};

export function RegisterWorkerPage() {
  const { t } = useTranslation();
  const { registerWorker } = useAuth();
  const navigate = useNavigate();
  const form = useForm({ fullName: '', phone: '', password: '', district: '', locality: '', skills: [] });

  const onSubmit = (event) =>
    form.submit(
      event,
      (values) => validate(values, rules),
      async (values) => {
        const user = await registerWorker({ ...values, phone: normalizePhone(values.phone) });
        navigate(homePathForRole(user.role), { replace: true });
      },
    );

  return (
    <RegistrationCard title={t('auth.registerWorker.title')} subtitle={t('auth.registerWorker.subtitle')}>
      <form className="mt-6 space-y-5" noValidate onSubmit={onSubmit}>
        <FormError code={form.formError} />
        <AccountFields form={form} />
        <DistrictSelect {...form.field('district')} required />
        <Input
          {...form.field('locality')}
          label={t('auth.fields.locality')}
          hint={t('auth.fields.localityHint')}
          icon={MapPin}
          autoComplete="address-level2"
          maxLength={100}
          required
        />
        <SkillPicker
          value={form.values.skills}
          onChange={(skills) => form.setValue('skills', skills)}
          legend={t('auth.registerWorker.skillsLegend')}
          hint={t('auth.registerWorker.skillsHint')}
          error={form.errors.skills ? t(`validation.${form.errors.skills}`) : undefined}
        />
        <p className="flex gap-2 text-sm text-muted">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-forest-500" />
          {t('auth.registerWorker.privacyNote')}
        </p>
        <Button type="submit" size="lg" fullWidth disabled={form.submitting}>
          {form.submitting ? t('auth.fields.submitting') : t('auth.fields.submit')}
        </Button>
      </form>
    </RegistrationCard>
  );
}
