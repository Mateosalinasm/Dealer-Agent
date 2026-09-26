import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { formatCents } from "@/lib/utils";
import { copilotConfigured } from "@/lib/deal-copilot";
import { downPaymentCentsFor } from "@/lib/marketing-copy";
import { leadTemperature, messageIntent } from "@/schema-sketch/schema";
import type { bodyType, fuelType } from "@/schema-sketch/schema";

const MODEL = "claude-sonnet-5";

export interface VehicleForAgent {
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  color: string | null;
  miles: number | null;
  askingPrice: number | null; // integer cents
  bodyType: (typeof bodyType)[number] | null;
  fuelType: (typeof fuelType)[number];
  isThreeRowSuv: boolean;
  sold: boolean;
}

export interface AgentTurn {
  direction: "inbound" | "outbound";
  body: string;
}

const ReplySchema = z.object({
  intent: z.enum(messageIntent).describe("What the customer's latest message is actually asking about."),
  leadTemperature: z.enum(leadTemperature).describe(
    "Hot: asking to see it now, gave a timeframe, or said they're ready to buy. Warm: engaged, asking real questions, hasn't committed to coming in. Cold: vague, price-shopping several vehicles, or gone quiet.",
  ),
  needsHandoff: z.boolean().describe(
    "True ONLY if the customer asked something this agent must never answer on its own: a guaranteed-approval question, an exact interest rate/APR, or anything else needing a real underwriting/finance answer — OR if they said something time-sensitive a human should see right away (already on the way, ready to buy now).",
  ),
  handoffReason: z.string().nullable().describe("One short sentence on why, if needsHandoff is true — null otherwise."),
  reply: z.string().describe(
    "The message to send back to the customer. If needsHandoff is true, this should still be a warm, honest reply (e.g. 'Great question — let me get you the exact numbers, one of our team will follow up shortly'), never a made-up answer to the handoff-worthy question itself.",
  ),
});

export type AgentReply = z.infer<typeof ReplySchema>;
export type AgentResult = { ok: true; data: AgentReply } | { ok: false; error: string };

const SYSTEM_PROMPT = `You are a Facebook Marketplace sales conversation assistant for a single "buy
here, pay here"-style used car dealership. You are replying to a real customer who messaged about a
specific vehicle listing. A human dealership employee reviews every reply you draft before it's sent
— you are drafting, not sending.

Hard rules — never break these:
1. NEVER invent or guess a fact about the vehicle (features, condition, history, exact mileage, VIN,
   title status, warranty terms) beyond what you're explicitly given below. If asked about something
   not in the given facts, say a team member can confirm that for them — never make it up.
2. NEVER mention the vehicle's title status or condition history, and never say or imply anything
   about salvage, rebuilt, flood, insurance-loss, lemon, or branded titles.
3. The down payment figure you're given (always phrased "starting from"/"desde") is the ONLY dollar
   amount you may state as a firm number. If asked the full/out-the-door price, financing terms, exact
   interest rate, or whether they're guaranteed to be approved, do NOT answer with a number or a
   guarantee — say a team member will go over the exact numbers with them, and set needsHandoff true.
4. Never claim or imply a specific approval outcome, credit score requirement, or interest rate.
5. Ask for a phone number gently and only when it naturally helps (e.g. confirming an appointment
   time, or letting a salesperson follow up) — never as the first message, never repeatedly if they've
   already declined or ignored it once.
6. Every reply should nudge, once naturally relevant, toward an appointment ("Want to come by today or
   tomorrow to see it in person?") — helpful and warm, never pushy or repetitive about it.
7. Match the customer's own language (English or Spanish) and a warm, direct, conversational tone —
   short messages, like a real person texting, not a formal email. No markdown, no bullet points.
8. Keep the conversation moving forward one step at a time — don't re-ask something already answered
   earlier in the conversation, and don't dump every detail into one message.
9. If the vehicle is marked sold, say so plainly and offer to help find something similar — never
   pretend it's still available.`;

function vehicleFacts(vehicle: VehicleForAgent): string {
  const downPaymentCents = downPaymentCentsFor(vehicle);
  const lines = [
    vehicle.year != null && `Year: ${vehicle.year}`,
    vehicle.make && `Make: ${vehicle.make}`,
    vehicle.model && `Model: ${vehicle.model}`,
    vehicle.trim && `Trim: ${vehicle.trim}`,
    vehicle.color && `Color: ${vehicle.color}`,
    vehicle.miles != null && `Mileage: ${vehicle.miles.toLocaleString()} miles`,
    vehicle.sold ? "Availability: SOLD, no longer available" : "Availability: available now",
    downPaymentCents != null && `Down payment (state exactly this, "starting from"): ${formatCents(downPaymentCents)}`,
  ]
    .filter(Boolean)
    .join("\n");
  return lines;
}

// history is oldest-first, NOT including the message currently being
// replied to — that one is passed separately as the final user turn so the
// prompt can be unambiguous about "this is the message to respond to."
export async function generateMarketplaceReply(params: {
  vehicle: VehicleForAgent;
  history: AgentTurn[];
  latestMessage: string;
}): Promise<AgentResult> {
  if (!copilotConfigured()) {
    return { ok: false, error: "AI reply generation isn't connected yet — add ANTHROPIC_API_KEY to .env.local." };
  }

  const { vehicle, history, latestMessage } = params;
  const jsonSchema = zodToJsonSchema(ReplySchema, { target: "openApi3" });
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const transcript = history.length > 0
    ? history.map((t) => `${t.direction === "inbound" ? "Customer" : "Dealership"}: ${t.body}`).join("\n")
    : "(no earlier messages in this conversation)";

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [
        {
          name: "submit_reply",
          description: "Submit the classified intent/lead temperature/handoff decision and the drafted reply.",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          input_schema: jsonSchema as any,
        },
      ],
      tool_choice: { type: "tool", name: "submit_reply" },
      messages: [
        {
          role: "user",
          content: `Vehicle facts:\n${vehicleFacts(vehicle)}\n\nConversation so far:\n${transcript}\n\nCustomer's new message to respond to:\n${latestMessage}`,
        },
      ],
    });

    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return { ok: false, error: "The model didn't return a structured reply — try again." };
    }

    const parsed = ReplySchema.safeParse(toolUse.input);
    if (!parsed.success) {
      return { ok: false, error: `Model output didn't match the expected shape: ${parsed.error.message}` };
    }

    return { ok: true, data: parsed.data };
  } catch (err) {
    return { ok: false, error: `Reply generation failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}
