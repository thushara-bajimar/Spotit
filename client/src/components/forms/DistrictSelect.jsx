import { useTranslation } from 'react-i18next';
import { Select } from '../ui/Select.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { fetchDistricts } from '../../services/referenceService.js';

/** District picker fed by GET /api/districts, labelled in the current language. */
export function DistrictSelect(props) {
  const { t, i18n } = useTranslation();
  const { status, data } = useApiData(fetchDistricts);
  const nameField = i18n.resolvedLanguage === 'kn' ? 'nameKn' : 'nameEn';

  const options = (data ?? []).map((d) => ({ value: d.id, label: d[nameField] }));
  const placeholder =
    status === 'loading' ? t('common.loading') : status === 'error' ? t('errors.NETWORK_ERROR') : t('common.select');

  return (
    <Select
      label={t('auth.fields.district')}
      placeholder={placeholder}
      options={options}
      disabled={status !== 'success'}
      {...props}
    />
  );
}
