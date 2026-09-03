"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { updateLectureNotes } from "@/app/actions/lecture";

export function LectureNotesEditor({ lectureId, notes }: { lectureId: string; notes: string | null }) {
  const [value, setValue] = React.useState(notes ?? "");
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateLectureNotes(lectureId, value);
      setDirty(false);
      toast.success("Notes saved");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setDirty(true);
        }}
        placeholder="Jot down whatever you want to remember from this lecture…"
        className="min-h-28"
      />
      <Button size="sm" variant="secondary" onClick={save} disabled={!dirty || saving} className="self-end">
        {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
        Save Notes
      </Button>
    </div>
  );
}
