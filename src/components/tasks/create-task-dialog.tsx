"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createTask } from "@/app/actions/tasks";
import { useI18n } from "@/components/shared/i18n-provider";
import type { TaskType, TaskPriority } from "@prisma/client";

export function CreateTaskDialog({ subjects }: { subjects: { id: string; name: string }[] }) {
  const router = useRouter();
  const { dict } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [type, setType] = React.useState<TaskType>("ASSIGNMENT" as TaskType);
  const [priority, setPriority] = React.useState<TaskPriority>("MEDIUM" as TaskPriority);
  const [subjectId, setSubjectId] = React.useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await createTask({
        title: String(form.get("title")),
        description: String(form.get("description") || ""),
        type,
        deadline: String(form.get("deadline")),
        priority,
        subjectId: subjectId || undefined,
      });
      toast.success(dict.forms.taskCreated);
      setOpen(false);
      router.refresh();
    } catch {
      toast.error(dict.forms.couldNotSave);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> {dict.forms.newTask}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dict.forms.newTaskTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label>{dict.common.title}</Label>
            <Input name="title" required />
          </div>
          <div className="space-y-1.5">
            <Label>{dict.common.description}</Label>
            <Textarea name="description" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{dict.forms.type}</Label>
              <Select value={type} onValueChange={(v) => setType(v as TaskType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ASSIGNMENT">{dict.status.taskType.ASSIGNMENT}</SelectItem>
                  <SelectItem value="PROJECT">{dict.status.taskType.PROJECT}</SelectItem>
                  <SelectItem value="EXAM">{dict.status.taskType.EXAM}</SelectItem>
                  <SelectItem value="QUIZ">{dict.status.taskType.QUIZ}</SelectItem>
                  <SelectItem value="PRESENTATION">{dict.status.taskType.PRESENTATION}</SelectItem>
                  <SelectItem value="READING">{dict.status.taskType.READING}</SelectItem>
                  <SelectItem value="OTHER">{dict.status.taskType.OTHER}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{dict.forms.priority}</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">{dict.status.taskPriority.LOW}</SelectItem>
                  <SelectItem value="MEDIUM">{dict.status.taskPriority.MEDIUM}</SelectItem>
                  <SelectItem value="HIGH">{dict.status.taskPriority.HIGH}</SelectItem>
                  <SelectItem value="URGENT">{dict.status.taskPriority.URGENT}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{dict.forms.deadline}</Label>
            <Input name="deadline" type="datetime-local" required />
          </div>
          <div className="space-y-1.5">
            <Label>{dict.forms.subjectOptional}</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger><SelectValue placeholder={dict.forms.noneOption} /></SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {dict.common.create}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
