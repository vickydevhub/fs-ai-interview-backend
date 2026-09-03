import { env } from "../config.js";

export async function generateJson<T>(
  systemPrompt: string,
  userPrompt: string,
  fallback: T
): Promise<T> {
  if (!env.LLM_API_KEY) {
    return fallback;
  }

  try {
    const response = await fetch(
      `${env.LLM_BASE_URL}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.LLM_API_KEY}`
        },
        body: JSON.stringify({
          model: env.LLM_MODEL,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: userPrompt
            }
          ]
        })
      }
    );

    if (!response.ok) {
      return fallback;
    }

    const data = await response.json();

    const content =
      data?.choices?.[0]?.message?.content;

    if (!content) {
      return fallback;
    }

    const cleaned = content
      .replace(/^```json/i, "")
      .replace(/^```/i, "")
      .replace(/```$/i, "")
      .trim();

    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}