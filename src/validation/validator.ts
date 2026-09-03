import { InterviewKit } from "../types.js";

export function validateKit(kit: InterviewKit): string[] {
  const errors: string[] = [];

  if (!kit || typeof kit !== "object") {
    return ["Kit must be an object"];
  }

  // --------------------------------------------------
  // Source
  // --------------------------------------------------

  if (!kit.source.company?.trim()) {
    errors.push("source.company is required");
  }

  if (!kit.source.company_url?.trim()) {
    errors.push("source.company_url is required");
    }
    
    if (!kit.source.jd?.trim()) {
        errors.push("source.jd is required");
      }

  if (!Number.isInteger(kit.source.jd_chars) || kit.source.jd_chars < 0) {
    errors.push("source.jd_chars must be a non-negative integer");
  }

  if (!Array.isArray(kit.source.pages_used)) {
    errors.push("source.pages_used must be an array");
  }

  // --------------------------------------------------
  // Company brief
  // --------------------------------------------------

  if (!kit.company_brief.summary?.trim()) {
    errors.push("company_brief.summary is required");
  }

  if (!kit.company_brief.what_they_do?.trim()) {
    errors.push("company_brief.what_they_do is required");
  }

  if (!Array.isArray(kit.company_brief.sources)) {
    errors.push("company_brief.sources must be an array");
  }

  // --------------------------------------------------
  // Requirements
  // --------------------------------------------------

  if (!Array.isArray(kit.role.requirements)) {
    errors.push("role.requirements must be an array");
    return errors;
  }

  const requirementIds = new Set<string>();

  for (const requirement of kit.role.requirements) {
    if (!requirement.id?.trim()) {
      errors.push("Requirement has missing id");
    }

    if (requirementIds.has(requirement.id)) {
      errors.push(`Duplicate requirement id: ${requirement.id}`);
    }

    requirementIds.add(requirement.id);

    if (!requirement.text?.trim()) {
      errors.push(`Requirement ${requirement.id} has empty text`);
    }

    if (
      ![
        "technical",
        "experience",
        "domain",
        "soft_skill",
        "other"
      ].includes(requirement.kind)
    ) {
      errors.push(
        `Requirement ${requirement.id} has invalid kind`
      );
    }

    if (!["must", "preferred"].includes(requirement.priority)) {
      errors.push(
        `Requirement ${requirement.id} has invalid priority`
      );
    }
  }

  // --------------------------------------------------
  // Questions
  // --------------------------------------------------

  if (!Array.isArray(kit.questions)) {
    errors.push("questions must be an array");
  }

  const questionIds = new Set<string>();

  for (const question of kit.questions ?? []) {
    if (!question.id?.trim()) {
      errors.push("Question has missing id");
    }

    if (questionIds.has(question.id)) {
      errors.push(`Duplicate question id: ${question.id}`);
    }

    questionIds.add(question.id);

    if (!Array.isArray(question.requirement_ids)) {
      errors.push(
        `Question ${question.id} requirement_ids must be an array`
      );
    }

    for (const requirementId of question.requirement_ids ?? []) {
      if (!requirementIds.has(requirementId)) {
        errors.push(
          `Question ${question.id} references missing requirement ${requirementId}`
        );
      }
    }

    if (!question.prompt?.trim()) {
      errors.push(`Question ${question.id} has empty prompt`);
    }

    if (!question.answer_outline?.trim()) {
      errors.push(
        `Question ${question.id} has empty answer_outline`
      );
    }

    if (
      ![
        "technical",
        "behavioral",
        "system_design",
        "practical",
        "domain"
      ].includes(question.category)
    ) {
      errors.push(
        `Question ${question.id} has invalid category`
      );
    }

    if (![1, 2, 3].includes(question.difficulty)) {
      errors.push(
        `Question ${question.id} has invalid difficulty`
      );
    }
  }

  // --------------------------------------------------
  // Flashcards
  // --------------------------------------------------

  if (!Array.isArray(kit.flashcards)) {
    errors.push("flashcards must be an array");
  }

  const flashcardIds = new Set<string>();

  for (const flashcard of kit.flashcards ?? []) {
    if (!flashcard.id?.trim()) {
      errors.push("Flashcard has missing id");
    }

    if (flashcardIds.has(flashcard.id)) {
      errors.push(
        `Duplicate flashcard id: ${flashcard.id}`
      );
    }

    flashcardIds.add(flashcard.id);

    if (!flashcard.front?.trim()) {
      errors.push(
        `Flashcard ${flashcard.id} has empty front`
      );
    }

    if (!flashcard.back?.trim()) {
      errors.push(
        `Flashcard ${flashcard.id} has empty back`
      );
    }

    for (const requirementId of flashcard.requirement_ids ?? []) {
      if (!requirementIds.has(requirementId)) {
        errors.push(
          `Flashcard ${flashcard.id} references missing requirement ${requirementId}`
        );
      }
    }
  }

  // --------------------------------------------------
  // Schedule
  // --------------------------------------------------

  if (!kit.schedule) {
    errors.push("schedule is required");
    return errors;
  }

  if (
    !Number.isInteger(kit.schedule.days_available) ||
    kit.schedule.days_available <= 0
  ) {
    errors.push(
      "schedule.days_available must be a positive integer"
    );
  }

  if (!Array.isArray(kit.schedule.days)) {
    errors.push("schedule.days must be an array");
  }

  if (
    Array.isArray(kit.schedule.days) &&
    kit.schedule.days.length !== kit.schedule.days_available
  ) {
    errors.push(
      "schedule.days_available does not match schedule.days length"
    );
  }

  const scheduleDays = new Set<number>();

  for (const day of kit.schedule.days ?? []) {
    if (scheduleDays.has(day.day)) {
      errors.push(`Duplicate schedule day: ${day.day}`);
    }

    scheduleDays.add(day.day);

    if (!Number.isInteger(day.day) || day.day <= 0) {
      errors.push(`Invalid schedule day: ${day.day}`);
    }

    if (!day.focus?.trim()) {
      errors.push(
        `Schedule day ${day.day} has empty focus`
      );
    }

    if (!Array.isArray(day.question_ids)) {
      errors.push(
        `Schedule day ${day.day} question_ids must be an array`
      );
    }

    for (const questionId of day.question_ids ?? []) {
      if (!questionIds.has(questionId)) {
        errors.push(
          `Schedule day ${day.day} references missing question ${questionId}`
        );
      }
    }

    if (
      !Number.isInteger(day.minutes) ||
      day.minutes <= 0
    ) {
      errors.push(
        `Schedule day ${day.day} has invalid minutes`
      );
    }
  }

  // --------------------------------------------------
  // Coverage
  // --------------------------------------------------

  if (!kit.coverage) {
    errors.push("coverage is required");
    return errors;
  }

  if (!Array.isArray(kit.coverage.uncovered_requirement_ids)) {
    errors.push(
      "coverage.uncovered_requirement_ids must be an array"
    );
  }

  for (const requirementId of
    kit.coverage.uncovered_requirement_ids ?? []) {
    if (!requirementIds.has(requirementId)) {
      errors.push(
        `Coverage references missing requirement ${requirementId}`
      );
    }
  }

  if (
    !Number.isInteger(kit.coverage.passes) ||
    kit.coverage.passes < 1 ||
    kit.coverage.passes > 2
  ) {
    errors.push(
      "coverage.passes must be an integer between 1 and 2"
    );
  }

  return errors;
}