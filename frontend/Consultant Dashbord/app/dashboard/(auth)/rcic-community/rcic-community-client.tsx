"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Loader2,
  MessageSquare,
  Search,
  ThumbsUp,
  Paperclip,
  Flag,
  Trash2,
  Download,
  Users,
  FileText,
  ImageIcon,
  Send,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RichTextEditorDemo } from "@/components/ui/custom/tiptap/rich-text-editor";
import { cn } from "@/lib/utils";

import "./rcic-community.css";

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

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function avatarTone(name: string) {
  const tones = [
    "bg-primary/15 text-primary",
    "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  ];
  const idx = name.split("").reduce((sum, c) => sum + c.charCodeAt(0), 0) % tones.length;
  return tones[idx];
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

function fmtSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function richTextHasContent(value: string) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .trim().length > 0;
}

function sanitizeCommunityHtml(value: string) {
  if (typeof window === "undefined" || !value.includes("<")) return value;

  const doc = new DOMParser().parseFromString(value, "text/html");
  const allowedTags = new Set([
    "P", "BR", "STRONG", "B", "EM", "I", "U", "S", "H1", "H2", "H3", "H4",
    "UL", "OL", "LI", "BLOCKQUOTE", "CODE", "PRE", "A", "SPAN", "MARK", "HR",
    "SUB", "SUP",
  ]);
  const blockedTags = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "FORM", "SVG", "MATH"]);

  Array.from(doc.body.querySelectorAll("*")).forEach((element) => {
    if (blockedTags.has(element.tagName)) {
      element.remove();
      return;
    }
    if (!allowedTags.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }

    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      if (element.tagName === "A" && name === "href") {
        if (!/^(https?:|mailto:)/i.test(attribute.value)) element.removeAttribute(attribute.name);
        return;
      }
      if (name === "style") {
        const safeStyles = attribute.value
          .split(";")
          .map((rule) => rule.trim())
          .filter((rule) => /^(color|background-color|text-align)\s*:/i.test(rule))
          .join("; ");
        if (safeStyles) element.setAttribute("style", safeStyles);
        else element.removeAttribute("style");
        return;
      }
      element.removeAttribute(attribute.name);
    });

    if (element.tagName === "A" && element.hasAttribute("href")) {
      element.setAttribute("target", "_blank");
      element.setAttribute("rel", "noopener noreferrer");
    }
  });

  return doc.body.innerHTML;
}

type AttachmentKind = "image" | "pdf" | "other";

function attachmentKind(mime: string | null, name: string | null): AttachmentKind {
  const m = (mime ?? "").toLowerCase();
  const n = (name ?? "").toLowerCase();
  if (m.startsWith("image/") || /\.(jpe?g|png|gif|webp|bmp)$/.test(n)) return "image";
  if (m === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  return "other";
}

function AuthorAvatar({ author, size = "md" }: { author: Author; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold",
        size === "sm" && "size-8 text-[11px]",
        size === "md" && "size-10 text-sm",
        size === "lg" && "size-11 text-sm",
        avatarTone(author.name || "?"),
      )}
    >
      {initials(author.name || "?")}
    </span>
  );
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
        if (active) onError("Could not load attachment preview.");
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

  if (!post.has_attachment) return null;

  if (kind === "image") {
    return (
      <div className="overflow-hidden rounded-xl border border-border/50 bg-muted/20">
        {loading && (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}
        {blobUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={blobUrl} alt={name} className="max-h-[420px] w-full object-contain bg-black/5" />
        )}
        <div className="flex items-center justify-between gap-2 border-t border-border/40 px-3 py-2">
          <span className="truncate text-xs text-muted-foreground">
            <ImageIcon className="mr-1 inline size-3.5" />
            {name}
            {post.attachment_size ? ` · ${fmtSize(post.attachment_size)}` : ""}
          </span>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onDownload}>
            <Download className="mr-1 size-3.5" /> Download
          </Button>
        </div>
      </div>
    );
  }

  if (kind === "pdf") {
    return (
      <div className="overflow-hidden rounded-xl border border-border/50 bg-muted/20">
        <button
          type="button"
          className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-muted/40"
          onClick={() => setPdfOpen(true)}
        >
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{name}</span>
            <span className="text-xs text-muted-foreground">
              PDF{post.attachment_size ? ` · ${fmtSize(post.attachment_size)}` : ""} · Tap to preview
            </span>
          </span>
        </button>
        <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden p-0">
            <DialogHeader className="border-b px-4 py-3">
              <DialogTitle className="truncate text-base">{name}</DialogTitle>
            </DialogHeader>
            {blobUrl ? (
              <iframe src={blobUrl} title={name} className="h-[70vh] w-full" />
            ) : (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="size-5 animate-spin" />
              </div>
            )}
            <DialogFooter className="border-t px-4 py-3">
              <Button type="button" variant="outline" onClick={onDownload}>
                <Download className="mr-1.5 size-4" /> Download
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <Button type="button" variant="outline" className="h-10 gap-2 rounded-xl" onClick={onDownload}>
      <Paperclip className="size-4" />
      {name}
      {post.attachment_size ? ` (${fmtSize(post.attachment_size)})` : ""}
    </Button>
  );
}

function FeedPostCard({
  post,
  expanded,
  replies,
  repliesLoading,
  replyText,
  replying,
  onToggleExpand,
  onReact,
  onReplyChange,
  onSubmitReply,
  onReport,
  onDelete,
  onDownload,
  onError,
}: {
  post: Post;
  expanded: boolean;
  replies: Reply[];
  repliesLoading: boolean;
  replyText: string;
  replying: boolean;
  onToggleExpand: () => void;
  onReact: () => void;
  onReplyChange: (v: string) => void;
  onSubmitReply: () => void;
  onReport: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onError: (msg: string) => void;
}) {
  return (
    <article className="rcic-feed-card overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      <div className="flex items-start gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        <AuthorAvatar author={post.author} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold leading-tight">{post.author.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {post.author.company_name || "RCIC"}
                {post.author.rcic_number ? ` · ${post.author.rcic_number}` : ""}
                {" · "}
                <span title={new Date(post.created_at).toLocaleString()}>{timeAgo(post.created_at)}</span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                onClick={onReport}
                aria-label="Report post"
              >
                <Flag className="size-3.5" />
              </Button>
              {post.is_mine ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  onClick={onDelete}
                  aria-label="Delete post"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-4 py-3 sm:px-5">
        <h3 className="text-[17px] font-bold leading-snug tracking-tight">{post.title}</h3>
        {post.body.includes("<") ? (
          <div
            className="rcic-rich-content text-[15px] leading-relaxed text-foreground/90"
            dangerouslySetInnerHTML={{ __html: sanitizeCommunityHtml(post.body) }}
          />
        ) : (
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground/90">{post.body}</p>
        )}
        {post.has_attachment && post.attachment_name ? (
          <PostAttachmentBlock post={post} onDownload={onDownload} onError={onError} />
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border/40 px-4 py-2 text-xs text-muted-foreground sm:px-5">
        <span className="inline-flex items-center gap-1.5">
          <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-primary">
            <ThumbsUp className="size-3" />
          </span>
          {post.reactions_count} helpful
        </span>
        <button type="button" className="hover:underline" onClick={onToggleExpand}>
          {post.replies_count} {post.replies_count === 1 ? "comment" : "comments"}
        </button>
      </div>

      <div className="grid grid-cols-2 border-t border-border/40">
        <button
          type="button"
          onClick={onReact}
          className={cn(
            "flex h-11 items-center justify-center gap-2 text-sm font-medium transition-colors hover:bg-muted/40",
            post.reacted ? "text-primary" : "text-muted-foreground",
          )}
        >
          <ThumbsUp className={cn("size-4", post.reacted && "fill-current")} />
          Helpful
        </button>
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex h-11 items-center justify-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40"
        >
          <MessageSquare className="size-4" />
          Comment
        </button>
      </div>

      {expanded ? (
        <div className="space-y-3 border-t border-border/40 bg-muted/15 px-4 py-4 sm:px-5">
          {repliesLoading ? (
            <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading comments…
            </div>
          ) : (
            <ul className="space-y-3">
              {replies.map((r) => (
                <li key={r.id} className="flex gap-2.5">
                  <AuthorAvatar author={r.author} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="rounded-2xl bg-background px-3.5 py-2.5 shadow-sm ring-1 ring-border/50">
                      <p className="text-xs font-semibold">
                        {r.author.name}
                        <span className="ml-1.5 font-normal text-muted-foreground">{timeAgo(r.created_at)}</span>
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{r.body}</p>
                    </div>
                    {!r.is_mine ? (
                      <button
                        type="button"
                        className="mt-1 ml-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                        onClick={onReport}
                      >
                        Report
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
              {replies.length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet — start the conversation.</p>
              ) : null}
            </ul>
          )}

          <div className="flex items-start gap-2.5 pt-1">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
              You
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <Textarea
                value={replyText}
                onChange={(e) => onReplyChange(e.target.value)}
                placeholder="Write a comment…"
                className="min-h-[72px] resize-none rounded-2xl bg-background"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="h-8 rounded-full px-4"
                  disabled={replying || !replyText.trim()}
                  onClick={onSubmitReply}
                >
                  {replying ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Send className="mr-1.5 size-3.5" />}
                  Post
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </article>
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
  const [toast, setToast] = useState("");

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [repliesByPost, setRepliesByPost] = useState<Record<number, Reply[]>>({});
  const [repliesLoadingId, setRepliesLoadingId] = useState<number | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [replyingId, setReplyingId] = useState<number | null>(null);

  const [composerOpen, setComposerOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);

  const [reportOpen, setReportOpen] = useState<{ type: "post" | "reply"; id: number } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reporting, setReporting] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }, []);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ per_page: "30" });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`${API}/consultant/rcic-community/posts?${params}`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Failed to load posts.");
      const list: Post[] = json.data ?? [];
      // Newest posts always first
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setPosts(list);
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

  const loadReplies = useCallback(async (postId: number) => {
    setRepliesLoadingId(postId);
    try {
      const res = await fetch(`${API}/consultant/rcic-community/posts/${postId}`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Failed to load comments.");
      setRepliesByPost((prev) => ({ ...prev, [postId]: json.data.replies ?? [] }));
      if (json.data?.post) {
        setPosts((list) => list.map((p) => (p.id === postId ? { ...p, ...json.data.post } : p)));
      }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Could not load comments.");
    } finally {
      setRepliesLoadingId(null);
    }
  }, [showToast]);

  const toggleExpand = useCallback(async (postId: number) => {
    if (expandedId === postId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(postId);
    if (!repliesByPost[postId]) {
      await loadReplies(postId);
    }
  }, [expandedId, repliesByPost, loadReplies]);

  useEffect(() => {
    const postId = searchParams.get("post");
    if (!postId || deepLinkHandled.current || loading) return;
    deepLinkHandled.current = true;
    const id = Number(postId);
    setExpandedId(id);
    void loadReplies(id);
    requestAnimationFrame(() => {
      document.getElementById(`rcic-post-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [searchParams, loading, loadReplies]);

  const submitPost = async () => {
    if (!newTitle.trim() || !richTextHasContent(newBody)) return;
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
      setComposerOpen(false);
      setNewTitle("");
      setNewBody("");
      setNewFile(null);
      showToast("Posted to the community!");
      // New post appears at the top of the feed immediately
      if (json.data) {
        setPosts((list) => [json.data as Post, ...list.filter((p) => p.id !== json.data.id)]);
      } else {
        await loadPosts();
      }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed to publish.");
    } finally {
      setPosting(false);
    }
  };

  const submitReply = async (postId: number) => {
    const text = (replyDrafts[postId] ?? "").trim();
    if (!text) return;
    setReplyingId(postId);
    try {
      const res = await fetch(`${API}/consultant/rcic-community/posts/${postId}/replies`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ body: text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Failed to reply.");
      setRepliesByPost((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] ?? []), json.data],
      }));
      setReplyDrafts((prev) => ({ ...prev, [postId]: "" }));
      setPosts((list) =>
        list.map((p) => (p.id === postId ? { ...p, replies_count: p.replies_count + 1 } : p)),
      );
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed to reply.");
    } finally {
      setReplyingId(null);
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
      setPosts((list) =>
        list.map((p) =>
          p.id === post.id
            ? { ...p, reacted: json.reacted, reactions_count: json.reactions_count }
            : p,
        ),
      );
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
      setPosts((list) => list.filter((p) => p.id !== post.id));
      if (expandedId === post.id) setExpandedId(null);
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

  const activeCount = useMemo(() => posts.length, [posts]);

  return (
    <div className="rcic-community-page min-w-0 w-full space-y-4 overflow-x-hidden pb-10">
      {toast ? (
        <div className="fixed top-4 right-3 left-3 z-50 rounded-xl border bg-background px-4 py-2 text-sm shadow-lg sm:left-auto sm:max-w-sm">
          {toast}
        </div>
      ) : null}

      <section className="rcic-community-hero overflow-hidden rounded-2xl border border-border/50 shadow-sm">
        <div className="relative px-4 py-5 sm:px-5">
          <div className="relative z-[1] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <Users className="size-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">RCIC Community</h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Ongoing peer conversation — ask, advise, and stay in the loop.
                </p>
              </div>
            </div>
            {!loading && activeCount > 0 ? (
              <Badge variant="secondary" className="w-fit rounded-lg font-normal">
                {activeCount} active posts
              </Badge>
            ) : null}
          </div>
        </div>
      </section>

      {/* Composer — Facebook-style */}
      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="flex w-full items-center gap-3 text-left"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            You
          </span>
          <span className="flex h-11 min-w-0 flex-1 items-center rounded-full bg-muted/50 px-4 text-sm text-muted-foreground transition-colors hover:bg-muted">
            What&apos;s on your mind, colleague?
          </span>
        </button>
        <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3">
          <span className="text-xs text-muted-foreground">Share a question or tip with fellow RCICs</span>
          <Button size="sm" className="h-8 rounded-full px-4" onClick={() => setComposerOpen(true)}>
            Create post
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-11 rounded-full border-border/60 bg-card pl-10 shadow-sm"
          placeholder="Search the community feed…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-muted/45" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-6 text-sm text-destructive">
          {error}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-6 py-16 text-center">
          <Users className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-3 font-semibold">No posts yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Be the first to start the conversation.</p>
          <Button className="mt-4 rounded-full" onClick={() => setComposerOpen(true)}>
            Create post
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} id={`rcic-post-${post.id}`}>
              <FeedPostCard
                post={post}
                expanded={expandedId === post.id}
                replies={repliesByPost[post.id] ?? []}
                repliesLoading={repliesLoadingId === post.id}
                replyText={replyDrafts[post.id] ?? ""}
                replying={replyingId === post.id}
                onToggleExpand={() => void toggleExpand(post.id)}
                onReact={() => void toggleReact(post)}
                onReplyChange={(v) => setReplyDrafts((prev) => ({ ...prev, [post.id]: v }))}
                onSubmitReply={() => void submitReply(post.id)}
                onReport={() => setReportOpen({ type: "post", id: post.id })}
                onDelete={() => void deletePost(post)}
                onDownload={() => void downloadAttachment(post.id, post.attachment_name ?? "attachment")}
                onError={showToast}
              />
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={composerOpen}
        onOpenChange={(open) => {
          setComposerOpen(open);
          if (!open) {
            setNewFile(null);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-3xl sm:p-6">
          <DialogHeader>
            <DialogTitle>Create post</DialogTitle>
            <DialogDescription>
              Share with the RCIC community. Optional attachment up to 10 MB.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="mt-1 h-10"
                maxLength={255}
                placeholder="What do you want to discuss?"
              />
            </div>
            <div>
              <Label>Details</Label>
              <RichTextEditorDemo
                output="html"
                value={newBody}
                onChange={(value) => setNewBody(value as string)}
                className="mt-1 min-h-[240px] max-h-[430px] rounded-lg"
                editorContentClassName="min-h-[190px] px-4 py-3"
                editorClassName="min-h-[190px]"
                placeholder="Add more context for colleagues…"
              />
            </div>
            <div>
              <Label>Attachment (optional)</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  type="file"
                  className="h-auto min-h-10 py-2"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
                />
                {newFile ? (
                  <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0" onClick={() => setNewFile(null)}>
                    <X className="size-4" />
                  </Button>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Max 10 MB{newFile ? ` · Selected: ${newFile.name}` : ""}
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" className="h-9 w-full sm:w-auto" onClick={() => setComposerOpen(false)}>
              Cancel
            </Button>
            <Button
              className="h-9 w-full sm:w-auto"
              onClick={() => void submitPost()}
              disabled={posting || !newTitle.trim() || !richTextHasContent(newBody)}
            >
              {posting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reportOpen !== null} onOpenChange={(o) => !o && setReportOpen(null)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] p-4 sm:max-w-lg sm:p-6">
          <DialogHeader>
            <DialogTitle>Report content</DialogTitle>
            <DialogDescription>
              Tell us why this should be reviewed. Admins will see your report.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="e.g. Off-topic, spam, unprofessional…"
            className="min-h-[100px]"
          />
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" className="h-9 w-full sm:w-auto" onClick={() => setReportOpen(null)}>
              Cancel
            </Button>
            <Button
              className="h-9 w-full sm:w-auto"
              onClick={() => void submitReport()}
              disabled={reporting || !reportReason.trim()}
            >
              Submit report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
