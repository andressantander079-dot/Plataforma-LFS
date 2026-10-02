import { DashboardSkeleton } from "@/components/dashboards/skeletons";

/** Carga premium del dashboard árbitro (skeleton con la forma del contenido). */
export default function Loading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <DashboardSkeleton />
    </div>
  );
}
