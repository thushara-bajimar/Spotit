import { useTranslation } from 'react-i18next';
import { Construction } from 'lucide-react';
import { Card } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';

/**
 * Clearly-labelled placeholder for dashboard sections that are not built yet.
 * It shows which phase delivers the real page, so nothing looks finished
 * when it is not.
 */
export function PlaceholderPage({ titleKey, phase }) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold text-forest-900">{t(titleKey)}</h1>
      <Card className="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
          <Construction aria-hidden="true" className="size-6" />
        </span>
        <div>
          <Badge tone="warning">{t('dashboard.placeholderPhase', { phase })}</Badge>
          <p className="mt-2 text-muted">{t('dashboard.placeholderBody')}</p>
        </div>
      </Card>
    </div>
  );
}
