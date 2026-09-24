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
6. Every list field (accounts, transactions, recurringDeposits, scores, odometerReadings, etc.)
   must always be an array — use an empty array [] when you find nothing for it. Never put a
   string, a note, or null into a field that's supposed to be a list.
7. If a document has too many rows to fit everything, the list fields (especially transactions)
   come first — truncate or shorten "notes" before you ever drop a row from a list field, and
   never summarize a list in prose instead of populating it. A human reviews every row anyway; a
   short "notes" is fine, an empty transactions array on a document full of transactions is not.

Always respond by calling the "extract" tool exactly once. Do not respond with plain text.`;

const CATEGORY_INSTRUCTIONS: Record<ExtractableCategory, string> = {
  turbopass:
    "This is a TurboPass bank-verification report. It shows linked bank accounts and every " +
    "transaction line TurboPass detected. List every distinct person named as an owner on any " +
    "account in `holders`, and every account in `accounts` with the name(s) on it. Then extract " +
    "EVERY transaction line into `transactions` — do not summarize or skip rows, the app does its " +
    "own grouping and math from the raw list. For each transaction, categorize it as payroll " +
    "(recurring employer/payroll deposit), zelle (a Zelle or person-to-person transfer, in either " +
    "direction — set counterpartyName to the other party), internal_transfer (between the " +
    "customer's own linked accounts), mobile_deposit, cash_deposit, fee (NSF/overdraft/monthly " +
    "fees), card_debit (card or debit purchases), or other. amountCents is positive for money in, " +
    "negative for money out. If multiple people are on the report, use applicantName for the " +
    "primary one and note anything ambiguous about the others in `notes`.",
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
    "This is the dealership's own credit application filled out by the customer — everything on " +
    "it is self-reported, not verified. Extract the applicant's name, co-applicant name if any, " +
    "gender, phone numbers (cell/home/work — leave any not listed null), and email. For the ID " +
    "section extract idType (driver's license, state ID, passport, etc.), idState, idNumber, and " +
    "the issued/expiration dates if shown. Extract only the LAST 4 DIGITS of the SSN into " +
    "ssnLast4 — never output the full 9-digit SSN even though it's on the form, same rule as " +
    "every other document type. For the current address and, if a previous-address section is " +
    "filled in, the previous address too, extract street/apt-unit/city/state/zip/county, whether " +
    "it's marked rent or own (addressType), the rent/mortgage amount, and years+months at that " +
    "address. For current employment and, if filled in, previous employment, extract the " +
    "employer's name, occupation, employer phone, employment status, how income is verified " +
    "(incomeType — e.g. TurboPass, pay stub, self-employed, whatever's marked), years+months at " +
    "the job, and the employer's address fields. Extract the stated monthly income as " +
    "monthlyIncomeStatedCents, and any \"Other Income\" section as otherIncomeAmountCents + " +
    "otherIncomeSource. Leave an entire address/employment section null if the form doesn't have " +
    "one filled in (e.g. no previous address listed) rather than guessing at it from the current " +
    "one.",
  autocheck:
    "This is an AutoCheck (or similar) vehicle history report. Extract the VIN, year, make, model, " +
    "trim, current mileage, title brand, owner count, and reported accident count. List every " +
    "odometer reading in the report with its date and source, in the order the report gives them, " +
    "and set odometerConsistent to false if any later reading is lower than an earlier one.",
  insurance:
    "This is an auto insurance declarations page. Extract the insured's name, policy number, and " +
    "effective/expiration dates. List EVERY driver named on the policy in `drivers` — not just the " +
    "primary insured. List EVERY vehicle covered in `vehicles`, each with its VIN, year/make/model, " +
    "and its comprehensive and collision deductibles as separate cents figures (if the page shows " +
    "one combined deductible for both, use that same figure for both fields). Extract the " +
    "lienholder/loss-payee's name and full mailing address exactly as printed, usually in a " +
    "'Lienholder' or 'Loss Payee' section — leave both null if there's no lienholder listed on the " +
    "page at all.",
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
    // TurboPass now asks for every transaction line, not a summary — a
    // real report can run to hundreds of rows (500+ transactions isn't
    // unusual), which needs far more than the SDK's own ~16000-token
    // non-streaming default. Streaming is what makes a large max_tokens
    // safe to request at all — the SDK requires it above a few tens of
    // thousands of tokens to avoid the request just timing out over HTTP.
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 64000,
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
    const response = await stream.finalMessage();

    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return { ok: false, error: "The model didn't return structured data — try again." };
    }

    // A tool_use block can still contain syntactically valid (if
    // incomplete) JSON when generation was cut off mid-object — it would
    // pass schema validation as a quietly truncated report rather than
    // failing loudly, which is worse. Catch that case explicitly instead.
    if (response.stop_reason === "max_tokens") {
      return { ok: false, error: "This document is too large to fully transcribe in one pass — try splitting it (e.g. by month) and uploading the parts separately." };
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
