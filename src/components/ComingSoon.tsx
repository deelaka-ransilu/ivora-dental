export default function ComingSoon({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <section className="mt-6 rounded-card border border-dashed border-line bg-surface p-6">
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="mt-1 text-sm text-muted">
        Placeholder, not built yet. This screen will let you:
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
