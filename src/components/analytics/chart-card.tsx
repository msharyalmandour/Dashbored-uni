import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function ChartCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function NoData({ text = "Not enough data yet." }: { text?: string }) {
  return (
    <div className="flex h-52 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
      {text}
    </div>
  );
}
