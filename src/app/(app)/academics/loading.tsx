import { PageHeaderSkeleton, CardGridSkeleton } from "@/components/shared/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeaderSkeleton />
      <CardGridSkeleton count={8} />
    </div>
  );
}
