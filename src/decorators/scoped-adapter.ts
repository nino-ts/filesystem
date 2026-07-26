import type { FilesystemDisk } from "../contracts/filesystem";

/**
 * Options for ScopedAdapter.
 */
export interface ScopedAdapterOptions {
    /**
     * Whether to automatically create the scope directory.
     * @default false
     */
    createScope?: boolean;
}

/**
 * Scoped filesystem decorator.
 *
 * Wraps another filesystem adapter and prefixes all paths with a scope,
 * providing isolated namespaces within the same filesystem.
 *
 * @example
 * ```typescript
 * const local = new LocalAdapter({ root: './storage' });
 *
 * // Create scoped adapters for different users
 * const user1Storage = new ScopedAdapter(local, 'users/1');
 * const user2Storage = new ScopedAdapter(local, 'users/2');
 *
 * // Operations are automatically scoped
 * await user1Storage.put('file.txt', 'User 1 content');
 * await user2Storage.put('file.txt', 'User 2 content');
 *
 * // Files are isolated
 * const user1Files = await user1Storage.files(); // ['users/1/file.txt']
 * const user2Files = await user2Storage.files(); // ['users/2/file.txt']
 * ```
 */
export class ScopedAdapter implements FilesystemDisk {
    private adapter: FilesystemDisk;
    private scope: string;
    private createScope: boolean;

    constructor(adapter: FilesystemDisk, scope: string, options: ScopedAdapterOptions = {}) {
        this.adapter = adapter;
        this.scope = this.normalizeScope(scope);
        this.createScope = options.createScope ?? false;
    }

    /**
     * Get the contents of a file (scoped).
     */
    async get(path: string): Promise<string | null> {
        return this.adapter.get(this.applyScope(path));
    }

    /**
     * Write the contents of a file (scoped).
     */
    async put(path: string, contents: string | Blob | ArrayBuffer | Uint8Array): Promise<boolean> {
        return this.adapter.put(this.applyScope(path), contents);
    }

    /**
     * Determine if a file exists (scoped).
     */
    async exists(path: string): Promise<boolean> {
        return this.adapter.exists(this.applyScope(path));
    }

    /**
     * Determine if a file is missing (scoped).
     */
    async missing(path: string): Promise<boolean> {
        return this.adapter.missing(this.applyScope(path));
    }

    /**
     * Delete the file at a given path (scoped).
     */
    async delete(paths: string | string[]): Promise<boolean> {
        const pathList = Array.isArray(paths) ? paths : [paths];
        const scopedPaths = pathList.map((path) => this.applyScope(path));
        return this.adapter.delete(scopedPaths);
    }

    /**
     * Copy a file to a new location (scoped).
     */
    async copy(from: string, to: string): Promise<boolean> {
        return this.adapter.copy(this.applyScope(from), this.applyScope(to));
    }

    /**
     * Move a file to a new location (scoped).
     */
    async move(from: string, to: string): Promise<boolean> {
        return this.adapter.move(this.applyScope(from), this.applyScope(to));
    }

    /**
     * Get the file size (scoped).
     */
    async size(path: string): Promise<number> {
        return this.adapter.size(this.applyScope(path));
    }

    /**
     * Get the file's last modification time (scoped).
     */
    async lastModified(path: string): Promise<number> {
        return this.adapter.lastModified(this.applyScope(path));
    }

    /**
     * Get an array of all files in a directory (scoped).
     */
    async files(directory = ""): Promise<string[]> {
        const scopedDir = this.applyScope(directory);
        const files = await this.adapter.files(scopedDir);
        return files.map((file) => this.removeScope(file));
    }

    /**
     * Get all of the files from the given directory (scoped).
     */
    async allFiles(directory = ""): Promise<string[]> {
        const scopedDir = this.applyScope(directory);
        const files = await this.adapter.allFiles(scopedDir);
        return files.map((file) => this.removeScope(file));
    }

    /**
     * Get all of the directories within a given directory (scoped).
     */
    async directories(directory = ""): Promise<string[]> {
        const scopedDir = this.applyScope(directory);
        const dirs = await this.adapter.directories(scopedDir);
        return dirs.map((dir) => this.removeScope(dir));
    }

    /**
     * Get all (recursive) of the directories within a given directory (scoped).
     */
    async allDirectories(directory = ""): Promise<string[]> {
        const scopedDir = this.applyScope(directory);
        const dirs = await this.adapter.allDirectories(scopedDir);
        return dirs.map((dir) => this.removeScope(dir));
    }

    /**
     * Create a directory (scoped).
     */
    async makeDirectory(path: string): Promise<boolean> {
        return this.adapter.makeDirectory(this.applyScope(path));
    }

    /**
     * Recursively delete a directory (scoped).
     */
    async deleteDirectory(directory: string): Promise<boolean> {
        return this.adapter.deleteDirectory(this.applyScope(directory));
    }

    /**
     * Append data to a file (scoped).
     */
    async append(path: string, data: string): Promise<boolean> {
        return this.adapter.append(this.applyScope(path), data);
    }

    /**
     * Prepend data to a file (scoped).
     */
    async prepend(path: string, data: string): Promise<boolean> {
        return this.adapter.prepend(this.applyScope(path), data);
    }

    /**
     * Get the file visibility (scoped).
     */
    async getVisibility(path: string): Promise<"public" | "private" | null> {
        return this.adapter.getVisibility(this.applyScope(path));
    }

    /**
     * Set the file visibility (scoped).
     */
    async setVisibility(path: string, visibility: "public" | "private"): Promise<boolean> {
        return this.adapter.setVisibility(this.applyScope(path), visibility);
    }

    /**
     * Get the file MIME type (scoped).
     */
    async mimeType(path: string): Promise<string | null> {
        return this.adapter.mimeType(this.applyScope(path));
    }

    /**
     * Get the URL for a file (scoped).
     */
    async url(path: string): Promise<string> {
        return this.adapter.url(this.applyScope(path));
    }

    /**
     * Get a temporary URL for a file (scoped).
     */
    async temporaryUrl(path: string, expiresIn: number): Promise<string> {
        return this.adapter.temporaryUrl(this.applyScope(path), expiresIn);
    }

    /**
     * Apply the scope prefix to a path.
     */
    private applyScope(path: string): string {
        const normalized = this.normalizePath(path);
        return this.scope ? `${this.scope}/${normalized}` : normalized;
    }

    /**
     * Remove the scope prefix from a path.
     */
    private removeScope(path: string): string {
        const normalized = this.normalizePath(path);
        if (!this.scope) {
            return normalized;
        }
        return normalized.startsWith(`${this.scope}/`) ? normalized.slice(this.scope.length + 1) : normalized;
    }

    /**
     * Normalize a path.
     */
    private normalizePath(path: string): string {
        return path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "").replace(/\/+/g, "/");
    }

    /**
     * Normalize a scope.
     */
    private normalizeScope(scope: string): string {
        return this.normalizePath(scope);
    }

    /**
     * Get the scope prefix.
     */
    getScope(): string {
        return this.scope;
    }
}
