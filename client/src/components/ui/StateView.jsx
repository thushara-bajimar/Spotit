import { CircleAlert, Inbox, LoaderCircle } from 'lucide-react';
import { cx } from '../../utils/cx.js';

const VARIANTS = {
  loading: { icon: LoaderCircle, iconClass: 'animate-spin text-forest-500', role: 'status' },
  empty: { icon: Inbox, iconClass: 'text-muted', role: undefined },
  error: { icon: CircleAlert, iconClass: 'text-danger-700', role: 'alert' },
};

/**
 * Shared loading / empty / error state so every page handles these the same way.
 *   <StateView variant="error" title={t('...')} action={<Button onClick={retry}>...</Button>} />
 */
export function StateView({ variant, title, description, action, className }) {
  const { icon: Icon, iconClass, role } = VARIANTS[variant];
  return (
    <div
      role={role}
      className={cx(
        'flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-white/60 px-6 py-10 text-center',
        className,
      )}
    >
      <Icon aria-hidden="true" className={cx('size-8', iconClass)} />
      {title && <p className="font-semibold text-ink">{title}</p>}
      {description && <p className="max-w-md text-sm text-muted">{description}</p>}
      {action}
    </div>
  );
}
