# FS AI Interview Backend

Backend service for **FS AI Interview Kit** — an AI-assisted interview preparation platform that converts a job description and company website into a structured interview preparation kit.

The backend is built with Node.js, Express, TypeScript, MongoDB, and an OpenAI-compatible LLM API.

---

## 🚀 Tech Stack

- Node.js
- Express.js
- TypeScript
- MongoDB
- Cheerio
- Zod
- Vitest
- OpenAI-compatible LLM API
- Groq
- CORS
- Helmet
- Express Rate Limit

---

## ✨ Features

### Authentication

- User registration
- User login
- User logout
- Session-based authentication
- User-specific interview kits
- Protected kit operations

### Interview Kit Generation

- Job description processing
- Company website research
- Company brief generation
- Role and responsibility extraction
- Requirement extraction
- Requirement prioritization
- AI-generated interview questions
- Answer outlines
- Flashcard generation
- Requirement coverage analysis
- Second-pass question generation for uncovered requirements
- Multi-day interview preparation schedule
- Runtime schema validation

### Kit Management

- Create interview kits
- List user's interview kits
- Retrieve individual kits
- Update kits
- Delete kits
- Regenerate interview kit content
- Practice questions

### Reliability and Security

- Zod runtime validation
- Structured API errors
- Input validation
- HTTP status codes
- CORS configuration
- Helmet security headers
- API rate limiting
- Separate generation rate limiting
- Production SSRF protection for external research URLs
- Environment-based configuration

### Testing and Evaluation

- Schedule allocation tests
- Requirement coverage tests
- Schema validation tests
- Invalid reference tests
- Invalid difficulty tests
- Invalid schedule tests
- Batch evaluation command

---

## 🏗️ Architecture

The generation pipeline is separated into independent stages:

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