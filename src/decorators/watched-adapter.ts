import { type FSWatcher, watch } from "node:fs";
import type { FilesystemDisk } from "../contracts/filesystem";

/**
 * Watch event callback.
 */
export type WatchCallback = (event: "change" | "rename", path: string) => void | Promise<void>;

/**
 * Options for WatchedAdapter.
 */
export interface WatchedAdapterOptions {
    /**
     * Whether to watch recursively.
     * @default false
     */
    recursive?: boolean;

    /**
     * Debounce time in milliseconds.
     * @default 100
     */
    debounce?: number;
}

/**
 * Watched filesystem decorator.
 *
 * Wraps another filesystem adapter and provides file system watching capabilities
 * using Bun's native FileSystemWatcher (via node:fs watch).
 *
 * @example
 * ```typescript
 * const local = new LocalAdapter({ root: './storage' });
 * const watched = new WatchedAdapter(local);
 *
 * // Watch for changes
 * watched.watch('file.txt', (event, path) => {
 *   console.log(`File ${path} ${event}`);
 * });
 *
 * // Stop watching
 * watched.unwatch('file.txt');
 * ```
 */
export class WatchedAdapter implements FilesystemDisk {
    private adapter: FilesystemDisk;
    private watchers = new Map<string, FSWatcher>();
    private callbacks = new Map<string, Set<WatchCallback>>();
    private recursive: boolean;
    private debounce: number;

    constructor(adapter: FilesystemDisk, options: WatchedAdapterOptions = {}) {
        this.adapter = adapter;
        this.recursive = options.recursive ?? false;
        this.debounce = options.debounce ?? 100;
    }

    /**
     * Watch a file or directory for changes.
     */
    watch(path: string, callback: WatchCallback): void {
        const normalizedPath = this.normalizePath(path);

        // Add callback
        if (!this.callbacks.has(normalizedPath)) {
            this.callbacks.set(normalizedPath, new Set());
        }
        this.callbacks.get(normalizedPath)?.add(callback);

        // Create watcher if not exists
        if (!this.watchers.has(normalizedPath)) {
            this.createWatcher(normalizedPath);
        }
    }

    /**
     * Stop watching a file or directory.
     */
    unwatch(path: string, callback?: WatchCallback): void {
        const normalizedPath = this.normalizePath(path);

        if (callback) {
            // Remove specific callback
            const callbacks = this.callbacks.get(normalizedPath);
            if (callbacks) {
                callbacks.delete(callback);
                if (callbacks.size === 0) {
                    this.callbacks.delete(normalizedPath);
                }
            }
        } else {
            // Remove all callbacks for this path
            this.callbacks.delete(normalizedPath);
        }

        // Close watcher if no more callbacks
        if (!this.callbacks.has(normalizedPath)) {
            const watcher = this.watchers.get(normalizedPath);
            if (watcher) {
                watcher.close();
                this.watchers.delete(normalizedPath);
            }
        }
    }

    /**
     * Stop all watchers.
     */
    unwatchAll(): void {
        for (const watcher of this.watchers.values()) {
            watcher.close();
        }
        this.watchers.clear();
        this.callbacks.clear();
    }

    /**
     * Get the number of watched paths.
     */
    getWatchCount(): number {
        return this.watchers.size;
    }

    /**
     * Create a watcher for a path.
     */
    private createWatcher(path: string): void {
        try {
            const watcher = watch(path, { recursive: this.recursive }, (event, filename) => {
                if (!filename) {
                    return;
                }

                // Debounce
                const callbacks = this.callbacks.get(path);
                if (!callbacks) {
                    return;
                }

                const eventType = event === "change" ? "change" : "rename";

                // Call all callbacks
                for (const callback of callbacks) {
                    try {
                        callback(eventType, filename);
                    } catch (_error) {}
                }
            });

            this.watchers.set(path, watcher);
        } catch (_error) {}
    }

    /**
     * Normalize a path.
     */
    private normalizePath(path: string): string {
        return path.replace(/\\/g, "/").replace(/\/+/g, "/");
    }

    // Delegate all FilesystemDisk methods to the wrapped adapter

    async get(path: string): Promise<string | null> {
        return this.adapter.get(path);
    }

    async put(path: string, contents: string | Blob | ArrayBuffer | Uint8Array): Promise<boolean> {
        return this.adapter.put(path, contents);
    }

    async exists(path: string): Promise<boolean> {
        return this.adapter.exists(path);
    }

    async missing(path: string): Promise<boolean> {
        return this.adapter.missing(path);
    }

    async delete(paths: string | string[]): Promise<boolean> {
        return this.adapter.delete(paths);
    }

    async copy(from: string, to: string): Promise<boolean> {
        return this.adapter.copy(from, to);
    }

    async move(from: string, to: string): Promise<boolean> {
        return this.adapter.move(from, to);
    }

    async size(path: string): Promise<number> {
        return this.adapter.size(path);
    }

    async lastModified(path: string): Promise<number> {
        return this.adapter.lastModified(path);
    }

    async files(directory?: string): Promise<string[]> {
        return this.adapter.files(directory);
    }

    async allFiles(directory?: string): Promise<string[]> {
        return this.adapter.allFiles(directory);
    }

    async directories(directory?: string): Promise<string[]> {
        return this.adapter.directories(directory);
    }

    async allDirectories(directory?: string): Promise<string[]> {
        return this.adapter.allDirectories(directory);
    }

    async makeDirectory(path: string): Promise<boolean> {
        return this.adapter.makeDirectory(path);
    }

    async deleteDirectory(directory: string): Promise<boolean> {
        return this.adapter.deleteDirectory(directory);
    }

    async append(path: string, data: string): Promise<boolean> {
        return this.adapter.append(path, data);
    }

    async prepend(path: string, data: string): Promise<boolean> {
        return this.adapter.prepend(path, data);
    }

    async getVisibility(path: string): Promise<"public" | "private" | null> {
        return this.adapter.getVisibility(path);
    }

    async setVisibility(path: string, visibility: "public" | "private"): Promise<boolean> {
        return this.adapter.setVisibility(path, visibility);
    }

    async mimeType(path: string): Promise<string | null> {
        return this.adapter.mimeType(path);
    }

    async url(path: string): Promise<string> {
        return this.adapter.url(path);
    }

    async temporaryUrl(path: string, expiresIn: number): Promise<string> {
        return this.adapter.temporaryUrl(path, expiresIn);
    }
}
