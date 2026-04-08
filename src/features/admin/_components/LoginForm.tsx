"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAdmin } from "../actions";

interface LoginState {
  error?: string;
}

const INITIAL_STATE: LoginState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    async (_prev: LoginState, formData: FormData) => {
      const result = await loginAdmin(formData);
      return result;
    },
    INITIAL_STATE,
  );

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Admin Access</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="secret">Secret</Label>
            <Input
              id="secret"
              name="secret"
              type="password"
              placeholder="Enter admin secret"
              autoComplete="off"
              required
            />
          </div>

          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending ? "Verifying..." : "Login"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
