import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Deal Copilot — a free-form assistant for structuring a deal and picking a
// bank, backed by the same Anthropic account as document extraction
// (lib/extraction.ts). Same "check and fail honestly" pattern: no
// ANTHROPIC_API_KEY, no crash, just a clear message so the button can sit
// on the deal page today and start working the moment the key is added.
//
// Unlike extraction, this is free-form advice, not a transcription task —
// the system prompt leans hard on "these are numbers already on file, not
// things to invent" for the same reason lib/lender-match.ts stays rules-
// based: a finance manager needs to be able to trust what this says enough
// to act on it.

const MODEL = "claude-sonnet-5";
const MAX_HISTORY_MESSAGES = 20;

export function copilotConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export interface CopilotMessage {
  role: "user" | "assistant";
  text: string;
}

export interface CopilotResult {
  ok: boolean;
  reply?: string;
  error?: string;
}

const SYSTEM_PROMPT = `You are Deal Copilot, built into a single auto dealership finance manager's
own deal desk. You're talking to that finance manager, never to the customer.

You'll be given a block of real numbers pulled straight from the database for the deal in
question — the vehicle, the applicant's credit/income facts, how each lender program on file
matches this deal, and which F&I products are eligible/recommended. Use those numbers. Don't
invent a credit score, an APR, a lender guideline, or a dollar figure that isn't either given to
you or a plain arithmetic result of what's given.

What you're good for:
- Suggesting how to structure the deal (down payment, term, which back-end products to add) to
  hit a target payment or gross.
- Recommending which lender(s) from the ones on file fit best, and why, based on the match data
  you're given — not a general opinion about lenders you weren't told about.
- Answering whatever else the finance manager asks — F&I questions, "what would you try next on
  this deal," general reasoning support. You're a thinking partner, not a form to fill out.

Ground rules:
- This is not a credit decision and never should be treated as one. Say so if a question is
  really asking you to approve or deny an applicant.
- If the data you need isn't in the context block, say what's missing instead of guessing.
- Be direct and concise — this is a busy finance manager on a lot, not a chat to be enjoyed for
  its own sake. Skip preamble.`;

/**
 * `contextBlock` is a pre-formatted plain-text summary of the deal (built
 * by the caller from real DB rows — see askDealCopilot in
 * app/desk/deals/copilot-actions.ts) so this module never touches the
 * database itself. `history` is the conversation so far, oldest first;
 * only the most recent MAX_HISTORY_MESSAGES are sent to bound token usage
 * on a long-running chat.
 */
export async function askCopilot(contextBlock: string, history: CopilotMessage[]): Promise<CopilotResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Deal Copilot isn't connected yet — add ANTHROPIC_API_KEY to .env.local to enable it." };
  }
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return { ok: false, error: "Nothing to ask." };
  }

  const client = new Anthropic({ apiKey });
  const trimmedHistory = history.slice(-MAX_HISTORY_MESSAGES);

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: `${SYSTEM_PROMPT}\n\n--- Deal context ---\n${contextBlock}`,
      messages: trimmedHistory.map((m) => ({ role: m.role, content: m.text })),
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, error: "The model didn't return a text reply — try again." };
    }
    return { ok: true, reply: textBlock.text };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Deal Copilot request failed: ${message}` };
  }
}
