import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { CategoryIcon } from '../common/CategoryIcon.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { fetchCategories } from '../../services/categoryService.js';
import { cx } from '../../utils/cx.js';

/**
 * Tap-to-select list of work types (job categories). Big touch targets and
 * icons make it usable without much reading.
 */
export function SkillPicker({ value, onChange, legend, hint, error }) {
  const { t, i18n } = useTranslation();
  const { status, data } = useApiData(fetchCategories);
  const nameField = i18n.resolvedLanguage === 'kn' ? 'nameKn' : 'nameEn';

  const toggle = (slug) =>
    onChange(value.includes(slug) ? value.filter((s) => s !== slug) : [...value, slug]);

  return (
    <fieldset>
      <legend className="text-sm font-semibold text-ink">
        {legend} <span className="font-normal text-muted">{t('common.optional')}</span>
      </legend>
      {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}

      {status === 'loading' && <p className="mt-3 text-sm text-muted">{t('common.loading')}</p>}
      {status === 'error' && <p className="mt-3 text-sm text-danger-700">{t('errors.NETWORK_ERROR')}</p>}

      {status === 'success' && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {data.map((category) => {
            const selected = value.includes(category.slug);
            return (
              <label
                key={category.slug}
                className={cx(
                  'flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-colors',
                  'has-[input:focus-visible]:ring-4 has-[input:focus-visible]:ring-amber-300',
                  selected ? 'border-forest-700 bg-forest-50 text-forest-900' : 'border-line bg-white text-ink',
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={selected}
                  onChange={() => toggle(category.slug)}
                />
                {selected ? (
                  <Check aria-hidden="true" className="size-5 shrink-0 text-forest-700" />
                ) : (
                  <CategoryIcon name={category.icon} className="size-5 shrink-0 text-forest-500" />
                )}
                <span className="leading-tight">{category[nameField]}</span>
              </label>
            );
          })}
        </div>
      )}
      {error && <p className="mt-1.5 text-sm font-medium text-danger-700">{error}</p>}
    </fieldset>
  );
}
