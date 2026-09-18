import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  EXTRACTION_SCHEMAS,
  type ExtractableCategory,
  type ExtractedData,
} from "@/lib/extraction-schemas";

const MODEL = "claude-sonnet-5";

const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const SYSTEM_PROMPT = `You extract structured data from dealership finance documents for a
single finance manager's own internal use — never for anything customer-facing.

Rules, in order of importance:
1. Never fabricate a value. If a field isn't clearly present in the document, output null for it.
   Do not estimate, round to a "plausible" number, or fill in a typical value.
2. Never output a full Social Security number, full bank account number, or full card number,
   even if one is visible in the document. If you need to reference an account, use only the
   last 4 digits (field name should already say "last4" where that's expected).
3. This is not a credit decision and you are not approving or denying anything. You are only
   transcribing what the document says into structured fields.
4. If the document doesn't match the expected type at all (e.g. it's blank, unrelated, or
   unreadable), still call the tool, leave every field null, and explain what's wrong in "notes".
5. Report the document's own numbers as they appear — do not convert currencies, do not net
   figures together unless the field explicitly asks for a total.

Always respond by calling the "extract" tool exactly once. Do not respond with plain text.`;

const CATEGORY_INSTRUCTIONS: Record<ExtractableCategory, string> = {
  turbopass:
    "This is a TurboPass bank-verification report. It shows linked bank accounts and detected " +
    "income/payroll deposits for one or more people. Extract every account and every distinct " +
    "recurring income source you can find, each with its own line. If multiple people are on the " +
    "report, use applicantName for the primary one and note co-applicants in `notes`.",
  bank_statement:
    "This is a bank statement (possibly multiple months). Extract the account holder, the " +
    "statement period, beginning/ending balances, and every recurring deposit you can identify " +
    "(payroll, benefits, transfers-in that repeat). Count overdraft/NSF fees if shown.",
  credit_report:
    "This is a credit bureau report (Equifax/Experian/TransUnion or a tri-merge). Extract the " +
    "credit score(s), counts of open tradelines and open auto loans, total monthly debt " +
    "obligation if the report totals it, and derogatory item counts (bankruptcies, collections, " +
    "repossessions, 30+ day late payments) and inquiries in the last 6 months.",
  credit_app:
    "This is the dealership's own credit application filled out by the customer. Extract the " +
    "applicant (and co-applicant if any), stated employer/income, time at job, residence type, " +
    "and stated monthly housing payment, exactly as written on the form — this is self-reported, " +
    "not verified.",
};

export interface ExtractionResult<C extends ExtractableCategory> {
  ok: boolean;
  data?: ExtractedData<C>;
  error?: string;
}

export async function extractDocument<C extends ExtractableCategory>(
  category: C,
  fileBuffer: Buffer,
  mimeType: string | null,
): Promise<ExtractionResult<C>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "ANTHROPIC_API_KEY is not set — add it to .env.local to enable AI extraction." };
  }
  if (!mimeType || !SUPPORTED_MIME_TYPES.has(mimeType)) {
    return {
      ok: false,
      error: `Unsupported file type "${mimeType ?? "unknown"}" — upload a PDF, PNG, JPEG, or WebP.`,
    };
  }

  const schema = EXTRACTION_SCHEMAS[category];
  const jsonSchema = zodToJsonSchema(schema, { target: "openApi3" });

  const client = new Anthropic({ apiKey });

  const documentBlock: Anthropic.Messages.ContentBlockParam =
    mimeType === "application/pdf"
      ? {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: fileBuffer.toString("base64") },
        }
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: mimeType as "image/png" | "image/jpeg" | "image/webp",
            data: fileBuffer.toString("base64"),
          },
        };

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [
        {
          name: "extract",
          description: `Extract structured data from this ${category.replace("_", " ")}.`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          input_schema: jsonSchema as any,
        },
      ],
      tool_choice: { type: "tool", name: "extract" },
      messages: [
        {
          role: "user",
          content: [documentBlock, { type: "text", text: CATEGORY_INSTRUCTIONS[category] }],
        },
      ],
    });

    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return { ok: false, error: "The model didn't return structured data — try again." };
    }

    const parsed = schema.safeParse(toolUse.input);
    if (!parsed.success) {
      return { ok: false, error: `Model output didn't match the expected shape: ${parsed.error.message}` };
    }

    return { ok: true, data: parsed.data as ExtractedData<C> };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Extraction failed: ${message}` };
  }
}
