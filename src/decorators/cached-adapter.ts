import type { FilesystemDisk } from "../contracts/filesystem";

/**
 * Options for CachedAdapter.
 */
export interface CachedAdapterOptions {
    /**
     * Time-to-live for cache entries in milliseconds.
     * @default 60000 (1 minute)
     */
    ttl?: number;

    /**
     * Maximum number of cache entries.
     * @default 1000
     */
    maxSize?: number;
}

/**
 * Cache entry with expiration time.
 */
interface CacheEntry<T> {
    data: T;
    expires: number;
}

/**
 * Caching filesystem decorator.
 *
 * Wraps another filesystem adapter and caches metadata operations
 * to improve performance. Automatically invalidates cache on write operations.
 *
 * @example
 * ```typescript
 * const local = new LocalAdapter({ root: './storage' });
 * const cached = new CachedAdapter(local, { ttl: 60000 });
 *
 * // First call hits the filesystem
 * const content = await cached.get('file.txt');
 *
 * // Second call (within TTL) hits the cache
 * const cachedContent = await cached.get('file.txt');
 * ```
 */
export class CachedAdapter implements FilesystemDisk {
    private adapter: FilesystemDisk;
    private cache = new Map<string, CacheEntry<unknown>>();
    private ttl: number;
    private maxSize: number;

    constructor(adapter: FilesystemDisk, options: CachedAdapterOptions = {}) {
        this.adapter = adapter;
        this.ttl = options.ttl ?? 60_000;
        this.maxSize = options.maxSize ?? 1000;
    }

    /**
     * Get the contents of a file (cached).
     */
    async get(path: string): Promise<string | null> {
        const cached = this.getFromCache<string | null>(`get:${path}`);
        if (cached !== undefined) {
            return cached;
        }

        const data = await this.adapter.get(path);
        this.setCache(`get:${path}`, data);
        return data;
    }

    /**
     * Write the contents of a file (invalidates cache).
     */
    async put(path: string, contents: string | Blob | ArrayBuffer | Uint8Array): Promise<boolean> {
        this.invalidate(path);
        return this.adapter.put(path, contents);
    }

    /**
     * Determine if a file exists (cached).
     */
    async exists(path: string): Promise<boolean> {
        const cached = this.getFromCache<boolean>(`exists:${path}`);
        if (cached !== undefined) {
            return cached;
        }

        const exists = await this.adapter.exists(path);
        this.setCache(`exists:${path}`, exists);
        return exists;
    }

    /**
     * Determine if a file is missing (cached).
     */
    async missing(path: string): Promise<boolean> {
        const cached = this.getFromCache<boolean>(`missing:${path}`);
        if (cached !== undefined) {
            return cached;
        }

        const missing = await this.adapter.missing(path);
        this.setCache(`missing:${path}`, missing);
        return missing;
    }

    /**
     * Delete the file at a given path (invalidates cache).
     */
    async delete(paths: string | string[]): Promise<boolean> {
        const pathList = Array.isArray(paths) ? paths : [paths];
        for (const path of pathList) {
            this.invalidate(path);
        }
        return this.adapter.delete(paths);
    }

    /**
     * Copy a file to a new location (invalidates cache).
     */
    async copy(from: string, to: string): Promise<boolean> {
        this.invalidate(from);
        this.invalidate(to);
        return this.adapter.copy(from, to);
    }

    /**
     * Move a file to a new location (invalidates cache).
     */
    async move(from: string, to: string): Promise<boolean> {
        this.invalidate(from);
        this.invalidate(to);
        return this.adapter.move(from, to);
    }

    /**
     * Get the file size (cached).
     */
    async size(path: string): Promise<number> {
        const cached = this.getFromCache<number>(`size:${path}`);
        if (cached !== undefined) {
            return cached;
        }

        const size = await this.adapter.size(path);
        this.setCache(`size:${path}`, size);
        return size;
    }

    /**
     * Get the file's last modification time (cached).
     */
    async lastModified(path: string): Promise<number> {
        const cached = this.getFromCache<number>(`lastModified:${path}`);
        if (cached !== undefined) {
            return cached;
        }

        const timestamp = await this.adapter.lastModified(path);
        this.setCache(`lastModified:${path}`, timestamp);
        return timestamp;
    }

    /**
     * Get an array of all files in a directory (cached).
     */
    async files(directory = ""): Promise<string[]> {
        const cached = this.getFromCache<string[]>(`files:${directory}`);
        if (cached !== undefined) {
            return cached;
        }

        const files = await this.adapter.files(directory);
        this.setCache(`files:${directory}`, files);
        return files;
    }

    /**
     * Get all of the files from the given directory (cached).
     */
    async allFiles(directory = ""): Promise<string[]> {
        const cached = this.getFromCache<string[]>(`allFiles:${directory}`);
        if (cached !== undefined) {
            return cached;
        }

        const files = await this.adapter.allFiles(directory);
        this.setCache(`allFiles:${directory}`, files);
        return files;
    }

    /**
     * Get all of the directories within a given directory (cached).
     */
    async directories(directory = ""): Promise<string[]> {
        const cached = this.getFromCache<string[]>(`directories:${directory}`);
        if (cached !== undefined) {
            return cached;
        }

        const dirs = await this.adapter.directories(directory);
        this.setCache(`directories:${directory}`, dirs);
        return dirs;
    }

    /**
     * Get all (recursive) of the directories within a given directory (cached).
     */
    async allDirectories(directory = ""): Promise<string[]> {
        const cached = this.getFromCache<string[]>(`allDirectories:${directory}`);
        if (cached !== undefined) {
            return cached;
        }

        const dirs = await this.adapter.allDirectories(directory);
        this.setCache(`allDirectories:${directory}`, dirs);
        return dirs;
    }

    /**
     * Create a directory (invalidates cache).
     */
    async makeDirectory(path: string): Promise<boolean> {
        this.invalidateDirectoryCache();
        return this.adapter.makeDirectory(path);
    }

    /**
     * Recursively delete a directory (invalidates cache).
     */
    async deleteDirectory(directory: string): Promise<boolean> {
        this.invalidate(directory);
        this.invalidateDirectoryCache();
        return this.adapter.deleteDirectory(directory);
    }

    /**
     * Append data to a file (invalidates cache).
     */
    async append(path: string, data: string): Promise<boolean> {
        this.invalidate(path);
        return this.adapter.append(path, data);
    }

    /**
     * Prepend data to a file (invalidates cache).
     */
    async prepend(path: string, data: string): Promise<boolean> {
        this.invalidate(path);
        return this.adapter.prepend(path, data);
    }

    /**
     * Get the file visibility (cached).
     */
    async getVisibility(path: string): Promise<"public" | "private" | null> {
        const cached = this.getFromCache<"public" | "private" | null>(`visibility:${path}`);
        if (cached !== undefined) {
            return cached;
        }

        const visibility = await this.adapter.getVisibility(path);
        this.setCache(`visibility:${path}`, visibility);
        return visibility;
    }

    /**
     * Set the file visibility (invalidates cache).
     */
    async setVisibility(path: string, visibility: "public" | "private"): Promise<boolean> {
        this.invalidate(path);
        return this.adapter.setVisibility(path, visibility);
    }

    /**
     * Get the file MIME type (cached).
     */
    async mimeType(path: string): Promise<string | null> {
        const cached = this.getFromCache<string | null>(`mimeType:${path}`);
        if (cached !== undefined) {
            return cached;
        }

        const mimeType = await this.adapter.mimeType(path);
        this.setCache(`mimeType:${path}`, mimeType);
        return mimeType;
    }

    /**
     * Get the URL for a file (cached).
     */
    async url(path: string): Promise<string> {
        const cached = this.getFromCache<string>(`url:${path}`);
        if (cached !== undefined) {
            return cached;
        }

        const url = await this.adapter.url(path);
        this.setCache(`url:${path}`, url);
        return url;
    }

    /**
     * Get a temporary URL for a file (not cached).
     */
    async temporaryUrl(path: string, expiresIn: number): Promise<string> {
        // Don't cache temporary URLs as they have expiration
        return this.adapter.temporaryUrl(path, expiresIn);
    }

    /**
     * Get a value from the cache if it exists and is not expired.
     */
    private getFromCache<T>(key: string): T | undefined {
        const entry = this.cache.get(key);
        if (!entry) {
            return undefined;
        }

        if (entry.expires < Date.now()) {
            this.cache.delete(key);
            return undefined;
        }

        return entry.data as T;
    }

    /**
     * Set a value in the cache.
     */
    private setCache<T>(key: string, value: T): void {
        // Enforce max size
        if (this.cache.size >= this.maxSize) {
            // Remove oldest entry
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
            }
        }

        this.cache.set(key, {
            data: value,
            expires: Date.now() + this.ttl,
        });
    }

    /**
     * Invalidate cache entries for a path.
     */
    private invalidate(path: string): void {
        const normalizedPath = path.replace(/\\/g, "/");
        const keys = Array.from(this.cache.keys()).filter(
            (key) => key.includes(normalizedPath) || key === `files:` || key === `directories:`,
        );
        for (const key of keys) {
            this.cache.delete(key);
        }
    }

    /**
     * Invalidate all directory cache entries.
     */
    private invalidateDirectoryCache(): void {
        const keys = Array.from(this.cache.keys()).filter(
            (key) =>
                key.startsWith("files:") ||
                key.startsWith("directories:") ||
                key.startsWith("allFiles:") ||
                key.startsWith("allDirectories:"),
        );
        for (const key of keys) {
            this.cache.delete(key);
        }
    }

    /**
     * Clear all cache entries.
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * Get the number of cache entries.
     */
    getCacheSize(): number {
        return this.cache.size;
    }
}
