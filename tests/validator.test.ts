import { describe, expect, it } from "vitest";
import { validateKit } from "../src/validation/validator.js";
import type { InterviewKit } from "../src/types.js";

function createValidKit(): InterviewKit {
  return {
    source: {
      company: "Example",
      company_url: "https://example.com",
      role: "Senior Backend Engineer",
        location: "",
        jd: "Senior Backend Engineer with Node.js and MongoDB experience.",
      jd_chars: 100,
      researched_at: new Date().toISOString(),
      pages_used: ["https://example.com"]
    },

    company_brief: {
      summary: "Example company research.",
      what_they_do: "Example company provides technology services.",
      sources: ["https://example.com"]
    },

    role: {
      title: "Senior Backend Engineer",
      seniority: "Senior",
      responsibilities: [
        "Build and maintain backend services."
      ],
      requirements: [
        {
          id: "r1",
          text: "Node.js",
          kind: "technical",
          priority: "must"
        }
      ]
    },

    questions: [
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "How does Node.js handle concurrent requests?",
        answer_outline:
          "Discuss the event loop and asynchronous I/O.",
        difficulty: 2
      }
    ],

    flashcards: [
      {
        id: "f1",
        front: "What is the Node.js event loop?",
        back:
          "It manages asynchronous operations without blocking the main execution thread.",
        requirement_ids: ["r1"]
      }
    ],

    schedule: {
      days_available: 1,
      days: [
        {
          day: 1,
          focus: "Node.js",
          question_ids: ["q1"],
          minutes: 60
        }
      ]
    },

    coverage: {
      uncovered_requirement_ids: [],
      passes: 1
    }
  };
}

describe("validateKit", () => {
  it("accepts a valid kit", () => {
    const kit = createValidKit();

    expect(validateKit(kit)).toEqual([]);
  });

  it("detects a question referencing a missing requirement", () => {
    const kit = createValidKit();

    kit.questions[0].requirement_ids = ["r999"];

    const errors = validateKit(kit);

    expect(
      errors.some((error) =>
        error.includes(
          "references missing requirement r999"
        )
      )
    ).toBe(true);
  });

  it("detects invalid question difficulty", () => {
    const kit = createValidKit();

    kit.questions[0].difficulty = 5 as 1 | 2 | 3;

    const errors = validateKit(kit);

    expect(
      errors.some((error) =>
        error.includes("invalid difficulty")
      )
    ).toBe(true);
  });

  it("detects invalid schedule question references", () => {
    const kit = createValidKit();

    kit.schedule.days[0].question_ids = ["q999"];

    const errors = validateKit(kit);

    expect(
      errors.some((error) =>
        error.includes(
          "references missing question q999"
        )
      )
    ).toBe(true);
  });

  it("detects invalid schedule minutes", () => {
    const kit = createValidKit();

    kit.schedule.days[0].minutes = 0;

    const errors = validateKit(kit);

    expect(
      errors.some((error) =>
        error.includes("invalid minutes")
      )
    ).toBe(true);
  });
});