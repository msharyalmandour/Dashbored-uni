"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { signUpAction } from "@/app/actions/auth";
import { useI18n } from "@/components/shared/i18n-provider";

type ActionState = { error?: string; confirmEmail?: boolean } | null;

export function RegisterForm() {
  const { dict } = useI18n();
  const [state, formAction, pending] = React.useActionState<ActionState, FormData>(
    async (_prev, formData) => signUpAction(formData),
    null
  );

  if (state?.confirmEmail) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">{dict.auth.confirmEmailTitle}</CardTitle>
          <CardDescription>{dict.auth.confirmEmailBody}</CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Link href="/login" className="text-sm text-primary hover:underline">
            {dict.auth.backToSignIn}
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-lg">{dict.auth.signUpTitle}</CardTitle>
        <CardDescription>{dict.auth.signUpSubtitle}</CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">{dict.auth.name}</Label>
            <Input id="name" name="name" autoComplete="name" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">{dict.auth.email}</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">{dict.auth.password}</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending && <Loader2 className="size-4 animate-spin" />}
            {dict.auth.signUp}
          </Button>
        </CardContent>
      </form>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        {dict.auth.haveAccount}{" "}
        <Link href="/login" className="ms-1 text-primary hover:underline">
          {dict.auth.signInLink}
        </Link>
      </CardFooter>
    </Card>
  );
}
