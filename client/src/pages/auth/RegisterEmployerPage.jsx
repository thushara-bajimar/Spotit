import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Building2, MapPin } from 'lucide-react';
import { Input } from '../../components/ui/Input.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Notice } from '../../components/ui/Notice.jsx';
import { AccountFields, accountRules } from '../../components/forms/AccountFields.jsx';
import { DistrictSelect } from '../../components/forms/DistrictSelect.jsx';
import { FormError } from '../../components/forms/FormError.jsx';
import { RegistrationCard } from '../../components/forms/RegistrationCard.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useForm } from '../../hooks/useForm.js';
import { checks, normalizePhone, validate } from '../../utils/validation.js';
import { homePathForRole } from '../../utils/roles.js';

// Mirrors server/src/constants/users.js (labels come from the language files).
const EMPLOYER_TYPES = [
  'individual',
  'household',
  'small_business',
  'hotel_restaurant',
  'shop',
  'hospital_institution',
  'other',
];
const TYPES_WITHOUT_BUSINESS = ['individual', 'household'];

const rules = {
  employerType: checks.required,
  ...accountRules(checks),
  businessName: (value, values) => {
    if (TYPES_WITHOUT_BUSINESS.includes(values.employerType)) return null;
    return checks.text(2, 150)(value);
  },
  district: checks.required,
  locality: checks.text(2, 100),
};

export function RegisterEmployerPage() {
  const { t } = useTranslation();
  const { registerEmployer } = useAuth();
  const navigate = useNavigate();
  const form = useForm({
    employerType: '',
    fullName: '',
    businessName: '',
    phone: '',
    password: '',
    district: '',
    locality: '',
    address: '',
  });

  const needsBusinessName = form.values.employerType && !TYPES_WITHOUT_BUSINESS.includes(form.values.employerType);

  const onSubmit = (event) =>
    form.submit(
      event,
      (values) => validate(values, rules),
      async (values) => {
        const user = await registerEmployer({
          ...values,
          phone: normalizePhone(values.phone),
          businessName: needsBusinessName ? values.businessName : undefined,
          address: values.address || undefined,
        });
        navigate(homePathForRole(user.role), { replace: true });
      },
    );

  return (
    <RegistrationCard title={t('auth.registerEmployer.title')} subtitle={t('auth.registerEmployer.subtitle')}>
      <Notice className="mt-5">{t('auth.registerEmployer.reviewNote')}</Notice>

      <form className="mt-6 space-y-5" noValidate onSubmit={onSubmit}>
        <FormError code={form.formError} />
        <Select
          {...form.field('employerType')}
          label={t('auth.registerEmployer.employerType')}
          placeholder={t('common.select')}
          options={EMPLOYER_TYPES.map((type) => ({ value: type, label: t(`employerTypes.${type}`) }))}
          required
        />
        <AccountFields form={form} />
        {needsBusinessName && (
          <Input
            {...form.field('businessName')}
            label={t('auth.registerEmployer.businessName')}
            icon={Building2}
            autoComplete="organization"
            maxLength={150}
            required
          />
        )}
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
        <Input
          {...form.field('address')}
          label={t('auth.registerEmployer.address')}
          optionalLabel={t('common.optional')}
          hint={t('auth.registerEmployer.addressHint')}
          autoComplete="street-address"
          maxLength={300}
        />
        <Button type="submit" size="lg" fullWidth disabled={form.submitting}>
          {form.submitting ? t('auth.fields.submitting') : t('auth.fields.submit')}
        </Button>
      </form>
    </RegistrationCard>
  );
}
