import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, MapPin, Pencil, User } from 'lucide-react';
import { Card } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Notice } from '../../components/ui/Notice.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { StateView } from '../../components/ui/StateView.jsx';
import { FormError } from '../../components/forms/FormError.jsx';
import { DistrictSelect } from '../../components/forms/DistrictSelect.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { useForm } from '../../hooks/useForm.js';
import { fetchEmployerProfile, updateEmployerProfileRequest } from '../../services/employerService.js';
import { fetchDistricts } from '../../services/referenceService.js';
import { checks, validate } from '../../utils/validation.js';
import { formatTimestamp, localName } from '../../utils/format.js';
import { ProfileTrust } from '../../components/trust/ProfileTrust.jsx';

const EMPLOYER_TYPES = ['individual', 'household', 'small_business', 'hotel_restaurant', 'shop', 'hospital_institution', 'other'];
const WITHOUT_BUSINESS = ['individual', 'household'];
const STATUS_TONE = { approved: 'success', pending: 'warning', rejected: 'danger' };

function ProfileForm({ profile, onSaved, onCancel }) {
  const { t } = useTranslation();
  const form = useForm({
    fullName: profile.fullName,
    employerType: profile.employerType,
    businessName: profile.businessName ?? '',
    district: profile.district,
    locality: profile.locality,
    address: profile.address ?? '',
    description: profile.description ?? '',
  });
  const needsBusiness = !WITHOUT_BUSINESS.includes(form.values.employerType);
  const identityChanged =
    form.values.employerType !== profile.employerType ||
    (needsBusiness ? form.values.businessName.trim() : '') !== (profile.businessName ?? '');

  const onSubmit = (event) =>
    form.submit(
      event,
      (v) =>
        validate(v, {
          fullName: checks.text(2, 100),
          employerType: checks.required,
          businessName: (value, all) => (WITHOUT_BUSINESS.includes(all.employerType) ? null : checks.text(2, 150)(value)),
          district: checks.required,
          locality: checks.text(2, 100),
        }),
      async (v) => {
        const result = await updateEmployerProfileRequest({
          ...v,
          businessName: needsBusiness ? v.businessName : undefined,
          address: v.address.trim() || undefined,
          description: v.description.trim() || undefined,
        });
        await onSaved(result);
      },
    );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormError code={form.formError} />
      {profile.verificationStatus === 'approved' && identityChanged && (
        <Notice tone="warning">{t('employer.profile.reviewWarning')}</Notice>
      )}
      {profile.verificationStatus === 'rejected' && <Notice tone="warning">{t('employer.profile.resubmitNote')}</Notice>}
      <Input {...form.field('fullName')} label={t('auth.fields.fullName')} icon={User} maxLength={100} required />
      <Select
        {...form.field('employerType')}
        label={t('auth.registerEmployer.employerType')}
        options={EMPLOYER_TYPES.map((type) => ({ value: type, label: t(`employerTypes.${type}`) }))}
      />
      {needsBusiness && (
        <Input
          {...form.field('businessName')}
          label={t('auth.registerEmployer.businessName')}
          icon={Building2}
          maxLength={150}
          required
        />
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <DistrictSelect {...form.field('district')} required />
        <Input {...form.field('locality')} label={t('auth.fields.locality')} icon={MapPin} maxLength={100} required />
      </div>
      <Input
        {...form.field('address')}
        label={t('auth.registerEmployer.address')}
        optionalLabel={t('common.optional')}
        maxLength={300}
      />
      <Textarea
        {...form.field('description')}
        label={t('employer.profile.description')}
        optionalLabel={t('common.optional')}
        hint={t('employer.profile.descriptionHint')}
        maxLength={1000}
      />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onCancel} disabled={form.submitting}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={form.submitting}>
          {form.submitting ? t('employer.profile.saving') : t('employer.profile.save')}
        </Button>
      </div>
    </form>
  );
}

export function EmployerProfilePage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage;
  const { refreshUser } = useAuth();
  const { status, data: profile, retry } = useApiData(fetchEmployerProfile);
  const districts = useApiData(fetchDistricts);
  const [editing, setEditing] = useState(false);
  const [flash, setFlash] = useState(null);

  if (status === 'loading' && !profile) return <StateView variant="loading" title={t('common.loading')} />;
  if (status === 'error') return <StateView variant="error" title={t('errors.generic')} />;

  const district = districts.data?.find((d) => d.id === profile.district);
  const rows = [
    [t('auth.fields.fullName'), profile.fullName],
    [t('auth.fields.phone'), profile.phone],
    [t('auth.registerEmployer.employerType'), t(`employerTypes.${profile.employerType}`)],
    [t('auth.registerEmployer.businessName'), profile.businessName],
    [t('profile.location'), [profile.locality, district && localName(district, language)].filter(Boolean).join(', ')],
    [t('auth.registerEmployer.address'), profile.address],
    [t('employer.profile.description'), profile.description],
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-bold text-forest-900">{t('profile.title')}</h1>
        {!editing && (
          <Button variant="secondary" onClick={() => { setFlash(null); setEditing(true); }}>
            <Pencil aria-hidden="true" className="size-4" />
            {t('employer.profile.edit')}
          </Button>
        )}
      </div>

      {flash && (
        <Notice role="status" className="mt-4">
          {t(`employer.profile.flash.${flash}`)}
        </Notice>
      )}

      <Card className="mt-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-sans text-lg font-bold text-ink">{t('employer.profile.verification')}</h2>
          <Badge tone={STATUS_TONE[profile.verificationStatus]}>
            {t(`employer.profile.status.${profile.verificationStatus}`)}
          </Badge>
        </div>
        <p className="mt-2 text-sm text-ink">{t(`employer.profile.statusHelp.${profile.verificationStatus}`)}</p>
        {profile.verificationStatus === 'rejected' && profile.rejectionReason && (
          <p className="mt-2 text-sm text-danger-700">
            {t('employer.job.rejectionReason')}: {profile.rejectionReason}
          </p>
        )}
        <p className="mt-2 text-xs text-muted">
          {t('employer.profile.submittedOn', { date: formatTimestamp(profile.submittedAt, language) })}
        </p>
      </Card>

      <Card className="mt-5 p-5 sm:p-6">
        {editing ? (
          <ProfileForm
            profile={profile}
            onCancel={() => setEditing(false)}
            onSaved={async (result) => {
              setEditing(false);
              setFlash(result.reviewRequired ? 'resubmitted' : 'saved');
              retry();
              await refreshUser(); // approval status shown elsewhere may have changed
            }}
          />
        ) : (
          <dl className="divide-y divide-line">
            {rows.map(([label, value]) => (
              <div key={label} className="grid gap-1 py-3 sm:grid-cols-[200px_1fr]">
                <dt className="text-sm font-semibold text-muted">{label}</dt>
                <dd className="whitespace-pre-line text-ink">{value || '–'}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>
      <ProfileTrust />
    </div>
  );
}
