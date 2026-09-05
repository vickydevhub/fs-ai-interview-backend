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

  it("creates exactly the requested number of days", () => {
    const questions: Question[] = [
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "Question 1",
        answer_outline: "Answer 1",
        difficulty: 1,
      },
      {
        id: "q2",
        requirement_ids: ["r2"],
        category: "technical",
        prompt: "Question 2",
        answer_outline: "Answer 2",
        difficulty: 1,
      },
    ];
  
    const requirements: Requirement[] = [
      {
        id: "r1",
        text: "Requirement 1",
        kind: "technical",
        priority: "must",
      },
      {
        id: "r2",
        text: "Requirement 2",
        kind: "technical",
        priority: "preferred",
      },
    ];
  
    const schedule = allocateSchedule(
      questions,
      requirements,
      5
    );
  
    expect(schedule).toHaveLength(5);
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

  it("supports a 60-day schedule", () => {
    const questions: Question[] = [
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "Question 1",
        answer_outline: "Answer 1",
        difficulty: 1,
      },
    ];
  
    const requirements: Requirement[] = [
      {
        id: "r1",
        text: "Requirement 1",
        kind: "technical",
        priority: "must",
      },
    ];
  
    const schedule = allocateSchedule(
      questions,
      requirements,
      60
    );
  
    expect(schedule).toHaveLength(60);
    expect(schedule[0].day).toBe(1);
    expect(schedule[59].day).toBe(60);
  });

  it("rejects more than 60 available days", () => {
    expect(() =>
      allocateSchedule(
        [],
        [],
        61
      )
    ).toThrow("daysAvailable must be between 1 and 60");
  });
});