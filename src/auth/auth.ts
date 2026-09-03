import crypto from "node:crypto";
import { getDb } from "../db.js";

function hashPassword(password: string): string {
  return crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");
}

export async function register(
  email: string,
  password: string
) {
  const db = await getDb();

  const existing = await db
    .collection("users")
    .findOne({ email });

  if (existing) {
    throw new Error(
      "User already exists"
    );
  }

  const user = {
    email,
    passwordHash: hashPassword(password),
    createdAt: new Date()
  };

  const result = await db
    .collection("users")
    .insertOne(user);

  return {
    id: result.insertedId.toString(),
    email
  };
}

export async function login(
  email: string,
  password: string
) {
  const db = await getDb();

  const user = await db
    .collection("users")
    .findOne({
      email,
      passwordHash: hashPassword(password)
    });

  if (!user) {
    return null;
  }

  const token = crypto
    .randomBytes(32)
    .toString("hex");

  await db
    .collection("sessions")
    .insertOne({
      token,
      userId: user._id,
      createdAt: new Date()
    });

  return {
    token,
    userId: user._id.toString(),
    email: user.email
  };
}

export async function getUserFromSession(
  token: string
) {
  const db = await getDb();

  const session = await db
    .collection("sessions")
    .findOne({ token });

  if (!session) {
    return null;
  }

  return session.userId.toString();
}