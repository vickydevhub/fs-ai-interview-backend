import { Question, Requirement } from "../types.js";

export interface ScheduleDay {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

export function allocateSchedule(
  questions: Question[],
  requirements: Requirement[],
  daysAvailable: number
): ScheduleDay[] {
  if (daysAvailable <= 0) {
    throw new Error("daysAvailable must be greater than zero");
  }

  const daysCount = Math.min(daysAvailable, Math.max(1, questions.length));

  const days: ScheduleDay[] = Array.from(
    { length: daysCount },
    (_, index) => ({
      day: index + 1,
      focus: "Interview preparation",
      question_ids: [],
      minutes: 60
    })
  );

  questions.forEach((question, index) => {
    const dayIndex = index % daysCount;

    days[dayIndex].question_ids.push(question.id);
  });

  for (const day of days) {
    const question = questions.find((item) =>
      day.question_ids.includes(item.id)
    );

    if (question) {
      const requirement = requirements.find((item) =>
        question.requirement_ids.includes(item.id)
      );

      day.focus =
        requirement?.text ?? "Interview preparation";
    }
  }

  return days;
}