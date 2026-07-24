export function SegmentedTabs(props: {
  tabs: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      className="inline-flex rounded-full border border-[var(--stroke)] bg-[color-mix(in_srgb,var(--surface)_70%,var(--chip))] p-1 text-sm shadow-[inset_0_1px_2px_rgba(16,42,80,0.06)]"
      role="tablist"
    >
      {props.tabs.map((tab) => {
        const active = tab.id === props.value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => props.onChange(tab.id)}
            className={
              active
                ? "cursor-pointer rounded-full bg-white px-4 py-2 font-semibold text-[var(--hero)] shadow-[0_4px_12px_rgba(16,42,80,0.1)] transition duration-200 ease-out"
                : "cursor-pointer rounded-full px-4 py-2 text-[var(--muted)] transition duration-200 ease-out hover:text-[var(--ink)]"
            }
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
