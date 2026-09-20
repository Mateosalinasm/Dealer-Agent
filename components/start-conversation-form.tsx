"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { startConversation } from "@/app/messages/actions";

export function StartConversationForm() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="secondary" className="w-full" onClick={() => setOpen(true)}>
        New conversation
      </Button>
    );
  }

  return (
    <form action={startConversation} className="flex flex-col gap-2 rounded-[var(--radius-panel)] border border-[var(--color-hairline)] p-2.5">
      <Input name="phone" type="tel" placeholder="Phone number" required autoFocus className="text-[12.5px]" />
      <Input name="name" placeholder="Name (optional)" className="text-[12.5px]" />
      <div className="flex justify-end gap-1.5">
        <Button type="button" variant="ghost" className="px-2 py-1 text-[11px]" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" className="px-2 py-1 text-[11px]">
          Start
        </Button>
      </div>
    </form>
  );
}
