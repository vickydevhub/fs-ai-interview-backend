# FS AI Interview Backend

Backend service for the **FS AI Interview Kit** — an AI-assisted interview preparation platform that converts a job description and company website into a structured interview preparation kit.

## 🚀 Tech Stack

- Node.js
- Express.js
- TypeScript
- MongoDB
- Cheerio
- Zod
- Vitest
- OpenAI-compatible LLM API
- Groq supported

## ✨ Features

- User registration and login
- Session-based authentication
- Interview kit CRUD
- Company website research
- Job description requirement extraction
- AI-generated interview questions
- Answer outlines
- Flashcards
- Requirement coverage analysis
- Second-pass question generation
- Multi-day preparation schedule
- Practice question API
- Interview kit regeneration
- Runtime schema validation
- Automated tests
- Batch evaluator

## 🏗️ Architecture

The generation pipeline is intentionally separated into multiple stages:

```text
JD + Company URL
       ↓
Company Research
       ↓
JD / Role Extraction
       ↓
Requirement Extraction
       ↓
Question Generation
       ↓
Flashcard Generation
       ↓
Coverage Check
       ↓
Second Pass
       ↓
Schedule Allocation
       ↓
Schema Validation
       ↓
Interview Kit
```

The implementation avoids relying on a single generation prompt. Each stage has a separate responsibility so the output can be validated and tested independently.

## 📁 Project Structure

```text
src/
├── auth/
├── generation/
│   ├── llm.ts
│   └── pipeline.ts
├── kits/
├── research/
├── scheduling/
├── validation/
├── config.ts
├── db.ts
├── types.ts
└── server.ts

tests/
├── scheduler.test.ts
└── validator.test.ts

scripts/
└── evaluate.ts
```

## ⚙️ Local Setup

### 1. Clone the repository

```bash
git clone <your-backend-repository-url>
cd fs-ai-interview-backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy:

```bash
cp .env.example .env
```

For Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Configure:

```env
NODE_ENV=development

MONGODB_URI=mongodb://127.0.0.1:27017/fs_ai_interview

SESSION_SECRET=replace-with-a-long-random-secret

BACKEND_PORT=4000
FRONTEND_URL=http://localhost:3000

LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=your-groq-api-key
LLM_MODEL=llama-3.3-70b-versatile
```

The LLM configuration uses an OpenAI-compatible API interface, so another compatible provider can also be configured.

## 🗄️ MongoDB

A local MongoDB instance can be used during development.

Alternatively, use a hosted MongoDB deployment and set:

```env
MONGODB_URI=your-mongodb-connection-string
```

## ▶️ Run Development Server

```bash
npm run dev
```

Backend:

```text
http://localhost:4000
```

Health check:

```text
GET /api/health
```

## 🧪 Tests

Run the automated test suite:

```bash
npm test
```

Tests cover:

- Schedule allocation
- Requirement coverage
- Schema validation
- Invalid references
- Invalid difficulty values
- Invalid schedule values

## 🔨 Build

```bash
npm run build
```

Run production build:

```bash
npm start
```

## 📊 Batch Evaluator

The assessment includes a batch evaluation interface.

Example:

```bash
npm run evaluate -- --input ./cases.example.json --output ./kits.json
```

The evaluator produces one result for every input case.

Successful cases contain:

```json
{
  "status": "ok",
  "kit": {}
}
```

Cases where no kit can be produced return:

```json
{
  "status": "failed",
  "kit": null,
  "error": {}
}
```

## 🔌 API Endpoints

### Authentication

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
```

### Interview Kits

```text
GET    /api/kits
POST   /api/kits
GET    /api/kits/:id
PATCH  /api/kits/:id
DELETE /api/kits/:id
```

### Generation

```text
POST /api/kits/:id/regenerate
```

### Practice

```text
POST /api/kits/:id/practice
```

### Health

```text
GET /api/health
```

## 🔐 Production Configuration

Required environment variables:

```env
NODE_ENV=production
MONGODB_URI=...
SESSION_SECRET=...
FRONTEND_URL=...
```

Optional AI configuration:

```env
LLM_BASE_URL=...
LLM_API_KEY=...
LLM_MODEL=...
```

When frontend and backend are deployed separately, configure `FRONTEND_URL` with the deployed frontend origin.

Production cookies use secure cross-origin settings when required.

## 🛡️ Security

The research crawler restricts private/loopback URLs in production to reduce SSRF risk.

Do not commit:

```text
.env
.env.local
```

Never commit API keys, database credentials, or session secrets.

## 🚀 Deployment

The backend is designed to be deployed independently from the frontend.

Typical deployment commands:

```bash
npm install
npm run build
npm start
```

Configure the production environment variables in the hosting provider.

The frontend should point to the deployed backend URL.

## 📝 Design Notes

The application follows a pipeline-oriented design:

- Research is separated from generation.
- Requirements are explicitly represented with stable IDs.
- Questions reference requirements.
- Coverage is calculated before finalizing the kit.
- Uncovered requirements trigger a second generation pass.
- Scheduling is handled independently.
- Final output is validated before persistence.

This makes the system easier to test, extend, and evaluate.

## 📄 License

This project was created as an engineering assessment submission.