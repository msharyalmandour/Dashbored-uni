import { PageSkeleton } from "@/components/shared/skeletons";

export default function Loading() {
  return <PageSkeleton stats={3} rows={6} />;
}
