import { openDB, type IDBPDatabase } from "idb";

interface PendingEntry {
  id?: number;
  habitId: string;
  date: string;
  status: string;
  isOverride: boolean;
  timestamp: number;
}

interface CadenceOfflineDB {
  "pending-entries": {
    key: number;
    value: PendingEntry;
  };
}

let dbPromise: Promise<IDBPDatabase<CadenceOfflineDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<CadenceOfflineDB>("cadence-offline", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("pending-entries")) {
          db.createObjectStore("pending-entries", {
            keyPath: "id",
            autoIncrement: true,
          });
        }
      },
    });
  }
  return dbPromise;
}

export async function queueEntry(
  entry: Omit<PendingEntry, "id" | "timestamp">
): Promise<void> {
  const db = await getDB();
  await db.add("pending-entries", {
    ...entry,
    timestamp: Date.now(),
  });
}

export async function getPendingEntries(): Promise<PendingEntry[]> {
  const db = await getDB();
  return db.getAll("pending-entries");
}

export async function removePendingEntry(id: number): Promise<void> {
  const db = await getDB();
  await db.delete("pending-entries", id);
}

export async function flushQueue(): Promise<void> {
  const entries = await getPendingEntries();

  for (const entry of entries) {
    try {
      const res = await fetch(`/api/habits/${entry.habitId}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: entry.date,
          status: entry.status,
          isOverride: entry.isOverride,
        }),
      });

      if (res.ok && entry.id != null) {
        await removePendingEntry(entry.id);
      }
    } catch {
      // Network still unavailable — stop trying remaining entries
      break;
    }
  }
}
