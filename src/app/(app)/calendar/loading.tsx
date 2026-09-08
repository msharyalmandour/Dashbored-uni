import { PageSkeleton } from "@/components/shared/skeletons";

export default function Loading() {
  return <PageSkeleton stats={0} rows={8} />;
}
