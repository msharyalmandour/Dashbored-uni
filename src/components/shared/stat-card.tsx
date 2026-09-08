import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning" | "destructive";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const toneClass = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-amber-600 dark:text-amber-400",
    destructive: "text-destructive",
  }[tone ?? "default"];

  return (
    <div className="rounded-lg border border-border bg-card p-3.5 text-center">
      {Icon && <Icon className="mx-auto mb-1 size-4 text-muted-foreground" />}
      <p className={cn("font-display text-xl font-semibold", toneClass)}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
