import { useTranslation } from 'react-i18next';
import { Container } from '../ui/Container.jsx';
import { Button } from '../ui/Button.jsx';
import { StateView } from '../ui/StateView.jsx';
import { CategoryIcon } from '../common/CategoryIcon.jsx';
import { SectionHeading } from './SectionHeading.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { fetchCategories } from '../../services/categoryService.js';

const SKELETON_COUNT = 10;

/** Job categories loaded from the real API (GET /api/categories). */
export function CategoriesSection() {
  const { t, i18n } = useTranslation();
  const { status, data: categories, error, retry } = useApiData(fetchCategories);
  const nameField = i18n.resolvedLanguage === 'kn' ? 'nameKn' : 'nameEn';

  let content;
  if (status === 'loading') {
    content = (
      <>
        <p role="status" className="sr-only">
          {t('common.loading')}
        </p>
        <ul aria-hidden="true" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <li key={i} className="h-[118px] animate-pulse rounded-2xl bg-cream-100" />
          ))}
        </ul>
      </>
    );
  } else if (status === 'error') {
    content = (
      <StateView
        variant="error"
        title={t('landing.categories.error')}
        description={t(`errors.${error.code}`, { defaultValue: t('errors.generic') })}
        action={
          <Button variant="secondary" onClick={retry}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  } else if (categories.length === 0) {
    content = <StateView variant="empty" title={t('landing.categories.empty')} />;
  } else {
    content = (
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {categories.map((category) => (
          <li
            key={category.id}
            className="flex min-h-[118px] flex-col gap-3 rounded-2xl border border-line bg-white p-4"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-forest-50 text-forest-700">
              <CategoryIcon name={category.icon} className="size-6" />
            </span>
            <span className="leading-snug font-semibold text-ink">{category[nameField]}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section aria-labelledby="categories-title" className="py-14 sm:py-20">
      <Container>
        <SectionHeading
          id="categories-title"
          title={t('landing.categories.title')}
          subtitle={t('landing.categories.subtitle')}
        />
        <div className="mt-8">{content}</div>
      </Container>
    </section>
  );
}
