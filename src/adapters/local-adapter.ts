import { appendFile, copyFile, mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import type { FilesystemDisk } from "../contracts/filesystem";

export interface LocalAdapterConfig {
    root: string;
}

/**
 * Local filesystem driver utilizing native Bun and Node.js primitives.
 *
 * Implements the FilesystemDisk contract for local disk operations,
 * providing a consistent API for file and directory management.
 */
export class LocalAdapter implements FilesystemDisk {
    private readonly root: string;

    constructor(config: LocalAdapterConfig) {
        this.root = config.root;
    }

    /**
     * Resolves a given path against the absolute root directory.
     *
     * @param targetPath - The relative path to resolve
     * @returns The absolute path
     */
    private applyPathPrefix(targetPath: string): string {
        return path.join(this.root, targetPath);
    }

    /**
     * Strip the root prefix from absolute paths, returning relative storage paths.
     *
     * @param absolutePath - The absolute path to normalize
     * @returns The relative path with forward slashes
     */
    private removePathPrefix(absolutePath: string): string {
        return path.relative(this.root, absolutePath).split(path.sep).join("/");
    }

    /**
     * Ensures the directory structure for a given file path exists.
     *
     * @param filePath - The full file path
     */
    private async ensureDirectory(filePath: string): Promise<void> {
        await mkdir(path.dirname(filePath), { recursive: true });
    }

    /**
     * Determine if a file exists.
     *
     * @param targetPath - The path to check
     * @returns True if the file exists, false otherwise
     */
    async exists(targetPath: string): Promise<boolean> {
        const file = Bun.file(this.applyPathPrefix(targetPath));
        return await file.exists();
    }

    /**
     * Get the contents of a file.
     *
     * @param targetPath - The path to the file
     * @returns The file contents as string, or null if missing
     */
    async get(targetPath: string): Promise<string | null> {
        const file = Bun.file(this.applyPathPrefix(targetPath));
        if (!(await file.exists())) {
            return null;
        }
        return await file.text();
    }

    /**
     * Write the contents of a file.
     *
     * @param targetPath - The path to the file
     * @param contents - The contents to write (string, Blob, ArrayBuffer, or Uint8Array)
     * @returns True on success, false on failure
     */
    async put(targetPath: string, contents: string | Blob | ArrayBuffer | Uint8Array): Promise<boolean> {
        try {
            const fullPath = this.applyPathPrefix(targetPath);
            await this.ensureDirectory(fullPath);
            await Bun.write(fullPath, contents);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Append data to a file.
     *
     * @param targetPath - The path to the file
     * @param data - The data to append
     * @returns True on success, false on failure
     */
    async append(targetPath: string, data: string): Promise<boolean> {
        try {
            const fullPath = this.applyPathPrefix(targetPath);
            await this.ensureDirectory(fullPath);
            await appendFile(fullPath, data);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Delete the file at a given path.
     *
     * @param paths - The path(s) to the file(s)
     * @returns True if all files were deleted successfully
     */
    async delete(paths: string | string[]): Promise<boolean> {
        const targetPaths = Array.isArray(paths) ? paths : [paths];
        let success = true;

        for (const p of targetPaths) {
            try {
                const fullPath = this.applyPathPrefix(p);
                const file = Bun.file(fullPath);
                if (await file.exists()) {
                    await rm(fullPath, { force: true });
                }
            } catch {
                success = false;
            }
        }

        return success;
    }

    /**
     * Copy a file to a new location.
     *
     * @param from - The original file path
     * @param to - The destination path
     * @returns True on success, false on failure
     */
    async copy(from: string, to: string): Promise<boolean> {
        try {
            const source = this.applyPathPrefix(from);
            const destination = this.applyPathPrefix(to);
            await this.ensureDirectory(destination);
            await copyFile(source, destination);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Move a file to a new location.
     *
     * @param from - The original file path
     * @param to - The destination path
     * @returns True on success, false on failure
     */
    async move(from: string, to: string): Promise<boolean> {
        try {
            const source = this.applyPathPrefix(from);
            const destination = this.applyPathPrefix(to);
            await this.ensureDirectory(destination);
            await rename(source, destination);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get the file size of a given file.
     *
     * @param targetPath - The file path
     * @returns The size in bytes, or 0 if file doesn't exist
     */
    async size(targetPath: string): Promise<number> {
        const file = Bun.file(this.applyPathPrefix(targetPath));
        if (!(await file.exists())) {
            return 0;
        }
        return file.size;
    }

    /**
     * Get the file's last modification time.
     *
     * @param targetPath - The file path
     * @returns The UNIX timestamp of the last modification, or 0 on error
     */
    async lastModified(targetPath: string): Promise<number> {
        try {
            const stats = await stat(this.applyPathPrefix(targetPath));
            return Math.floor(stats.mtimeMs / 1000);
        } catch {
            return 0;
        }
    }

    async getVisibility(targetPath: string): Promise<string | null> {
        const file = Bun.file(this.applyPathPrefix(targetPath));
        if (!(await file.exists())) {
            return null;
        }
        return "private";
    }

    async setVisibility(_targetPath: string, _visibility: string): Promise<boolean> {
        // Local filesystem: visibility is a no-op (permissions may be managed externally)
        return true;
    }

    async mimeType(targetPath: string): Promise<string | null> {
        if (!(await this.exists(targetPath))) {
            return null;
        }
        const ext = targetPath.split(".").pop()?.toLowerCase();
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

    async url(targetPath: string): Promise<string> {
        return `/storage/${this.removePathPrefix(this.applyPathPrefix(targetPath))}`;
    }

    async temporaryUrl(path: string, expiresInSeconds: number): Promise<string> {
        const url = await this.url(path);
        const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
        return `${url}?expires=${expires}`;
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
     * @param targetPath - The directory path
     * @returns True on success, false on failure
     */
    async makeDirectory(targetPath: string): Promise<boolean> {
        try {
            await mkdir(this.applyPathPrefix(targetPath), { recursive: true });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Recursively delete a directory.
     *
     * @param directory - The directory path
     * @returns True on success, false on failure
     */
    async deleteDirectory(directory: string): Promise<boolean> {
        try {
            await rm(this.applyPathPrefix(directory), {
                force: true,
                recursive: true,
            });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Helper to scan directories using pure directory parsing.
     *
     * @param directory - The directory to scan
     * @param recursive - Whether to scan recursively
     * @param returnFiles - True to return files, false for directories
     * @returns An array of relative paths
     */
    private async scanDirectory(directory: string, recursive: boolean, returnFiles: boolean): Promise<string[]> {
        const fullDir = directory ? this.applyPathPrefix(directory) : this.root;
        const results: string[] = [];

        try {
            const entries = await readdir(fullDir, {
                recursive,
                withFileTypes: true,
            });

            for (const entry of entries) {
                const isMatch = returnFiles ? entry.isFile() : entry.isDirectory();
                if (isMatch) {
                    const absolutePath = path.join(entry.parentPath || fullDir, entry.name);
                    const rel = this.removePathPrefix(absolutePath);
                    results.push(rel.replace(/\\/g, "/"));
                }
            }

            return results;
        } catch {
            return [];
        }
    }
}
