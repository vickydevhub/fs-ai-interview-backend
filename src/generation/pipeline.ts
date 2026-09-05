import {
  Flashcard,
  InterviewKit,
  Question,
  Requirement
} from "../types.js";

import { researchCompany } from "../research/crawler.js";
import { generateJson } from "./llm.js";
import { allocateSchedule } from "../scheduling/scheduler.js";

const REQUIREMENT_KINDS: Requirement["kind"][] = [
  "technical",
  "experience",
  "domain",
  "soft_skill",
  "other"
];

const PRIORITIES: Requirement["priority"][] = [
  "must",
  "preferred"
];

const CATEGORIES: Question["category"][] = [
  "technical",
  "behavioral",
  "system_design",
  "practical",
  "domain"
];

const DEFAULT_ANSWER_OUTLINE =
  "Explain the context, your approach, important technical decisions, " +
  "trade-offs, testing or validation, challenges, and measurable outcome.";

const DEFAULT_FLASHCARD_BACK =
  "Be ready to explain the concept, how you have used it, important " +
  "implementation decisions, trade-offs, common problems, and production considerations.";

function normalizeText(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim()
    : "";
}

function normalizeKey(value: string): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function isKind(value: unknown): value is Requirement["kind"] {
  return typeof value === "string" && REQUIREMENT_KINDS.includes(value as Requirement["kind"]);
}

function isPriority(value: unknown): value is Requirement["priority"] {
  return typeof value === "string" && PRIORITIES.includes(value as Requirement["priority"]);
}

function isCategory(value: unknown): value is Question["category"] {
  return typeof value === "string" && CATEGORIES.includes(value as Question["category"]);
}

function isDifficulty(value: unknown): value is Question["difficulty"] {
  return value === 1 || value === 2 || value === 3;
}

function dedupeRequirements(
  items: Array<{
    text: string;
    kind: Requirement["kind"];
    priority: Requirement["priority"];
  }>
): Requirement[] {
  const seen = new Set<string>();
  const requirements: Requirement[] = [];

  for (const item of items) {
    const text = normalizeText(item.text);
    const key = normalizeKey(text);

    if (text.length < 3 || !key || seen.has(key)) continue;

    seen.add(key);
    requirements.push({
      id: `r${requirements.length + 1}`,
      text,
      kind: isKind(item.kind) ? item.kind : "other",
      priority: isPriority(item.priority) ? item.priority : "must"
    });
  }

  return requirements;
}

/**
 * Deterministic fallback only. The normal path is LLM extraction from the
 * complete JD, so arbitrary technologies do not require code changes here.
 */
function extractRequirements(jd: string): Requirement[] {
  const text = jd
    .replace(/\r/g, "\n")
    .replace(/[•●▪]/g, "\n")
    .replace(/\s+/g, " ")
    .trim();

  const candidates: Array<{
    pattern: RegExp;
    kind: Requirement["kind"];
    priority: Requirement["priority"];
  }> = [
    {
      pattern: /\b\d+\+?\s*years?\b[^.]*?(?:experience|development|engineering)[^.]*\.?/gi,
      kind: "experience",
      priority: "must"
    },
    {
      pattern: /\b(?:must|required|required to|experience with|proficient in|strong knowledge of|knowledge of)\b[^.]{10,160}/gi,
      kind: "other",
      priority: "must"
    },
    {
      pattern: /\b(?:nice to have|preferred|plus|bonus)\b[^.]{10,160}/gi,
      kind: "other",
      priority: "preferred"
    }
  ];

  const found: Array<{
    text: string;
    kind: Requirement["kind"];
    priority: Requirement["priority"];
  }> = [];

  for (const candidate of candidates) {
    for (const match of text.match(candidate.pattern) ?? []) {
      const value = normalizeText(match)
        .replace(/^[-:;,\s]+/, "")
        .replace(/[;,.]+$/, "");

      if (value.length >= 8) {
        found.push({
          text: value,
          kind: candidate.kind,
          priority: candidate.priority
        });
      }
    }
  }

  if (found.length === 0) {
    for (const sentence of text
      .split(/[.!?]/)
      .map((value) => value.trim())
      .filter((value) => value.length >= 20)
      .slice(0, 10)) {
      found.push({
        text: sentence,
        kind: "other",
        priority: "must"
      });
    }
  }

  return dedupeRequirements(found);
}

function mergeRequirements(
  primary: Requirement[],
  fallback: Requirement[]
): Requirement[] {
  const items = primary.map((item) => ({
    text: item.text,
    kind: item.kind,
    priority: item.priority
  }));
  const seen = new Set(primary.map((item) => normalizeKey(item.text)));

  for (const item of fallback) {
    const key = normalizeKey(item.text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    items.push({
      text: item.text,
      kind: item.kind,
      priority: item.priority
    });
  }

  return dedupeRequirements(items);
}

function createFallbackQuestions(requirements: Requirement[]): Question[] {
  return requirements.map((requirement, index) => {
    let category: Question["category"] = "technical";
    let prompt =
      `How would you apply ${requirement.text} in a real production project? ` +
      "Explain your approach, decisions, trade-offs, and validation.";

    if (requirement.kind === "soft_skill") {
      category = "behavioral";
      prompt =
        `Tell me about a real situation where you demonstrated ${requirement.text}. ` +
        "What was the situation, what did you do, and what was the result?";
    } else if (requirement.kind === "experience") {
      category = "practical";
      prompt =
        `Describe your hands-on experience with ${requirement.text}. ` +
        "What did you own, what challenges did you face, and what was the outcome?";
    } else if (requirement.kind === "domain") {
      category = "domain";
    }

    return {
      id: `q${index + 1}`,
      requirement_ids: [requirement.id],
      category,
      prompt,
      answer_outline: DEFAULT_ANSWER_OUTLINE,
      difficulty: 2
    };
  });
}

function createFallbackFlashcards(requirements: Requirement[]): Flashcard[] {
  return requirements.map((requirement, index) => ({
    id: `f${index + 1}`,
    front: requirement.text,
    back: DEFAULT_FLASHCARD_BACK,
    requirement_ids: [requirement.id]
  }));
}

function calculateCoverage(
  requirements: Requirement[],
  questions: Question[]
): string[] {
  const validIds = new Set(requirements.map((item) => item.id));
  const covered = new Set<string>();

  for (const question of questions) {
    if (
      normalizeText(question.prompt).length < 20 ||
      normalizeText(question.answer_outline).length < 20
    ) continue;

    for (const id of question.requirement_ids) {
      if (validIds.has(id)) covered.add(id);
    }
  }

  return requirements
    .filter((requirement) => !covered.has(requirement.id))
    .map((requirement) => requirement.id);
}

function normalizeQuestions(
  raw: unknown,
  requirements: Requirement[]
): Question[] {
  if (!Array.isArray(raw)) return [];

  const questions: Question[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;

    const value = item as Record<string, unknown>;
    const index = value.requirement_index;

    if (
      !Number.isInteger(index) ||
      (index as number) < 0 ||
      (index as number) >= requirements.length
    ) continue;

    const prompt = normalizeText(value.prompt);
    const answer = normalizeText(value.answer_outline);
    if (prompt.length < 20) continue;

    const requirement = requirements[index as number];

    questions.push({
      id: `q${questions.length + 1}`,
      requirement_ids: [requirement.id],
      category: isCategory(value.category)
        ? value.category
        : requirement.kind === "soft_skill"
          ? "behavioral"
          : requirement.kind === "domain"
            ? "domain"
            : "technical",
      prompt,
      answer_outline: answer.length >= 20 ? answer : DEFAULT_ANSWER_OUTLINE,
      difficulty: isDifficulty(value.difficulty) ? value.difficulty : 2
    });
  }

  return questions;
}

function normalizeFlashcards(
  raw: unknown,
  requirements: Requirement[]
): Flashcard[] {
  if (!Array.isArray(raw)) return [];

  const flashcards: Flashcard[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;

    const value = item as Record<string, unknown>;
    const index = value.requirement_index;

    if (
      !Number.isInteger(index) ||
      (index as number) < 0 ||
      (index as number) >= requirements.length
    ) continue;

    const front = normalizeText(value.front);
    const back = normalizeText(value.back);
    if (front.length < 3 || back.length < 10) continue;

    flashcards.push({
      id: `f${flashcards.length + 1}`,
      front,
      back,
      requirement_ids: [requirements[index as number].id]
    });
  }

  return flashcards;
}

async function generateRequirementsWithLLM(
  jd: string,
  fallback: Requirement[]
): Promise<Requirement[]> {
  const systemPrompt = `
You are an expert technical recruiter and engineering interviewer.

Analyze the ENTIRE job description and extract all interview-relevant requirements.

Return ONLY valid JSON:
{
  "requirements": [
    {
      "text": "requirement text",
      "kind": "technical",
      "priority": "must"
    }
  ]
}

Allowed kind values: technical, experience, domain, soft_skill, other.
Allowed priority values: must, preferred.

Rules:
- Read the entire JD.
- Extract programming languages, frameworks, libraries, databases, cloud services,
  infrastructure tools, APIs, testing tools, architecture concepts, methodologies,
  domain knowledge, responsibilities, experience, and soft skills.
- Preserve specific technology/product names exactly where possible.
- Do not use a predefined technology list.
- Include unfamiliar or uncommon technologies if they appear in the JD.
- Separate materially different technologies into separate requirements.
- Include required and preferred skills.
- Mark explicit requirements as must and nice-to-have/preferred items as preferred.
- Do not invent anything not supported by the JD.
- Avoid copying whole paragraphs.
`;

  try {
    const result = await generateJson<{
      requirements?: Array<{
        text: string;
        kind: Requirement["kind"];
        priority: Requirement["priority"];
      }>;
    }>(
      systemPrompt,
      `Job Description:\n\n${jd}`,
      { requirements: [] }
    );

    const llm = dedupeRequirements(
      Array.isArray(result.requirements) ? result.requirements : []
    );

    return mergeRequirements(llm, fallback);
  } catch {
    return fallback;
  }
}

async function generateQuestionsWithLLM(
  requirements: Requirement[],
  fallback: Question[]
): Promise<Question[]> {
  const systemPrompt = `
You are an expert engineering interviewer.

Generate practical interview questions from the supplied requirements.
Return ONLY valid JSON:
{
  "questions": [
    {
      "requirement_index": 0,
      "category": "technical",
      "prompt": "Question...",
      "answer_outline": "Answer should cover...",
      "difficulty": 2
    }
  ]
}

Allowed category values: technical, behavioral, system_design, practical, domain.
Difficulty must be 1, 2, or 3.

Rules:
- Every requirement must have at least one question when possible.
- Questions must be specific to the supplied requirement.
- Prefer practical, production-oriented, scenario, troubleshooting,
  architecture, implementation, and trade-off questions.
- Use behavioral questions for soft skills and concrete project questions for experience.
- Do not invent technologies, tools, frameworks, databases, or services.
- Do not use a predefined technology question list.
- Do not ask generic questions when a requirement-specific question is possible.
`;

  try {
    const result = await generateJson<{
      questions?: Array<{
        requirement_index: number;
        category: Question["category"];
        prompt: string;
        answer_outline: string;
        difficulty: 1 | 2 | 3;
      }>;
    }>(
      systemPrompt,
      JSON.stringify(
        requirements.map((requirement, index) => ({
          index,
          requirement: requirement.text,
          kind: requirement.kind,
          priority: requirement.priority
        })),
        null,
        2
      ),
      { questions: [] }
    );

    const questions = normalizeQuestions(result.questions, requirements);
    return questions.length > 0 ? questions : fallback;
  } catch {
    return fallback;
  }
}

async function generateMissingQuestionsWithLLM(
  requirements: Requirement[],
  existingCount: number
): Promise<Question[]> {
  if (requirements.length === 0) return [];

  const systemPrompt = `
You are an expert engineering interviewer.

The supplied requirements were missed by an earlier question-generation pass.
Generate exactly one strong interview question for EACH supplied requirement.

Return ONLY valid JSON:
{
  "questions": [
    {
      "requirement_index": 0,
      "category": "technical",
      "prompt": "Question...",
      "answer_outline": "Answer should cover...",
      "difficulty": 2
    }
  ]
}

Rules:
- One question per supplied requirement.
- The question must directly test the requirement.
- Prefer practical/production scenarios.
- Do not invent technologies or tools.
`;

  try {
    const result = await generateJson<{
      questions?: Array<{
        requirement_index: number;
        category: Question["category"];
        prompt: string;
        answer_outline: string;
        difficulty: 1 | 2 | 3;
      }>;
    }>(
      systemPrompt,
      JSON.stringify({
        existing_question_count: existingCount,
        requirements: requirements.map((requirement, index) => ({
          index,
          requirement: requirement.text,
          kind: requirement.kind,
          priority: requirement.priority
        }))
      }, null, 2),
      { questions: [] }
    );

    const questions = normalizeQuestions(result.questions, requirements);
    if (questions.length > 0) return questions;
  } catch {
    // Deterministic fallback below.
  }

  return requirements.map((requirement, index) => ({
    id: `q${existingCount + index + 1}`,
    requirement_ids: [requirement.id],
    category: requirement.kind === "soft_skill"
      ? "behavioral"
      : requirement.kind === "domain"
        ? "domain"
        : "practical",
    prompt:
      `Give a concrete production example involving ${requirement.text}. ` +
      "Explain the problem, your implementation or decision, trade-offs, " +
      "testing/validation, and result.",
    answer_outline:
      "Explain the situation, your responsibility, implementation or decision, " +
      "alternatives, testing, trade-offs, problems, and measurable outcome.",
    difficulty: 2
  }));
}

async function generateFlashcardsWithLLM(
  requirements: Requirement[],
  fallback: Flashcard[]
): Promise<Flashcard[]> {
  const systemPrompt = `
You are an expert engineering interviewer creating interview-preparation flashcards.

Generate one concise flashcard for each supplied requirement.
Return ONLY valid JSON:
{
  "flashcards": [
    {
      "requirement_index": 0,
      "front": "Question or key concept",
      "back": "Concise answer or checklist"
    }
  ]
}

Rules:
- Generate one flashcard per requirement.
- Be specific to the supplied requirement.
- Preserve technology names.
- The back should contain useful quick-revision points.
- Do not invent technologies, tools, APIs, or services.
`;

  try {
    const result = await generateJson<{
      flashcards?: Array<{
        requirement_index: number;
        front: string;
        back: string;
      }>;
    }>(
      systemPrompt,
      JSON.stringify(
        requirements.map((requirement, index) => ({
          index,
          requirement: requirement.text,
          kind: requirement.kind,
          priority: requirement.priority
        })),
        null,
        2
      ),
      { flashcards: [] }
    );

    const flashcards = normalizeFlashcards(
      result.flashcards,
      requirements
    );

    return flashcards.length > 0 ? flashcards : fallback;
  } catch {
    return fallback;
  }
}

async function generateMissingFlashcardsWithLLM(
  requirements: Requirement[],
  existingCount: number
): Promise<Flashcard[]> {
  if (requirements.length === 0) return [];

  const systemPrompt = `
You are an expert engineering interviewer.
Generate exactly one concise interview-preparation flashcard for each supplied requirement.
Return ONLY valid JSON:
{
  "flashcards": [
    {
      "requirement_index": 0,
      "front": "Question or key concept",
      "back": "Concise answer or checklist"
    }
  ]
}
Rules:
- Be specific to each requirement.
- Do not invent technologies or tools.
- Keep answers useful for quick interview revision.
`;

  try {
    const result = await generateJson<{
      flashcards?: Array<{
        requirement_index: number;
        front: string;
        back: string;
      }>;
    }>(
      systemPrompt,
      JSON.stringify({
        existing_flashcard_count: existingCount,
        requirements: requirements.map((requirement, index) => ({
          index,
          requirement: requirement.text,
          kind: requirement.kind,
          priority: requirement.priority
        }))
      }, null, 2),
      { flashcards: [] }
    );

    const flashcards = normalizeFlashcards(
      result.flashcards,
      requirements
    );

    if (flashcards.length > 0) return flashcards;
  } catch {
    // Deterministic fallback below.
  }

  return requirements.map((requirement, index) => ({
    id: `f${existingCount + index + 1}`,
    front: requirement.text,
    back: DEFAULT_FLASHCARD_BACK,
    requirement_ids: [requirement.id]
  }));
}

function createCompanyBrief(
  companyUrl: string,
  pages: Array<{ url: string; title: string; text: string }>
) {
  const companyName = new URL(companyUrl).hostname
    .replace(/^www\./, "")
    .split(".")[0]
    .replace(/[-_]/g, " ");

  if (pages.length === 0) {
    return {
      summary: `Company research was unavailable for ${companyName}.`,
      what_they_do:
        "No company website content was available. The interview kit was generated primarily from the job description.",
      sources: []
    };
  }

  const usefulPages = pages
    .filter((page) => page.text.length > 50)
    .slice(0, 5);

  const combinedText = usefulPages
    .map((page) => `${page.title ? `${page.title}. ` : ""}${page.text}`)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const selected = combinedText
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 40)
    .slice(0, 4);

  return {
    summary:
      `Research completed using ${usefulPages.length} company website page(s).`,
    what_they_do:
      (selected.length > 0 ? selected.join(" ") : combinedText).slice(0, 1000),
    sources: usefulPages.map((page) => page.url)
  };
}

function extractRoleInfo(jd: string) {
  const text = jd
    .replace(/\r/g, "\n")
    .replace(/[•●▪]/g, "\n")
    .replace(/\s+/g, " ")
    .trim();

  let title = "Engineering Role";
  const titleMatch = text.match(
    /\b(Senior|Lead|Principal|Staff|Junior|Mid[- ]Level)?\s*(Backend|Frontend|Full[- ]Stack|Software|Web|Platform|DevOps|Data|Cloud)?\s*(Engineer|Developer|Architect)\b/i
  );

  if (titleMatch) title = titleMatch[0].trim();

  let seniority = "Mid";
  if (/\bprincipal\b|\bstaff\b/i.test(text)) seniority = "Staff/Principal";
  else if (/\blead\b/i.test(text)) seniority = "Lead";
  else if (/\bsenior\b/i.test(text)) seniority = "Senior";
  else if (/\bjunior\b/i.test(text)) seniority = "Junior";

  const responsibilitySection = text.match(
    /(?:responsibilities|what you.ll do|you will|role responsibilities)\s*[:\-]?\s*(.*?)(?=\b(?:requirements|qualifications|skills|preferred|experience)\b|$)/i
  );

  let responsibilities: string[] = [];
  if (responsibilitySection?.[1]) {
    responsibilities = responsibilitySection[1]
      .split(/(?<=[.!?])\s+|;\s+/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 20)
      .slice(0, 10);
  }

  if (responsibilities.length === 0) {
    responsibilities = text
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(
        (sentence) =>
          sentence.length >= 30 &&
          /build|develop|design|maintain|implement|lead|manage|deploy/i.test(sentence)
      )
      .slice(0, 8);
  }

  return { title, seniority, responsibilities };
}

export async function generateInterviewKit(
  jd: string,
  companyUrl: string,
  daysAvailable: number
): Promise<InterviewKit> {
  if (!jd || jd.trim().length < 20) {
    throw new Error("Job description is too short to generate an interview kit.");
  }

  if (!Number.isInteger(daysAvailable) || daysAvailable < 1) {
    throw new Error("daysAvailable must be a positive integer.");
  }

  const research = await researchCompany(companyUrl);

  // 1. LLM is the primary requirement extractor. The deterministic extractor
  //    is only a safety net and is merged rather than replacing LLM output.
  const fallbackRequirements = extractRequirements(jd);
  const requirements = await generateRequirementsWithLLM(
    jd,
    fallbackRequirements
  );

  if (requirements.length === 0) {
    throw new Error(
      "Unable to identify interview requirements from the job description."
    );
  }

  // 2. Generate questions from the actual extracted requirements. There is
  //    intentionally no fixed Node/Express/Mongo/etc. question list.
  let questions = await generateQuestionsWithLLM(
    requirements,
    createFallbackQuestions(requirements)
  );

  // 3. Coverage validation + second LLM pass for anything missed.
  let passes = 1;
  let uncovered = calculateCoverage(requirements, questions);

  if (uncovered.length > 0) {
    passes = 2;

    const missingRequirements = requirements.filter((requirement) =>
      uncovered.includes(requirement.id)
    );

    const missingQuestions = await generateMissingQuestionsWithLLM(
      missingRequirements,
      questions.length
    );

    questions = [...questions, ...missingQuestions];
    uncovered = calculateCoverage(requirements, questions);
  }

  // 4. Generate flashcards from the same requirement set so arbitrary JD
  //    technologies are covered here as well.
  let flashcards = await generateFlashcardsWithLLM(
    requirements,
    createFallbackFlashcards(requirements)
  );

  // 5. Ensure every requirement has a flashcard.
  const flashcardCoverage = new Set(
    flashcards.flatMap((flashcard) => flashcard.requirement_ids)
  );

  const missingFlashcardRequirements = requirements.filter(
    (requirement) => !flashcardCoverage.has(requirement.id)
  );

  if (missingFlashcardRequirements.length > 0) {
    const missingFlashcards = await generateMissingFlashcardsWithLLM(
      missingFlashcardRequirements,
      flashcards.length
    );
    flashcards = [...flashcards, ...missingFlashcards];
  }

  // 6. Final coverage is persisted for the UI/assessment.
  const finalUncovered = calculateCoverage(requirements, questions);

  // 7. Schedule uses the generated requirements/questions and requested days.
  const scheduleDays = allocateSchedule(
    questions,
    requirements,
    daysAvailable
  );

  const roleInfo = extractRoleInfo(jd);

  return {
    source: {
      company: new URL(companyUrl).hostname,
      company_url: companyUrl,
      role: "Interview Preparation",
      location: "",
      jd,
      jd_chars: jd.length,
      researched_at: new Date().toISOString(),
      pages_used: research.sources
    },

    company_brief: createCompanyBrief(companyUrl, research.pages),

    role: {
      title: roleInfo.title,
      seniority: roleInfo.seniority,
      responsibilities: roleInfo.responsibilities,
      requirements
    },

    questions,
    flashcards,

    schedule: {
      days_available: scheduleDays.length,
      days: scheduleDays
    },

    coverage: {
      uncovered_requirement_ids: finalUncovered,
      passes
    }
  };
}