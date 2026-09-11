"use client";

import { useI18n } from "@/components/shared/i18n-provider";

/**
 * An empty chart, said in the student's language.
 *
 * The default was an English sentence, so a chart with no data yet was the one
 * place an Arabic analytics page spoke English — and an empty chart is exactly
 * when a student reads the words rather than the picture.
 */
export function NoData({ text }: { text?: string }) {
  const { dict } = useI18n();
  return (
    <div className="flex h-52 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
      {text ?? dict.common.notEnoughData}
    </div>
  );
}
