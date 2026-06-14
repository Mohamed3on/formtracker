export function NationalityFlag({
  url,
  name,
  calledUp,
}: {
  url?: string;
  name?: string;
  /** Player is currently called up to this national team; adds a subtle emerald presence dot. */
  calledUp?: boolean;
}) {
  if (!url) return null;
  const flag = (
    <img
      src={url}
      alt={name || ""}
      title={name || ""}
      className="w-4 h-3 object-contain shrink-0"
    />
  );
  if (!calledUp) return flag;
  return (
    <span
      className="relative inline-flex shrink-0"
      title={name ? `Currently called up for ${name}` : "Currently called up"}
    >
      {flag}
      <span
        role="img"
        aria-label={name ? `Currently called up to ${name}` : "Currently called up"}
        className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400 ring-2 ring-[var(--bg-card)]"
      />
    </span>
  );
}
