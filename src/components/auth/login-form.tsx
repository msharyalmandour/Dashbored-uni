"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { signInAction } from "@/app/actions/auth";
import { useI18n } from "@/components/shared/i18n-provider";

type ActionState = { error?: string } | null;

export function LoginForm() {
  const { dict } = useI18n();
  const [state, formAction, pending] = React.useActionState<ActionState, FormData>(
    async (_prev, formData) => signInAction(formData),
    null
  );

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-lg">{dict.auth.signInTitle}</CardTitle>
        <CardDescription>{dict.auth.signInSubtitle}</CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">{dict.auth.email}</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">{dict.auth.password}</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending && <Loader2 className="size-4 animate-spin" />}
            {dict.auth.signIn}
          </Button>
        </CardContent>
      </form>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        {dict.auth.noAccount}{" "}
        <Link href="/register" className="ms-1 text-primary hover:underline">
          {dict.auth.signUpLink}
        </Link>
      </CardFooter>
    </Card>
  );
}
