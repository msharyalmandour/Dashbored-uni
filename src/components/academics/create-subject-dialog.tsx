"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createSubject } from "@/app/actions/academics";
import { useI18n } from "@/components/shared/i18n-provider";

const SWATCHES = ["#8b5cf6", "#ef4444", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#6366f1", "#64748b"];

export function CreateSubjectDialog({ semesterId }: { semesterId: string }) {
  const router = useRouter();
  const { dict } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [color, setColor] = React.useState(SWATCHES[0]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await createSubject({
        semesterId,
        name: String(form.get("name")),
        code: String(form.get("code") || ""),
        instructor: String(form.get("instructor") || ""),
        color,
        creditHours: Number(form.get("creditHours")) || 3,
      });
      toast.success(dict.forms.subjectAdded);
      setOpen(false);
      router.refresh();
    } catch {
      toast.error(dict.forms.couldNotCreateSubject);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Plus className="size-4" /> {dict.forms.newSubject}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dict.forms.newSubject}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label>{dict.forms.name}</Label>
            <Input name="name" placeholder={dict.forms.egSubject} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{dict.forms.code}</Label>
              <Input name="code" placeholder={dict.forms.egSubjectCode} />
            </div>
            <div className="space-y-1.5">
              <Label>{dict.forms.creditHours}</Label>
              <Input name="creditHours" type="number" min={1} max={10} defaultValue={3} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{dict.forms.instructor}</Label>
            <Input name="instructor" placeholder={dict.forms.egInstructor} />
          </div>
          <div className="space-y-1.5">
            <Label>{dict.forms.color}</Label>
            <div className="flex gap-2">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="size-7 rounded-full ring-offset-2 ring-offset-background transition-all"
                  style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px ${c}` : undefined }}
                  aria-label={`${dict.forms.color}: ${c}`}
                />
              ))}
            </div>
          </div>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {dict.forms.createSubject}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
