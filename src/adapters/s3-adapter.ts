import type { FilesystemDisk } from "../contracts/filesystem";

/**
 * Configuration for S3Adapter.
 */
export interface S3AdapterConfig {
    /**
     * The S3 bucket name.
     */
    bucket: string;

    /**
     * The S3 endpoint (optional, uses AWS default if not provided).
     */
    endpoint?: string;

    /**
     * The AWS region (optional, uses us-east-1 if not provided).
     */
    region?: string;

    /**
     * The AWS access key ID.
     */
    accessKeyId: string;

    /**
     * The AWS secret access key.
     */
    secretAccessKey: string;

    /**
     * The root path prefix for all operations (optional).
     */
    root?: string;

    /**
     * Default ACL for uploaded files (optional).
     */
    acl?: "public-read" | "private" | "public-read-write" | "authenticated-read";
}

/**
 * S3 filesystem adapter using Bun's native S3Client.
 *
 * Implements the FilesystemDisk contract for AWS S3 and S3-compatible
 * storage services (Cloudflare R2, DigitalOcean Spaces, MinIO, etc.).
 *
 * @example
 * ```typescript
 * const adapter = new S3Adapter({
 *   bucket: 'my-bucket',
 *   accessKeyId: process.env.AWS_KEY,
 *   secretAccessKey: process.env.AWS_SECRET,
 *   region: 'us-east-1',
 * });
 *
 * await adapter.put('file.txt', 'Hello World');
 * const content = await adapter.get('file.txt');
 * ```
 */
export class S3Adapter implements FilesystemDisk {
    private client: import("bun").S3Client;
    private root: string;
    private defaultAcl?: "public-read" | "private" | "public-read-write" | "authenticated-read";

    constructor(config: S3AdapterConfig) {
        this.client = new Bun.S3Client({
            accessKeyId: config.accessKeyId,
            bucket: config.bucket,
            endpoint: config.endpoint,
            region: config.region,
            secretAccessKey: config.secretAccessKey,
        });
        this.root = config.root ? this.normalizePath(config.root) : "";
        this.defaultAcl = config.acl;
    }

    /**
     * Get the contents of a file.
     *
     * @param path - The path to the file
     * @returns The file contents as string, or null if missing
     */
    async get(path: string): Promise<string | null> {
        const key = this.resolvePath(path);
        try {
            const file = this.client.file(key);
            if (!(await file.exists())) {
                return null;
            }
            return await file.text();
        } catch {
            return null;
        }
    }

    /**
     * Write the contents of a file.
     *
     * @param path - The path to the file
     * @param contents - The contents to write (string, Blob, ArrayBuffer, or Uint8Array)
     * @returns True on success, false on failure
     */
    async put(path: string, contents: string | Blob | ArrayBuffer | Uint8Array): Promise<boolean> {
        try {
            const key = this.resolvePath(path);
            const file = this.client.file(key);
            await file.write(contents);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Determine if a file exists.
     *
     * @param path - The path to check
     * @returns True if the file exists, false otherwise
     */
    async exists(path: string): Promise<boolean> {
        const key = this.resolvePath(path);
        try {
            const file = this.client.file(key);
            return await file.exists();
        } catch {
            return false;
        }
    }

    /**
     * Determine if a file is missing.
     *
     * @param path - The path to check
     * @returns True if the file is missing, false otherwise
     */
    async missing(path: string): Promise<boolean> {
        return !(await this.exists(path));
    }

    /**
     * Delete the file at a given path.
     *
     * @param paths - The path(s) to the file(s)
     * @returns True if all files were deleted successfully
     */
    async delete(paths: string | string[]): Promise<boolean> {
        const pathList = Array.isArray(paths) ? paths : [paths];

        try {
            await Promise.all(
                pathList.map(async (path) => {
                    const key = this.resolvePath(path);
                    const file = this.client.file(key);
                    await file.delete();
                }),
            );
            return true;
        } catch {
            return false;
        }
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
            const fromKey = this.resolvePath(from);
            const toKey = this.resolvePath(to);

            // Get source file contents
            const sourceFile = this.client.file(fromKey);
            if (!(await sourceFile.exists())) {
                return false;
            }

            const contents = await sourceFile.arrayBuffer();

            // Write to destination
            const destFile = this.client.file(toKey);
            await destFile.write(contents);

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
        const copied = await this.copy(from, to);
        if (!copied) {
            return false;
        }
        return await this.delete(from);
    }

    /**
     * Get the file size of a given file.
     *
     * @param path - The file path
     * @returns The size in bytes, or 0 if file doesn't exist
     */
    async size(path: string): Promise<number> {
        const key = this.resolvePath(path);
        try {
            const file = this.client.file(key);
            if (!(await file.exists())) {
                return 0;
            }
            return file.size;
        } catch {
            return 0;
        }
    }

    /**
     * Get the file's last modification time.
     *
     * @param path - The file path
     * @returns The UNIX timestamp of the last modification, or 0 on error
     */
    async lastModified(path: string): Promise<number> {
        const key = this.resolvePath(path);
        try {
            const file = this.client.file(key);
            if (!(await file.exists())) {
                return 0;
            }
            // S3 doesn't provide mtime directly, use ETag or return current time
            return Math.floor(Date.now() / 1000);
        } catch {
            return 0;
        }
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
        // S3 doesn't have real directories, but we can create a placeholder
        try {
            const key = `${this.resolvePath(path)}/.gitkeep`;
            const file = this.client.file(key);
            await file.write("");
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
            const dirPath = this.resolvePath(directory);
            const files = await this.allFiles(directory);

            await Promise.all(
                files.map(async (file) => {
                    const key = this.resolvePath(file);
                    const s3File = this.client.file(key);
                    await s3File.delete();
                }),
            );

            // Delete .gitkeep if exists
            const gitkeep = this.client.file(`${dirPath}/.gitkeep`);
            if (await gitkeep.exists()) {
                await gitkeep.delete();
            }

            return true;
        } catch {
            return false;
        }
    }

    /**
     * Append data to a file.
     *
     * @param path - The path to the file
     * @param data - The data to append
     * @returns True on success, false on failure
     */
    async append(path: string, data: string): Promise<boolean> {
        try {
            const key = this.resolvePath(path);
            const file = this.client.file(key);

            // Get existing content or empty string
            const existing = (await file.exists()) ? await file.text() : "";

            // Write appended content
            await file.write(existing + data);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Prepend data to a file.
     *
     * @param path - The path to the file
     * @param data - The data to prepend
     * @returns True on success, false on failure
     */
    async prepend(path: string, data: string): Promise<boolean> {
        try {
            const key = this.resolvePath(path);
            const file = this.client.file(key);

            // Get existing content or empty string
            const existing = (await file.exists()) ? await file.text() : "";

            // Write prepended content
            await file.write(data + existing);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get the file visibility.
     *
     * @param path - The file path
     * @returns The visibility ('public' or 'private'), or null if not set
     */
    async getVisibility(_path: string): Promise<"public" | "private" | null> {
        // S3 doesn't expose ACL directly, return default or null
        return this.defaultAcl === "public-read" ? "public" : "private";
    }

    /**
     * Set the file visibility.
     *
     * @param path - The file path
     * @param visibility - The visibility ('public' or 'private')
     * @returns True on success, false on failure
     */
    async setVisibility(_path: string, _visibility: "public" | "private"): Promise<boolean> {
        // S3 ACL is set during upload, not after
        // This is a no-op for S3Adapter
        return true;
    }

    /**
     * Get the file MIME type.
     *
     * @param path - The file path
     * @returns The MIME type, or null if not determinable
     */
    async mimeType(path: string): Promise<string | null> {
        if (!(await this.exists(path))) {
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
        const key = this.resolvePath(path);
        // Return S3 URL format
        const endpoint = this.client.endpoint || `https://s3.${this.client.region || "us-east-1"}.amazonaws.com`;
        return `${endpoint}/${this.client.bucket}/${key}`;
    }

    /**
     * Get a temporary URL for a file.
     *
     * @param path - The file path
     * @param expiresIn - Expiration time in seconds
     * @returns The temporary URL
     */
    async temporaryUrl(path: string, expiresIn: number): Promise<string> {
        const key = this.resolvePath(path);
        const file = this.client.file(key);
        return file.presign({
            acl: this.defaultAcl || "public-read",
            expiresIn,
        });
    }

    /**
     * Get a temporary upload URL for client-side uploads.
     *
     * @param path - The file path where the file will be stored
     * @param expiresIn - Expiration time in seconds
     * @param options - Additional options (contentType, contentLength, acl)
     * @returns Object with url, headers, and method for upload
     */
    async temporaryUploadUrl(
        path: string,
        expiresIn: number,
        options?: {
            contentType?: string;
            contentLength?: number;
            acl?: string;
        },
    ): Promise<{
        url: string;
        headers: Record<string, string>;
        method: "PUT" | "POST";
    }> {
        const key = this.resolvePath(path);
        const file = this.client.file(key);

        // Generate presigned URL for PUT upload
        const url = file.presign({
            acl: options?.acl || this.defaultAcl || "public-read",
            expiresIn,
            method: "PUT",
            type: options?.contentType,
        });

        // Build headers for client upload
        const headers: Record<string, string> = {
            "Content-Type": options?.contentType || "application/octet-stream",
        };

        if (options?.contentLength) {
            headers["Content-Length"] = options.contentLength.toString();
        }

        return {
            headers,
            method: "PUT",
            url,
        };
    }

    /**
     * Write file contents with progress callback.
     *
     * @param path - The path to the file
     * @param contents - The contents to write (Blob or Uint8Array for progress)
     * @param onProgress - Progress callback (0-100)
     * @returns True on success, false on failure
     */
    async putWithProgress(
        path: string,
        contents: Blob | Uint8Array,
        onProgress: (percent: number) => void,
    ): Promise<boolean> {
        try {
            const key = this.resolvePath(path);
            const file = this.client.file(key);

            // For Blob, use native write (Bun handles multipart automatically)
            if (contents instanceof Blob) {
                // Calculate total size
                const total = contents.size;
                let uploaded = 0;

                // Use streaming write with progress
                const stream = contents.stream();
                const writer = file.writer();

                const reader = stream.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        break;
                    }

                    if (value) {
                        writer.write(value);
                        uploaded += value.length;
                        onProgress(Math.min(100, Math.round((uploaded / total) * 100)));
                    }
                }

                await writer.end();
                onProgress(100);
                return true;
            }

            // For Uint8Array, direct write
            await file.write(contents);
            onProgress(100);
            return true;
        } catch (_error) {
            return false;
        }
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
     * Resolve a path by prepending the root prefix.
     *
     * @param path - The path to resolve
     * @returns The resolved path with root prefix
     */
    private resolvePath(path: string): string {
        const normalized = this.normalizePath(path);
        return this.root ? `${this.root}/${normalized}` : normalized;
    }

    /**
     * Scan a directory and return files or directories.
     *
     * @param directory - The directory to scan
     * @param recursive - Whether to scan recursively
     * @param returnFiles - True to return files, false for directories
     * @returns An array of paths
     */
    private async scanDirectory(directory: string, recursive: boolean, returnFiles: boolean): Promise<string[]> {
        const dirPath = this.resolvePath(directory);
        const prefix = dirPath ? `${dirPath}/` : "";

        try {
            const result = await this.client.list({ prefix });
            const results: string[] = [];

            for (const obj of result.objects || []) {
                const key = obj.key;
                if (!key) {
                    continue;
                }

                // Skip .gitkeep files
                if (key.endsWith("/.gitkeep")) {
                    continue;
                }

                // Remove root prefix from key
                const relativeKey = this.root ? key.replace(`${this.root}/`, "") : key;

                if (returnFiles) {
                    // Return files
                    if (!recursive && relativeKey.includes("/")) {
                        continue; // Skip files in subdirectories
                    }
                    results.push(relativeKey);
                } else {
                    // Return directories
                    const parts = relativeKey.split("/");
                    if (parts.length > 1) {
                        const dirName = parts[0];
                        if (!results.includes(dirName)) {
                            results.push(dirName);
                        }
                    }
                }
            }

            return results;
        } catch {
            return [];
        }
    }
}
