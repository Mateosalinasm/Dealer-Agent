"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";
import { saveFile, readStoredFile } from "@/lib/storage";
import { extractDocument } from "@/lib/extraction";
import { isExtractable } from "@/lib/extraction-schemas";
import { getDealershipTimezone, todayInTimezone } from "@/lib/dealership-time";
import { dealStageInfo, STAGES } from "@/lib/deal-stage";
import {
  appointmentSchema,
  creditSchema,
  customerFactsSchema,
  dealInfoSchema,
  documentUploadSchema,
  moneyTradeSchema,
  newDealSchema,
  ptiSchema,
  submissionSchema,
} from "@/lib/validation";
import { randomUUID } from "node:crypto";

/** Caps at the 120 most recent entries, newest last — see lib/deal-health.ts for how they're read (newest first). */
function appendLog(log: { at: number; text: string }[], text: string) {
  return [...log, { at: Date.now(), text }].slice(-120);
}

const DEFAULT_STIPS = ["POI", "POR", "TurboPass", "Insurance"].map((label) => ({
  label,
  done: false,
}));

export async function createDeal(formData: FormData) {
  const parsed = newDealSchema.parse({
    customerName: formData.get("customerName"),
    vehicleId: formData.get("vehicleId") ?? "",
    wantBodyType: formData.get("wantBodyType") ?? "",
    lenderId: formData.get("lenderId") ?? "",
    dealDate: formData.get("dealDate") || undefined,
    lot: formData.get("lot") ?? "",
    notes: formData.get("notes") ?? "",
  });

  const [deal] = await db
    .insert(schema.deals)
    .values({
      customerName: parsed.customerName,
      vehicleId: parsed.vehicleId || null,
      wantBodyType: parsed.wantBodyType || null,
      lenderId: parsed.lenderId || null,
      lot: parsed.lot || null,
      notes: parsed.notes || null,
      dealDate: parsed.dealDate || todayInTimezone(await getDealershipTimezone()),
      stips: DEFAULT_STIPS,
    })
    .returning();

  // Credit app upload (see components/credit-app-upload-field.tsx) — stored
  // for the record now. Auto-filling name/address from it, and cross-
  // referencing against the TurboPass address, needs AI extraction
  // (ANTHROPIC_API_KEY), which isn't wired up yet.
  const creditApp = formData.get("creditApp") as File | null;
  if (creditApp && creditApp.size > 0) {
    const { storagePath, fileSize } = await saveFile(creditApp);
    await db.insert(schema.documents).values({
      dealId: deal.id,
      category: "credit_app",
      fileName: creditApp.name,
      storagePath,
      mimeType: creditApp.type || null,
      fileSize,
    });
  }

  revalidatePath("/desk/priority-queue");
  revalidatePath("/desk/deals");
  redirect(`/desk/deals/${deal.id}`);
}

export async function updateDealInfo(dealId: string, formData: FormData) {
  const parsed = dealInfoSchema.parse({
    programId: formData.get("programId") ?? "",
    termMonths: formData.get("termMonths") || undefined,
    aprPct: formData.get("aprPct") || undefined,
    commissionDollars: formData.get("commissionDollars") || undefined,
    notes: formData.get("notes") ?? "",
  });

  await db
    .update(schema.deals)
    .set({
      programId: parsed.programId || null,
      termMonths: parsed.termMonths ?? null,
      apr: parsed.aprPct != null ? Math.round(parsed.aprPct * 100) : null,
      commission: parsed.commissionDollars != null ? Math.round(parsed.commissionDollars * 100) : null,
      notes: parsed.notes || null,
    })
    .where(eq(schema.deals.id, dealId));

  revalidatePath(`/desk/deals/${dealId}`);
  revalidatePath("/desk/analytics");
  revalidatePath("/desk/deals");
}

// Lender ("Bank"), down payment, and the rest of the application facts
// that drive dealHealth/nextAction/ptiCalc — see lib/deal-facts.ts.
export async function updateCustomerFacts(dealId: string, formData: FormData) {
  const parsed = customerFactsSchema.parse({
    vehicleId: formData.get("vehicleId") ?? "",
    wantBodyType: formData.get("wantBodyType") ?? "",
    lenderId: formData.get("lenderId") ?? "",
    lot: formData.get("lot") ?? "",
    cashDownDollars: formData.get("cashDownDollars") || undefined,
    statedIncomeDollars: formData.get("statedIncomeDollars") || undefined,
    verifiedIncomeDollars: formData.get("verifiedIncomeDollars") || undefined,
    paymentDollars: formData.get("paymentDollars") || undefined,
    openAutoPaymentDollars: formData.get("openAutoPaymentDollars") || undefined,
    statedAddress: formData.get("statedAddress") ?? "",
    idType: formData.get("idType") ?? "",
  });

  await db
    .update(schema.deals)
    .set({
      vehicleId: parsed.vehicleId || null,
      wantBodyType: parsed.wantBodyType || null,
      lenderId: parsed.lenderId || null,
      lot: parsed.lot || null,
      cashDown: parsed.cashDownDollars != null ? Math.round(parsed.cashDownDollars * 100) : null,
      statedIncome: parsed.statedIncomeDollars != null ? Math.round(parsed.statedIncomeDollars * 100) : null,
      verifiedIncome: parsed.verifiedIncomeDollars != null ? Math.round(parsed.verifiedIncomeDollars * 100) : null,
      payment: parsed.paymentDollars != null ? Math.round(parsed.paymentDollars * 100) : null,
      openAutoPayment: parsed.openAutoPaymentDollars != null ? Math.round(parsed.openAutoPaymentDollars * 100) : null,
      statedAddress: parsed.statedAddress || null,
      idType: parsed.idType || null,
    })
    .where(eq(schema.deals.id, dealId));

  revalidatePath(`/desk/deals/${dealId}`);
  revalidatePath("/desk/priority-queue");
  revalidatePath("/desk/deals");
}

// Sets just the vehicle — the "Use this vehicle" action from the Find
// vehicle tab of the lender/vehicle match tool, where re-deriving the
// whole customer-facts form isn't worth it for one field.
export async function setDealVehicle(dealId: string, vehicleId: string) {
  await db.update(schema.deals).set({ vehicleId }).where(eq(schema.deals.id, dealId));
  revalidatePath(`/desk/deals/${dealId}`);
  revalidatePath("/desk/priority-queue");
  revalidatePath("/desk/deals");
}

export async function updateCredit(dealId: string, formData: FormData) {
  const parsed = creditSchema.parse({
    fico: formData.get("fico") || undefined,
    idType: formData.get("idType") ?? "",
    inquiries30d: formData.get("inquiries30d") || undefined,
    repossessions: formData.get("repossessions") || undefined,
    collectionsDollars: formData.get("collectionsDollars") || undefined,
    openAutos: formData.get("openAutos") || undefined,
    autoLates: formData.get("autoLates") || undefined,
    bankruptcies: formData.get("bankruptcies") || undefined,
    mortgages: formData.get("mortgages") || undefined,
  });

  await db
    .update(schema.deals)
    .set({
      fico: parsed.fico ?? null,
      idType: parsed.idType || null,
      inquiries30d: parsed.inquiries30d ?? null,
      repossessions: parsed.repossessions ?? null,
      collectionsAmount: parsed.collectionsDollars != null ? Math.round(parsed.collectionsDollars * 100) : null,
      openAutos: parsed.openAutos ?? null,
      autoLates: parsed.autoLates ?? null,
      bankruptcies: parsed.bankruptcies ?? null,
      mortgages: parsed.mortgages ?? null,
    })
    .where(eq(schema.deals.id, dealId));

  revalidatePath(`/desk/deals/${dealId}`);
  revalidatePath("/desk/deals");
}

export async function clearCredit(dealId: string) {
  await db
    .update(schema.deals)
    .set({
      fico: null,
      inquiries30d: null,
      repossessions: null,
      collectionsAmount: null,
      openAutos: null,
      autoLates: null,
      bankruptcies: null,
      mortgages: null,
    })
    .where(eq(schema.deals.id, dealId));
  revalidatePath(`/desk/deals/${dealId}`);
  revalidatePath("/desk/deals");
}

export async function toggleOpenAutoTradeIn(dealId: string) {
  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, dealId)).limit(1);
  if (!deal) return;
  await db.update(schema.deals).set({ openAutoTradeIn: !deal.openAutoTradeIn }).where(eq(schema.deals.id, dealId));
  revalidatePath(`/desk/deals/${dealId}`);
}

// Money & trade — backEndGross is recomputed here (warranty + gapIns -
// backEndCost) so app/desk/analytics, which reads that column directly,
// doesn't need to change.
export async function updateMoneyTrade(dealId: string, formData: FormData) {
  const parsed = moneyTradeSchema.parse({
    salePriceDollars: formData.get("salePriceDollars") || undefined,
    docFeeDollars: formData.get("docFeeDollars") || undefined,
    salesTaxDollars: formData.get("salesTaxDollars") || undefined,
    warrantyDollars: formData.get("warrantyDollars") || undefined,
    gapInsDollars: formData.get("gapInsDollars") || undefined,
    backEndCostDollars: formData.get("backEndCostDollars") || undefined,
    tradeVehicle: formData.get("tradeVehicle") ?? "",
    tradeAcvDollars: formData.get("tradeAcvDollars") || undefined,
    tradePayoffDollars: formData.get("tradePayoffDollars") || undefined,
  });

  const toCents = (d: number | undefined) => (d != null ? Math.round(d * 100) : null);
  const warranty = toCents(parsed.warrantyDollars);
  const gapIns = toCents(parsed.gapInsDollars);
  const backEndCost = toCents(parsed.backEndCostDollars);
  const backEndGross = warranty != null || gapIns != null || backEndCost != null ? (warranty ?? 0) + (gapIns ?? 0) - (backEndCost ?? 0) : 0;

  await db
    .update(schema.deals)
    .set({
      salePrice: toCents(parsed.salePriceDollars),
      docFee: toCents(parsed.docFeeDollars),
      salesTax: toCents(parsed.salesTaxDollars),
      warranty,
      gapIns,
      backEndCost,
      backEndGross,
      tradeVehicle: parsed.tradeVehicle || null,
      tradeAcv: toCents(parsed.tradeAcvDollars),
      tradePayoff: toCents(parsed.tradePayoffDollars),
    })
    .where(eq(schema.deals.id, dealId));

  revalidatePath(`/desk/deals/${dealId}`);
  revalidatePath("/desk/analytics");
}

export async function updatePti(dealId: string, formData: FormData) {
  const parsed = ptiSchema.parse({
    ptiPriceDollars: formData.get("ptiPriceDollars") || undefined,
    ptiPct: formData.get("ptiPct") || undefined,
  });

  await db
    .update(schema.deals)
    .set({
      ptiPrice: parsed.ptiPriceDollars != null ? Math.round(parsed.ptiPriceDollars * 100) : null,
      ptiPct: parsed.ptiPct ?? null,
    })
    .where(eq(schema.deals.id, dealId));

  revalidatePath(`/desk/deals/${dealId}`);
}

// --- Submissions -------------------------------------------------------

export async function addSubmission(dealId: string, formData: FormData) {
  const lenderId = String(formData.get("lenderId") ?? "");
  if (!lenderId) return;
  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, dealId)).limit(1);
  if (!deal) return;
  const [lender] = await db.select().from(schema.lenders).where(eq(schema.lenders.id, lenderId)).limit(1);
  if (!lender) return;

  const subs = [
    ...deal.subs,
    {
      id: randomUUID(),
      lenderId,
      at: Date.now(),
      status: "sent" as const,
      apr: null,
      term: null,
      advance: null,
      maxPayment: null,
      tier: "",
      downReq: null,
      stips: "",
      reason: "",
    },
  ];
  const done = { ...deal.done, submit: true };
  const log = appendLog(deal.log, `Submitted to ${lender.name}`);

  await db.update(schema.deals).set({ subs, done, log }).where(eq(schema.deals.id, dealId));
  revalidatePath(`/desk/deals/${dealId}`);
}

/** Recomputes done.approval from whether any live submission is approved/countered — mirrors syncApprovalStep in the design. */
function syncApprovalStep(done: Record<string, boolean>, subs: { status: string }[]) {
  const hasApproval = subs.some((s) => s.status === "approved" || s.status === "counter");
  return { ...done, approval: hasApproval };
}

export async function updateSubmission(dealId: string, subId: string, formData: FormData) {
  const parsed = submissionSchema.parse({
    status: formData.get("status"),
    aprPct: formData.get("aprPct") || undefined,
    term: formData.get("term") || undefined,
    advanceDollars: formData.get("advanceDollars") || undefined,
    maxPaymentDollars: formData.get("maxPaymentDollars") || undefined,
    tier: formData.get("tier") ?? "",
    downReqDollars: formData.get("downReqDollars") || undefined,
    stips: formData.get("stips") ?? "",
    reason: formData.get("reason") ?? "",
  });

  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, dealId)).limit(1);
  if (!deal) return;
  const target = deal.subs.find((s) => s.id === subId);
  if (!target) return;

  const toCents = (d: number | undefined) => (d != null ? Math.round(d * 100) : null);
  const statusChanged = parsed.status !== target.status;
  const subs = deal.subs.map((s) =>
    s.id === subId
      ? {
          ...s,
          status: parsed.status,
          apr: parsed.aprPct != null ? Math.round(parsed.aprPct * 100) : null,
          term: parsed.term ?? null,
          advance: toCents(parsed.advanceDollars),
          maxPayment: toCents(parsed.maxPaymentDollars),
          tier: parsed.tier || "",
          downReq: toCents(parsed.downReqDollars),
          stips: parsed.stips || "",
          reason: parsed.reason || "",
        }
      : s,
  );

  const done = syncApprovalStep(deal.done, subs);
  const [lender] = await db.select().from(schema.lenders).where(eq(schema.lenders.id, target.lenderId)).limit(1);
  const log = statusChanged
    ? appendLog(deal.log, `${lender?.name ?? "Lender"}: ${parsed.status}`)
    : deal.log;

  await db.update(schema.deals).set({ subs, done, log }).where(eq(schema.deals.id, dealId));
  revalidatePath(`/desk/deals/${dealId}`);
}

export async function setPrimarySubmission(dealId: string, subId: string) {
  await db.update(schema.deals).set({ primarySubId: subId }).where(eq(schema.deals.id, dealId));
  revalidatePath(`/desk/deals/${dealId}`);
}

export async function removeSubmission(dealId: string, subId: string) {
  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, dealId)).limit(1);
  if (!deal) return;
  const target = deal.subs.find((s) => s.id === subId);
  if (!target) return;

  const subs = deal.subs.filter((s) => s.id !== subId);
  const done = { ...syncApprovalStep(deal.done, subs), submit: subs.length > 0 };
  const primarySubId = deal.primarySubId === subId ? null : deal.primarySubId;
  const [lender] = await db.select().from(schema.lenders).where(eq(schema.lenders.id, target.lenderId)).limit(1);
  const log = appendLog(deal.log, `Removed the ${lender?.name ?? "lender"} submission`);

  await db.update(schema.deals).set({ subs, done, primarySubId, log }).where(eq(schema.deals.id, dealId));
  revalidatePath(`/desk/deals/${dealId}`);
}

// --- Health issue acknowledgement --------------------------------------

export async function ackHealthIssue(dealId: string, key: string, title: string) {
  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, dealId)).limit(1);
  if (!deal) return;
  const ackIssues = { ...deal.ackIssues, [key]: Date.now() };
  // Acking the name-mismatch issue is the manual sign-off that income counts as verified.
  const done = key === "tpName" ? { ...deal.done, income: true } : deal.done;
  const log = appendLog(deal.log, `Approved the alert "${title}"`);
  await db.update(schema.deals).set({ ackIssues, done, log }).where(eq(schema.deals.id, dealId));
  revalidatePath(`/desk/deals/${dealId}`);
}

export async function reopenHealthIssue(dealId: string, key: string) {
  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, dealId)).limit(1);
  if (!deal) return;
  const ackIssues = { ...deal.ackIssues };
  delete ackIssues[key];
  await db.update(schema.deals).set({ ackIssues }).where(eq(schema.deals.id, dealId));
  revalidatePath(`/desk/deals/${dealId}`);
}

export async function toggleStip(dealId: string, index: number) {
  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, dealId)).limit(1);
  if (!deal) return;
  const stips = [...deal.stips];
  if (!stips[index]) return;
  const nowDone = !stips[index].done;
  stips[index] = { ...stips[index], done: nowDone };
  const log = appendLog(deal.log, `${nowDone ? "Collected" : "Reopened"} stip "${stips[index].label}"`);
  await db.update(schema.deals).set({ stips, log }).where(eq(schema.deals.id, dealId));
  revalidatePath(`/desk/deals/${dealId}`);
}

// Toggles one step of the Application/Approval/Funding checklist (see
// lib/deal-stage.ts). This is what actually drives a deal's position on
// the pipeline board — `funded`/`fundedOn` below are kept in sync purely
// so the pre-existing inventory-sold-sync and buy-scorecard turn-time
// code (which read those columns, not `done`) keep working unchanged.
export async function toggleDealStep(dealId: string, stepId: string) {
  const today = todayInTimezone(await getDealershipTimezone());
  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, dealId)).limit(1);
  if (!deal) return;

  const nowDone = !deal.done[stepId];
  const done = { ...deal.done, [stepId]: nowDone };
  const { stageIdx } = dealStageInfo(done);
  const funded = !!done.funded;

  let fundingSince = deal.fundingSince;
  if (stageIdx >= 2 && !fundingSince) fundingSince = new Date();
  if (stageIdx < 2 && fundingSince) fundingSince = null;

  const stepLabel = STAGES.flatMap((s) => s.steps).find((s) => s.id === stepId)?.label ?? stepId;
  const log = appendLog(deal.log, `${nowDone ? "Checked" : "Unchecked"} ${stepLabel.toLowerCase()}`);

  await db
    .update(schema.deals)
    .set({ done, fundingSince, funded, fundedOn: funded ? today : null, log })
    .where(eq(schema.deals.id, dealId));

  if (deal.vehicleId && funded !== deal.funded) {
    await db
      .update(schema.vehicles)
      .set({ sold: funded, soldOn: funded ? today : null })
      .where(eq(schema.vehicles.id, deal.vehicleId));
    revalidatePath("/inventory");
    revalidatePath("/sourcing/what-to-buy");
    revalidatePath("/sourcing/buy-scorecard");
  }

  revalidatePath(`/desk/deals/${dealId}`);
  revalidatePath("/desk/priority-queue");
  revalidatePath("/desk/deals");
}

export async function setDealArchived(dealId: string, archived: boolean) {
  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, dealId)).limit(1);
  if (!deal) return;
  const log = appendLog(deal.log, archived ? "Archived" : "Reopened");

  await db
    .update(schema.deals)
    .set({ archived, archivedAt: archived ? new Date() : null, log })
    .where(eq(schema.deals.id, dealId));

  revalidatePath(`/desk/deals/${dealId}`);
  revalidatePath("/desk/priority-queue");
  revalidatePath("/desk/deals");
}

export async function uploadDocument(dealId: string, formData: FormData) {
  const category = documentUploadSchema.parse({ category: formData.get("category") }).category;
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    throw new Error("No file selected");
  }

  const { storagePath, fileSize } = await saveFile(file);
  await db.insert(schema.documents).values({
    dealId,
    category,
    fileName: file.name,
    storagePath,
    mimeType: file.type || null,
    fileSize,
  });

  revalidatePath(`/desk/deals/${dealId}`);
}

// dealId first (not documentId) so callers can pass a bound reference —
// analyzeDocument.bind(null, dealId) — as a genuine Server Action prop.
// An inline closure wrapping the action isn't serializable across the
// Server/Client boundary when passed from a Server Component.
export async function analyzeDocument(dealId: string, documentId: string) {
  const [doc] = await db.select().from(schema.documents).where(eq(schema.documents.id, documentId)).limit(1);
  if (!doc) return;

  if (!isExtractable(doc.category)) {
    await db
      .update(schema.documents)
      .set({
        extractionStatus: "failed",
        extractionError: "This document type isn't set up for extraction yet.",
        extractedAt: new Date(),
      })
      .where(eq(schema.documents.id, documentId));
    revalidatePath(`/desk/deals/${dealId}`);
    return;
  }

  await db
    .update(schema.documents)
    .set({ extractionStatus: "pending" })
    .where(eq(schema.documents.id, documentId));

  const fileBuffer = await readStoredFile(doc.storagePath);
  const result = await extractDocument(doc.category, fileBuffer, doc.mimeType);

  if (result.ok) {
    await db
      .update(schema.documents)
      .set({
        extractionStatus: "success",
        extractedData: result.data,
        extractedAt: new Date(),
        extractionError: null,
      })
      .where(eq(schema.documents.id, documentId));
  } else {
    await db
      .update(schema.documents)
      .set({
        extractionStatus: "failed",
        extractionError: result.error ?? "Unknown error",
        extractedAt: new Date(),
      })
      .where(eq(schema.documents.id, documentId));
  }

  revalidatePath(`/desk/deals/${dealId}`);
}

export async function deleteDocument(dealId: string, documentId: string) {
  await db.delete(schema.documents).where(eq(schema.documents.id, documentId));
  revalidatePath(`/desk/deals/${dealId}`);
}

export async function createAppointment(formData: FormData) {
  const parsed = appointmentSchema.parse({
    customerName: formData.get("customerName"),
    phone: formData.get("phone") ?? "",
    scheduledAt: formData.get("scheduledAt"),
    notes: formData.get("notes") ?? "",
    dealId: formData.get("dealId") ?? "",
  });

  await db.insert(schema.appointments).values({
    customerName: parsed.customerName,
    phone: parsed.phone || null,
    scheduledAt: new Date(parsed.scheduledAt),
    notes: parsed.notes || null,
    dealId: parsed.dealId || null,
  });

  revalidatePath("/desk/appointments");
  if (parsed.dealId) revalidatePath(`/desk/deals/${parsed.dealId}`);
}

export async function setAppointmentStatus(
  appointmentId: string,
  status: "scheduled" | "completed" | "canceled",
) {
  await db.update(schema.appointments).set({ status }).where(eq(schema.appointments.id, appointmentId));
  revalidatePath("/desk/appointments");
}
