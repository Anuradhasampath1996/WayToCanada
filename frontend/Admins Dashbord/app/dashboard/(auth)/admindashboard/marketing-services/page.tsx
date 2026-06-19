"use client";

import * as React from "react";
import { PlusCircle, Pencil, Trash2, Megaphone, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { adminAuthHeaders } from "@/lib/admin-auth";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type Service = {
  id: number;
  slug: string;
  name: string;
  tagline: string | null;
  summary: string | null;
  detail_body: string | null;
  features: string[] | null;
  price: number;
  price_label: string;
  billing_type: string;
  is_active: boolean;
  sort_order: number;
};

const emptyForm = {
  slug: "",
  name: "",
  tagline: "",
  summary: "",
  detail_body: "",
  features: "",
  price: "",
  price_label: "one-time",
  billing_type: "one_time",
  is_active: true,
  sort_order: "0",
};

export default function AdminMarketingServicesPage() {
  const [services, setServices] = React.useState<Service[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Service | null>(null);
  const [form, setForm] = React.useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = React.useState<Service | null>(null);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/marketing-services`, { headers: adminAuthHeaders() });
      const json = await res.json();
      if (res.ok) setServices(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(svc: Service) {
    setEditing(svc);
    setForm({
      slug: svc.slug,
      name: svc.name,
      tagline: svc.tagline ?? "",
      summary: svc.summary ?? "",
      detail_body: svc.detail_body ?? "",
      features: (svc.features ?? []).join("\n"),
      price: String(svc.price),
      price_label: svc.price_label,
      billing_type: svc.billing_type,
      is_active: svc.is_active,
      sort_order: String(svc.sort_order),
    });
    setDialogOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      const body = {
        slug: form.slug,
        name: form.name,
        tagline: form.tagline || null,
        summary: form.summary || null,
        detail_body: form.detail_body || null,
        features: form.features.split("\n").map((l) => l.trim()).filter(Boolean),
        price: parseFloat(form.price) || 0,
        price_label: form.price_label || "one-time",
        billing_type: form.billing_type,
        is_active: form.is_active,
        sort_order: parseInt(form.sort_order, 10) || 0,
      };
      const url = editing
        ? `${API}/admin/marketing-services/${editing.id}`
        : `${API}/admin/marketing-services`;
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: adminAuthHeaders("application/json"),
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setDialogOpen(false);
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggle(svc: Service) {
    await fetch(`${API}/admin/marketing-services/${svc.id}/toggle`, {
      method: "PATCH",
      headers: adminAuthHeaders(),
    });
    await load();
  }

  async function remove() {
    if (!deleteTarget) return;
    await fetch(`${API}/admin/marketing-services/${deleteTarget.id}`, {
      method: "DELETE",
      headers: adminAuthHeaders(),
    });
    setDeleteTarget(null);
    await load();
  }

  return (
    <div className="space-y-6 p-6 lg:p-8 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Megaphone className="size-6 text-violet-600" />
            Marketing Services
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Set prices and content for Website Builder, Social Media, and Google Ads.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="size-4" />
          </Button>
          <Button onClick={openCreate} className="gap-1.5">
            <PlusCircle className="size-4" /> Add service
          </Button>
        </div>
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Billing</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : services.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No services yet.</TableCell></TableRow>
            ) : (
              services.map((svc) => (
                <TableRow key={svc.id}>
                  <TableCell>
                    <p className="font-medium">{svc.name}</p>
                    <p className="text-xs text-muted-foreground">{svc.slug}</p>
                  </TableCell>
                  <TableCell>${Number(svc.price).toFixed(2)} <span className="text-xs text-muted-foreground">{svc.price_label}</span></TableCell>
                  <TableCell className="capitalize">{svc.billing_type.replace("_", " ")}</TableCell>
                  <TableCell>
                    <Badge variant={svc.is_active ? "default" : "secondary"}>{svc.is_active ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(svc)}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => void toggle(svc)}>{svc.is_active ? "Disable" : "Enable"}</Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteTarget(svc)}><Trash2 className="size-4" /></Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit service" : "New marketing service"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="website-builder" disabled={!!editing} />
            </div>
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Tagline</Label>
              <Input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Summary (card preview)</Label>
              <Textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} rows={2} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Full details (read more page)</Label>
              <Textarea value={form.detail_body} onChange={(e) => setForm({ ...form, detail_body: e.target.value })} rows={6} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Features (one per line)</Label>
              <Textarea value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} rows={4} placeholder="Feature one&#10;Feature two" />
            </div>
            <div className="space-y-1.5">
              <Label>Price (CAD)</Label>
              <Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Price label</Label>
              <Input value={form.price_label} onChange={(e) => setForm({ ...form, price_label: e.target.value })} placeholder="one-time / per month" />
            </div>
            <div className="space-y-1.5">
              <Label>Billing type</Label>
              <Select value={form.billing_type} onValueChange={(v) => setForm({ ...form, billing_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time">One-time payment</SelectItem>
                  <SelectItem value="monthly">Monthly subscription</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sort order</Label>
              <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Active (visible to consultants)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void save()} disabled={saving || !form.slug || !form.name}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete service?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
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
