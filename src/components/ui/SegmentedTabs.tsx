export function SegmentedTabs(props: {
  tabs: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  fullWidth?: boolean;
  variant?: "default" | "workspace";
}) {
  const rootClass = [
    "segmented-tabs",
    props.fullWidth ? "segmented-tabs--full" : "",
    props.variant === "workspace" ? "segmented-tabs--workspace" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass} role="tablist">
      {props.tabs.map((tab) => {
        const active = tab.id === props.value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => props.onChange(tab.id)}
            className={`segmented-tabs__tab${active ? " segmented-tabs__tab--active" : ""}`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
