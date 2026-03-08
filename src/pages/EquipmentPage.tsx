// Equipment — Full CRUD for players via React Query
import { useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { useEquipment, useCreateEquipment, useUpdateEquipment, useDeleteEquipment } from "@/hooks/api/queries";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Package, Plus, Pencil, Trash2 } from "lucide-react";
import type { EquipmentCategory } from "@/types";

const CATEGORIES: { value: EquipmentCategory; label: string }[] = [
  { value: "racket", label: "Racket" }, { value: "string", label: "Strings" },
  { value: "shoes", label: "Shoes" }, { value: "balls", label: "Balls" },
  { value: "accessories", label: "Accessories" },
];

export default function EquipmentPage() {
  const { user } = useAuth();
  const playerId = user?.id ?? "p1";
  const { data: items = [], isLoading, error } = useEquipment(playerId);
  const createMut = useCreateEquipment();
  const deleteMut = useDeleteEquipment();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "racket" as EquipmentCategory, brand: "", model: "", condition: "", notes: "" });

  const handleAdd = () => {
    createMut.mutate({ playerId, name: form.name, category: form.category, brand: form.brand || undefined, model: form.model || undefined, condition: form.condition || undefined, notes: form.notes || undefined }, {
      onSuccess: () => { setAddOpen(false); setForm({ name: "", category: "racket", brand: "", model: "", condition: "", notes: "" }); },
    });
  };

  if (isLoading) return <LoadingState message="Loading equipment…" />;
  if (error) return <ErrorState message="Failed to load equipment" onRetry={() => window.location.reload()} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold text-foreground">Equipment</h1><p className="text-muted-foreground">Manage your rackets, strings, shoes, and more.</p></div>
        <Button className="gap-2 self-start" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add Item</Button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<Package className="h-6 w-6 text-muted-foreground" />} title="No equipment" description="Start tracking your tennis equipment.">
          <Button onClick={() => setAddOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Add Item</Button>
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Package className="h-5 w-5" /></div>
                  <div><h3 className="font-semibold text-foreground">{item.name}</h3><p className="text-xs capitalize text-muted-foreground">{item.category}{item.brand ? ` · ${item.brand}` : ""}</p></div>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100" onClick={() => deleteMut.mutate({ id: item.id, playerId })}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
              {item.model && <p className="text-xs text-muted-foreground">Model: {item.model}</p>}
              {item.condition && <span className="self-start rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{item.condition}</span>}
              {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
            </div>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Equipment</DialogTitle><DialogDescription>Track a new piece of tennis equipment.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Wilson Pro Staff 97" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Category</Label><Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as EquipmentCategory }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Brand</Label><Input value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} placeholder="Wilson, Babolat…" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Model</Label><Input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Condition</Label><Input value={form.condition} onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))} placeholder="New, Good, Worn…" /></div>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="e.g. Tension: 52 lbs" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!form.name.trim() || createMut.isPending}>{createMut.isPending ? "Adding…" : "Add Equipment"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
