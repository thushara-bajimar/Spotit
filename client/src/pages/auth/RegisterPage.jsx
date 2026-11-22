import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CircleCheck, HardHat, Store } from 'lucide-react';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Notice } from '../../components/ui/Notice.jsx';
import { cx } from '../../utils/cx.js';

// Only workers and employers can self-register. Admin accounts are never
// created from the public site.
const ROLE_OPTIONS = [
  { value: 'worker', icon: HardHat, titleKey: 'auth.register.workerTitle', textKey: 'auth.register.workerText' },
  { value: 'employer', icon: Store, titleKey: 'auth.register.employerTitle', textKey: 'auth.register.employerText' },
];

/**
 * Registration step 1 (choose a role). PHASE 1: layout only — "Continue" is
 * disabled and a notice says so. The full form arrives in Phase 2.
 * `?role=worker|employer` pre-selects a role (used by landing page buttons).
 */
export function RegisterPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const requestedRole = searchParams.get('role');
  const [role, setRole] = useState(ROLE_OPTIONS.some((o) => o.value === requestedRole) ? requestedRole : null);

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-3xl font-bold text-forest-900">{t('auth.register.title')}</h1>
      <p className="mt-1 text-muted">{t('auth.register.subtitle')}</p>

      <Notice tone="warning" className="mt-5">
        {t('auth.register.notice')}
      </Notice>

      <fieldset className="mt-6">
        <legend className="mb-3 text-sm font-semibold text-ink">{t('auth.register.roleLegend')}</legend>
        <div className="grid gap-3">
          {ROLE_OPTIONS.map(({ value, icon: Icon, titleKey, textKey }) => {
            const selected = role === value;
            return (
              <label
                key={value}
                className={cx(
                  'flex cursor-pointer items-center gap-4 rounded-2xl border-2 p-4 transition-colors',
                  'has-[input:focus-visible]:ring-4 has-[input:focus-visible]:ring-amber-300',
                  selected ? 'border-forest-700 bg-forest-50' : 'border-line bg-white hover:border-forest-200',
                )}
              >
                <input
                  type="radio"
                  name="role"
                  value={value}
                  checked={selected}
                  onChange={() => setRole(value)}
                  className="sr-only"
                />
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-forest-100 text-forest-700">
                  <Icon aria-hidden="true" className="size-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-semibold text-ink">{t(titleKey)}</span>
                  <span className="block text-sm text-muted">{t(textKey)}</span>
                </span>
                <CircleCheck
                  aria-hidden="true"
                  className={cx('size-6 shrink-0 text-forest-700', !selected && 'invisible')}
                />
              </label>
            );
          })}
        </div>
      </fieldset>

      <Button size="lg" fullWidth disabled className="mt-6">
        {t('auth.register.continue')}
      </Button>

      <p className="mt-6 text-center text-sm text-muted">
        {t('auth.register.haveAccount')}{' '}
        <Link to="/login" className="font-semibold text-forest-700 underline underline-offset-2">
          {t('auth.register.loginLink')}
        </Link>
      </p>
    </Card>
  );
}
