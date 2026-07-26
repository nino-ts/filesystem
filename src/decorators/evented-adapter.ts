import type { FilesystemDisk } from "../contracts/filesystem";

/**
 * Filesystem events.
 */
export type FilesystemEvent =
    | "file.created"
    | "file.deleted"
    | "file.moved"
    | "file.copied"
    | "file.updated"
    | "directory.created"
    | "directory.deleted";

/**
 * Event callback function.
 */
export type EventCallback = (path: string) => void | Promise<void>;

/**
 * Event listener handle.
 */
export interface EventListener {
    event: FilesystemEvent;
    callback: EventCallback;
}

/**
 * Evented filesystem decorator.
 *
 * Wraps another filesystem adapter and emits events for filesystem operations,
 * enabling reactive programming patterns and audit logging.
 *
 * @example
 * ```typescript
 * const local = new LocalAdapter({ root: './storage' });
 * const evented = new EventedAdapter(local);
 *
 * // Listen for file creation
 * evented.on('file.created', (path) => {
 *   console.log(`File created: ${path}`);
 * });
 *
 * // Listen for file deletion
 * evented.on('file.deleted', (path) => {
 *   console.log(`File deleted: ${path}`);
 * });
 *
 * // Operations will emit events
 * await evented.put('file.txt', 'Content'); // Emits 'file.created'
 * await evented.delete('file.txt'); // Emits 'file.deleted'
 * ```
 */
export class EventedAdapter implements FilesystemDisk {
    private adapter: FilesystemDisk;
    private listeners = new Map<FilesystemEvent, Set<EventCallback>>();

    constructor(adapter: FilesystemDisk) {
        this.adapter = adapter;
    }

    /**
     * Get the contents of a file.
     */
    async get(path: string): Promise<string | null> {
        return this.adapter.get(path);
    }

    /**
     * Write the contents of a file (emits file.created or file.updated).
     */
    async put(path: string, contents: string | Blob | ArrayBuffer | Uint8Array): Promise<boolean> {
        const exists = await this.adapter.exists(path);
        const result = await this.adapter.put(path, contents);

        if (result) {
            await this.emit(exists ? "file.updated" : "file.created", path);
        }

        return result;
    }

    /**
     * Determine if a file exists.
     */
    async exists(path: string): Promise<boolean> {
        return this.adapter.exists(path);
    }

    /**
     * Determine if a file is missing.
     */
    async missing(path: string): Promise<boolean> {
        return this.adapter.missing(path);
    }

    /**
     * Delete the file at a given path (emits file.deleted).
     */
    async delete(paths: string | string[]): Promise<boolean> {
        const pathList = Array.isArray(paths) ? paths : [paths];
        const result = await this.adapter.delete(paths);

        if (result) {
            for (const path of pathList) {
                await this.emit("file.deleted", path);
            }
        }

        return result;
    }

    /**
     * Copy a file to a new location (emits file.copied).
     */
    async copy(from: string, to: string): Promise<boolean> {
        const result = await this.adapter.copy(from, to);

        if (result) {
            await this.emit("file.copied", from);
            await this.emit("file.copied", to);
        }

        return result;
    }

    /**
     * Move a file to a new location (emits file.moved).
     */
    async move(from: string, to: string): Promise<boolean> {
        const result = await this.adapter.move(from, to);

        if (result) {
            await this.emit("file.moved", from);
            await this.emit("file.moved", to);
        }

        return result;
    }

    /**
     * Get the file size.
     */
    async size(path: string): Promise<number> {
        return this.adapter.size(path);
    }

    /**
     * Get the file's last modification time.
     */
    async lastModified(path: string): Promise<number> {
        return this.adapter.lastModified(path);
    }

    /**
     * Get an array of all files in a directory.
     */
    async files(directory = ""): Promise<string[]> {
        return this.adapter.files(directory);
    }

    /**
     * Get all of the files from the given directory.
     */
    async allFiles(directory = ""): Promise<string[]> {
        return this.adapter.allFiles(directory);
    }

    /**
     * Get all of the directories within a given directory.
     */
    async directories(directory = ""): Promise<string[]> {
        return this.adapter.directories(directory);
    }

    /**
     * Get all (recursive) of the directories within a given directory.
     */
    async allDirectories(directory = ""): Promise<string[]> {
        return this.adapter.allDirectories(directory);
    }

    /**
     * Create a directory (emits directory.created).
     */
    async makeDirectory(path: string): Promise<boolean> {
        const result = await this.adapter.makeDirectory(path);

        if (result) {
            await this.emit("directory.created", path);
        }

        return result;
    }

    /**
     * Recursively delete a directory (emits directory.deleted).
     */
    async deleteDirectory(directory: string): Promise<boolean> {
        const result = await this.adapter.deleteDirectory(directory);

        if (result) {
            await this.emit("directory.deleted", directory);
        }

        return result;
    }

    /**
     * Append data to a file (emits file.updated).
     */
    async append(path: string, data: string): Promise<boolean> {
        const result = await this.adapter.append(path, data);

        if (result) {
            await this.emit("file.updated", path);
        }

        return result;
    }

    /**
     * Prepend data to a file (emits file.updated).
     */
    async prepend(path: string, data: string): Promise<boolean> {
        const result = await this.adapter.prepend(path, data);

        if (result) {
            await this.emit("file.updated", path);
        }

        return result;
    }

    /**
     * Get the file visibility.
     */
    async getVisibility(path: string): Promise<"public" | "private" | null> {
        return this.adapter.getVisibility(path);
    }

    /**
     * Set the file visibility (emits file.updated).
     */
    async setVisibility(path: string, visibility: "public" | "private"): Promise<boolean> {
        const result = await this.adapter.setVisibility(path, visibility);

        if (result) {
            await this.emit("file.updated", path);
        }

        return result;
    }

    /**
     * Get the file MIME type.
     */
    async mimeType(path: string): Promise<string | null> {
        return this.adapter.mimeType(path);
    }

    /**
     * Get the URL for a file.
     */
    async url(path: string): Promise<string> {
        return this.adapter.url(path);
    }

    /**
     * Get a temporary URL for a file.
     */
    async temporaryUrl(path: string, expiresIn: number): Promise<string> {
        return this.adapter.temporaryUrl(path, expiresIn);
    }

    /**
     * Register an event listener.
     *
     * @param event - The event to listen for
     * @param callback - The callback to invoke when the event is emitted
     * @returns An event listener handle that can be used to remove the listener
     */
    on(event: FilesystemEvent, callback: EventCallback): EventListener {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)?.add(callback);

        return { callback, event };
    }

    /**
     * Remove an event listener.
     *
     * @param listener - The event listener handle to remove
     */
    off(listener: EventListener): void {
        const callbacks = this.listeners.get(listener.event);
        if (callbacks) {
            callbacks.delete(listener.callback);
        }
    }

    /**
     * Remove all event listeners.
     */
    offAll(): void {
        this.listeners.clear();
    }

    /**
     * Get the number of listeners for an event.
     */
    listenerCount(event: FilesystemEvent): number {
        return this.listeners.get(event)?.size || 0;
    }

    /**
     * Emit an event to all registered listeners.
     */
    private async emit(event: FilesystemEvent, path: string): Promise<void> {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            await Promise.all(Array.from(callbacks).map((callback) => callback(path)));
        }
    }
}
