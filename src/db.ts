import { MongoClient, Db } from "mongodb";
import { env } from "./config.js";

const client = new MongoClient(env.MONGODB_URI);

let database: Db | null = null;

export async function getDb(): Promise<Db> {
  if (database) {
    return database;
  }

  await client.connect();

  database = client.db();

  return database;
}

export async function checkDatabase(): Promise<boolean> {
    try {
      const db = await getDb();
  
      await db.command({
        ping: 1
      });
  
      return true;
    } catch (error) {
      console.error(
        "MongoDB connection failed:",
        error
      );
  
      return false;
    }
  }