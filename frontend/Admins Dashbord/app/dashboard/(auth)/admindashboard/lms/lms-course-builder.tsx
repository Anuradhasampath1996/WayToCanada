"use client";

import * as React from "react";
import {
  BookOpen, ClipboardList, Clock, Download, FileQuestion, ImageIcon, Layers, Plus, Trash2, Upload, GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { adminAuthHeaders } from "@/lib/admin-auth";
import { RichTextEditorDemo } from "@/components/ui/custom/tiptap/rich-text-editor";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/v1`;

type BankOption = { id?: number; option_text: string; is_correct?: boolean };
type BankQuestion = {
  id: number; question_text: string; topic?: string; difficulty: string;
  explanation?: string; options: BankOption[];
};
type QuizItem = {
  id: number; title: string; content_type: string; source_mode: string;
  passing_score: number; random_question_count?: number; time_limit_minutes?: number;
  description?: string; bank_links?: { bank_question_id: number; bank_question?: BankQuestion }[];
};
type HomeworkItem = { id: number; title: string; instructions?: string; max_score: number };
type CourseDetail = {
  id: number; title: string; thumbnail_url?: string | null;
  modules: { id: number; title: string; lessons: { id: number; title: string; lesson_type: string }[] }[];
  quizzes: QuizItem[];
  homework: HomeworkItem[];
  question_bank?: BankQuestion[];
  question_bank_count?: number;
};

export function LmsCourseBuilder({
  course,
  onRefresh,
}: {
  course: CourseDetail;
  onRefresh: () => void;
}) {
  const [section, setSection] = React.useState("lessons");
  const [moduleTitle, setModuleTitle] = React.useState("");
  const [lessonForm, setLessonForm] = React.useState({
    module_id: "", title: "", lesson_type: "mixed", video_url: "", text_content: "",
  });
  const [lessonEditorKey, setLessonEditorKey] = React.useState(0);

  const [bank, setBank] = React.useState<BankQuestion[]>([]);
  const [bankForm, setBankForm] = React.useState({
    question_text: "", topic: "", difficulty: "medium", explanation: "",
    options: ["", "", "", ""], correct: 0,
  });
  const [importText, setImportText] = React.useState("");

  const [examOpen, setExamOpen] = React.useState(false);
  const [examForm, setExamForm] = React.useState({
    title: "", content_type: "mock_exam", source_mode: "bank_random",
    random_question_count: "20", passing_score: "70", time_limit_minutes: "60",
    no_time_limit: false,
    description: "", selectedBankIds: [] as number[],
  });

  const [hwOpen, setHwOpen] = React.useState(false);
  const [hwForm, setHwForm] = React.useState({ title: "", instructions: "", max_score: "100" });
  const [hwEditorKey, setHwEditorKey] = React.useState(0);
  const [thumbnailUrl, setThumbnailUrl] = React.useState(course.thumbnail_url ?? "");
  const [thumbnailUploading, setThumbnailUploading] = React.useState(false);

  React.useEffect(() => {
    setThumbnailUrl(course.thumbnail_url ?? "");
  }, [course.thumbnail_url]);

  const loadBank = React.useCallback(async () => {
    const res = await fetch(`${API}/admin/lms/courses/${course.id}/question-bank`, { headers: adminAuthHeaders() });
    setBank((await res.json()).data ?? []);
  }, [course.id]);

  React.useEffect(() => { loadBank(); }, [loadBank]);

  async function saveThumbnailUrl() {
    await fetch(`${API}/admin/lms/courses/${course.id}`, {
      method: "PUT",
      headers: { ...adminAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ thumbnail_url: thumbnailUrl || null }),
    });
    onRefresh();
  }

  async function uploadThumbnail(file: File) {
    setThumbnailUploading(true);
    try {
      const body = new FormData();
      body.append("thumbnail", file);
      const res = await fetch(`${API}/admin/lms/courses/${course.id}/thumbnail`, {
        method: "POST",
        headers: adminAuthHeaders(),
        body,
      });
      const data = await res.json();
      if (data.thumbnail_url) setThumbnailUrl(data.thumbnail_url);
      onRefresh();
    } finally {
      setThumbnailUploading(false);
    }
  }

  async function addModule() {
    if (!moduleTitle) return;
    await fetch(`${API}/admin/lms/courses/${course.id}/modules`, {
      method: "POST", headers: { ...adminAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ title: moduleTitle }),
    });
    setModuleTitle("");
    onRefresh();
  }

  async function addLesson() {
    if (!lessonForm.module_id) return;
    await fetch(`${API}/admin/lms/modules/${lessonForm.module_id}/lessons`, {
      method: "POST", headers: { ...adminAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(lessonForm),
    });
    setLessonForm({ module_id: "", title: "", lesson_type: "mixed", video_url: "", text_content: "" });
    setLessonEditorKey((k) => k + 1);
    onRefresh();
  }

  async function addBankQuestion() {
    const options = bankForm.options.filter(Boolean).map((t, i) => ({
      option_text: t, is_correct: i === bankForm.correct,
    }));
    await fetch(`${API}/admin/lms/courses/${course.id}/question-bank`, {
      method: "POST", headers: { ...adminAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        question_text: bankForm.question_text,
        topic: bankForm.topic || null,
        difficulty: bankForm.difficulty,
        explanation: bankForm.explanation || null,
        options,
      }),
    });
    setBankForm({ question_text: "", topic: "", difficulty: "medium", explanation: "", options: ["", "", "", ""], correct: 0 });
    loadBank();
    onRefresh();
  }

  async function deleteBankQuestion(id: number) {
    await fetch(`${API}/admin/lms/question-bank/${id}`, { method: "DELETE", headers: adminAuthHeaders() });
    loadBank();
    onRefresh();
  }

  async function importBank() {
    await fetch(`${API}/admin/lms/courses/${course.id}/question-bank/import`, {
      method: "POST", headers: { ...adminAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ format: "csv", content: importText }),
    });
    setImportText("");
    loadBank();
    onRefresh();
  }

  async function exportBank() {
    const res = await fetch(`${API}/admin/lms/courses/${course.id}/question-bank/export`, { headers: adminAuthHeaders() });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${course.title}-question-bank.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function createExam() {
    const body: Record<string, unknown> = {
      title: examForm.title,
      content_type: examForm.content_type,
      source_mode: examForm.source_mode,
      passing_score: Number(examForm.passing_score),
      time_limit_minutes: examForm.no_time_limit ? null : (Number(examForm.time_limit_minutes) || null),
      description: examForm.description || null,
    };
    if (examForm.source_mode === "bank_random") {
      body.random_question_count = Number(examForm.random_question_count);
    }
    if (examForm.source_mode === "bank_fixed") {
      body.bank_question_ids = examForm.selectedBankIds;
    }
    await fetch(`${API}/admin/lms/courses/${course.id}/quizzes`, {
      method: "POST", headers: { ...adminAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setExamOpen(false);
    onRefresh();
  }

  async function deleteExam(id: number) {
    await fetch(`${API}/admin/lms/quizzes/${id}`, { method: "DELETE", headers: adminAuthHeaders() });
    onRefresh();
  }

  async function createHomework() {
    await fetch(`${API}/admin/lms/courses/${course.id}/homework`, {
      method: "POST", headers: { ...adminAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        title: hwForm.title,
        instructions: hwForm.instructions,
        max_score: Number(hwForm.max_score),
      }),
    });
    setHwOpen(false);
    setHwForm({ title: "", instructions: "", max_score: "100" });
    setHwEditorKey((k) => k + 1);
    onRefresh();
  }

  async function deleteHomework(id: number) {
    await fetch(`${API}/admin/lms/homework/${id}`, { method: "DELETE", headers: adminAuthHeaders() });
    onRefresh();
  }

  function toggleBankSelect(id: number) {
    setExamForm((f) => ({
      ...f,
      selectedBankIds: f.selectedBankIds.includes(id)
        ? f.selectedBankIds.filter((x) => x !== id)
        : [...f.selectedBankIds, id],
    }));
  }

  const examTypeLabel: Record<string, string> = {
    quiz: "Quiz", exam: "Exam", mock_exam: "Mock exam",
  };
  const sourceLabel: Record<string, string> = {
    inline: "Inline", bank_fixed: "Fixed from bank", bank_random: "Random from bank",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          {course.title}
          <Badge variant="outline">{bank.length} bank questions</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-xl border p-4 bg-muted/20 space-y-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-emerald-600" />
            <p className="font-semibold text-sm">Course thumbnail</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="h-32 w-full sm:w-48 rounded-xl border bg-muted overflow-hidden shrink-0">
              {thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbnailUrl} alt="Course thumbnail" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-muted-foreground/40">
                  <ImageIcon className="h-10 w-10" />
                </div>
              )}
            </div>
            <div className="flex-1 space-y-3">
              <Input
                placeholder="Thumbnail image URL"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={saveThumbnailUrl}>Save URL</Button>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="max-w-[220px]"
                  disabled={thumbnailUploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadThumbnail(file);
                    e.target.value = "";
                  }}
                />
                {thumbnailUploading && <span className="text-xs text-muted-foreground">Uploading…</span>}
              </div>
              <p className="text-xs text-muted-foreground">Shown on the client learning portal and course overview.</p>
            </div>
          </div>
        </div>

        <Tabs value={section} onValueChange={setSection}>
          <TabsList className="mb-4 flex flex-wrap h-auto">
            <TabsTrigger value="lessons">Lessons</TabsTrigger>
            <TabsTrigger value="bank">Question bank</TabsTrigger>
            <TabsTrigger value="exams">Exams &amp; quizzes</TabsTrigger>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
          </TabsList>

          <TabsContent value="lessons" className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Input placeholder="New module title" value={moduleTitle} onChange={(e) => setModuleTitle(e.target.value)} className="max-w-xs" />
              <Button onClick={addModule}><Layers className="h-4 w-4 mr-1" />Add module</Button>
            </div>
            {course.modules?.map((m) => (
              <div key={m.id} className="rounded-lg border p-4 space-y-1">
                <p className="font-semibold">{m.title}</p>
                {m.lessons?.map((l) => (
                  <p key={l.id} className="text-sm text-muted-foreground pl-3">• {l.title} ({l.lesson_type})</p>
                ))}
              </div>
            ))}
            <div className="grid gap-3 sm:grid-cols-2 border-t pt-4">
              <Select value={lessonForm.module_id} onValueChange={(v) => setLessonForm({ ...lessonForm, module_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select module" /></SelectTrigger>
                <SelectContent>
                  {course.modules?.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.title}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Lesson title" value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} />
              <Input placeholder="Video embed URL" value={lessonForm.video_url} onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })} />
              <div className="sm:col-span-2 space-y-2">
                <Label>Text content</Label>
                <RichTextEditorDemo
                  key={lessonEditorKey}
                  output="html"
                  value={lessonForm.text_content}
                  onChange={(v) => setLessonForm({ ...lessonForm, text_content: v as string })}
                  placeholder="Lesson notes and study material…"
                  className="min-h-[160px] max-h-[280px]"
                  editorContentClassName="p-3 text-sm"
                />
              </div>
              <Button className="w-fit" onClick={addLesson}>Add lesson</Button>
            </div>
          </TabsContent>

          <TabsContent value="bank" className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportBank}><Download className="h-4 w-4 mr-1" />Export CSV</Button>
            </div>
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-sm">Import MCQ from CSV</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Columns: question, option_a, option_b, option_c, option_d, correct (A–F), topic, difficulty, explanation
                </p>
                <Textarea rows={4} placeholder="Paste CSV content…" value={importText} onChange={(e) => setImportText(e.target.value)} />
                <Button variant="outline" onClick={importBank} disabled={!importText.trim()}>
                  <Upload className="h-4 w-4 mr-1" />Import
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-sm">Add question to bank</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Textarea placeholder="Question text" value={bankForm.question_text} onChange={(e) => setBankForm({ ...bankForm, question_text: e.target.value })} />
                <div className="grid gap-2 sm:grid-cols-3">
                  <Input placeholder="Topic (e.g. Reading)" value={bankForm.topic} onChange={(e) => setBankForm({ ...bankForm, topic: e.target.value })} />
                  <Select value={bankForm.difficulty} onValueChange={(v) => setBankForm({ ...bankForm, difficulty: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="Explanation (optional)" value={bankForm.explanation} onChange={(e) => setBankForm({ ...bankForm, explanation: e.target.value })} />
                </div>
                {bankForm.options.map((o, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input type="radio" name="bank-correct" checked={bankForm.correct === i} onChange={() => setBankForm({ ...bankForm, correct: i })} />
                    <Input value={o} onChange={(e) => {
                      const opts = [...bankForm.options]; opts[i] = e.target.value; setBankForm({ ...bankForm, options: opts });
                    }} placeholder={`Option ${String.fromCharCode(65 + i)}`} />
                  </div>
                ))}
                <Button onClick={addBankQuestion}><Plus className="h-4 w-4 mr-1" />Add to bank</Button>
              </CardContent>
            </Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead><TableHead>Topic</TableHead><TableHead>Level</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bank.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="max-w-md truncate">{q.question_text}</TableCell>
                    <TableCell>{q.topic ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{q.difficulty}</Badge></TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => deleteBankQuestion(q.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="exams" className="space-y-4">
            <Button onClick={() => setExamOpen(true)}><GraduationCap className="h-4 w-4 mr-1" />Create exam / mock test</Button>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Source</TableHead><TableHead>Questions</TableHead><TableHead>Duration</TableHead><TableHead>Pass %</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {course.quizzes?.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">{q.title}</TableCell>
                    <TableCell>{examTypeLabel[q.content_type] ?? q.content_type}</TableCell>
                    <TableCell>{sourceLabel[q.source_mode] ?? q.source_mode}</TableCell>
                    <TableCell>
                      {q.source_mode === "bank_random" ? q.random_question_count : (q.bank_links?.length ?? "—")}
                    </TableCell>
                    <TableCell>
                      {q.time_limit_minutes ? (
                        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{q.time_limit_minutes} min</span>
                      ) : "No limit"}
                    </TableCell>
                    <TableCell>{q.passing_score}%</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => deleteExam(q.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="assignments" className="space-y-4">
            <Button onClick={() => setHwOpen(true)}><ClipboardList className="h-4 w-4 mr-1" />Create written assignment</Button>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Title</TableHead><TableHead>Max score</TableHead><TableHead></TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {(course.homework ?? []).map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>{h.title}</TableCell>
                    <TableCell>{h.max_score}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => deleteHomework(h.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={examOpen} onOpenChange={setExamOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create exam from question bank</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Exam title (e.g. IELTS Mock Test 1)" value={examForm.title} onChange={(e) => setExamForm({ ...examForm, title: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={examForm.content_type} onValueChange={(v) => setExamForm({ ...examForm, content_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quiz">Quiz</SelectItem>
                    <SelectItem value="exam">Exam</SelectItem>
                    <SelectItem value="mock_exam">Mock exam</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Question source</Label>
                <Select value={examForm.source_mode} onValueChange={(v) => setExamForm({ ...examForm, source_mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_random">Random from bank</SelectItem>
                    <SelectItem value="bank_fixed">Pick specific questions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {examForm.source_mode === "bank_random" && (
              <div className="space-y-1">
                <Label>Number of random questions</Label>
                <Input type="number" min={1} placeholder="e.g. 40" value={examForm.random_question_count}
                  onChange={(e) => setExamForm({ ...examForm, random_question_count: e.target.value })} />
              </div>
            )}
            {examForm.source_mode === "bank_fixed" && (
              <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-2">
                {bank.map((q) => (
                  <label key={q.id} className="flex items-start gap-2 text-sm cursor-pointer">
                    <Checkbox checked={examForm.selectedBankIds.includes(q.id)} onCheckedChange={() => toggleBankSelect(q.id)} />
                    <span className="line-clamp-2">{q.question_text}</span>
                  </label>
                ))}
                {bank.length === 0 && <p className="text-sm text-muted-foreground">Add questions to the bank first.</p>}
              </div>
            )}

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <Label className="text-base font-semibold">Exam duration</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Client dashboard eke countdown timer ekak pennawa. Mock exam walata time limit set karanna recommend karanawa.
              </p>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={examForm.no_time_limit}
                  onCheckedChange={(v) => setExamForm({ ...examForm, no_time_limit: Boolean(v) })}
                />
                No time limit (unlimited)
              </label>
              {!examForm.no_time_limit && (
                <div className="space-y-1">
                  <Label htmlFor="exam-duration">Time allowed (minutes)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="exam-duration"
                      type="number"
                      min={1}
                      max={600}
                      className="max-w-[140px]"
                      placeholder="e.g. 60"
                      value={examForm.time_limit_minutes}
                      onChange={(e) => setExamForm({ ...examForm, time_limit_minutes: e.target.value })}
                    />
                    <span className="text-sm text-muted-foreground">minutes</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Examples: IELTS reading 60 min · PTE full mock 120 min · Quick quiz 15 min
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label>Passing score (%)</Label>
              <Input type="number" min={1} max={100} placeholder="e.g. 70" value={examForm.passing_score}
                onChange={(e) => setExamForm({ ...examForm, passing_score: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Instructions for students (optional)</Label>
              <Textarea placeholder="e.g. Complete all questions within the time limit. No negative marking." value={examForm.description}
                onChange={(e) => setExamForm({ ...examForm, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={createExam} disabled={
              !examForm.title
              || (examForm.source_mode === "bank_fixed" && examForm.selectedBankIds.length === 0)
              || (!examForm.no_time_limit && !examForm.time_limit_minutes)
            }>
              <FileQuestion className="h-4 w-4 mr-1" />Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={hwOpen} onOpenChange={setHwOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Written assignment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Assignment title" value={hwForm.title} onChange={(e) => setHwForm({ ...hwForm, title: e.target.value })} />
            <div className="space-y-2">
              <Label>Instructions</Label>
              <RichTextEditorDemo
                key={hwEditorKey}
                output="html"
                value={hwForm.instructions}
                onChange={(v) => setHwForm({ ...hwForm, instructions: v as string })}
                className="min-h-[140px] max-h-[240px]"
                editorContentClassName="p-3 text-sm"
              />
            </div>
            <Input type="number" placeholder="Max score" value={hwForm.max_score} onChange={(e) => setHwForm({ ...hwForm, max_score: e.target.value })} />
          </div>
          <DialogFooter><Button onClick={createHomework}>Save assignment</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
