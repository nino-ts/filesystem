import type { FilesystemDisk } from "../contracts/filesystem";

/**
 * Archive utilities for creating and extracting tar archives.
 *
 * Uses Bun's native {@link Bun.Archive} API for fast tar operations.
 */
export async function create(outputPath: string, paths: string[]): Promise<boolean> {
    try {
        const entries: Record<string, string | Uint8Array> = {};

        for (const filePath of paths) {
            const file = Bun.file(filePath);
            if (!(await file.exists())) {
                continue;
            }
            entries[filePath] = new Uint8Array(await file.arrayBuffer());
        }

        const archive = new Bun.Archive(entries);
        await Bun.write(outputPath, archive);
        return true;
    } catch (_error) {
        return false;
    }
}

/**
 * Extract a tar archive to a directory.
 *
 * @param archivePath - Path to the tar archive
 * @param destination - Destination directory
 * @returns True on success, false on failure
 */
export async function extract(archivePath: string, destination: string): Promise<boolean> {
    try {
        const tarball = await Bun.file(archivePath).bytes();
        const archive = new Bun.Archive(tarball);
        await archive.extract(destination);
        return true;
    } catch (_error) {
        return false;
    }
}

/**
 * Create a tar archive from a directory.
 *
 * @param outputPath - Path for the output tar file
 * @param directory - Directory to archive
 * @param adapter - Filesystem adapter to list files
 * @returns True on success, false on failure
 */
export async function createFromDirectory(
    outputPath: string,
    directory: string,
    adapter: FilesystemDisk,
): Promise<boolean> {
    try {
        const files = await adapter.allFiles(directory);
        const entries: Record<string, string> = {};

        for (const filePath of files) {
            const content = await adapter.get(filePath);
            if (content !== null) {
                entries[filePath] = content;
            }
        }

        const archive = new Bun.Archive(entries);
        await Bun.write(outputPath, archive);
        return true;
    } catch (_error) {
        return false;
    }
}

/**
 * Extract a tar archive to a directory using an adapter.
 *
 * @param archivePath - Path to the tar archive
 * @param destination - Destination directory
 * @param adapter - Filesystem adapter for extraction
 * @returns True on success, false on failure
 */
export async function extractToDirectory(
    archivePath: string,
    destination: string,
    adapter: FilesystemDisk,
): Promise<boolean> {
    try {
        await adapter.makeDirectory(destination);
        return await extract(archivePath, destination);
    } catch (_error) {
        return false;
    }
}

/**
 * Create and download a tar archive as a Blob.
 *
 * @param paths - Array of file paths to include
 * @param adapter - Filesystem adapter to read files
 * @returns Blob containing the tar archive, or null on failure
 */
export async function createBlob(paths: string[], adapter: FilesystemDisk): Promise<Blob | null> {
    try {
        const entries: Record<string, string> = {};

        for (const filePath of paths) {
            const content = await adapter.get(filePath);
            if (content !== null) {
                entries[filePath] = content;
            }
        }

        const archive = new Bun.Archive(entries);
        return await archive.blob();
    } catch (_error) {
        return null;
    }
}

/**
 * List contents of a tar archive.
 *
 * @param archivePath - Path to the tar archive
 * @returns Array of file paths in the archive, or empty array on failure
 */
export async function list(archivePath: string): Promise<string[]> {
    try {
        const tarball = await Bun.file(archivePath).bytes();
        const archive = new Bun.Archive(tarball);
        const files = await archive.files();
        return [...files.keys()];
    } catch (_error) {
        return [];
    }
}

export const ArchiveUtils = {
    create,
    createBlob,
    createFromDirectory,
    extract,
    extractToDirectory,
    list,
};
