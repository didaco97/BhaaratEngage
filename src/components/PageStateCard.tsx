import { Card, CardContent } from "@/components/ui/card";

interface PageStateCardProps {
  readonly title: string;
  readonly description: string;
}

export default function PageStateCard({ title, description }: PageStateCardProps) {
  return (
    <Card className="rounded-[32px]">
      <CardContent className="py-20 text-center">
        <p className="text-lg font-semibold text-foreground">{title}</p>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
