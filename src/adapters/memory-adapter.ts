import type { FilesystemDisk } from "../contracts/filesystem";

/**
 * In-memory filesystem adapter for testing.
 *
 * Implements the FilesystemDisk contract using a Map for storage,
 * providing fast, isolated filesystem operations without disk I/O.
 *
 * @example
 * ```typescript
 * const adapter = new MemoryAdapter();
 * await adapter.put('file.txt', 'Content');
 * const content = await adapter.get('file.txt');
 * ```
 */
export class MemoryAdapter implements FilesystemDisk {
    private storage = new Map<string, Uint8Array>();
    private directorySet = new Set<string>();
    private visibility = new Map<string, "public" | "private">();

    /**
     * Get the contents of a file.
     *
     * @param path - The path to the file
     * @returns The file contents as string, or null if missing
     */
    async get(path: string): Promise<string | null> {
        const data = this.storage.get(this.normalizePath(path));
        if (!data) {
            return null;
        }
        return new TextDecoder().decode(data);
    }

    /**
     * Write the contents of a file.
     *
     * @param path - The path to the file
     * @param contents - The contents to write (string, Blob, ArrayBuffer, or Uint8Array)
     * @returns True on success, false on failure
     */
    async put(path: string, contents: string | Blob | ArrayBuffer | Uint8Array): Promise<boolean> {
        const normalizedPath = this.normalizePath(path);
        let data: Uint8Array;

        if (typeof contents === "string") {
            data = new TextEncoder().encode(contents);
        } else if (contents instanceof Blob) {
            data = new Uint8Array(await contents.arrayBuffer());
        } else if (contents instanceof ArrayBuffer) {
            data = new Uint8Array(contents);
        } else {
            data = contents;
        }

        this.storage.set(normalizedPath, data);
        return true;
    }

    /**
     * Determine if a file exists.
     *
     * @param path - The path to check
     * @returns True if the file exists, false otherwise
     */
    async exists(path: string): Promise<boolean> {
        return this.storage.has(this.normalizePath(path));
    }

    /**
     * Determine if a file is missing.
     *
     * @param path - The path to check
     * @returns True if the file is missing, false otherwise
     */
    async missing(path: string): Promise<boolean> {
        return !this.storage.has(this.normalizePath(path));
    }

    /**
     * Delete the file at a given path.
     *
     * @param paths - The path(s) to the file(s)
     * @returns True if all files were deleted successfully
     */
    async delete(paths: string | string[]): Promise<boolean> {
        const pathList = Array.isArray(paths) ? paths : [paths];
        for (const path of pathList) {
            this.storage.delete(this.normalizePath(path));
            this.visibility.delete(this.normalizePath(path));
        }
        return true;
    }

    /**
     * Copy a file to a new location.
     *
     * @param from - The original file path
     * @param to - The destination path
     * @returns True on success, false on failure
     */
    async copy(from: string, to: string): Promise<boolean> {
        const fromPath = this.normalizePath(from);
        const toPath = this.normalizePath(to);

        const data = this.storage.get(fromPath);
        if (!data) {
            return false;
        }

        this.storage.set(toPath, new Uint8Array(data));

        // Copy visibility if exists
        const visibility = this.visibility.get(fromPath);
        if (visibility) {
            this.visibility.set(toPath, visibility);
        }

        return true;
    }

    /**
     * Move a file to a new location.
     *
     * @param from - The original file path
     * @param to - The destination path
     * @returns True on success, false on failure
     */
    async move(from: string, to: string): Promise<boolean> {
        const copied = await this.copy(from, to);
        if (!copied) {
            return false;
        }
        await this.delete(from);
        return true;
    }

    /**
     * Get the file size of a given file.
     *
     * @param path - The file path
     * @returns The size in bytes, or 0 if file doesn't exist
     */
    async size(path: string): Promise<number> {
        const data = this.storage.get(this.normalizePath(path));
        return data ? data.byteLength : 0;
    }

    /**
     * Get the file's last modification time.
     *
     * @param path - The file path
     * @returns The UNIX timestamp of the last modification, or 0 on error
     */
    async lastModified(path: string): Promise<number> {
        // MemoryAdapter doesn't track modification times
        if (!this.exists(path)) {
            return 0;
        }
        return Math.floor(Date.now() / 1000);
    }

    /**
     * Get an array of all files in a directory (non-recursive).
     *
     * @param directory - The directory path (defaults to root)
     * @returns An array of file paths
     */
    async files(directory = ""): Promise<string[]> {
        return this.scanDirectory(directory, false, true);
    }

    /**
     * Get all of the files from the given directory (recursive).
     *
     * @param directory - The directory path (defaults to root)
     * @returns An array of all file paths
     */
    async allFiles(directory = ""): Promise<string[]> {
        return this.scanDirectory(directory, true, true);
    }

    /**
     * Get all of the directories within a given directory (non-recursive).
     *
     * @param directory - The directory path (defaults to root)
     * @returns An array of directory paths
     */
    async directories(directory = ""): Promise<string[]> {
        return this.scanDirectory(directory, false, false);
    }

    /**
     * Get all (recursive) of the directories within a given directory.
     *
     * @param directory - The directory path (defaults to root)
     * @returns An array of all directory paths
     */
    async allDirectories(directory = ""): Promise<string[]> {
        return this.scanDirectory(directory, true, false);
    }

    /**
     * Create a directory.
     *
     * @param path - The directory path
     * @returns True on success, false on failure
     */
    async makeDirectory(path: string): Promise<boolean> {
        const normalizedPath = this.normalizePath(path);
        this.directorySet.add(normalizedPath);
        return true;
    }

    /**
     * Recursively delete a directory.
     *
     * @param directory - The directory path
     * @returns True on success, false on failure
     */
    async deleteDirectory(directory: string): Promise<boolean> {
        const dirPath = this.normalizePath(directory);

        // Delete all files in the directory
        const filesToDelete = Array.from(this.storage.keys()).filter((key) => key.startsWith(`${dirPath}/`));
        for (const key of filesToDelete) {
            this.storage.delete(key);
        }

        // Delete all subdirectories
        const dirsToDelete = Array.from(this.directorySet.keys()).filter((key) => key.startsWith(dirPath));
        for (const key of dirsToDelete) {
            this.directorySet.delete(key);
        }

        // Delete the directory itself
        this.directorySet.delete(dirPath);

        return true;
    }

    /**
     * Append data to a file.
     *
     * @param path - The path to the file
     * @param data - The data to append
     * @returns True on success, false on failure
     */
    async append(path: string, data: string): Promise<boolean> {
        const normalizedPath = this.normalizePath(path);
        const existing = this.storage.get(normalizedPath);
        const existingText = existing ? new TextDecoder().decode(existing) : "";
        const newData = new TextEncoder().encode(existingText + data);
        this.storage.set(normalizedPath, newData);
        return true;
    }

    /**
     * Prepend data to a file.
     *
     * @param path - The path to the file
     * @param data - The data to prepend
     * @returns True on success, false on failure
     */
    async prepend(path: string, data: string): Promise<boolean> {
        const normalizedPath = this.normalizePath(path);
        const existing = this.storage.get(normalizedPath);
        if (!existing) {
            // File doesn't exist, just create it
            const newData = new TextEncoder().encode(data);
            this.storage.set(normalizedPath, newData);
            return true;
        }
        const existingText = new TextDecoder().decode(existing);
        const newData = new TextEncoder().encode(data + existingText);
        this.storage.set(normalizedPath, newData);
        return true;
    }

    /**
     * Get the file visibility.
     *
     * @param path - The file path
     * @returns The visibility ('public' or 'private'), or null if not set
     */
    async getVisibility(path: string): Promise<"public" | "private" | null> {
        const normalizedPath = this.normalizePath(path);
        if (!this.storage.has(normalizedPath)) {
            return null;
        }
        return this.visibility.get(normalizedPath) || null;
    }

    /**
     * Set the file visibility.
     *
     * @param path - The file path
     * @param visibility - The visibility ('public' or 'private')
     * @returns True on success, false on failure
     */
    async setVisibility(path: string, visibility: "public" | "private"): Promise<boolean> {
        const normalizedPath = this.normalizePath(path);
        if (!this.storage.has(normalizedPath)) {
            return false;
        }
        this.visibility.set(normalizedPath, visibility);
        return true;
    }

    /**
     * Get the file MIME type.
     *
     * @param path - The file path
     * @returns The MIME type, or null if not determinable
     */
    async mimeType(path: string): Promise<string | null> {
        const normalizedPath = this.normalizePath(path);
        if (!this.storage.has(normalizedPath)) {
            return null;
        }

        const ext = path.split(".").pop()?.toLowerCase();
        const mimeTypes: Record<string, string> = {
            css: "text/css",
            gif: "image/gif",
            htm: "text/html",
            html: "text/html",
            jpeg: "image/jpeg",
            jpg: "image/jpeg",
            js: "application/javascript",
            json: "application/json",
            pdf: "application/pdf",
            png: "image/png",
            svg: "image/svg+xml",
            txt: "text/plain",
            xml: "application/xml",
        };

        return ext ? mimeTypes[ext] || "application/octet-stream" : null;
    }

    /**
     * Get the URL for a file.
     *
     * @param path - The file path
     * @returns The file URL
     */
    async url(path: string): Promise<string> {
        return `/storage/${this.normalizePath(path)}`;
    }

    /**
     * Get a temporary URL for a file.
     *
     * @param path - The file path
     * @param expiresIn - Expiration time in seconds
     * @returns The temporary URL
     */
    async temporaryUrl(path: string, expiresIn: number): Promise<string> {
        const url = await this.url(path);
        const expires = Math.floor(Date.now() / 1000) + expiresIn;
        return `${url}?expires=${expires}`;
    }

    /**
     * Normalize a path by removing leading/trailing slashes and normalizing separators.
     *
     * @param path - The path to normalize
     * @returns The normalized path
     */
    private normalizePath(path: string): string {
        return path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "").replace(/\/+/g, "/");
    }

    /**
     * Scan a directory and return files or directories.
     *
     * @param directory - The directory to scan
     * @param recursive - Whether to scan recursively
     * @param returnFiles - True to return files, false for directories
     * @returns An array of paths
     */
    private scanDirectory(directory: string, recursive: boolean, returnFiles: boolean): string[] {
        const dirPath = this.normalizePath(directory);
        const results: string[] = [];

        if (returnFiles) {
            // Scan files
            for (const [path] of this.storage) {
                if (dirPath === "") {
                    // Root directory
                    if (!recursive && !path.includes("/")) {
                        results.push(path);
                    } else if (recursive) {
                        results.push(path);
                    } else if (path.startsWith(`${dirPath}/`) && !path.slice(dirPath.length + 1).includes("/")) {
                        results.push(path);
                    }
                } else {
                    if (!recursive && path.startsWith(`${dirPath}/`) && !path.slice(dirPath.length + 1).includes("/")) {
                        results.push(path);
                    } else if (recursive && path.startsWith(`${dirPath}/`)) {
                        results.push(path);
                    }
                }
            }
        } else {
            // Scan directories
            for (const dir of this.directorySet) {
                if (dirPath === "") {
                    // Root directory
                    if (!recursive && !dir.includes("/")) {
                        results.push(dir);
                    } else if (recursive) {
                        results.push(dir);
                    }
                } else {
                    if (!recursive && dir.startsWith(`${dirPath}/`) && !dir.slice(dirPath.length + 1).includes("/")) {
                        results.push(dir);
                    } else if (recursive && dir.startsWith(`${dirPath}/`)) {
                        results.push(dir);
                    }
                }
            }
        }

        return results;
    }
}
