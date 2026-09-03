import fs from "node:fs/promises";

import { generateInterviewKit } from "../src/generation/pipeline.js";
import { validateKit } from "../src/validation/validator.js";

interface InputCase {
  id: string;
  jd: string;
  company_url: string;
  days: number;
}

interface SuccessResult {
  id: string;
  status: "ok";
  kit: Awaited<ReturnType<typeof generateInterviewKit>>;
  error: null;
}

interface FailedResult {
  id: string;
  status: "failed";
  kit: null;
  error: {
    code: string;
    message: string;
  };
}

type CaseResult = SuccessResult | FailedResult;

function getArgument(name: string): string | null {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

function validateInputCase(
  input: unknown
): input is InputCase {
  if (
    typeof input !== "object" ||
    input === null
  ) {
    return false;
  }

  const value = input as Record<string, unknown>;

  return (
    typeof value.id === "string" &&
    value.id.trim().length > 0 &&
    typeof value.jd === "string" &&
    value.jd.trim().length > 0 &&
    typeof value.company_url === "string" &&
    value.company_url.trim().length > 0 &&
    typeof value.days === "number" &&
    Number.isInteger(value.days) &&
    value.days > 0
  );
}

async function processCase(
  input: InputCase
): Promise<CaseResult> {
  try {
    const kit = await generateInterviewKit(
      input.jd,
      input.company_url,
      input.days
    );

    const validationErrors =
      validateKit(kit);

    if (validationErrors.length > 0) {
      return {
        id: input.id,
        status: "failed",
        kit: null,
        error: {
          code: "KIT_VALIDATION_FAILED",
          message: validationErrors.join("; ")
        }
      };
    }

    return {
      id: input.id,
      status: "ok",
      kit,
      error: null
    };
  } catch (error) {
    return {
      id: input.id,
      status: "failed",
      kit: null,
      error: {
        code: "KIT_GENERATION_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Unknown generation error"
      }
    };
  }
}

async function main() {
  const inputPath =
    getArgument("--input");

  const outputPath =
    getArgument("--output");

  if (!inputPath) {
    throw new Error(
      'Missing required argument "--input"'
    );
  }

  if (!outputPath) {
    throw new Error(
      'Missing required argument "--output"'
    );
  }

  const raw = await fs.readFile(
    inputPath,
    "utf8"
  );

  const parsed: unknown =
    JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(
      "Input file must contain a JSON array"
    );
  }

  const results: CaseResult[] = [];

  for (let index = 0; index < parsed.length; index++) {
    const input = parsed[index];

    if (!validateInputCase(input)) {
      const possibleId =
        typeof input === "object" &&
        input !== null &&
        typeof (
          input as Record<string, unknown>
        ).id === "string"
          ? (
              input as Record<string, string>
            ).id
          : `case-${index + 1}`;

      results.push({
        id: possibleId,
        status: "failed",
        kit: null,
        error: {
          code: "INVALID_INPUT",
          message:
            "Case must contain id, jd, company_url and a positive integer days value."
        }
      });

      continue;
    }

    const result =
      await processCase(input);

    results.push(result);
  }

  const output = {
    version: "1.0",
    generated_at:
      new Date().toISOString(),
    kits: results
  };

  await fs.writeFile(
    outputPath,
    JSON.stringify(output, null, 2),
    "utf8"
  );

  console.log(
    `Evaluation completed: ${results.length} case(s)`
  );

  console.log(
    `Output written to: ${outputPath}`
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : error
  );

  process.exit(1);
});