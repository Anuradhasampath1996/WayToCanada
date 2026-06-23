"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Loader2, MessageSquare, Plus, Search, ThumbsUp, Paperclip, Flag,
  Trash2, Download, ChevronLeft, Users, Eye, FileText, ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type Author = { id: number; name: string; rcic_number: string | null; company_name: string | null };

type Post = {
  id: number;
  title: string;
  body: string;
  reactions_count: number;
  replies_count: number;
  has_attachment: boolean;
  attachment_name: string | null;
  attachment_mime: string | null;
  attachment_size: number | null;
  reacted: boolean;
  is_mine: boolean;
  created_at: string;
  author: Author;
};

type Reply = {
  id: number;
  post_id: number;
  body: string;
  is_mine: boolean;
  created_at: string;
  author: Author;
};

function authHeaders(json = true): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    Accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-CA", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function fmtSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type AttachmentKind = "image" | "pdf" | "other";

function attachmentKind(mime: string | null, name: string | null): AttachmentKind {
  const m = (mime ?? "").toLowerCase();
  const n = (name ?? "").toLowerCase();
  if (m.startsWith("image/") || /\.(jpe?g|png|gif|webp|bmp)$/.test(n)) return "image";
  if (m === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  return "other";
}

function PostAttachmentBlock({
  post,
  onDownload,
  onError,
}: {
  post: Post;
  onDownload: () => void;
  onError: (msg: string) => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const blobRef = useRef<string | null>(null);
  const kind = attachmentKind(post.attachment_mime, post.attachment_name);
  const name = post.attachment_name ?? "attachment";

  useEffect(() => {
    if (!post.has_attachment || kind === "other") {
      setBlobUrl(null);
      return;
    }

    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("wtc_consultant_token");
        const res = await fetch(`${API}/consultant/rcic-community/posts/${post.id}/attachment`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error("Could not load attachment.");
        const objectUrl = URL.createObjectURL(await res.blob());
        if (!active) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        if (blobRef.current) URL.revokeObjectURL(blobRef.current);
        blobRef.current = objectUrl;
        setBlobUrl(objectUrl);
      } catch {
        if (active) {
          setBlobUrl(null);
          onError("Could not preview attachment.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
    };
  }, [post.id, post.has_attachment, kind, onError]);

  if (kind === "image") {
    return (
      <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/10 shadow-sm">
        <div className="relative flex min-h-[160px] items-center justify-center bg-gradient-to-b from-muted/30 to-muted/10 p-2">
          {loading ? (
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          ) : blobUrl ? (
            <img
              src={blobUrl}
              alt={name}
              className="max-h-[min(420px,55vh)] w-full rounded-lg object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <ImageIcon className="size-10 opacity-40" />
              <p className="text-xs">Preview unavailable</p>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 border-t border-border/50 bg-background/80 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium break-words">{name}</p>
            {post.attachment_size ? (
              <p className="text-xs text-muted-foreground">{fmtSize(post.attachment_size)}</p>
            ) : null}
          </div>
          <Button variant="outline" size="sm" className="h-9 w-full shrink-0 gap-1.5 sm:w-auto" onClick={onDownload}>
            <Download className="size-4" />
            Download
          </Button>
        </div>
      </div>
    );
  }

  if (kind === "pdf") {
    return (
      <>
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/10 p-3 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-600">
            <FileText className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium break-words">{name}</p>
            {post.attachment_size ? (
              <p className="text-xs text-muted-foreground">{fmtSize(post.attachment_size)} · PDF</p>
            ) : (
              <p className="text-xs text-muted-foreground">PDF document</p>
            )}
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              size="sm"
              className="h-9 w-full gap-1.5 sm:w-auto"
              disabled={loading || !blobUrl}
              onClick={() => setPdfOpen(true)}
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
              View
            </Button>
            <Button variant="outline" size="sm" className="h-9 w-full gap-1.5 sm:w-auto" onClick={onDownload}>
              <Download className="size-4" />
              Download
            </Button>
          </div>
        </div>

        <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
          <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
            <DialogHeader className="border-b px-4 py-3">
              <DialogTitle className="truncate pr-8 text-sm font-medium break-words sm:text-base">{name}</DialogTitle>
            </DialogHeader>
            {blobUrl ? (
              <iframe
                title={name}
                src={blobUrl}
                className="h-[min(70vh,32rem)] w-full bg-muted/20 sm:h-[min(78vh,820px)]"
              />
            ) : (
              <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                PDF preview unavailable
              </div>
            )}
            <DialogFooter className="border-t px-4 py-3">
              <Button variant="outline" className="h-9 w-full sm:w-auto" onClick={onDownload}>
                <Download className="mr-2 size-4" />
                Download
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <Button variant="outline" size="sm" className="h-9 w-full gap-2 break-words sm:w-auto" onClick={onDownload}>
      <Download className="size-4" />
      {name}
      {post.attachment_size ? ` (${fmtSize(post.attachment_size)})` : ""}
    </Button>
  );
}

export function RcicCommunityClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const deepLinkHandled = useRef(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Post | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [reportOpen, setReportOpen] = useState<{ type: "post" | "reply"; id: number } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reporting, setReporting] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }, []);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ per_page: "20" });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`${API}/consultant/rcic-community/posts?${params}`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Failed to load posts.");
      setPosts(json.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load posts.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    void fetch(`${API}/consultant/rcic-community/mark-seen`, {
      method: "POST",
      headers: authHeaders(),
    }).then(() => {
      window.dispatchEvent(new CustomEvent("rcic-community-seen"));
    });
  }, []);

  const openPost = async (post: Post) => {
    setSelected(post);
    setDetailLoading(true);
    setReplies([]);
    try {
      const res = await fetch(`${API}/consultant/rcic-community/posts/${post.id}`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Failed to load post.");
      setSelected(json.data.post);
      setReplies(json.data.replies ?? []);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Could not open post.");
      setSelected(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    const postId = searchParams.get("post");
    if (!postId || deepLinkHandled.current) return;

    const match = posts.find((p) => String(p.id) === postId);
    if (match) {
      deepLinkHandled.current = true;
      void openPost(match);
      return;
    }

    if (loading) return;

    deepLinkHandled.current = true;
    setSelected({
      id: Number(postId),
      title: "",
      body: "",
      reactions_count: 0,
      replies_count: 0,
      has_attachment: false,
      attachment_name: null,
      attachment_mime: null,
      attachment_size: null,
      reacted: false,
      is_mine: false,
      created_at: new Date().toISOString(),
      author: { id: 0, name: "", rcic_number: null, company_name: null },
    });
    void (async () => {
      setDetailLoading(true);
      try {
        const res = await fetch(`${API}/consultant/rcic-community/posts/${postId}`, { headers: authHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message ?? "Post not found.");
        setSelected(json.data.post);
        setReplies(json.data.replies ?? []);
      } catch (e: unknown) {
        showToast(e instanceof Error ? e.message : "Post not found.");
      } finally {
        setDetailLoading(false);
      }
    })();
  }, [searchParams, posts, loading, showToast]);

  const submitPost = async () => {
    if (!newTitle.trim() || !newBody.trim()) return;
    setPosting(true);
    try {
      const form = new FormData();
      form.append("title", newTitle.trim());
      form.append("body", newBody.trim());
      if (newFile) form.append("file", newFile);
      const res = await fetch(`${API}/consultant/rcic-community/posts`, {
        method: "POST",
        headers: authHeaders(false),
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Failed to publish.");
      setComposeOpen(false);
      setNewTitle("");
      setNewBody("");
      setNewFile(null);
      showToast("Post published!");
      await loadPosts();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed to publish.");
    } finally {
      setPosting(false);
    }
  };

  const submitReply = async () => {
    if (!selected || !replyText.trim()) return;
    setReplying(true);
    try {
      const res = await fetch(`${API}/consultant/rcic-community/posts/${selected.id}/replies`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ body: replyText.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Failed to reply.");
      setReplies((r) => [...r, json.data]);
      setReplyText("");
      setSelected((p) => p ? { ...p, replies_count: p.replies_count + 1 } : p);
      setPosts((list) => list.map((p) => (p.id === selected.id ? { ...p, replies_count: p.replies_count + 1 } : p)));
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed to reply.");
    } finally {
      setReplying(false);
    }
  };

  const toggleReact = async (post: Post) => {
    try {
      const res = await fetch(`${API}/consultant/rcic-community/posts/${post.id}/react`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ reaction: "like" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error();
      const update = (p: Post): Post => ({
        ...p,
        reacted: json.reacted,
        reactions_count: json.reactions_count,
      });
      setPosts((list) => list.map((p) => (p.id === post.id ? update(p) : p)));
      if (selected?.id === post.id) setSelected(update(selected));
    } catch {
      showToast("Could not update reaction.");
    }
  };

  const submitReport = async () => {
    if (!reportOpen || !reportReason.trim()) return;
    setReporting(true);
    try {
      const res = await fetch(`${API}/consultant/rcic-community/report`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          type: reportOpen.type,
          id: reportOpen.id,
          reason: reportReason.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Failed to report.");
      setReportOpen(null);
      setReportReason("");
      showToast("Report submitted. Thank you.");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed to report.");
    } finally {
      setReporting(false);
    }
  };

  const deletePost = async (post: Post) => {
    if (!confirm("Delete your post? This cannot be undone.")) return;
    try {
      const res = await fetch(`${API}/consultant/rcic-community/posts/${post.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      setSelected(null);
      await loadPosts();
      showToast("Post deleted.");
    } catch {
      showToast("Could not delete post.");
    }
  };

  const downloadAttachment = async (postId: number, name: string) => {
    const token = localStorage.getItem("wtc_consultant_token");
    const res = await fetch(`${API}/consultant/rcic-community/posts/${postId}/attachment`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      showToast("Download failed.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const postIdFromUrl = searchParams.get("post");
  const showPostDetail = selected !== null || (postIdFromUrl !== null && deepLinkHandled.current);

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden pb-8 sm:space-y-6 sm:pb-10">
      {toast && (
        <div className="fixed top-4 right-3 left-3 z-50 rounded-xl border bg-background px-4 py-2 text-sm shadow-lg sm:left-auto sm:max-w-sm">
          {toast}
        </div>
      )}

      <section className="rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-emerald-500/5 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 sm:size-10">
                <Users className="size-4 sm:size-5" />
              </span>
              RCIC Community
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              A private peer space for RCICMASTER consultants — ask questions, share experience, and learn from colleagues.
            </p>
          </div>
          <Button className="h-10 w-full rounded-xl sm:w-auto" onClick={() => setComposeOpen(true)}>
            <Plus className="mr-2 size-4" />
            New post
          </Button>
        </div>
      </section>

      {!showPostDetail ? (
        <Card className="border-border/70">
          <CardHeader className="border-b border-border/50 p-4 pb-4 sm:p-6">
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-10 w-full rounded-xl pl-9"
                  placeholder="Search posts…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-16 text-muted-foreground">
                <Loader2 className="mr-2 size-5 animate-spin" /> Loading…
              </div>
            ) : error ? (
              <p className="p-4 text-sm text-destructive break-words sm:p-6">{error}</p>
            ) : posts.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground sm:p-8">
                No posts yet. Be the first to start a conversation.
              </p>
            ) : (
              <ul className="divide-y divide-border/50">
                {posts.map((post) => (
                  <li key={post.id}>
                    <button
                      type="button"
                      className="w-full px-4 py-4 text-left transition-colors hover:bg-muted/30 sm:px-5"
                      onClick={() => void openPost(post)}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold leading-tight break-words">{post.title}</p>
                        {post.has_attachment && (
                          <Badge variant="outline" className="shrink-0 gap-1 text-[10px]">
                            <Paperclip className="size-3" /> File
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground break-words">{post.body}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="break-words">{post.author.name}{post.author.rcic_number ? ` · ${post.author.rcic_number}` : ""}</span>
                        <span className="shrink-0">{fmtDate(post.created_at)}</span>
                        <span className="flex shrink-0 items-center gap-1">
                          <ThumbsUp className="size-3" /> {post.reactions_count}
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          <MessageSquare className="size-3" /> {post.replies_count}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/70">
          <CardHeader className="border-b border-border/50 p-4 sm:p-6">
            <Button
              variant="ghost"
              size="sm"
              className="mb-2 h-9 w-full justify-start sm:w-fit"
              onClick={() => {
                setSelected(null);
                deepLinkHandled.current = false;
                router.replace("/dashboard/rcic-community");
              }}
            >
              <ChevronLeft className="mr-1 size-4" /> Back to feed
            </Button>
            {detailLoading ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            ) : selected ? (
              <>
                <CardTitle className="text-lg leading-tight break-words sm:text-xl">{selected.title}</CardTitle>
                <CardDescription className="break-words">
                  {selected.author.name}
                  {selected.author.rcic_number ? ` · ${selected.author.rcic_number}` : ""}
                  {selected.author.company_name ? ` · ${selected.author.company_name}` : ""}
                  {" · "}{fmtDate(selected.created_at)}
                </CardDescription>
              </>
            ) : null}
          </CardHeader>
          {!detailLoading && selected && (
            <CardContent className="space-y-5 p-4 pt-4 sm:space-y-6 sm:p-6 sm:pt-5">
              <p className="whitespace-pre-line text-sm leading-relaxed break-words">{selected.body}</p>

              {selected.has_attachment && selected.attachment_name && (
                <PostAttachmentBlock
                  post={selected}
                  onDownload={() => void downloadAttachment(selected.id, selected.attachment_name!)}
                  onError={showToast}
                />
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  variant={selected.reacted ? "default" : "outline"}
                  size="sm"
                  className="h-9 w-full gap-1.5 sm:w-auto"
                  onClick={() => void toggleReact(selected)}
                >
                  <ThumbsUp className="size-4" />
                  Helpful ({selected.reactions_count})
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-full gap-1.5 text-muted-foreground sm:w-auto"
                  onClick={() => setReportOpen({ type: "post", id: selected.id })}
                >
                  <Flag className="size-4" /> Report
                </Button>
                {selected.is_mine && (
                  <Button variant="ghost" size="sm" className="h-9 w-full text-destructive sm:w-auto" onClick={() => void deletePost(selected)}>
                    <Trash2 className="mr-1 size-4" /> Delete
                  </Button>
                )}
              </div>

              <div className="space-y-4 border-t border-border/50 pt-4">
                <h3 className="text-sm font-semibold">Replies ({replies.length})</h3>
                {replies.map((r) => (
                  <div key={r.id} className="rounded-xl border border-border/50 bg-muted/20 p-3">
                    <p className="text-xs font-medium text-muted-foreground break-words">
                      {r.author.name}{r.author.rcic_number ? ` · ${r.author.rcic_number}` : ""} · {fmtDate(r.created_at)}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm break-words">{r.body}</p>
                    {!r.is_mine && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1 h-8 w-full justify-start text-xs text-muted-foreground sm:h-7 sm:w-auto"
                        onClick={() => setReportOpen({ type: "reply", id: r.id })}
                      >
                        <Flag className="mr-1 size-3" /> Report
                      </Button>
                    )}
                  </div>
                ))}
                <div className="space-y-2">
                  <Textarea
                    placeholder="Share your advice or experience…"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="min-h-[88px] rounded-xl"
                  />
                  <Button className="h-10 w-full sm:w-auto" onClick={() => void submitReply()} disabled={replying || !replyText.trim()}>
                    {replying ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    Reply
                  </Button>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-lg sm:p-6">
          <DialogHeader>
            <DialogTitle>New community post</DialogTitle>
            <DialogDescription>
              Ask a question or share experience with fellow RCICs. Optional attachment up to 10 MB (PDF, Word, images).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="mt-1 h-10" maxLength={255} />
            </div>
            <div>
              <Label>Details</Label>
              <Textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} className="mt-1 min-h-[120px]" />
            </div>
            <div>
              <Label>Attachment (optional)</Label>
              <Input
                type="file"
                className="mt-1 h-auto min-h-10 py-2"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
              />
              <p className="mt-1 text-xs text-muted-foreground">Max 10 MB</p>
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" className="h-9 w-full sm:w-auto" onClick={() => setComposeOpen(false)}>Cancel</Button>
            <Button className="h-9 w-full sm:w-auto" onClick={() => void submitPost()} disabled={posting || !newTitle.trim() || !newBody.trim()}>
              {posting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reportOpen !== null} onOpenChange={(o) => !o && setReportOpen(null)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] p-4 sm:max-w-lg sm:p-6">
          <DialogHeader>
            <DialogTitle>Report content</DialogTitle>
            <DialogDescription>
              Tell us why this post or reply should be reviewed. Admins will see your report.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="e.g. Off-topic, spam, unprofessional…"
            className="min-h-[100px]"
          />
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" className="h-9 w-full sm:w-auto" onClick={() => setReportOpen(null)}>Cancel</Button>
            <Button className="h-9 w-full sm:w-auto" onClick={() => void submitReport()} disabled={reporting || !reportReason.trim()}>
              Submit report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
