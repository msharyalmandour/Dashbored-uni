"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/app/actions/auth";
import { useI18n } from "@/components/shared/i18n-provider";

export function SignOutButton() {
  const { dict } = useI18n();
  return (
    <Button variant="ghost" size="icon" onClick={() => signOutAction()} aria-label={dict.auth.signOut}>
      <LogOut className="size-4" />
    </Button>
  );
}
