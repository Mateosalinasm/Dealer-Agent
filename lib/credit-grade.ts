// Credit grading. The design prototype's own UI copy states the rule
// qualitatively ("650-699 is an automatic A, 700+ an A+, under 500 an
// F. In between the band sets the starting grade, then repos,
// bankruptcies, collections over $2,000 and heavy inquiries move it
// down; a clean open auto or a mortgage moves it up.") but never spells
// out exact cutoffs for the 500-649 range or exact point values for each
// adjustment. This is a best-faith translation of that description into
// code — the three stated anchors (700+/650-699/under 500) are exact;
// the 500-649 steps and the adjustment sizes are a reasonable filling-in
// of the gap, not verified against anything.

export type CreditGrade = "A+" | "A" | "B" | "C" | "D" | "F";

const GRADES: CreditGrade[] = ["F", "D", "C", "B", "A", "A+"];

export interface CreditFacts {
  fico: number | null;
  inquiries30d: number | null;
  repossessions: number | null;
  collectionsAmount: number | null; // cents
  openAutos: number | null;
  autoLates: number | null;
  bankruptcies: number | null;
  mortgages: number | null;
}

export interface CreditGradeResult {
  grade: CreditGrade;
  reasons: { label: string; detail: string }[];
}

const HEAVY_INQUIRIES = 3;
const COLLECTIONS_THRESHOLD = 200_000; // $2,000 in cents

function startingGradeIdx(fico: number): number {
  if (fico >= 700) return 5; // A+
  if (fico >= 650) return 4; // A
  if (fico >= 600) return 3; // B
  if (fico >= 550) return 2; // C
  if (fico >= 500) return 1; // D
  return 0; // F
}

export function gradeCredit(facts: CreditFacts): CreditGradeResult {
  if (!facts.fico) {
    return { grade: "F", reasons: [{ label: "No score entered", detail: "Starting grade F" }] };
  }

  let idx = startingGradeIdx(facts.fico);
  const reasons: CreditGradeResult["reasons"] = [
    { label: `FICO ${facts.fico}`, detail: `Starting grade ${GRADES[idx]}` },
  ];

  const down = (label: string, detail: string) => {
    idx = Math.max(0, idx - 1);
    reasons.push({ label, detail });
  };
  const up = (label: string, detail: string) => {
    idx = Math.min(GRADES.length - 1, idx + 1);
    reasons.push({ label, detail });
  };

  if (facts.repossessions) down("Repossession on file", `${facts.repossessions} repo${facts.repossessions === 1 ? "" : "s"} — moves it down`);
  if (facts.bankruptcies) down("Bankruptcy on file", `${facts.bankruptcies} — moves it down`);
  if (facts.collectionsAmount && facts.collectionsAmount > COLLECTIONS_THRESHOLD) down("Collections over $2,000", "Moves it down");
  if (facts.inquiries30d && facts.inquiries30d > HEAVY_INQUIRIES) down("Heavy inquiries", `${facts.inquiries30d} in the last 30 days — moves it down`);

  if (facts.openAutos && !facts.autoLates) up("Clean open auto", "No lates on it — moves it up");
  if (facts.mortgages) up("Mortgage on file", "Moves it up");

  if (reasons.length === 1) reasons.push({ label: "No open auto", detail: "No auto history to lean on" });

  return { grade: GRADES[idx], reasons };
}
