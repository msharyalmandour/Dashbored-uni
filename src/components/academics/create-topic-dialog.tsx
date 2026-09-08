"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createTopic } from "@/app/actions/academics";
import { useI18n } from "@/components/shared/i18n-provider";
import type { Difficulty } from "@prisma/client";

export function CreateTopicDialog({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const { dict } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [difficulty, setDifficulty] = React.useState<Difficulty>("MEDIUM");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await createTopic({
        subjectId,
        name: String(form.get("name")),
        description: String(form.get("description") || ""),
        difficulty,
      });
      toast.success(dict.forms.topicAdded);
      setOpen(false);
      router.refresh();
    } catch {
      toast.error(dict.forms.couldNotCreateTopic);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Plus className="size-4" /> {dict.forms.newTopic}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dict.forms.newTopic}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label>{dict.forms.name}</Label>
            <Input name="name" placeholder={dict.forms.egTopic} required />
          </div>
          <div className="space-y-1.5">
            <Label>{dict.common.description}</Label>
            <Textarea name="description" placeholder={dict.forms.optionalPlaceholder} />
          </div>
          <div className="space-y-1.5">
            <Label>{dict.common.difficulty}</Label>
            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EASY">{dict.common.easy}</SelectItem>
                <SelectItem value="MEDIUM">{dict.common.medium}</SelectItem>
                <SelectItem value="HARD">{dict.common.hard}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {dict.forms.createTopic}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
