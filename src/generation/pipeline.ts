import {
    Flashcard,
    InterviewKit,
    Question,
    Requirement
  } from "../types.js";
  
  import { researchCompany } from "../research/crawler.js";
  import { generateJson } from "./llm.js";
  import { allocateSchedule } from "../scheduling/scheduler.js";
  
  function extractRequirements(
    jd: string
  ): Requirement[] {
    const text = jd
      .replace(/\r/g, "\n")
      .replace(/[•●▪]/g, "\n")
      .replace(/\s+/g, " ")
      .trim();
  
    const requirements: Requirement[] = [];
  
    const patterns: Array<{
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
        pattern: /\bNode\.?js\b/gi,
        kind: "technical",
        priority: "must"
      },
      {
        pattern: /\bExpress(?:\.js)?\b/gi,
        kind: "technical",
        priority: "must"
      },
      {
        pattern: /\bREST(?:ful)?\s+API[s]?\b/gi,
        kind: "technical",
        priority: "must"
      },
      {
        pattern: /\bMongoDB\b/gi,
        kind: "technical",
        priority: "must"
      },
      {
        pattern: /\bDocker\b/gi,
        kind: "technical",
        priority: "must"
      },
      {
        pattern: /\bCI\/CD\b/gi,
        kind: "technical",
        priority: "must"
      },
      {
        pattern: /\bautomated testing\b|\bunit testing\b|\bintegration testing\b/gi,
        kind: "technical",
        priority: "must"
      },
      {
        pattern: /\bsystem design\b/gi,
        kind: "technical",
        priority: "preferred"
      },
      {
        pattern: /\bcloud platforms?\b|\bAWS\b|\bAzure\b|\bGCP\b/gi,
        kind: "technical",
        priority: "preferred"
      }
    ];
  
    for (const item of patterns) {
      const matches = text.match(item.pattern);
  
      if (!matches) {
        continue;
      }
  
      for (const match of matches) {
        const requirementText = match
          .trim()
          .replace(/\s+/g, " ");
  
        const exists = requirements.some(
          (requirement) =>
            requirement.text.toLowerCase() ===
            requirementText.toLowerCase()
        );
  
        if (!exists) {
          requirements.push({
            id: `r${requirements.length + 1}`,
            text: requirementText,
            kind: item.kind,
            priority: item.priority
          });
        }
      }
    }
  
    /*
     * If the JD doesn't contain recognizable
     * technology keywords, retain useful JD
     * content instead of producing an empty kit.
     */
    if (requirements.length === 0) {
      const sentences = text
        .split(/[.!?]/)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length >= 15)
        .slice(0, 10);
  
      for (const sentence of sentences) {
        requirements.push({
          id: `r${requirements.length + 1}`,
          text: sentence,
          kind: "other",
          priority: "must"
        });
      }
    }
  
    return requirements;
  }
  
  function createQuestions(requirements: Requirement[]): Question[] {
    const questions: Question[] = [];
  
    for (const requirement of requirements) {
      const text = requirement.text.toLowerCase();
  
      let prompt = `Explain your practical experience with ${requirement.text}.`;
      let category: Question["category"] = "technical";
      let difficulty: Question["difficulty"] = 2;
  
      if (text.includes("node")) {
        prompt =
          "How would you design a production Node.js service to handle high traffic and concurrent requests?";
        difficulty = 2;
      } else if (text.includes("express")) {
        prompt =
          "How would you structure an Express.js application for scalability, error handling, authentication, and maintainability?";
        difficulty = 2;
      } else if (text.includes("rest")) {
        prompt =
          "How would you design a REST API for a production application? Explain resource design, validation, authentication, errors, and versioning.";
        difficulty = 2;
      } else if (text.includes("mongodb")) {
        prompt =
          "How would you design MongoDB collections and indexes for a high-traffic application? Explain your decisions and trade-offs.";
        difficulty = 3;
      } else if (text.includes("docker")) {
        prompt =
          "How would you containerize a backend application with Docker for development and production?";
        difficulty = 2;
      } else if (text.includes("ci/cd")) {
        prompt =
          "Describe a CI/CD pipeline you would build for a backend application, including testing, build, deployment, and rollback.";
        difficulty = 3;
      } else if (
        text.includes("testing") ||
        text.includes("unit testing") ||
        text.includes("integration testing")
      ) {
        prompt =
          "How would you design unit and integration tests for a backend API? Give examples of what you would mock and what you would test end-to-end.";
        difficulty = 2;
      } else if (text.includes("system design")) {
        prompt =
          "Design a scalable backend system for a high-traffic application. Explain the API, database, caching, scaling, reliability, and monitoring strategy.";
        category = "system_design";
        difficulty = 3;
      } else if (
        text.includes("cloud") ||
        text.includes("aws") ||
        text.includes("azure") ||
        text.includes("gcp")
      ) {
        prompt =
          "How would you deploy and operate a production backend application on a cloud platform?";
        difficulty = 3;
      } else if (
        requirement.kind === "soft_skill"
      ) {
        prompt =
          `Tell me about a situation where you demonstrated ${requirement.text}. What was the challenge, what did you do, and what was the result?`;
        category = "behavioral";
        difficulty = 2;
      } else if (
        requirement.kind === "experience"
      ) {
        prompt =
          `Describe your hands-on experience related to ${requirement.text}. What projects did you work on, what decisions did you make, and what results did you achieve?`;
        category = "practical";
        difficulty = 2;
      }
  
      questions.push({
        id: `q${questions.length + 1}`,
        requirement_ids: [requirement.id],
        category,
        prompt,
        answer_outline:
          "Structure the answer with the context, your approach, important technical decisions, trade-offs, challenges, testing/validation, and measurable outcome.",
        difficulty
      });
    }
  
    return questions;
}
  
function createSecondPassQuestions(
    requirements: Requirement[],
    existingQuestions: Question[]
  ): Question[] {
    const questions: Question[] = [];
  
    for (const requirement of requirements) {
      const text = requirement.text.toLowerCase();
  
      let prompt =
        `Give a real-world example demonstrating your experience with ${requirement.text}. ` +
        `Explain the problem, your implementation, trade-offs, and result.`;
  
      let category: Question["category"] = "practical";
      let difficulty: Question["difficulty"] = 2;
  
      if (text.includes("system design")) {
        prompt =
          "Design a production-ready system related to this requirement. Explain architecture, scalability, data storage, failure handling, monitoring, and trade-offs.";
  
        category = "system_design";
        difficulty = 3;
      } else if (
        text.includes("node") ||
        text.includes("express") ||
        text.includes("api") ||
        text.includes("mongodb")
      ) {
        prompt =
          `Describe a production problem you solved using ${requirement.text}. ` +
          "What was the architecture, what problems occurred, and how did you improve performance or reliability?";
  
        category = "practical";
        difficulty = 3;
      } else if (
        text.includes("docker") ||
        text.includes("ci/cd") ||
        text.includes("cloud")
      ) {
        prompt =
          `Explain how you would use ${requirement.text} in a production deployment. ` +
          "Include build, configuration, deployment, monitoring, failure handling, and rollback.";
  
        category = "practical";
        difficulty = 3;
      } else if (
        text.includes("testing")
      ) {
        prompt =
          `Give a practical testing strategy for ${requirement.text}. ` +
          "Explain unit tests, integration tests, mocks, test data, and CI execution.";
  
        category = "practical";
        difficulty = 2;
      }
  
      questions.push({
        id: `q${existingQuestions.length + questions.length + 1}`,
        requirement_ids: [requirement.id],
        category,
        prompt,
        answer_outline:
          "Explain the situation, architecture or implementation, technical decisions, alternatives considered, testing, trade-offs, and measurable outcome.",
        difficulty
      });
    }
  
    return questions;
  }
  
  function createFlashcards(
    requirements: Requirement[]
  ): Flashcard[] {
    const flashcards: Flashcard[] = [];
  
    for (const requirement of requirements) {
      const text = requirement.text.toLowerCase();
  
      let front = requirement.text;
      let back =
        "Be prepared to explain your practical experience, implementation decisions, challenges, trade-offs, testing, and production results.";
  
      if (text.includes("node")) {
        front = "Node.js: What makes it suitable for scalable backend applications?";
        back =
          "Node.js uses an event-driven, non-blocking I/O model. Be ready to discuss the event loop, asynchronous operations, concurrency, clustering, worker threads, and handling CPU-intensive work.";
      } else if (text.includes("express")) {
        front = "Express.js: How do you structure a production API?";
        back =
          "Use clear routing, controllers/services, validation, centralized error handling, authentication middleware, logging, configuration management, and appropriate separation of concerns.";
      } else if (text.includes("rest")) {
        front = "REST API: What are the key design principles?";
        back =
          "Use resource-oriented URLs, appropriate HTTP methods/status codes, validation, authentication/authorization, consistent error responses, pagination, versioning, and idempotency where appropriate.";
      } else if (text.includes("mongodb")) {
        front = "MongoDB: How do you optimize query performance?";
        back =
          "Analyze query patterns, create appropriate indexes, avoid unnecessary document growth, use projections, pagination, aggregation carefully, and verify performance with explain().";
      } else if (text.includes("docker")) {
        front = "Docker: What makes a production container image effective?";
        back =
          "Use a small base image, multi-stage builds, non-root users, environment-based configuration, predictable startup commands, health checks, and avoid putting secrets inside the image.";
      } else if (text.includes("ci/cd")) {
        front = "CI/CD: What should a backend deployment pipeline contain?";
        back =
          "Typically linting, automated tests, build verification, security checks, artifact creation, deployment, health checks, monitoring, and a rollback strategy.";
      } else if (
        text.includes("testing") ||
        text.includes("unit testing") ||
        text.includes("integration testing")
      ) {
        front = "Backend testing: Unit vs integration tests?";
        back =
          "Unit tests isolate individual functions or components. Integration tests verify multiple components working together, such as an API with a database. Use both to balance speed and confidence.";
      } else if (text.includes("system design")) {
        front = "System design: What areas should you consider for a scalable backend?";
        back =
          "Consider APIs, data storage, caching, load balancing, horizontal scaling, asynchronous processing, availability, consistency, observability, security, failure handling, and cost.";
      } else if (
        text.includes("cloud") ||
        text.includes("aws") ||
        text.includes("azure") ||
        text.includes("gcp")
      ) {
        front = "Cloud deployment: What should you consider for production?";
        back =
          "Consider compute, networking, storage, secrets, autoscaling, monitoring, logging, backups, security, availability, deployment strategy, and cost.";
      } else if (requirement.kind === "experience") {
        front = `Experience: How would you demonstrate ${requirement.text}?`;
        back =
          "Use a specific project example. Explain your responsibility, technical decisions, challenges, measurable outcome, and what you learned.";
      } else if (requirement.kind === "soft_skill") {
        front = `Behavioral: How have you demonstrated ${requirement.text}?`;
        back =
          "Use the STAR structure: Situation, Task, Action, Result. Focus on your specific contribution and the outcome.";
      }
  
      flashcards.push({
        id: `f${flashcards.length + 1}`,
        front,
        back,
        requirement_ids: [requirement.id]
      });
    }
  
    return flashcards;
  }
  
  function calculateCoverage(
    requirements: Requirement[],
    questions: Question[]
  ): string[] {
    const coveredRequirementIds = new Set<string>();
  
    for (const question of questions) {
      if (
        question.prompt.trim().length < 20 ||
        question.answer_outline.trim().length < 20
      ) {
        continue;
      }
  
      for (const requirementId of question.requirement_ids) {
        coveredRequirementIds.add(requirementId);
      }
    }
  
    return requirements
      .filter(
        (requirement) =>
          !coveredRequirementIds.has(requirement.id)
      )
      .map((requirement) => requirement.id);
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
      .map((page) => {
        const title = page.title ? `${page.title}. ` : "";
        return `${title}${page.text}`;
      })
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  
    const sentences = combinedText
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length >= 40);
  
    const selected = sentences.slice(0, 4);
  
    const whatTheyDo =
      selected.length > 0
        ? selected.join(" ").slice(0, 1000)
        : combinedText.slice(0, 1000);
  
    return {
      summary: `Research completed using ${usefulPages.length} company website page(s).`,
      what_they_do: whatTheyDo,
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
  
    if (titleMatch) {
      title = titleMatch[0].trim();
    }
  
    let seniority = "Mid";
  
    if (/\bprincipal\b|\bstaff\b/i.test(text)) {
      seniority = "Staff/Principal";
    } else if (/\blead\b/i.test(text)) {
      seniority = "Lead";
    } else if (/\bsenior\b/i.test(text)) {
      seniority = "Senior";
    } else if (/\bjunior\b/i.test(text)) {
      seniority = "Junior";
    }
  
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
            /build|develop|design|maintain|implement|lead|manage|develop|deploy/i.test(
              sentence
            )
        )
        .slice(0, 8);
    }
  
    return {
      title,
      seniority,
      responsibilities
    };
  }
  async function generateRequirementsWithLLM(
    jd: string,
    fallback: Requirement[]
  ): Promise<Requirement[]> {
    const systemPrompt = `
  You are an expert technical recruiter and engineering interviewer.
  
  Extract the important requirements from the job description.
  
  Return ONLY valid JSON in this exact format:
  
  {
    "requirements": [
      {
        "text": "requirement text",
        "kind": "technical",
        "priority": "must"
      }
    ]
  }
  
  Allowed kind values:
  - technical
  - experience
  - domain
  - soft_skill
  - other
  
  Allowed priority values:
  - must
  - preferred
  
  Rules:
  - Extract individual requirements, not the entire paragraph.
  - Preserve important technologies and skills.
  - Separate different technologies into separate requirements.
  - Do not invent requirements that are not supported by the JD.
  - Keep the requirement text concise.
  `;
  
    const userPrompt = `
  Job Description:
  
  ${jd}
  `;
  
    const result = await generateJson<{
      requirements?: Array<{
        text: string;
        kind: Requirement["kind"];
        priority: Requirement["priority"];
      }>;
    }>(
      systemPrompt,
      userPrompt,
      { requirements: [] }
    );
  
    if (!result.requirements?.length) {
      return fallback;
    }
  
    return result.requirements
      .filter(
        (item) =>
          typeof item.text === "string" &&
          item.text.trim().length > 0
      )
      .map((item, index) => ({
        id: `r${index + 1}`,
        text: item.text.trim(),
        kind: item.kind,
        priority: item.priority
      }));
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
  
  Allowed category values:
  - technical
  - behavioral
  - system_design
  - practical
  - domain
  
  Difficulty must be:
  1, 2, or 3.
  
  Rules:
  - Every requirement should have at least one question.
  - Questions must be specific to the requirement.
  - Avoid generic questions such as "Tell me about your experience".
  - Prefer practical, production-oriented questions.
  - Do not invent technologies not present in the requirements.
  `;
  
    const userPrompt = JSON.stringify(
      requirements.map((requirement, index) => ({
        index,
        requirement: requirement.text,
        kind: requirement.kind,
        priority: requirement.priority
      })),
      null,
      2
    );
  
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
      userPrompt,
      { questions: [] }
    );
  
    if (!result.questions?.length) {
      return fallback;
    }
  
    const questions = result.questions
      .filter(
        (item) =>
          Number.isInteger(item.requirement_index) &&
          item.requirement_index >= 0 &&
          item.requirement_index < requirements.length &&
          typeof item.prompt === "string" &&
          item.prompt.trim().length > 0
      )
      .map((item, index) => ({
        id: `q${index + 1}`,
        requirement_ids: [
          requirements[item.requirement_index].id
        ],
        category: item.category,
        prompt: item.prompt.trim(),
        answer_outline:
          item.answer_outline?.trim() ||
          "Explain your approach, technical decisions, trade-offs, testing, and result.",
        difficulty:
          [1, 2, 3].includes(item.difficulty)
            ? item.difficulty
            : 2
      }));
  
    return questions.length > 0 ? questions : fallback;
  }
  export async function generateInterviewKit(
    jd: string,
    companyUrl: string,
    daysAvailable: number
  ): Promise<InterviewKit> {
    const research = await researchCompany(
      companyUrl
    );
  
    const extractedRequirements = extractRequirements(jd);

    const requirements =
    await generateRequirementsWithLLM(
        jd,
        extractedRequirements
    );

    const roleInfo = extractRoleInfo(jd);

    const fallbackQuestions =
    createQuestions(requirements);

    let questions =
    await generateQuestionsWithLLM(
        requirements,
        fallbackQuestions
    );

    let flashcards =
    createFlashcards(requirements);
          
          let passes = 1;
          
          const firstPassUncovered = calculateCoverage(
            requirements,
            questions
          );
          
          if (firstPassUncovered.length > 0) {
            passes = 2;
          
            const uncoveredRequirements =
              requirements.filter((requirement) =>
                firstPassUncovered.includes(requirement.id)
              );
          
            const secondPassQuestions =
              createSecondPassQuestions(
                uncoveredRequirements,
                questions
              );
          
            questions = [
              ...questions,
              ...secondPassQuestions
            ];
          
            const secondPassFlashcards =
              createFlashcards(uncoveredRequirements).map(
                (flashcard, index) => ({
                  ...flashcard,
                  id: `f${flashcards.length + index + 1}`
                })
              );
          
            flashcards = [
              ...flashcards,
              ...secondPassFlashcards
            ];
          }
          
          const finalUncovered =
            calculateCoverage(requirements, questions);
  
            const scheduleDays = allocateSchedule(
                questions,
                requirements,
                daysAvailable
              );
  
    return {
      source: {
        company:
          new URL(companyUrl).hostname,
        company_url: companyUrl,
        role:
          "Interview Preparation",
            location: "",
        jd,
        jd_chars: jd.length,
        researched_at:
          new Date().toISOString(),
        pages_used: research.sources
      },
  
      company_brief: createCompanyBrief(
        companyUrl,
        research.pages
      ),
  
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
  
  