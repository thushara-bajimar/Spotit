/** Title + optional subtitle used at the top of each landing section. */
export function SectionHeading({ id, title, subtitle }) {
  return (
    <div className="max-w-2xl">
      <h2 id={id} className="text-3xl font-bold text-forest-900 sm:text-4xl">
        {title}
      </h2>
      {subtitle && <p className="mt-3 text-lg text-muted">{subtitle}</p>}
    </div>
  );
}
