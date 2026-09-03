import "dotenv/config";
function required(value: string | undefined, name: string): string {
    if (!value) {
      throw new Error(`${name} is required`);
    }
  
    return value;
  }
  
  export const env = {
    NODE_ENV: process.env.NODE_ENV ?? "development",
  
    MONGODB_URI: required(
      process.env.MONGODB_URI,
      "MONGODB_URI"
    ),
  
    SESSION_SECRET: required(
      process.env.SESSION_SECRET,
      "SESSION_SECRET"
    ),
  
    BACKEND_PORT: Number(process.env.BACKEND_PORT ?? 4000),
  
    FRONTEND_URL:
      process.env.FRONTEND_URL ?? "http://localhost:3000",
  
    LLM_BASE_URL:
      process.env.LLM_BASE_URL ??
      "https://generativelanguage.googleapis.com/v1beta/openai",
  
    LLM_API_KEY:
      process.env.LLM_API_KEY ?? "",
  
    LLM_MODEL:
      process.env.LLM_MODEL ?? "gemini-2.5-flash",
  
    RESEARCH_USER_AGENT:
      process.env.RESEARCH_USER_AGENT ??
      "FS-AI-Interview-Kit/1.0",
  
    RESEARCH_MAX_PAGES:
      Number(process.env.RESEARCH_MAX_PAGES ?? 8),
  
    RESEARCH_MAX_BYTES:
      Number(process.env.RESEARCH_MAX_BYTES ?? 1000000),
  
    RESEARCH_DELAY_MS:
      Number(process.env.RESEARCH_DELAY_MS ?? 300)
  };