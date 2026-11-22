import { CircleAlert, Info } from 'lucide-react';
import { cx } from '../../utils/cx.js';

const TONES = {
  info: { classes: 'border-forest-200 bg-forest-50 text-forest-900', icon: Info },
  warning: { classes: 'border-amber-300 bg-amber-100 text-ink', icon: CircleAlert },
};

/** Inline message box for preview notices, confirmations and warnings. */
export function Notice({ tone = 'info', className, children, ...props }) {
  const { classes, icon: Icon } = TONES[tone];
  return (
    <div className={cx('flex gap-3 rounded-xl border px-4 py-3 text-sm', classes, className)} {...props}>
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
