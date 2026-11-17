export interface SessionStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * Conservative per-entry size for platform keystores. Some secure stores reject
 * values above ~2048 bytes; a UTF-16 code unit is at most 3 UTF-8 bytes, so 600
 * code units always stay below that bound.
 */
export const SECURE_CHUNK_SIZE = 600;

const CHUNK_MARKER = '__tbm_chunked__:';

function chunkKey(key: string, index: number): string {
  return `${key}.chunk.${index}`;
}

function parseChunkCount(raw: string | null): number | null {
  if (raw === null || !raw.startsWith(CHUNK_MARKER)) {
    return null;
  }
  const count = Number(raw.slice(CHUNK_MARKER.length));
  return Number.isInteger(count) && count > 0 ? count : null;
}

/**
 * Wraps a size-limited store so values of any length can be saved. Small values
 * are stored as-is; larger ones are split into numbered chunk entries and the
 * main key holds a marker with the chunk count. Stale chunks from a previous,
 * longer value are removed on every write.
 */
export function createChunkedStorage(
  base: SessionStorage,
  chunkSize: number = SECURE_CHUNK_SIZE,
): SessionStorage {
  async function removeChunks(key: string, from: number, to: number): Promise<void> {
    for (let index = from; index < to; index++) {
      await base.removeItem(chunkKey(key, index));
    }
  }

  return {
    async getItem(key: string): Promise<string | null> {
      const raw = await base.getItem(key);
      const count = parseChunkCount(raw);
      if (count === null) {
        return raw;
      }
      const parts: string[] = [];
      for (let index = 0; index < count; index++) {
        const part = await base.getItem(chunkKey(key, index));
        if (part === null) {
          // A torn write; treat the value as absent rather than corrupt.
          return null;
        }
        parts.push(part);
      }
      return parts.join('');
    },
    async setItem(key: string, value: string): Promise<void> {
      const previousCount = parseChunkCount(await base.getItem(key)) ?? 0;

      if (value.length <= chunkSize && !value.startsWith(CHUNK_MARKER)) {
        await base.setItem(key, value);
        await removeChunks(key, 0, previousCount);
        return;
      }

      const count = Math.ceil(value.length / chunkSize);
      for (let index = 0; index < count; index++) {
        await base.setItem(
          chunkKey(key, index),
          value.slice(index * chunkSize, (index + 1) * chunkSize),
        );
      }
      await base.setItem(key, `${CHUNK_MARKER}${count}`);
      await removeChunks(key, count, previousCount);
    },
    async removeItem(key: string): Promise<void> {
      const count = parseChunkCount(await base.getItem(key)) ?? 0;
      await base.removeItem(key);
      await removeChunks(key, 0, count);
    },
  };
}

export function createMemorySessionStorage(): SessionStorage {
  const entries = new Map<string, string>();
  return {
    async getItem(key: string): Promise<string | null> {
      return entries.has(key) ? (entries.get(key) as string) : null;
    },
    async setItem(key: string, value: string): Promise<void> {
      entries.set(key, value);
    },
    async removeItem(key: string): Promise<void> {
      entries.delete(key);
    },
  };
}