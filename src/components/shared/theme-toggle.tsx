"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/shared/i18n-provider";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { dict } = useI18n();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    // Deliberate hydration-safe mount flag (the documented next-themes pattern):
    // render the server-safe default once, then flip after hydration completes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={dict.shell.toggleTheme}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {mounted && resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
