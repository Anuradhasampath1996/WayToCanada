"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Loader2, Shield, Trash2, EyeOff, Eye, Flag, MessageSquare, RefreshCw, Plus, Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { adminAuthHeaders } from "@/lib/admin-auth";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type PostRow = {
  id: number;
  title: string;
  body: string;
  is_hidden: boolean;
  reactions_count: number;
  replies_count: number;
  created_at: string;
  author?: { id: number; name: string; email: string; rcic_number: string | null };
};

type ReportRow = {
  id: number;
  type: string;
  target_id: number;
  reason: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  reporter: { name: string; email: string };
  content_preview: { title?: string; body?: string; post_title?: string; author?: string; hidden?: boolean } | null;
};

async function parseApiError(res: Response, fallback: string) {
  try {
    const json = await res.json();
    return (json?.message as string) ?? fallback;
  } catch {
    return fallback;
  }
}

export default function AdminRcicCommunityClient() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(() => searchParams.get("tab") === "reports" ? "reports" : "posts");
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reviewReport, setReviewReport] = useState<ReportRow | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "reports" || t === "posts") setTab(t);
  }, [searchParams]);

  const loadPosts = useCallback(async () => {
    const res = await fetch(`${API}/admin/rcic-community/posts?hidden=all&per_page=50`, {
      headers: adminAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error(await parseApiError(res, "Failed to load posts."));
    }
    const json = await res.json();
    setPosts(json.data ?? []);
  }, []);

  const loadReports = useCallback(async () => {
    const res = await fetch(`${API}/admin/rcic-community/reports?status=all&per_page=50`, {
      headers: adminAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error(await parseApiError(res, "Failed to load reports."));
    }
    const json = await res.json();
    setReports(json.data ?? []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadPosts(), loadReports()]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load community data.");
      setPosts([]);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [loadPosts, loadReports]);

  useEffect(() => {
    void load();
  }, [load]);

  async function hidePost(post: PostRow, hidden: boolean) {
    const res = await fetch(`${API}/admin/rcic-community/posts/${post.id}/hide`, {
      method: "PATCH",
      headers: adminAuthHeaders("application/json"),
      body: JSON.stringify({ hidden }),
    });
    if (res.ok) {
      setMessage(hidden ? "Post hidden." : "Post restored.");
      await loadPosts();
    } else {
      setError(await parseApiError(res, "Could not update post."));
    }
  }

  async function deletePost(id: number) {
    if (!confirm("Permanently delete this post?")) return;
    const res = await fetch(`${API}/admin/rcic-community/posts/${id}`, {
      method: "DELETE",
      headers: adminAuthHeaders(),
    });
    if (res.ok) {
      setMessage("Post deleted.");
      await loadPosts();
    } else {
      setError(await parseApiError(res, "Could not delete post."));
    }
  }

  async function submitPost() {
    if (!newTitle.trim() || !newBody.trim()) return;
    setPosting(true);
    setError("");
    try {
      const form = new FormData();
      form.append("title", newTitle.trim());
      form.append("body", newBody.trim());
      if (newFile) form.append("file", newFile);
      const res = await fetch(`${API}/admin/rcic-community/posts`, {
        method: "POST",
        headers: adminAuthHeaders(),
        body: form,
      });
      if (!res.ok) throw new Error(await parseApiError(res, "Failed to publish post."));
      setComposeOpen(false);
      setNewTitle("");
      setNewBody("");
      setNewFile(null);
      setMessage("Post published to RCIC Community.");
      await loadPosts();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to publish post.");
    } finally {
      setPosting(false);
    }
  }

  async function resolveReport(status: "reviewed" | "dismissed", hideContent: boolean) {
    if (!reviewReport) return;
    const res = await fetch(`${API}/admin/rcic-community/reports/${reviewReport.id}`, {
      method: "PATCH",
      headers: adminAuthHeaders("application/json"),
      body: JSON.stringify({ status, admin_notes: adminNotes, hide_content: hideContent }),
    });
    if (res.ok) {
      setReviewReport(null);
      setAdminNotes("");
      setMessage("Report updated.");
      await loadReports();
      await loadPosts();
    } else {
      setError(await parseApiError(res, "Could not update report."));
    }
  }

  const pendingCount = reports.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6 p-6 lg:p-8 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Shield className="size-6 text-emerald-600" />
            RCIC Community moderation
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review consultant posts, publish announcements, and handle reports.
          </p>
        </div>
        <Button onClick={() => setComposeOpen(true)} className="gap-1.5">
          <Plus className="size-4" /> New post
        </Button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}
      {message && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="posts" className="gap-1.5">
              <MessageSquare className="size-4" /> Posts
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-1.5">
              <Flag className="size-4" /> Reports
              {pendingCount > 0 && (
                <Badge className="ml-1 h-5 bg-amber-500 px-1.5">{pendingCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </Button>
        </div>

        <TabsContent value="posts" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">All posts</CardTitle>
              <CardDescription>Hide posts from consultants or delete permanently.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
              ) : posts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No posts yet.</p>
              ) : (
                posts.map((post) => (
                  <div key={post.id} className={cn("rounded-xl border p-4", post.is_hidden && "opacity-60 bg-muted/30")}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{post.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {post.author?.name} · {post.author?.email}
                          {post.author?.rcic_number ? ` · ${post.author.rcic_number}` : ""}
                        </p>
                      </div>
                      {post.is_hidden && <Badge variant="secondary">Hidden</Badge>}
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{post.body}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void hidePost(post, !post.is_hidden)}
                      >
                        {post.is_hidden ? <><Eye className="mr-1 size-3" /> Restore</> : <><EyeOff className="mr-1 size-3" /> Hide</>}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => void deletePost(post.id)}>
                        <Trash2 className="mr-1 size-3" /> Delete
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Consultant reports</CardTitle>
              <CardDescription>Review flagged posts and replies.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
              ) : reports.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reports.</p>
              ) : (
                reports.map((r) => (
                  <div key={r.id} className="rounded-xl border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={r.status === "pending" ? "default" : "outline"}>{r.status}</Badge>
                      <span className="text-xs text-muted-foreground">{r.type} #{r.target_id}</span>
                    </div>
                    <p className="mt-2 text-sm">{r.reason}</p>
                    {r.content_preview && (
                      <p className="mt-2 rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">
                        {r.content_preview.title ?? r.content_preview.post_title}: {r.content_preview.body}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      Reported by {r.reporter.name} ({r.reporter.email})
                    </p>
                    {r.status === "pending" && (
                      <Button size="sm" className="mt-3" onClick={() => { setReviewReport(r); setAdminNotes(""); }}>
                        Review
                      </Button>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Publish community post</DialogTitle>
            <DialogDescription>
              Post an announcement visible to all RCIC consultants.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="post-title">Title</Label>
              <Input
                id="post-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Post title"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="post-body">Message</Label>
              <Textarea
                id="post-body"
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="Write your announcement..."
                rows={5}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="post-file">Attachment (optional, max 10 MB)</Label>
              <Input
                id="post-file"
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
              />
              {newFile && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Paperclip className="size-3" /> {newFile.name}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>Cancel</Button>
            <Button onClick={() => void submitPost()} disabled={posting || !newTitle.trim() || !newBody.trim()}>
              {posting ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Plus className="mr-1 size-4" />}
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reviewReport !== null} onOpenChange={(o) => !o && setReviewReport(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review report</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Admin notes (optional)"
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => void resolveReport("dismissed", false)}>Dismiss</Button>
            <Button variant="secondary" onClick={() => void resolveReport("reviewed", false)}>Mark reviewed</Button>
            <Button variant="destructive" onClick={() => void resolveReport("reviewed", true)}>Hide content</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
