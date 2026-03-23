import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI ?? "";

interface MongoClientCache {
  client: MongoClient | null;
  promise: Promise<MongoClient> | null;
}

const globalWithMongo = global as typeof globalThis & {
  _mongoClient: MongoClientCache;
};

const cached: MongoClientCache = globalWithMongo._mongoClient ?? {
  client: null,
  promise: null,
};

if (!globalWithMongo._mongoClient) {
  globalWithMongo._mongoClient = cached;
}

export async function getMongoClient(): Promise<MongoClient> {
  if (!MONGODB_URI) {
    throw new Error("Please define the MONGODB_URI environment variable");
  }
  if (cached.client) return cached.client;
  if (!cached.promise) {
    cached.promise = new MongoClient(MONGODB_URI).connect();
  }
  cached.client = await cached.promise;
  return cached.client;
}
