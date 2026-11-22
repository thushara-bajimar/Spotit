import { cx } from '../../utils/cx.js';

const TONES = {
  neutral: 'bg-cream-100 text-ink',
  success: 'bg-forest-100 text-forest-800',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-danger-50 text-danger-700',
  // Marks temporary / sample content so it is never mistaken for real data.
  sample: 'bg-amber-500 text-ink uppercase tracking-wide',
};

/** Small status label. Always pair colour with text, never colour alone. */
export function Badge({ tone = 'neutral', className, ...props }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
