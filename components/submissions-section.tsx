import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { addSubmission, removeSubmission, setPrimarySubmission, updateSubmission } from "@/app/desk/deals/actions";
import type { Submission } from "@/lib/deal-facts";

const STATUS_LABEL: Record<Submission["status"], string> = {
  sent: "Submitted",
  approved: "Approved",
  counter: "Counter",
  declined: "Declined",
  pulled: "Withdrawn",
};

const STATUS_TONE: Record<Submission["status"], "info" | "positive" | "caution" | "negative" | "neutral"> = {
  sent: "info",
  approved: "positive",
  counter: "caution",
  declined: "negative",
  pulled: "neutral",
};

export function SubmissionsSection({
  dealId,
  subs,
  lenders,
  primarySubId,
}: {
  dealId: string;
  subs: Submission[];
  lenders: { id: string; name: string }[];
  primarySubId: string | null;
}) {
  const lenderName = (id: string) => lenders.find((l) => l.id === id)?.name ?? "Unknown lender";

  return (
    <div className="flex flex-col gap-3">
      {subs.length === 0 && <p className="text-[12.5px] text-[var(--color-text-muted)]">Not submitted to any lender yet.</p>}

      {subs.map((sub) => {
        const showTerms = sub.status === "approved" || sub.status === "counter";
        const showReason = sub.status === "declined" || sub.status === "counter";
        const isPrimary = sub.id === primarySubId || (!primarySubId && showTerms && subs.find((s) => s.status === "approved" || s.status === "counter")?.id === sub.id);

        return (
          <div key={sub.id} className="rounded-[var(--radius-panel)] border border-[var(--color-hairline)] p-3.5">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <span className="text-[13.5px] font-semibold text-[var(--color-text)]">{lenderName(sub.lenderId)}</span>
              <Badge tone={STATUS_TONE[sub.status]}>{STATUS_LABEL[sub.status]}</Badge>
              {isPrimary && <Badge tone="info">Working this one</Badge>}
              <div className="ml-auto flex items-center gap-1.5">
                {!isPrimary && showTerms && (
                  <form action={setPrimarySubmission.bind(null, dealId, sub.id)}>
                    <button type="submit" className="text-[11px] font-semibold text-[var(--color-primary)] hover:underline">
                      Work this approval
                    </button>
                  </form>
                )}
                <form action={removeSubmission.bind(null, dealId, sub.id)}>
                  <button type="submit" className="text-[13px] text-[var(--color-text-placeholder)] hover:text-[var(--color-negative)]">
                    ×
                  </button>
                </form>
              </div>
            </div>

            <form action={updateSubmission.bind(null, dealId, sub.id)} className="flex flex-col gap-2.5">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <div>
                  <Label>Status</Label>
                  <Select name="status" defaultValue={sub.status}>
                    {Object.entries(STATUS_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>
                {showTerms && (
                  <>
                    <div>
                      <Label>Rate %</Label>
                      <Input name="aprPct" type="number" step="0.01" defaultValue={sub.apr != null ? sub.apr / 100 : ""} />
                    </div>
                    <div>
                      <Label>Term</Label>
                      <Input name="term" type="number" defaultValue={sub.term ?? ""} />
                    </div>
                    <div>
                      <Label>Advance</Label>
                      <Input name="advanceDollars" type="number" step="0.01" defaultValue={sub.advance != null ? sub.advance / 100 : ""} />
                    </div>
                    <div>
                      <Label>Max payment</Label>
                      <Input name="maxPaymentDollars" type="number" step="0.01" defaultValue={sub.maxPayment != null ? sub.maxPayment / 100 : ""} />
                    </div>
                    <div>
                      <Label>Down required</Label>
                      <Input name="downReqDollars" type="number" step="0.01" defaultValue={sub.downReq != null ? sub.downReq / 100 : ""} />
                    </div>
                    <div>
                      <Label>Tier</Label>
                      <Input name="tier" defaultValue={sub.tier} />
                    </div>
                    <div className="col-span-2 sm:col-span-3">
                      <Label>Stips they attached</Label>
                      <Input name="stips" defaultValue={sub.stips} />
                    </div>
                  </>
                )}
                {showReason && (
                  <div className="col-span-2 sm:col-span-3">
                    <Label>What they said</Label>
                    <Input name="reason" defaultValue={sub.reason} />
                  </div>
                )}
              </div>
              <Button type="submit" variant="secondary" className="self-end">
                Save
              </Button>
            </form>
          </div>
        );
      })}

      <form action={addSubmission.bind(null, dealId)} className="flex items-end gap-2">
        <div className="flex-1">
          <Label>Submit to</Label>
          <Select name="lenderId" defaultValue="">
            <option value="" disabled>
              Choose a lender
            </option>
            {lenders.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Add
        </Button>
      </form>
    </div>
  );
}
