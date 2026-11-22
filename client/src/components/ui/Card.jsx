import { cx } from '../../utils/cx.js';

/** White surface with a soft border — the base for job cards, panels and forms. */
export function Card({ as: Component = 'div', className, ...props }) {
  return (
    <Component
      className={cx('rounded-2xl border border-line bg-white p-5 shadow-sm shadow-forest-900/5', className)}
      {...props}
    />
  );
}
