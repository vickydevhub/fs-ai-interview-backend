import { ObjectId } from "mongodb";
import { getDb } from "../db.js";
import { InterviewKit } from "../types.js";

export async function createKit(
  userId: string,
  kit: InterviewKit
) {
  const db = await getDb();

  const result = await db
    .collection("kits")
    .insertOne({
      userId: new ObjectId(userId),
      ...kit,
      createdAt: new Date(),
      updatedAt: new Date()
    });

  return result.insertedId.toString();
}

export async function listKits(
  userId: string
) {
  const db = await getDb();

  return db
    .collection("kits")
    .find({
      userId: new ObjectId(userId)
    })
    .sort({
      createdAt: -1
    })
    .toArray();
}

export async function getKit(
  userId: string,
  id: string
) {
  const db = await getDb();

  return db
    .collection("kits")
    .findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(userId)
    });
}

export async function updateKit(
  userId: string,
  id: string,
  update: Partial<InterviewKit>
) {
  const db = await getDb();

  await db
    .collection("kits")
    .updateOne(
      {
        _id: new ObjectId(id),
        userId: new ObjectId(userId)
      },
      {
        $set: {
          ...update,
          updatedAt: new Date()
        }
      }
    );
}

export async function deleteKit(
  userId: string,
  id: string
) {
  const db = await getDb();

  await db
    .collection("kits")
    .deleteOne({
      _id: new ObjectId(id),
      userId: new ObjectId(userId)
    });
}