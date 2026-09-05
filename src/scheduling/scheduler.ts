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
  if (!Number.isInteger(daysAvailable) || daysAvailable < 1 || daysAvailable > 60) {
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

  // Distribute questions across the requested number of days.
  questions.forEach((question, index) => {
    const dayIndex = index % daysAvailable;
    days[dayIndex].question_ids.push(question.id);
  });

  // Set focus based on the first question assigned to each day.
  for (const day of days) {
    const question = questions.find((item) =>
      day.question_ids.includes(item.id)
    );

    if (question) {
      const requirement = requirements.find((item) =>
        question.requirement_ids.includes(item.id)
      );

      day.focus = requirement?.text ?? "Interview preparation";
    } else {
      // No new question available for this day.
      // Use review/practice instead of inventing question IDs.
      day.focus = "Review and practice";
    }
  }

  // Safety check: always return exactly the requested number of days.
  if (days.length !== daysAvailable) {
    throw new Error(
      `Unable to create exactly ${daysAvailable} schedule days`
    );
  }

  return days;
}