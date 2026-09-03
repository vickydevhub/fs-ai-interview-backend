import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { env } from "./config.js";
import { checkDatabase } from "./db.js";
import {
  register,
  login,
  getUserFromSession
} from "./auth/auth.js";

import {
  createKit,
  listKits,
  getKit,
  updateKit,
  deleteKit
} from "./kits/kits.js";

import { generateInterviewKit } from "./generation/pipeline.js";
import { validateKit } from "./validation/validator.js";

const app = express();

app.use(
  cors({
    origin: env.FRONTEND_URL
      .split(",")
      .map((value) => value.trim()),
    credentials: true
  })
);

app.use(express.json());
app.use(cookieParser());

async function authenticatedUser(
  req: express.Request
) {
  const token = req.cookies.session;

  if (!token) {
    return null;
  }

  return getUserFromSession(token);
}

app.get(
    "/api/health",
    async (_req, res) => {
      const database =
        await checkDatabase();
  
      res.status(
        database ? 200 : 503
      ).json({
        ok: database,
        service:
          "fs-ai-interview-backend",
        database:
          database
            ? "connected"
            : "disconnected"
      });
    }
  );

app.post(
  "/api/auth/register",
  async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error:
            "Email and password are required"
        });
      }

      const user = await register(
        email,
        password
      );

      res.status(201).json(user);
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Registration failed"
      });
    }
  }
);

app.post(
  "/api/auth/login",
  async (req, res) => {
    const { email, password } = req.body;

    const result = await login(
      email,
      password
    );

    if (!result) {
      return res.status(401).json({
        error: "Invalid credentials"
      });
    }

    res.cookie("session", result.token, {
      httpOnly: true,
      sameSite:
        env.NODE_ENV === "production"
          ? "none"
          : "lax",
      secure:
        env.NODE_ENV === "production",
      maxAge:
        7 * 24 * 60 * 60 * 1000
    });

    res.json({
      userId: result.userId,
      email: result.email
    });
  }
);

app.post(
  "/api/auth/logout",
  (_req, res) => {
    res.clearCookie("session");
    res.json({ ok: true });
  }
);

app.get("/api/kits", async (req, res) => {
  const userId =
    await authenticatedUser(req);

  if (!userId) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  const kits = await listKits(userId);

  res.json(kits);
});

app.post("/api/kits", async (req, res) => {
  try {
    const userId =
      await authenticatedUser(req);

    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized"
      });
    }

    const {
      jd,
      company_url,
      days
    } = req.body;

    if (
      typeof jd !== "string" ||
      typeof company_url !== "string" ||
      typeof days !== "number"
    ) {
      return res.status(400).json({
        error:
          "jd, company_url and days are required"
      });
    }

    const kit =
      await generateInterviewKit(
        jd,
        company_url,
        days
      );

    const validationErrors =
      validateKit(kit);

    if (validationErrors.length > 0) {
      return res.status(422).json({
        error: "Generated kit is invalid",
        details: validationErrors
      });
    }

    const id = await createKit(
      userId,
      kit
    );

    res.status(201).json({
      id,
      kit
    });
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to create kit"
    });
  }
});

app.get(
  "/api/kits/:id",
  async (req, res) => {
    const userId =
      await authenticatedUser(req);

    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized"
      });
    }

    const kit = await getKit(
      userId,
      req.params.id
    );

    if (!kit) {
      return res.status(404).json({
        error: "Kit not found"
      });
    }

    res.json(kit);
  }
);

app.patch(
  "/api/kits/:id",
  async (req, res) => {
    const userId =
      await authenticatedUser(req);

    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized"
      });
    }

    await updateKit(
      userId,
      req.params.id,
      req.body
    );

    res.json({
      ok: true
    });
  }
);

app.post("/api/kits/:id/regenerate", async (req, res) => {
    try {
      const userId = await authenticatedUser(req);
  
      if (!userId) {
        return res.status(401).json({
          error: "Authentication required"
        });
      }
  
      const existingKit = await getKit(
        userId,
        req.params.id
      );
  
      if (!existingKit) {
        return res.status(404).json({
          error: "Kit not found"
        });
      }
  
      const jd =
        typeof req.body?.jd === "string" && req.body.jd.trim()
          ? req.body.jd.trim()
          : existingKit.source?.jd_text;
  
      const companyUrl =
        typeof req.body?.company_url === "string" &&
        req.body.company_url.trim()
          ? req.body.company_url.trim()
          : existingKit.source?.company_url;
  
      const days =
        Number.isInteger(req.body?.days) &&
        req.body.days > 0
          ? req.body.days
          : existingKit.schedule?.days_available;
  
      if (!jd || !companyUrl || !days) {
        return res.status(400).json({
          error:
            "JD, company_url and days are required for regeneration"
        });
      }
  
      const regeneratedKit =
        await generateInterviewKit(
          jd,
          companyUrl,
          days
        );
  
      const validationErrors =
        validateKit(regeneratedKit);
  
      if (validationErrors.length > 0) {
        return res.status(422).json({
          error: "Generated kit failed validation",
          details: validationErrors
        });
      }
  
      await updateKit(
        userId,
        req.params.id,
        regeneratedKit
      );
  
      return res.json({
        id: req.params.id,
        kit: regeneratedKit
      });
    } catch (error) {
      console.error("Regeneration failed:", error);
  
      return res.status(500).json({
        error: "Failed to regenerate kit"
      });
    }
  });

app.delete(
  "/api/kits/:id",
  async (req, res) => {
    const userId =
      await authenticatedUser(req);

    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized"
      });
    }

    await deleteKit(
      userId,
      req.params.id
    );

    res.json({
      ok: true
    });
  }
);

app.post("/api/kits/:id/practice", async (req, res) => {
    try {
      const userId = await authenticatedUser(req);
  
      if (!userId) {
        return res.status(401).json({
          error: "Authentication required"
        });
      }
  
      const kit = await getKit(
        userId,
        req.params.id
      );
  
      if (!kit) {
        return res.status(404).json({
          error: "Kit not found"
        });
      }
  
      if (!kit.questions?.length) {
        return res.status(422).json({
          error: "This kit has no questions"
        });
      }
  
      const question =
        kit.questions[
          Math.floor(
            Math.random() * kit.questions.length
          )
        ];
  
      return res.json({
        question
      });
    } catch (error) {
      console.error("Practice request failed:", error);
  
      return res.status(500).json({
        error: "Failed to start practice"
      });
    }
  });

const port = Number(
  process.env.PORT ??
    env.BACKEND_PORT
);

app.listen(port, () => {
  console.log(
    `Backend listening on port ${port}`
  );
});