"use client";

import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/shared/i18n-provider";

export function LanguageToggle() {
  const { locale, setLocale, dict } = useI18n();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={dict.shell.toggleLanguage}
      onClick={() => setLocale(locale === "en" ? "ar" : "en")}
    >
      <Languages className="size-4" />
    </Button>
  );
}
