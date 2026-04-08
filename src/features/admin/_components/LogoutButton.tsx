"use client";

import { Button } from "@/components/ui/button";
import { logoutAdmin } from "../actions";

export function LogoutButton() {
  return (
    <form action={logoutAdmin}>
      <Button type="submit" variant="outline" size="sm">
        Logout
      </Button>
    </form>
  );
}
