const DATABASE_NAME = "melodyvision-study-audio";
const STORE_NAME = "files";

interface StoredStudyAudio {
  id: string;
  file: File;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Unable to open audio storage"));
  });
}

export async function saveStudyAudioFile(id: string, file: File): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({ id, file } satisfies StoredStudyAudio);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Unable to save audio"));
  });
  database.close();
}

export async function getStudyAudioFile(id: string): Promise<File | null> {
  const database = await openDatabase();
  const result = await new Promise<StoredStudyAudio | undefined>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result as StoredStudyAudio | undefined);
    request.onerror = () => reject(request.error || new Error("Unable to load audio"));
  });
  database.close();
  return result?.file || null;
}
