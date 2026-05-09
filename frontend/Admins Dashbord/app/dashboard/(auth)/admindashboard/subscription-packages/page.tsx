"use client";

import * as React from "react";
import {
  PlusCircle,
  Pencil,
  Trash2,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  BadgeDollarSign,
  RefreshCw,
  X,
  GripVertical,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const API = process.env.NEXT_PUBLIC_API_URL + "/api/v1";

type SubscriptionPackage = {
  id: number;
  name: string;
  description: string | null;
  monthly_price: number | null;
  yearly_price: number | null;
  features: string[] | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type PackageForm = {
  name: string;
  description: string;
  monthly_price: string;
  yearly_price: string;
  features: string[]; // array of feature strings
  is_active: boolean;
  sort_order: string;
};

const emptyForm = (): PackageForm => ({
  name: "",
  description: "",
  monthly_price: "",
  yearly_price: "",
  features: [],
  is_active: true,
  sort_order: "0",
});

function authHeaders() {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("wtc_admin_token") : "";
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function fmt(price: number | null) {
  if (price == null) return <span className="text-muted-foreground text-sm">—</span>;
  return (
    <span>
      $
      {price.toLocaleString("en-CA", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </span>
  );
}

// ── Feature tag editor ─────────────────────────────────────────────────────────
function FeatureEditor({
  features,
  onChange,
}: {
  features: string[];
  onChange: (f: string[]) => void;
}) {
  const [input, setInput] = React.useState("");

  function addFeature() {
    const val = input.trim();
    if (!val || features.includes(val)) return;
    onChange([...features, val]);
    setInput("");
  }

  function removeFeature(idx: number) {
    onChange(features.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder="e.g. Unlimited clients"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addFeature();
            }
          }}
        />
        <Button type="button" variant="secondary" onClick={addFeature}>
          Add
        </Button>
      </div>
      {features.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {features.map((f, i) => (
            <span
              key={i}
              className="flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2.5 py-1"
            >
              <GripVertical className="size-3 text-muted-foreground" />
              {f}
              <button
                type="button"
                onClick={() => removeFeature(i)}
                className="ml-0.5 hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Package form dialog ────────────────────────────────────────────────────────
function PackageFormDialog({
  open,
  onClose,
  initial,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial: SubscriptionPackage | null; // null = create
  onSaved: () => void;
}) {
  const isEdit = !!initial;
  const [form, setForm] = React.useState<PackageForm>(emptyForm());
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      if (initial) {
        setForm({
          name: initial.name,
          description: initial.description ?? "",
          monthly_price: initial.monthly_price?.toString() ?? "",
          yearly_price: initial.yearly_price?.toString() ?? "",
          features: initial.features ?? [],
          is_active: initial.is_active,
          sort_order: initial.sort_order.toString(),
        });
      } else {
        setForm(emptyForm());
      }
      setError(null);
    }
  }, [open, initial]);

  function set(field: keyof PackageForm, value: PackageForm[typeof field]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: form.name,
        description: form.description || null,
        monthly_price: form.monthly_price !== "" ? parseFloat(form.monthly_price) : null,
        yearly_price: form.yearly_price !== "" ? parseFloat(form.yearly_price) : null,
        features: form.features.length > 0 ? form.features : null,
        is_active: form.is_active,
        sort_order: parseInt(form.sort_order) || 0,
      };
      const url = isEdit
        ? `${API}/admin/subscription-packages/${initial!.id}`
        : `${API}/admin/subscription-packages`;
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg =
          json.errors
            ? Object.values(json.errors as Record<string, string[]>).flat().join(" ")
            : json.message ?? "Save failed.";
        throw new Error(msg);
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "An error occurred.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Package" : "Create Subscription Package"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          {/* Name */}
          <div className="space-y-1.5">
            <Label>Package Name *</Label>
            <Input
              required
              placeholder="e.g. Professional Plan"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              placeholder="Brief description of this package…"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
            />
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Monthly Price (CAD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  $
                </span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="pl-6"
                  value={form.monthly_price}
                  onChange={(e) => set("monthly_price", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Yearly Price (CAD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  $
                </span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="pl-6"
                  value={form.yearly_price}
                  onChange={(e) => set("yearly_price", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-1.5">
            <Label>Features</Label>
            <p className="text-muted-foreground text-xs">
              Press Enter or click Add after each feature.
            </p>
            <FeatureEditor
              features={form.features}
              onChange={(f) => set("features", f)}
            />
          </div>

          {/* Sort order */}
          <div className="space-y-1.5">
            <Label>Sort Order</Label>
            <Input
              type="number"
              placeholder="0"
              value={form.sort_order}
              onChange={(e) => set("sort_order", e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Lower numbers appear first on the pricing page.
            </p>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-muted-foreground text-xs">
                Inactive packages are hidden from consultants
              </p>
            </div>
            <Switch
              checked={form.is_active}
              onCheckedChange={(v) => set("is_active", v)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <RefreshCw className="size-4 animate-spin mr-2" />}
              {isEdit ? "Save Changes" : "Create Package"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function SubscriptionPackagesPage() {
  const [packages, setPackages] = React.useState<SubscriptionPackage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const [formOpen, setFormOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<SubscriptionPackage | null>(null);

  const [deleteTarget, setDeleteTarget] = React.useState<SubscriptionPackage | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [toggling, setToggling] = React.useState<number | null>(null);

  async function fetchPackages() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/admin/subscription-packages`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to load packages.");
      const json = await res.json();
      setPackages(json.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    fetchPackages();
  }, []);

  async function handleToggle(pkg: SubscriptionPackage) {
    setToggling(pkg.id);
    try {
      await fetch(`${API}/admin/subscription-packages/${pkg.id}/toggle`, {
        method: "PATCH",
        headers: authHeaders(),
      });
      await fetchPackages();
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`${API}/admin/subscription-packages/${deleteTarget.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      setDeleteTarget(null);
      await fetchPackages();
    } finally {
      setDeleting(false);
    }
  }

  function openCreate() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function openEdit(pkg: SubscriptionPackage) {
    setEditTarget(pkg);
    setFormOpen(true);
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BadgeDollarSign className="size-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Subscription Packages
            </h1>
            <p className="text-muted-foreground text-sm">
              Manage plans available for consultants to purchase.
            </p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <PlusCircle className="size-4 mr-2" />
          New Package
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <RefreshCw className="size-5 animate-spin" />
          Loading packages…
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <XCircle className="size-4 shrink-0" />
          {error}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={fetchPackages}>
            Retry
          </Button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && packages.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
          <BadgeDollarSign className="size-12 opacity-30" />
          <p className="text-sm">No packages yet. Create your first one.</p>
          <Button variant="outline" onClick={openCreate}>
            <PlusCircle className="size-4 mr-2" />
            Create Package
          </Button>
        </div>
      )}

      {/* Table */}
      {!loading && !error && packages.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Package Name</TableHead>
                <TableHead>Monthly</TableHead>
                <TableHead>Yearly</TableHead>
                <TableHead>Features</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {packages.map((pkg, idx) => (
                <TableRow key={pkg.id}>
                  <TableCell className="text-muted-foreground text-sm">
                    {pkg.sort_order > 0 ? pkg.sort_order : idx + 1}
                  </TableCell>

                  <TableCell>
                    <div className="font-medium">{pkg.name}</div>
                    {pkg.description && (
                      <div className="text-muted-foreground text-xs mt-0.5 max-w-xs truncate">
                        {pkg.description}
                      </div>
                    )}
                  </TableCell>

                  <TableCell>{fmt(pkg.monthly_price)}</TableCell>
                  <TableCell>{fmt(pkg.yearly_price)}</TableCell>

                  <TableCell>
                    {pkg.features && pkg.features.length > 0 ? (
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {pkg.features.slice(0, 3).map((f, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {f}
                          </Badge>
                        ))}
                        {pkg.features.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{pkg.features.length - 3} more
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-center">
                    <button
                      onClick={() => handleToggle(pkg)}
                      disabled={toggling === pkg.id}
                      className="inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {toggling === pkg.id ? (
                        <RefreshCw className="size-4 animate-spin text-muted-foreground" />
                      ) : pkg.is_active ? (
                        <Badge className="bg-green-600 hover:bg-green-700 gap-1">
                          <CheckCircle2 className="size-3" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <XCircle className="size-3" />
                          Inactive
                        </Badge>
                      )}
                    </button>
                  </TableCell>

                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(pkg)}>
                          <Pencil className="size-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggle(pkg)}>
                          {pkg.is_active ? (
                            <>
                              <XCircle className="size-4 mr-2" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="size-4 mr-2" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteTarget(pkg)}
                        >
                          <Trash2 className="size-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create / Edit dialog */}
      <PackageFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initial={editTarget}
        onSaved={fetchPackages}
      />

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the package. Consultants who have
              already subscribed will not be affected, but no new subscriptions
              can be made with this package.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? (
                <RefreshCw className="size-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="size-4 mr-2" />
              )}
              Delete Package
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
