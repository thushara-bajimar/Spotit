import { useTranslation } from 'react-i18next';
import { Notice } from '../ui/Notice.jsx';

/** Form-level error (e.g. wrong password, server unreachable), announced to screen readers. */
export function FormError({ code, className }) {
  const { t } = useTranslation();
  if (!code) return null;
  return (
    <Notice tone="warning" role="alert" className={className}>
      {t(`errors.${code}`, { defaultValue: t('errors.generic') })}
    </Notice>
  );
}
