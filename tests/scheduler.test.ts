import { describe, expect, it } from "vitest";
import { allocateSchedule } from "../src/scheduling/scheduler.js";
import type {
  Question,
  Requirement
} from "../src/types.js";

const requirements: Requirement[] = [
  {
    id: "r1",
    text: "Node.js",
    kind: "technical",
    priority: "must"
  },
  {
    id: "r2",
    text: "MongoDB",
    kind: "technical",
    priority: "must"
  },
  {
    id: "r3",
    text: "Docker",
    kind: "technical",
    priority: "preferred"
  }
];

const questions: Question[] = [
  {
    id: "q1",
    requirement_ids: ["r1"],
    category: "technical",
    prompt: "How does Node.js handle concurrent requests?",
    answer_outline: "Discuss the event loop and asynchronous I/O.",
    difficulty: 2
  },
  {
    id: "q2",
    requirement_ids: ["r2"],
    category: "technical",
    prompt: "How would you optimize MongoDB queries?",
    answer_outline: "Discuss indexes, explain(), and query patterns.",
    difficulty: 2
  },
  {
    id: "q3",
    requirement_ids: ["r3"],
    category: "practical",
    prompt: "How would you use Docker in production?",
    answer_outline: "Discuss images, containers, configuration, and deployment.",
    difficulty: 2
  },
  {
    id: "q4",
    requirement_ids: ["r1"],
    category: "technical",
    prompt: "How would you scale a Node.js service?",
    answer_outline: "Discuss horizontal scaling and load balancing.",
    difficulty: 3
  }
];

describe("allocateSchedule", () => {
  it("distributes questions across available days", () => {
    const schedule = allocateSchedule(
      questions,
      requirements,
      2
    );

    expect(schedule).toHaveLength(2);

    const scheduledQuestionIds = schedule.flatMap(
      (day) => day.question_ids
    );

    expect(scheduledQuestionIds).toHaveLength(4);
    expect(new Set(scheduledQuestionIds).size).toBe(4);
  });

  it("does not create more days than questions", () => {
    const schedule = allocateSchedule(
      questions.slice(0, 2),
      requirements,
      5
    );

    expect(schedule).toHaveLength(2);
  });

  it("assigns a useful focus to each day", () => {
    const schedule = allocateSchedule(
      questions,
      requirements,
      2
    );

    for (const day of schedule) {
      expect(day.focus.length).toBeGreaterThan(0);
    }
  });

  it("rejects zero available days", () => {
    expect(() =>
      allocateSchedule(
        questions,
        requirements,
        0
      )
    ).toThrow("daysAvailable must be greater than zero");
  });
});