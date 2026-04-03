import { Shield } from "lucide-react";

export function StaffSupervisorBadge({ name }: { name: string | null | undefined }) {
  if (!name) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 border border-purple-200 px-2.5 py-0.5 text-xs font-medium text-purple-800">
      <Shield className="size-3" />
      {name}
    </span>
  );
}
