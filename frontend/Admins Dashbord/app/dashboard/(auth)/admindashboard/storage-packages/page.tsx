"use client";

import * as React from "react";
import { PlusCircle, Pencil, Trash2, HardDrive, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { adminAuthHeaders } from "@/lib/admin-auth";

const API = process.env.NEXT_PUBLIC_API_URL + "/api/v1";

type StoragePackage = {
  id: number;
  name: string;
  description: string | null;
  extra_gb: number;
  monthly_price: number | null;
  yearly_price: number | null;
  is_active: boolean;
  sort_order: number;
};

const emptyForm = {
  name: "",
  description: "",
  extra_gb: "5",
  monthly_price: "",
  yearly_price: "",
  is_active: true,
  sort_order: "0",
};

export default function StorageAddonPackagesPage() {
  const [packages, setPackages] = React.useState<StoragePackage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<StoragePackage | null>(null);
  const [form, setForm] = React.useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = React.useState<StoragePackage | null>(null);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/storage-addon-packages`, { headers: adminAuthHeaders() });
      const json = await res.json();
      if (res.ok) setPackages(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(pkg: StoragePackage) {
    setEditing(pkg);
    setForm({
      name: pkg.name,
      description: pkg.description ?? "",
      extra_gb: String(pkg.extra_gb),
      monthly_price: pkg.monthly_price != null ? String(pkg.monthly_price) : "",
      yearly_price: pkg.yearly_price != null ? String(pkg.yearly_price) : "",
      is_active: pkg.is_active,
      sort_order: String(pkg.sort_order),
    });
    setDialogOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      const body = {
        name: form.name,
        description: form.description || null,
        extra_gb: parseInt(form.extra_gb, 10),
        monthly_price: form.monthly_price ? parseFloat(form.monthly_price) : null,
        yearly_price: form.yearly_price ? parseFloat(form.yearly_price) : null,
        is_active: form.is_active,
        sort_order: parseInt(form.sort_order, 10) || 0,
      };
      const url = editing
        ? `${API}/admin/storage-addon-packages/${editing.id}`
        : `${API}/admin/storage-addon-packages`;
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: adminAuthHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json();
        alert(json?.message ?? "Save failed");
        return;
      }
      setDialogOpen(false);
      void load();
    } finally {
      setSaving(false);
    }
  }

  async function toggle(pkg: StoragePackage) {
    await fetch(`${API}/admin/storage-addon-packages/${pkg.id}/toggle`, {
      method: "PATCH",
      headers: adminAuthHeaders(),
    });
    void load();
  }

  async function remove() {
    if (!deleteTarget) return;
    await fetch(`${API}/admin/storage-addon-packages/${deleteTarget.id}`, {
      method: "DELETE",
      headers: adminAuthHeaders(),
    });
    setDeleteTarget(null);
    void load();
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HardDrive className="h-7 w-7" />
            Storage Upgrade Packages
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Set pricing for consultant extra storage (beyond 3 GB free). Consultants pay via Stripe subscription.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate}>
            <PlusCircle className="h-4 w-4 mr-1" />
            Add package
          </Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Extra GB</TableHead>
              <TableHead>Monthly</TableHead>
              <TableHead>Yearly</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : packages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No storage packages yet. Add one so consultants can upgrade.
                </TableCell>
              </TableRow>
            ) : (
              packages.map((pkg) => (
                <TableRow key={pkg.id}>
                  <TableCell className="font-medium">{pkg.name}</TableCell>
                  <TableCell>+{pkg.extra_gb} GB</TableCell>
                  <TableCell>{pkg.monthly_price != null ? `$${pkg.monthly_price}` : "—"}</TableCell>
                  <TableCell>{pkg.yearly_price != null ? `$${pkg.yearly_price}` : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={pkg.is_active ? "default" : "secondary"}>
                      {pkg.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(pkg)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Switch checked={pkg.is_active} onCheckedChange={() => void toggle(pkg)} />
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(pkg)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit package" : "New storage package"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. +10 GB Storage" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Extra GB</Label>
                <Input type="number" min={1} value={form.extra_gb} onChange={(e) => setForm({ ...form, extra_gb: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Sort order</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monthly price (CAD)</Label>
                <Input type="number" step="0.01" value={form.monthly_price} onChange={(e) => setForm({ ...form, monthly_price: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Yearly price (CAD)</Label>
                <Input type="number" step="0.01" value={form.yearly_price} onChange={(e) => setForm({ ...form, yearly_price: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void save()} disabled={saving || !form.name.trim()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete package?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{deleteTarget?.name}&quot;? Existing consultant subscriptions are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
