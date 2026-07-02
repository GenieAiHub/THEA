import { useAdminOrgs } from "@/hooks/use-admin";
import { Building2 } from "lucide-react";

export default function OrgsPage() {
  const { data, isLoading } = useAdminOrgs();
  const orgs: any[] = data ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-mono font-bold text-foreground">Organizations</h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            {orgs.length} registered organization{orgs.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="border border-border rounded-sm overflow-hidden">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2.5 text-muted-foreground font-normal">Name</th>
              <th className="text-left px-4 py-2.5 text-muted-foreground font-normal">Slug</th>
              <th className="text-left px-4 py-2.5 text-muted-foreground font-normal">Focus</th>
              <th className="text-right px-4 py-2.5 text-muted-foreground font-normal">Created</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : orgs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Building2 className="h-8 w-8 opacity-30" />
                    <span>No organizations yet.</span>
                  </div>
                </td>
              </tr>
            ) : (
              orgs.map((org: any) => (
                <tr key={org.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-foreground font-semibold">{org.name}</td>
                  <td className="px-4 py-3 text-primary">{org.slug}</td>
                  <td className="px-4 py-3 text-muted-foreground">{org.focus}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">
                    {new Date(org.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
