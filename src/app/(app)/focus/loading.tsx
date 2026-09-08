import { PageHeaderSkeleton, CardGridSkeleton } from "@/components/shared/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton action={false} />
      <CardGridSkeleton count={2} className="lg:grid-cols-2" />
    </div>
  );
}
