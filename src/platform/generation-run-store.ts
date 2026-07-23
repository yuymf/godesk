import type { GenerationRun } from "./ingestion";

const DATABASE_NAME = "godesk-private-generation-runs";
const STORE_NAME = "runs";
const DATABASE_VERSION = 1;

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () =>
      reject(request.error ?? new Error("无法打开本地生成任务存储。"));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function transactionRequest<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
) {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const request = action(transaction.objectStore(STORE_NAME));
        request.onerror = () =>
          reject(request.error ?? new Error("本地生成任务存储失败。"));
        request.onsuccess = () => resolve(request.result);
        transaction.oncomplete = () => database.close();
        transaction.onerror = () => {
          database.close();
          reject(transaction.error ?? new Error("本地生成任务存储失败。"));
        };
      }),
  );
}

export function saveGenerationRun(run: GenerationRun) {
  return transactionRequest("readwrite", (store) => store.put(run));
}

export async function getLatestGenerationRun() {
  const runs = await transactionRequest<GenerationRun[]>("readonly", (store) =>
    store.getAll(),
  );
  return runs.sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  )[0];
}

export function deleteGenerationRun(id: string) {
  return transactionRequest("readwrite", (store) => store.delete(id));
}
