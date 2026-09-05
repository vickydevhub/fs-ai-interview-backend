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
  if (!Number.isInteger(daysAvailable)) {
    throw new Error("daysAvailable must be an integer");
  }

  if (daysAvailable <= 0) {
    throw new Error("daysAvailable must be greater than zero");
  }

  if (daysAvailable > 60) {
    throw new Error("daysAvailable must be between 1 and 60");
  }

  const days: ScheduleDay[] = Array.from(
    { length: daysAvailable },
    (_, index) => ({
      day: index + 1,
      focus: "Interview preparation",
      question_ids: [],
      minutes: 60,
    })
  );

  questions.forEach((question, index) => {
    const dayIndex = index % daysAvailable;

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
    } else {
      day.focus = "Review and practice";
    }
  }

  if (days.length !== daysAvailable) {
    throw new Error(
      `Unable to create exactly ${daysAvailable} schedule days`
    );
  }

  return days;
}