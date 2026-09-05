import { env } from "../config.js";

export async function generateJson<T>(
  systemPrompt: string,
  userPrompt: string,
  fallback: T
): Promise<T> {
  if (!env.LLM_API_KEY) {
    return fallback;
  }

  const MAX_ATTEMPTS = 2;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(
        `${env.LLM_BASE_URL}/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.LLM_API_KEY}`,
          },
          body: JSON.stringify({
            model: env.LLM_MODEL,
            temperature: 0.2,
            messages: [
              {
                role: "system",
                content: systemPrompt,
              },
              {
                role: "user",
                content: userPrompt,
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        const error: any = new Error(
          `LLM request failed with status ${response.status}`
        );

        error.status = response.status;

        const retryable =
          response.status === 429 ||
          response.status >= 500;

        if (!retryable || attempt === MAX_ATTEMPTS) {
          return fallback;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * attempt)
        );

        continue;
      }

      const data = await response.json();

      const content =
        data?.choices?.[0]?.message?.content;

      if (!content) {
        if (attempt === MAX_ATTEMPTS) {
          return fallback;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * attempt)
        );

        continue;
      }

      const cleaned = content
        .replace(/^```json/i, "")
        .replace(/^```/i, "")
        .replace(/```$/i, "")
        .trim();

      try {
        return JSON.parse(cleaned) as T;
      } catch {
        if (attempt === MAX_ATTEMPTS) {
          return fallback;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * attempt)
        );
      }
    } catch (error: any) {
      const status = error?.status ?? error?.response?.status;

      const retryable =
        status === 429 ||
        (status >= 500 && status <= 599) ||
        error?.name === "AbortError";

      if (!retryable || attempt === MAX_ATTEMPTS) {
        return fallback;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * attempt)
      );
    }
  }

  return fallback;
}