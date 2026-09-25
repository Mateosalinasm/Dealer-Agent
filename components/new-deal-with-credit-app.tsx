"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { NewDealForm, type VehicleOption } from "@/components/new-deal-form";
import { CreditAppUploadField } from "@/components/credit-app-upload-field";

// Wraps the header (title + credit-app upload) and the form together in
// one client component so they can share state — the upload button and
// the form are visual siblings (the button sits in the header, outside
// the form's own Card), but a credit-app extraction needs to reach INTO
// the form to fill fields and pop its Buyer info/Address/Employment
// sections open. incrementing autoFillTick each time a file is
// successfully read is what does that (see forceOpenSignal on
// AccordionSection).
export function NewDealWithCreditApp({ vehicles, lenders }: { vehicles: VehicleOption[]; lenders: { id: string; name: string }[] }) {
  const [autoFillTick, setAutoFillTick] = useState(0);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 pr-8">
        <h1 className="text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">New deal</h1>
        <CreditAppUploadField onFilled={() => setAutoFillTick((t) => t + 1)} />
      </div>
      <Card className="mt-5">
        <NewDealForm vehicles={vehicles} lenders={lenders} forceOpenSignal={autoFillTick} />
      </Card>
    </div>
  );
}
