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

export function CreateClinicalDialog() {
  const router = useRouter();
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
      toast.success("Training entry logged");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> New Entry
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Clinical Training Entry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Cases seen</Label>
              <Input name="casesSeen" type="number" min={0} defaultValue={0} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Hospital / Site</Label>
              <Input name="hospital" />
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Input name="department" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Supervisor</Label>
            <Input name="supervisor" />
          </div>
          <div className="space-y-1.5">
            <Label>Skills practiced</Label>
            <Input name="skillsPracticed" placeholder="Venipuncture, patient interviewing…" />
          </div>
          <div className="space-y-1.5">
            <Label>What I learned</Label>
            <Textarea name="whatILearned" />
          </div>
          <div className="space-y-1.5">
            <Label>What I didn&apos;t understand</Label>
            <Textarea name="whatIDidNotUnderstand" placeholder="This can become a knowledge gap afterward." />
          </div>
          <div className="space-y-1.5">
            <Label>Questions to ask</Label>
            <Textarea name="questionsToAsk" />
          </div>
          <div className="space-y-1.5">
            <Label>Reflection</Label>
            <Textarea name="reflection" />
          </div>
          <div className="space-y-1.5">
            <Label>Next action</Label>
            <Input name="nextAction" />
          </div>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save Entry
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
