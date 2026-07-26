import type { FilesystemDisk } from "../contracts/filesystem";

/**
 * Options for CompressedAdapter.
 */
export interface CompressedAdapterOptions {
    /**
     * File extensions to compress.
     * @default All files
     */
    extensions?: string[];

    /**
     * Minimum file size to compress (in bytes).
     * @default 0 (compress all)
     */
    minSize?: number;

    /**
     * Compression level (1-9).
     * @default 6
     */
    level?: number;
}

/**
 * Compressed filesystem decorator.
 *
 * Wraps another filesystem adapter and transparently compresses/decompresses
 * files using Bun's native gzip/gunzip APIs.
 *
 * @example
 * ```typescript
 * const local = new LocalAdapter({ root: './storage' });
 * const compressed = new CompressedAdapter(local, { level: 9 });
 *
 * // Files are automatically compressed on write
 * await compressed.put('large-file.txt', 'Large content...');
 *
 * // Files are automatically decompressed on read
 * const content = await compressed.get('large-file.txt');
 * ```
 */
export class CompressedAdapter implements FilesystemDisk {
    private adapter: FilesystemDisk;
    private extensions?: string[];
    private minSize: number;
    private level: number;

    constructor(adapter: FilesystemDisk, options: CompressedAdapterOptions = {}) {
        this.adapter = adapter;
        this.extensions = options.extensions;
        this.minSize = options.minSize ?? 0;
        this.level = options.level ?? 6;
    }

    /**
     * Check if a file should be compressed.
     */
    private shouldCompress(path: string, contents: string | Blob | ArrayBuffer | Uint8Array): boolean {
        // Check extension filter
        if (this.extensions) {
            const ext = path.split(".").pop()?.toLowerCase();
            if (ext && !this.extensions.includes(ext)) {
                return false;
            }
        }

        // Check minimum size
        const size = this.getContentSize(contents);
        if (size < this.minSize) {
            return false;
        }

        return true;
    }

    /**
     * Get the size of content.
     */
    private getContentSize(contents: string | Blob | ArrayBuffer | Uint8Array): number {
        if (typeof contents === "string") {
            return new TextEncoder().encode(contents).length;
        }
        if (contents instanceof Blob) {
            return contents.size;
        }
        if (contents instanceof ArrayBuffer) {
            return contents.byteLength;
        }
        return contents.length;
    }

    /**
     * Get the contents of a file (decompressed if needed).
     */
    async get(path: string): Promise<string | null> {
        const compressedPath = path.endsWith(".gz") ? path : `${path}.gz`;

        // Try compressed version first
        const data = await this.adapter.get(compressedPath);
        if (data) {
            try {
                const decompressed = await Bun.gunzip(data);
                return new TextDecoder().decode(decompressed);
            } catch {
                // If decompression fails, return as-is
                return data;
            }
        }

        // Fall back to uncompressed version
        return this.adapter.get(path);
    }

    /**
     * Write the contents of a file (compressed if applicable).
     */
    async put(path: string, contents: string | Blob | ArrayBuffer | Uint8Array): Promise<boolean> {
        if (this.shouldCompress(path, contents)) {
            const compressedPath = path.endsWith(".gz") ? path : `${path}.gz`;

            try {
                // Convert to Uint8Array if needed
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

                // Compress and write
                const compressed = await Bun.gzip(data, { level: this.level });
                return this.adapter.put(compressedPath, compressed);
            } catch (_error) {
                return false;
            }
        }

        // Write uncompressed
        return this.adapter.put(path, contents);
    }

    // Delegate other methods to the wrapped adapter

    async exists(path: string): Promise<boolean> {
        const exists = await this.adapter.exists(path);
        if (exists) {
            return true;
        }

        // Check compressed version
        const compressedPath = path.endsWith(".gz") ? path : `${path}.gz`;
        return this.adapter.exists(compressedPath);
    }

    async missing(path: string): Promise<boolean> {
        return !(await this.exists(path));
    }

    async delete(paths: string | string[]): Promise<boolean> {
        const pathList = Array.isArray(paths) ? paths : [paths];

        // Delete both compressed and uncompressed versions
        for (const path of pathList) {
            await this.adapter.delete(path);
            await this.adapter.delete(`${path}.gz`);
        }

        return true;
    }

    async copy(from: string, to: string): Promise<boolean> {
        // Try compressed version first
        const compressedFrom = from.endsWith(".gz") ? from : `${from}.gz`;
        const compressedTo = to.endsWith(".gz") ? to : `${to}.gz`;

        if (await this.adapter.exists(compressedFrom)) {
            return this.adapter.copy(compressedFrom, compressedTo);
        }

        return this.adapter.copy(from, to);
    }

    async move(from: string, to: string): Promise<boolean> {
        const copied = await this.copy(from, to);
        if (copied) {
            await this.delete(from);
            return true;
        }
        return false;
    }

    async size(path: string): Promise<number> {
        // Return compressed size if available
        const compressedPath = path.endsWith(".gz") ? path : `${path}.gz`;
        const compressedSize = await this.adapter.size(compressedPath);
        if (compressedSize > 0) {
            return compressedSize;
        }
        return this.adapter.size(path);
    }

    async lastModified(path: string): Promise<number> {
        return this.adapter.lastModified(path);
    }

    async files(directory?: string): Promise<string[]> {
        const files = await this.adapter.files(directory);
        // Remove .gz extension from results
        return files.map((file) => file.replace(/\.gz$/, ""));
    }

    async allFiles(directory?: string): Promise<string[]> {
        const files = await this.adapter.allFiles(directory);
        return files.map((file) => file.replace(/\.gz$/, ""));
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
        // For append, we need to decompress, append, and recompress
        const existing = (await this.get(path)) || "";
        return this.put(path, existing + data);
    }

    async prepend(path: string, data: string): Promise<boolean> {
        // For prepend, we need to decompress, prepend, and recompress
        const existing = (await this.get(path)) || "";
        return this.put(path, data + existing);
    }

    async getVisibility(path: string): Promise<"public" | "private" | null> {
        return this.adapter.getVisibility(path);
    }

    async setVisibility(path: string, visibility: "public" | "private"): Promise<boolean> {
        return this.adapter.setVisibility(path, visibility);
    }

    async mimeType(path: string): Promise<string | null> {
        return this.adapter.mimeType(path.replace(/\.gz$/, ""));
    }

    async url(path: string): Promise<string> {
        return this.adapter.url(path);
    }

    async temporaryUrl(path: string, expiresIn: number): Promise<string> {
        return this.adapter.temporaryUrl(path, expiresIn);
    }

    /**
     * Get compression statistics.
     */
    async getCompressionStats(path: string): Promise<{
        originalSize: number;
        compressedSize: number;
        ratio: number;
    } | null> {
        const compressedPath = path.endsWith(".gz") ? path : `${path}.gz`;
        const compressedSize = await this.adapter.size(compressedPath);

        if (compressedSize === 0) {
            return null;
        }

        // Get uncompressed content to calculate original size
        const content = await this.get(path);
        if (!content) {
            return null;
        }

        const originalSize = new TextEncoder().encode(content).length;
        const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(2);

        return {
            compressedSize,
            originalSize,
            ratio: parseFloat(ratio),
        };
    }
}
