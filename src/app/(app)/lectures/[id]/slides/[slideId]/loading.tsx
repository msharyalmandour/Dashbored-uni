import { PageHeaderSkeleton, CardGridSkeleton } from "@/components/shared/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeaderSkeleton action={false} />
      <CardGridSkeleton count={1} className="" />
    </div>
  );
}
