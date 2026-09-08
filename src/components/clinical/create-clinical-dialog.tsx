"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createClinicalEntry } from "@/app/actions/clinical";
import { useI18n } from "@/components/shared/i18n-provider";

export function CreateClinicalDialog() {
  const router = useRouter();
  const { dict } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await createClinicalEntry({
        date: String(form.get("date")),
        hospital: String(form.get("hospital") || ""),
        department: String(form.get("department") || ""),
        supervisor: String(form.get("supervisor") || ""),
        skillsPracticed: String(form.get("skillsPracticed") || ""),
        casesSeen: Number(form.get("casesSeen")) || 0,
        whatILearned: String(form.get("whatILearned") || ""),
        whatIDidNotUnderstand: String(form.get("whatIDidNotUnderstand") || ""),
        questionsToAsk: String(form.get("questionsToAsk") || ""),
        reflection: String(form.get("reflection") || ""),
        nextAction: String(form.get("nextAction") || ""),
      });
      toast.success(dict.forms.trainingLogged);
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
          <Plus className="size-4" /> {dict.forms.newEntry}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{dict.forms.newClinicalTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{dict.common.date}</Label>
              <Input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
            </div>
            <div className="space-y-1.5">
              <Label>{dict.forms.casesSeen}</Label>
              <Input name="casesSeen" type="number" min={0} defaultValue={0} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{dict.forms.hospital}</Label>
              <Input name="hospital" />
            </div>
            <div className="space-y-1.5">
              <Label>{dict.forms.department}</Label>
              <Input name="department" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{dict.forms.supervisor}</Label>
            <Input name="supervisor" />
          </div>
          <div className="space-y-1.5">
            <Label>{dict.forms.skillsPracticed}</Label>
            <Input name="skillsPracticed" placeholder={dict.forms.egSkills} />
          </div>
          <div className="space-y-1.5">
            <Label>{dict.forms.whatILearned}</Label>
            <Textarea name="whatILearned" />
          </div>
          <div className="space-y-1.5">
            <Label>{dict.forms.whatIDidntUnderstand}</Label>
            <Textarea name="whatIDidNotUnderstand" placeholder={dict.forms.egNextAction} />
          </div>
          <div className="space-y-1.5">
            <Label>{dict.forms.questionsToAsk}</Label>
            <Textarea name="questionsToAsk" />
          </div>
          <div className="space-y-1.5">
            <Label>{dict.forms.reflection}</Label>
            <Textarea name="reflection" />
          </div>
          <div className="space-y-1.5">
            <Label>{dict.forms.nextAction}</Label>
            <Input name="nextAction" />
          </div>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {dict.common.save}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
