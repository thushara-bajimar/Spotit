import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../../i18n/index.js';
import { cx } from '../../utils/cx.js';

/** English / ಕನ್ನಡ switch. Each option is labelled in its own language. */
export function LanguageToggle({ className }) {
  const { t, i18n } = useTranslation();
  const current = i18n.resolvedLanguage;

  return (
    <div
      role="group"
      aria-label={t('common.language')}
      className={cx('inline-flex rounded-xl border border-line bg-white p-0.5', className)}
    >
      {SUPPORTED_LANGUAGES.map((language) => {
        const active = language === current;
        return (
          <button
            key={language}
            type="button"
            lang={language}
            aria-pressed={active}
            onClick={() => i18n.changeLanguage(language)}
            className={cx(
              'min-h-9 rounded-[10px] px-2.5 text-sm font-semibold transition-colors sm:px-3',
              active ? 'bg-forest-700 text-white' : 'text-forest-800 hover:bg-forest-50',
            )}
          >
            {language === 'en' ? 'EN' : t('language.kn')}
          </button>
        );
      })}
    </div>
  );
}
