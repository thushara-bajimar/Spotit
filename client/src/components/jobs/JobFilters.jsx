import { useTranslation } from 'react-i18next';
import { Select } from '../ui/Select.jsx';
import { Input } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { fetchCategories } from '../../services/categoryService.js';
import { fetchDistricts } from '../../services/referenceService.js';
import { localName } from '../../utils/format.js';

const WAGE_BASES = ['per_hour', 'per_day', 'per_week', 'per_task'];
const DURATIONS = ['few_hours', 'one_day', 'multiple_days', 'short_term'];

/**
 * Filter controls. `values` mirror the URL query; `onChange(name, value)`
 * updates one filter. Changes apply immediately (no extra "Apply" step).
 */
export function JobFilters({ values, onChange, onClear }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage;
  const categories = useApiData(fetchCategories);
  const districts = useApiData(fetchDistricts);

  const bind = (name) => ({
    name,
    value: values[name] ?? '',
    onChange: (event) => onChange(name, event.target.value),
  });

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
      <Select
        {...bind('category')}
        label={t('jobs.filters.category')}
        options={[
          { value: '', label: t('jobs.filters.allCategories') },
          ...(categories.data ?? []).map((c) => ({ value: c.slug, label: localName(c, language) })),
        ]}
      />
      <Select
        {...bind('district')}
        label={t('jobs.filters.district')}
        options={[
          { value: '', label: t('jobs.filters.allDistricts') },
          ...(districts.data ?? []).map((d) => ({ value: d.id, label: localName(d, language) })),
        ]}
      />
      <Select
        {...bind('wageBasis')}
        label={t('jobs.filters.wageBasis')}
        options={[
          { value: '', label: t('jobs.filters.anyWageBasis') },
          ...WAGE_BASES.map((basis) => ({ value: basis, label: t(`jobs.filters.basis.${basis}`) })),
        ]}
      />
      <Input
        {...bind('minWage')}
        label={t('jobs.filters.minWage')}
        type="number"
        inputMode="numeric"
        min={0}
        step={50}
        placeholder="0"
      />
      <Select
        {...bind('duration')}
        label={t('jobs.filters.duration')}
        options={[
          { value: '', label: t('jobs.filters.anyDuration') },
          ...DURATIONS.map((d) => ({ value: d, label: t(`duration.${d}`) })),
        ]}
      />
      <Input {...bind('date')} label={t('jobs.filters.date')} type="date" hint={t('jobs.filters.dateHint')} />
      <Button variant="secondary" onClick={onClear} className="sm:col-span-2 lg:col-span-1">
        {t('jobs.filters.clear')}
      </Button>
    </div>
  );
}
