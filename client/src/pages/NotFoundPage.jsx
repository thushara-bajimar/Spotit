import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';
import { Container } from '../components/ui/Container.jsx';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <Container className="flex flex-col items-center py-20 text-center sm:py-28">
      <span className="grid size-16 place-items-center rounded-2xl bg-cream-100 text-amber-700">
        <MapPin aria-hidden="true" className="size-8" />
      </span>
      <h1 className="mt-6 text-4xl font-bold text-forest-900">{t('notFound.title')}</h1>
      <p className="mt-3 max-w-md text-muted">{t('notFound.text')}</p>
      <Button as={Link} to="/" className="mt-8">
        {t('notFound.action')}
      </Button>
    </Container>
  );
}
