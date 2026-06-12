"use client";

import * as React from "react";
import { GraduationCap, ImageIcon, Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { adminAuthHeaders } from "@/lib/admin-auth";
import { LmsCourseBuilder } from "./lms-course-builder";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/v1`;

type Category = { id: number; name: string; slug: string; description?: string; is_active: boolean; courses_count?: number };
type Course = {
  id: number; title: string; category_id: number; is_published: boolean;
  thumbnail_url?: string | null; category?: Category; modules_count?: number;
};

export default function LmsAdminPage() {
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = React.useState<any>(null);
  const [catForm, setCatForm] = React.useState({ name: "", description: "" });
  const [courseForm, setCourseForm] = React.useState({ title: "", category_id: "", description: "", thumbnail_url: "" });
  const [thumbnailFile, setThumbnailFile] = React.useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [tab, setTab] = React.useState("categories");

  const load = React.useCallback(async () => {
    const [cRes, coRes] = await Promise.all([
      fetch(`${API}/admin/lms/categories`, { headers: adminAuthHeaders() }),
      fetch(`${API}/admin/lms/courses`, { headers: adminAuthHeaders() }),
    ]);
    setCategories((await cRes.json()).data ?? []);
    setCourses((await coRes.json()).data ?? []);
  }, []);

  React.useEffect(() => { load(); }, [load]);

  async function loadCourse(id: number) {
    const res = await fetch(`${API}/admin/lms/courses/${id}`, { headers: adminAuthHeaders() });
    setSelectedCourse(await res.json());
  }

  async function addCategory() {
    await fetch(`${API}/admin/lms/categories`, {
      method: "POST", headers: { ...adminAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(catForm),
    });
    setCatForm({ name: "", description: "" });
    load();
  }

  function onThumbnailPick(file: File | null) {
    setThumbnailFile(file);
    if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    setThumbnailPreview(file ? URL.createObjectURL(file) : null);
  }

  async function uploadCourseThumbnail(courseId: number, file: File) {
    const body = new FormData();
    body.append("thumbnail", file);
    await fetch(`${API}/admin/lms/courses/${courseId}/thumbnail`, {
      method: "POST",
      headers: adminAuthHeaders(),
      body,
    });
  }

  async function addCourse() {
    setCreating(true);
    try {
      const res = await fetch(`${API}/admin/lms/courses`, {
        method: "POST", headers: { ...adminAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          title: courseForm.title,
          description: courseForm.description || null,
          thumbnail_url: courseForm.thumbnail_url || null,
          category_id: Number(courseForm.category_id),
          is_published: true,
        }),
      });
      const created = await res.json();
      if (thumbnailFile && created?.id) {
        await uploadCourseThumbnail(created.id, thumbnailFile);
      }
      setCourseForm({ title: "", category_id: "", description: "", thumbnail_url: "" });
      onThumbnailPick(null);
      load();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GraduationCap className="h-7 w-7 text-emerald-600" />
          LMS Management
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Categories, courses, question bank, mock exams, assignments, and lesson content.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="builder" disabled={!selectedCourse}>Course Builder</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Add exam stream</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="e.g. IELTS" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
              <Input placeholder="Description" value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} />
              <Button className="sm:col-span-2 w-fit" onClick={addCategory}><Plus className="h-4 w-4 mr-1" />Add category</Button>
            </CardContent>
          </Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead><TableHead>Courses</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.courses_count ?? 0}</TableCell>
                  <TableCell><Badge variant={c.is_active ? "default" : "secondary"}>{c.is_active ? "Active" : "Off"}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="courses" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Create master course</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Course title" value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} />
              <Select value={courseForm.category_id} onValueChange={(v) => setCourseForm({ ...courseForm, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Textarea className="sm:col-span-2" placeholder="Description" value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} />
              <Input
                className="sm:col-span-2"
                placeholder="Thumbnail image URL (optional)"
                value={courseForm.thumbnail_url}
                onChange={(e) => setCourseForm({ ...courseForm, thumbnail_url: e.target.value })}
              />
              <div className="sm:col-span-2 flex flex-wrap items-center gap-4 rounded-lg border p-4 bg-muted/20">
                <div className="h-24 w-40 rounded-lg border bg-muted overflow-hidden flex items-center justify-center shrink-0">
                  {thumbnailPreview || courseForm.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbnailPreview ?? courseForm.thumbnail_url}
                      alt="Thumbnail preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Course thumbnail</p>
                  <p className="text-xs text-muted-foreground max-w-sm">Upload JPG, PNG, or WebP (max 4 MB) or paste an image URL above.</p>
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="max-w-xs"
                    onChange={(e) => onThumbnailPick(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
              <Button className="w-fit" onClick={addCourse} disabled={creating}>
                <Plus className="h-4 w-4 mr-1" />{creating ? "Creating…" : "Create course"}
              </Button>
            </CardContent>
          </Card>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Course</TableHead><TableHead>Category</TableHead><TableHead>Thumbnail</TableHead><TableHead></TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {courses.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.title}</TableCell>
                  <TableCell>{c.category?.name}</TableCell>
                  <TableCell>
                    {c.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.thumbnail_url} alt="" className="h-10 w-16 rounded object-cover border" />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => { loadCourse(c.id); setTab("builder"); }}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />Build
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="builder">
          {selectedCourse && (
            <LmsCourseBuilder
              course={selectedCourse}
              onRefresh={() => loadCourse(selectedCourse.id)}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
