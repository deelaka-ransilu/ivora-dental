export default function ComingSoon({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <section className="mt-6 rounded-md border border-dashed border-neutral-500/60 p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm opacity-70">
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