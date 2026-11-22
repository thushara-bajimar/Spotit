import { useTranslation } from 'react-i18next';
import { Card } from '../../components/ui/Card.jsx';
import { StateView } from '../../components/ui/StateView.jsx';
import { CategoryIcon } from '../../components/common/CategoryIcon.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { fetchWorkerProfile } from '../../services/workerService.js';
import { fetchCategories } from '../../services/categoryService.js';
import { fetchDistricts } from '../../services/referenceService.js';
import { localName } from '../../utils/format.js';
import { ProfileTrust } from '../../components/trust/ProfileTrust.jsx';

/** Read-only view of the worker's own profile (editing comes later). */
export function WorkerProfilePage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage;
  const { user } = useAuth();
  const profile = useApiData(fetchWorkerProfile);
  const categories = useApiData(fetchCategories);
  const districts = useApiData(fetchDistricts);

  if (profile.status === 'loading' && !profile.data) return <StateView variant="loading" title={t('common.loading')} />;
  if (profile.status === 'error') return <StateView variant="error" title={t('errors.generic')} />;

  const district = districts.data?.find((d) => d.id === profile.data?.district);
  const skills = (profile.data?.skills ?? []).map((slug) => categories.data?.find((c) => c.slug === slug)).filter(Boolean);

  const rows = [
    [t('auth.fields.fullName'), user.fullName],
    [t('auth.fields.phone'), user.phone],
    [t('profile.location'), [profile.data?.locality, district && localName(district, language)].filter(Boolean).join(', ')],
    [t('common.language'), t(`language.${user.preferredLanguage}`)],
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold text-forest-900">{t('profile.title')}</h1>
      <Card className="mt-5 p-5 sm:p-6">
        <dl className="divide-y divide-line">
          {rows.map(([label, value]) => (
            <div key={label} className="grid gap-1 py-3 sm:grid-cols-[180px_1fr]">
              <dt className="text-sm font-semibold text-muted">{label}</dt>
              <dd className="text-ink">{value || '–'}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card className="mt-5 p-5 sm:p-6">
        <h2 className="font-sans text-lg font-bold text-ink">{t('profile.skills')}</h2>
        {skills.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t('profile.noSkills')}</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {skills.map((category) => (
              <li
                key={category.slug}
                className="flex items-center gap-1.5 rounded-full bg-forest-50 px-3 py-1.5 text-sm font-semibold text-forest-800"
              >
                <CategoryIcon name={category.icon} className="size-4" />
                {localName(category, language)}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-sm text-muted">{t('profile.editingLater')}</p>
      </Card>
      <ProfileTrust />
    </div>
  );
}
