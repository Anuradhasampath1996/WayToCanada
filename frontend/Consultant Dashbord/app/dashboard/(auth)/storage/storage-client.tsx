"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ChevronRight,
  FolderPlus,
  Folder,
  FolderOpen,
  FileText,
  Upload,
  Trash2,
  HardDrive,
  Loader2,
  Pencil,
  Download,
  Sparkles,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import {
  StorageFilePreviewDialog,
  getPreviewKind,
  type PreviewKind,
} from "./storage-file-preview";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

function authHeaders(json = true): Record<string, string> {
  const token =
    (typeof document !== "undefined"
      ? document.cookie.match(/wtc_consultant_token=([^;]+)/)?.[1]
      : undefined) ?? localStorage.getItem("wtc_consultant_token") ?? "";
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    Accept: "application/json",
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

type Summary = {
  used_bytes: number;
  quota_bytes: number;
  free_bytes: number;
  addon_bytes: number;
  remaining_bytes: number;
  used_percent: number;
};

type StorageFolder = {
  id: number;
  name: string;
  parent_id: number | null;
  created_at: string;
  subfolder_count?: number;
  file_count?: number;
  item_count?: number;
};

type StorageFile = {
  id: number;
  folder_id: number | null;
  original_filename: string;
  mime_type: string | null;
  size_bytes: number;
  created_at: string;
};

type StoragePackage = {
  id: number;
  name: string;
  description: string | null;
  extra_gb: number;
  monthly_price: number | null;
  yearly_price: number | null;
};

type FolderContents = {
  folders: StorageFolder[];
  files: StorageFile[];
};

const ROOT_KEY = "root";

function folderKey(id: number | null): string {
  return id === null ? ROOT_KEY : String(id);
}

async function downloadFile(file: StorageFile) {
  const res = await fetch(`${API}/consultant/storage/files/${file.id}/download`, {
    headers: authHeaders(false),
  });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.original_filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Tree row components ───────────────────────────────────────────────────────

type FileRowProps = {
  file: StorageFile;
  depth: number;
  onView: (file: StorageFile) => void;
  onRename: (file: StorageFile) => void;
  onDelete: (file: StorageFile) => void;
};

function FileRow({ file, depth, onView, onRename, onDelete }: FileRowProps) {
  return (
    <div
      className="group flex items-center gap-1 rounded-lg py-1.5 pr-2 hover:bg-muted/50"
      style={{ paddingLeft: depth * 20 + 8 }}
    >
      <span className="w-6 shrink-0" />
      <FileText className="h-4 w-4 shrink-0 text-blue-500" />
      <div className="min-w-0 flex-1 pl-1">
        <p className="truncate text-sm font-medium">{file.original_filename}</p>
        <p className="text-[11px] text-muted-foreground">{formatBytes(file.size_bytes)}</p>
      </div>
      <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          title="View"
          onClick={() => onView(file)}
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          title="Rename"
          onClick={() => onRename(file)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          title="Download"
          onClick={() => void downloadFile(file)}
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-destructive"
          title="Delete"
          onClick={() => onDelete(file)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

type FolderRowProps = {
  folder: StorageFolder;
  depth: number;
  expanded: boolean;
  loading: boolean;
  contents: FolderContents | undefined;
  onToggle: (folderId: number) => void;
  onNewSubfolder: (parentId: number) => void;
  onUpload: (folderId: number) => void;
  onRename: (folder: StorageFolder) => void;
  onDelete: (folder: StorageFolder) => void;
  onViewFile: (file: StorageFile) => void;
  onRenameFile: (file: StorageFile) => void;
  onDeleteFile: (file: StorageFile) => void;
  expandedSet: Set<number>;
  loadingSet: Set<number>;
  cache: Record<string, FolderContents>;
  onToggleChild: (folderId: number) => void;
  onNewSubfolderChild: (parentId: number) => void;
  onUploadChild: (folderId: number) => void;
  onRenameChild: (folder: StorageFolder) => void;
  onDeleteChild: (folder: StorageFolder) => void;
  onViewFileChild: (file: StorageFile) => void;
  onRenameFileChild: (file: StorageFile) => void;
  onDeleteFileChild: (file: StorageFile) => void;
};

function FolderRow({
  folder,
  depth,
  expanded,
  loading,
  contents,
  onToggle,
  onNewSubfolder,
  onUpload,
  onRename,
  onDelete,
  onViewFile,
  onRenameFile,
  onDeleteFile,
  expandedSet,
  loadingSet,
  cache,
  onToggleChild,
  onNewSubfolderChild,
  onUploadChild,
  onRenameChild,
  onDeleteChild,
  onViewFileChild,
  onRenameFileChild,
  onDeleteFileChild,
}: FolderRowProps) {
  const hasItems = (folder.item_count ?? 0) > 0;
  const FolderIcon = expanded ? FolderOpen : Folder;

  return (
    <div>
      <div
        className="group flex items-center gap-1 rounded-lg py-1.5 pr-2 hover:bg-muted/50"
        style={{ paddingLeft: depth * 20 + 8 }}
      >
        <button
          type="button"
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors",
            "hover:bg-muted text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onToggle(folder.id)}
          aria-label={expanded ? "Collapse folder" : "Expand folder"}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ChevronRight
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                expanded && "rotate-90",
                !hasItems && !expanded && "opacity-40",
              )}
            />
          )}
        </button>

        <FolderIcon className="h-4 w-4 shrink-0 text-amber-500" />

        <div className="min-w-0 flex-1 pl-1">
          <span className="truncate text-sm font-medium">{folder.name}</span>
          {hasItems && !expanded && (
            <span className="ml-2 text-[11px] text-muted-foreground">
              {folder.item_count} item{(folder.item_count ?? 0) !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="New subfolder"
            onClick={() => onNewSubfolder(folder.id)}
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Upload here"
            onClick={() => onUpload(folder.id)}
          >
            <Upload className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onRename(folder)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive"
            onClick={() => onDelete(folder)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {expanded && contents && (
        <div className="relative">
          <div
            className="absolute bottom-2 top-0 w-px bg-border/70"
            style={{ left: depth * 20 + 19 }}
          />
          {contents.folders.map((child) => (
            <FolderRow
              key={child.id}
              folder={child}
              depth={depth + 1}
              expanded={expandedSet.has(child.id)}
              loading={loadingSet.has(child.id)}
              contents={cache[folderKey(child.id)]}
              onToggle={onToggleChild}
              onNewSubfolder={onNewSubfolderChild}
              onUpload={onUploadChild}
              onRename={onRenameChild}
              onDelete={onDeleteChild}
              onViewFile={onViewFileChild}
              onRenameFile={onRenameFileChild}
              onDeleteFile={onDeleteFileChild}
              expandedSet={expandedSet}
              loadingSet={loadingSet}
              cache={cache}
              onToggleChild={onToggleChild}
              onNewSubfolderChild={onNewSubfolderChild}
              onUploadChild={onUploadChild}
              onRenameChild={onRenameChild}
              onDeleteChild={onDeleteChild}
              onViewFileChild={onViewFileChild}
              onRenameFileChild={onRenameFileChild}
              onDeleteFileChild={onDeleteFileChild}
            />
          ))}
          {contents.files.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              depth={depth + 1}
              onView={onViewFile}
              onRename={onRenameFile}
              onDelete={onDeleteFile}
            />
          ))}
          {contents.folders.length === 0 && contents.files.length === 0 && (
            <p
              className="py-2 text-xs italic text-muted-foreground"
              style={{ paddingLeft: (depth + 1) * 20 + 28 }}
            >
              Empty folder
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function StorageClient() {
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [initialLoading, setInitialLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [cache, setCache] = useState<Record<string, FolderContents>>({});
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [loadingFolders, setLoadingFolders] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderParentId, setNewFolderParentId] = useState<number | null>(null);
  const [uploadTargetFolderId, setUploadTargetFolderId] = useState<number | null>(null);

  const [renameTarget, setRenameTarget] = useState<StorageFolder | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameFileTarget, setRenameFileTarget] = useState<StorageFile | null>(null);
  const [renameFileName, setRenameFileName] = useState("");
  const [viewFileTarget, setViewFileTarget] = useState<StorageFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<PreviewKind | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<StorageFolder | null>(null);
  const [deleteFileTarget, setDeleteFileTarget] = useState<StorageFile | null>(null);

  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [packages, setPackages] = useState<StoragePackage[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<StoragePackage | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [billingCountry, setBillingCountry] = useState("CA");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [province, setProvince] = useState("ON");
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const fetchContents = useCallback(async (folderId: number | null): Promise<FolderContents> => {
    const qs = folderId ? `?folder_id=${folderId}` : "";
    const res = await fetch(`${API}/consultant/storage/browse${qs}`, { headers: authHeaders() });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.message ?? "Failed to load storage");
    if (json.summary) setSummary(json.summary);
    return { folders: json.folders ?? [], files: json.files ?? [] };
  }, []);

  const loadFolderContents = useCallback(
    async (folderId: number | null, force = false) => {
      const key = folderKey(folderId);
      if (!force && cache[key]) return cache[key];

      if (folderId !== null) {
        setLoadingFolders((prev) => new Set(prev).add(folderId));
      }

      try {
        const data = await fetchContents(folderId);
        setCache((prev) => ({ ...prev, [key]: data }));
        return data;
      } finally {
        if (folderId !== null) {
          setLoadingFolders((prev) => {
            const next = new Set(prev);
            next.delete(folderId);
            return next;
          });
        }
      }
    },
    [cache, fetchContents],
  );

  const refreshVisible = useCallback(async () => {
    await loadFolderContents(null, true);
    await Promise.all([...expanded].map((id) => loadFolderContents(id, true)));
  }, [expanded, loadFolderContents]);

  useEffect(() => {
    async function init() {
      setInitialLoading(true);
      try {
        await loadFolderContents(null, true);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load storage");
      } finally {
        setInitialLoading(false);
      }
    }
    void init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPackages = useCallback(async () => {
    const res = await fetch(`${API}/storage-addon-packages`, { headers: authHeaders() });
    const json = await res.json();
    if (res.ok) setPackages(json.data ?? []);
  }, []);

  useEffect(() => {
    void loadPackages();
  }, [loadPackages]);

  useEffect(() => {
    if (!upgradeOpen) return;
    void (async () => {
      try {
        const res = await fetch(`${API}/consultant/profile`, { headers: authHeaders() });
        const json = await res.json();
        if (!res.ok) return;
        setBillingCountry(json.company_country === "Canada" || json.company_country === "CA" ? "CA" : (json.company_country ?? "CA"));
        setAddressLine1(json.company_address_line1 ?? "");
        setAddressLine2(json.company_address_line2 ?? "");
        setCity(json.company_city ?? "");
        setPostalCode(json.company_postal_code ?? "");
        if (json.company_province) setProvince(String(json.company_province).toUpperCase().slice(0, 2));
      } catch {
        /* optional */
      }
    })();
  }, [upgradeOpen]);

  useEffect(() => {
    if (searchParams.get("upgrade") === "1" || searchParams.get("upgrade") === "cancelled") {
      setUpgradeOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function openRenameFile(file: StorageFile) {
    setRenameFileTarget(file);
    setRenameFileName(file.original_filename);
  }

  async function openViewFile(file: StorageFile) {
    setViewFileTarget(file);
    setPreviewLoading(true);
    setPreviewUrl(null);
    setPreviewText(null);
    setPreviewHtml(null);
    const kind = getPreviewKind(file);
    setPreviewKind(kind);

    if (kind === "unsupported") {
      setPreviewLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API}/consultant/storage/files/${file.id}/view`, {
        headers: authHeaders(false),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.message ?? "Could not load file preview");
      }
      const blob = await res.blob();
      if (kind === "text") {
        setPreviewText(await blob.text());
      } else if (kind === "docx") {
        const mammoth = await import("mammoth");
        const result = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
        setPreviewHtml(result.value);
      } else {
        setPreviewUrl(URL.createObjectURL(blob));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load file preview");
      setViewFileTarget(null);
      setPreviewKind(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewText(null);
    setPreviewHtml(null);
    setPreviewKind(null);
    setViewFileTarget(null);
  }

  async function renameFile() {
    if (!renameFileTarget || !renameFileName.trim()) return;
    const res = await fetch(`${API}/consultant/storage/files/${renameFileTarget.id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ original_filename: renameFileName.trim() }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.message ?? "Could not rename file");
      return;
    }
    setRenameFileTarget(null);
    await refreshVisible();
  }

  async function toggleFolder(folderId: number) {
    if (expanded.has(folderId)) {
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(folderId);
        return next;
      });
      return;
    }

    setExpanded((prev) => new Set(prev).add(folderId));
    try {
      await loadFolderContents(folderId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load folder");
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(folderId);
        return next;
      });
    }
  }

  function openNewFolder(parentId: number | null) {
    setNewFolderParentId(parentId);
    setNewFolderName("");
    setNewFolderOpen(true);
  }

  function openUpload(folderId: number | null) {
    setUploadTargetFolderId(folderId);
    fileInputRef.current?.click();
  }

  async function createFolder() {
    if (!newFolderName.trim()) return;
    const res = await fetch(`${API}/consultant/storage/folders`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ name: newFolderName.trim(), parent_id: newFolderParentId }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.message ?? "Could not create folder");
      return;
    }
    setNewFolderOpen(false);
    setNewFolderName("");
    await refreshVisible();
    if (newFolderParentId !== null) {
      setExpanded((prev) => new Set(prev).add(newFolderParentId));
    }
  }

  async function renameFolder() {
    if (!renameTarget || !renameName.trim()) return;
    const res = await fetch(`${API}/consultant/storage/folders/${renameTarget.id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ name: renameName.trim() }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.message ?? "Could not rename folder");
      return;
    }
    setRenameTarget(null);
    await refreshVisible();
  }

  async function deleteFolder() {
    if (!deleteFolderTarget) return;
    const res = await fetch(`${API}/consultant/storage/folders/${deleteFolderTarget.id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) {
      const json = await res.json();
      setError(json?.message ?? "Could not delete folder");
      return;
    }
    setDeleteFolderTarget(null);
    setExpanded((prev) => {
      const next = new Set(prev);
      next.delete(deleteFolderTarget.id);
      return next;
    });
    setCache((prev) => {
      const next = { ...prev };
      delete next[folderKey(deleteFolderTarget.id)];
      return next;
    });
    await refreshVisible();
  }

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setUploading(true);
    setError("");
    const targetFolder = uploadTargetFolderId;
    try {
      for (const file of Array.from(fileList)) {
        const form = new FormData();
        form.append("file", file);
        if (targetFolder !== null) form.append("folder_id", String(targetFolder));
        const res = await fetch(`${API}/consultant/storage/files`, {
          method: "POST",
          headers: authHeaders(false),
          body: form,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message ?? `Upload failed: ${file.name}`);
        if (json.summary) setSummary(json.summary);
      }
      if (targetFolder !== null) {
        setExpanded((prev) => new Set(prev).add(targetFolder));
      }
      await refreshVisible();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadTargetFolderId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function deleteFile() {
    if (!deleteFileTarget) return;
    const res = await fetch(`${API}/consultant/storage/files/${deleteFileTarget.id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.message ?? "Could not delete file");
      return;
    }
    if (json.summary) setSummary(json.summary);
    setDeleteFileTarget(null);
    await refreshVisible();
  }

  async function startCheckout() {
    if (!selectedPkg) return;
    if (!addressLine1.trim() || !city.trim()) {
      setError("Billing address and city are required.");
      return;
    }
    setCheckoutLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/consultant/storage/payment/checkout-session`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          storage_addon_package_id: selectedPkg.id,
          billing_cycle: billingCycle,
          billing_country: billingCountry,
          billing_address_line1: addressLine1.trim(),
          billing_address_line2: addressLine2.trim() || undefined,
          billing_city: city.trim(),
          billing_postal_code: postalCode.trim() || undefined,
          billing_province: billingCountry === "CA" ? province : undefined,
          province: billingCountry === "CA" ? province : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Checkout failed");
      if (json.url) window.location.href = json.url;
      else throw new Error("No checkout URL returned");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setCheckoutLoading(false);
    }
  }

  const root = cache[ROOT_KEY];
  const quotaFull = summary ? summary.remaining_bytes <= 0 : false;
  const isEmpty = !initialLoading && root && root.folders.length === 0 && root.files.length === 0;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <HardDrive className="h-7 w-7 text-primary" />
            My Document Storage
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Tree view — click the arrow to expand folders and see subfolders &amp; files inside.
          </p>
        </div>
        <Button variant="outline" onClick={() => setUpgradeOpen(true)}>
          <Sparkles className="h-4 w-4 mr-2" />
          Upgrade storage
        </Button>
      </div>

      {summary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Storage usage</CardTitle>
            <CardDescription>
              {formatBytes(summary.used_bytes)} of {formatBytes(summary.quota_bytes)} used
              {summary.addon_bytes > 0 && ` (+${formatBytes(summary.addon_bytes)} purchased)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={Math.min(100, summary.used_percent)} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {formatBytes(summary.remaining_bytes)} remaining · includes {formatBytes(summary.free_bytes)} free
            </p>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-base">Files &amp; folders</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Expand with <ChevronRight className="inline h-3 w-3" /> — no need to open folders separately
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => openNewFolder(null)}>
              <FolderPlus className="h-4 w-4 mr-1" />
              New folder
            </Button>
            <Button
              size="sm"
              disabled={uploading || quotaFull}
              onClick={() => openUpload(null)}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              Upload
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => void uploadFiles(e.target.files)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {initialLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : isEmpty ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No folders or files yet. Create a folder or upload documents.
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/20 p-2">
              {root?.folders.map((folder) => (
                <FolderRow
                  key={folder.id}
                  folder={folder}
                  depth={0}
                  expanded={expanded.has(folder.id)}
                  loading={loadingFolders.has(folder.id)}
                  contents={cache[folderKey(folder.id)]}
                  onToggle={toggleFolder}
                  onNewSubfolder={openNewFolder}
                  onUpload={openUpload}
                  onRename={(f) => {
                    setRenameTarget(f);
                    setRenameName(f.name);
                  }}
                  onDelete={setDeleteFolderTarget}
                  onViewFile={openViewFile}
                  onRenameFile={openRenameFile}
                  onDeleteFile={setDeleteFileTarget}
                  expandedSet={expanded}
                  loadingSet={loadingFolders}
                  cache={cache}
                  onToggleChild={toggleFolder}
                  onNewSubfolderChild={openNewFolder}
                  onUploadChild={openUpload}
                  onRenameChild={(f) => {
                    setRenameTarget(f);
                    setRenameName(f.name);
                  }}
                  onDeleteChild={setDeleteFolderTarget}
                  onViewFileChild={openViewFile}
                  onRenameFileChild={openRenameFile}
                  onDeleteFileChild={setDeleteFileTarget}
                />
              ))}
              {root?.files.map((file) => (
                <FileRow
                  key={file.id}
                  file={file}
                  depth={0}
                  onView={openViewFile}
                  onRename={openRenameFile}
                  onDelete={setDeleteFileTarget}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {newFolderParentId ? "New subfolder" : "New folder"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="folder-name">Folder name</Label>
            <Input
              id="folder-name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="e.g. Client contracts"
              onKeyDown={(e) => e.key === "Enter" && void createFolder()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>Cancel</Button>
            <Button onClick={() => void createFolder()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
          </DialogHeader>
          <Input
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void renameFolder()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button onClick={() => void renameFolder()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameFileTarget} onOpenChange={(o) => !o && setRenameFileTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename file</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="file-rename">File name</Label>
            <Input
              id="file-rename"
              value={renameFileName}
              onChange={(e) => setRenameFileName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void renameFile()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameFileTarget(null)}>Cancel</Button>
            <Button onClick={() => void renameFile()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StorageFilePreviewDialog
        file={viewFileTarget}
        open={!!viewFileTarget}
        onOpenChange={(o) => !o && closePreview()}
        previewUrl={previewUrl}
        previewText={previewText}
        previewHtml={previewHtml}
        previewKind={previewKind}
        loading={previewLoading}
        onDownload={(f) => void downloadFile(f as StorageFile)}
      />

      <AlertDialog open={!!deleteFolderTarget} onOpenChange={(o) => !o && setDeleteFolderTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete &quot;{deleteFolderTarget?.name}&quot; and everything inside it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void deleteFolder()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteFileTarget} onOpenChange={(o) => !o && setDeleteFileTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete &quot;{deleteFileTarget?.original_filename}&quot;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void deleteFile()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upgrade storage</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Need more than 3 GB? Choose a plan below. Payment unlocks extra storage via subscription (monthly or yearly).
          </p>
          {packages.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No upgrade plans available yet. Contact your administrator.
            </p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {packages.map((pkg) => (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => setSelectedPkg(pkg)}
                  className={cn(
                    "w-full rounded-lg border p-4 text-left transition-colors",
                    selectedPkg?.id === pkg.id ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                  )}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-semibold">{pkg.name}</p>
                      <p className="text-xs text-muted-foreground">+{pkg.extra_gb} GB extra</p>
                    </div>
                    <div className="text-right text-sm">
                      {pkg.monthly_price != null && <p>${pkg.monthly_price}/mo</p>}
                      {pkg.yearly_price != null && (
                        <p className="text-muted-foreground">${pkg.yearly_price}/yr</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {selectedPkg && (
            <div className="space-y-3 pt-2 border-t">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={billingCycle === "monthly" ? "default" : "outline"}
                  onClick={() => setBillingCycle("monthly")}
                >
                  Monthly
                </Button>
                <Button
                  size="sm"
                  variant={billingCycle === "yearly" ? "default" : "outline"}
                  onClick={() => setBillingCycle("yearly")}
                >
                  Yearly
                </Button>
              </div>
              <div className="space-y-2 pt-1">
                <Label>Billing address</Label>
                <Input placeholder="Street address" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
                <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
                <Input placeholder="Postal code" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                <div className="space-y-1">
                  <Label>Province (Canada)</Label>
                  <Input value={province} onChange={(e) => setProvince(e.target.value.toUpperCase())} maxLength={2} />
                </div>
                <p className="text-[11px] text-muted-foreground">GST/HST calculated from your billing address, same as subscription checkout.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradeOpen(false)}>Close</Button>
            <Button disabled={!selectedPkg || checkoutLoading} onClick={() => void startCheckout()}>
              {checkoutLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Pay with Stripe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
