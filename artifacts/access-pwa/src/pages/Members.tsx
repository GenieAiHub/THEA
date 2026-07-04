import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Loader2, Plus, Search, UserPlus, Users } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { createMember, listMembers, ApiError } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { NativeHeader } from "@/components/native/NativeHeader";
import { Pressable, PressableLink } from "@/components/native/Pressable";
import { BottomSheet } from "@/components/native/BottomSheet";
import { PullToRefresh } from "@/components/native/PullToRefresh";
import { staggerContainer, staggerItem } from "@/components/native/motion";
import { toast } from "sonner";

export default function Members() {
  const { canManage } = useAuth();
  const qc = useQueryClient();
  const members = useQuery({
    queryKey: ["members"],
    queryFn: () => listMembers().then((r) => r.data),
  });
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      createMember({
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        consentGiven: true,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["members"] });
      setOpen(false);
      setFullName("");
      setEmail("");
      setPhone("");
      setError(null);
      toast.success("Member added");
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Couldn't add member.");
    },
  });

  const list = (members.data ?? []).filter((m) =>
    m.fullName.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <PullToRefresh onRefresh={() => members.refetch()}>
      <div className="space-y-5">
        <NativeHeader
          title="Members"
          subtitle={`${members.data?.length ?? 0} enrolled`}
          action={
            canManage ? (
              <Pressable
                hapticPattern="tap"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                onClick={() => setOpen(true)}
                data-testid="button-add-member"
              >
                <Plus className="h-5 w-5" />
              </Pressable>
            ) : undefined
          }
        />

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search members"
            className="pl-9"
            type="search"
            data-testid="input-search-members"
          />
        </div>

        {members.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : list.length > 0 ? (
          <motion.div
            className="space-y-2"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {list.map((m) => (
              <motion.div key={m.id} variants={staggerItem}>
                <PressableLink
                  href={`/members/${m.id}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                  data-testid={`member-${m.id}`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                    {initials(m.fullName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.email ?? m.phone ?? "No contact info"}
                    </p>
                  </div>
                  {m.status !== "active" && (
                    <Badge variant="secondary" className="capitalize">
                      {m.status}
                    </Badge>
                  )}
                  {typeof m.faceCount === "number" && m.faceCount > 0 && (
                    <Badge variant="outline">{m.faceCount} face</Badge>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </PressableLink>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-14 text-center">
            <Users className="mb-2 h-7 w-7 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {q ? "No members match your search" : "No members yet"}
            </p>
            {canManage && !q && (
              <Button className="mt-4" onClick={() => setOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" /> Add your first member
              </Button>
            )}
          </div>
        )}

        <BottomSheet open={open} onOpenChange={setOpen} title="Add member">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="m-name">Full name</Label>
              <Input
                id="m-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jordan Lee"
                data-testid="input-member-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-email">Email (optional)</Label>
              <Input
                id="m-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jordan@company.com"
                data-testid="input-member-email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-phone">Phone (optional)</Label>
              <Input
                id="m-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 000 0000"
                data-testid="input-member-phone"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              className="h-12 w-full"
              onClick={() => create.mutate()}
              disabled={!fullName.trim() || create.isPending}
              data-testid="button-save-member"
            >
              {create.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add member
            </Button>
          </div>
        </BottomSheet>
      </div>
    </PullToRefresh>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
