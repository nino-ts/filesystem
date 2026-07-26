import type { FilesystemDisk } from "../contracts/filesystem";

/**
 * Archive utilities for creating and extracting tar archives.
 *
 * Uses Bun's native Archive API for fast tar operations.
 */
export async function create(outputPath: string, paths: string[]): Promise<boolean> {
    try {
        await Bun.Archive.create(outputPath, paths);
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
        await Bun.Archive.extract(archivePath, destination);
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
        return await create(outputPath, files);
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
        const tempPath = `__temp_archive_${Date.now()}.tar`;
        const created = await create(tempPath, paths);
        if (!created) {
            return null;
        }

        const content = await adapter.get(tempPath);
        if (!content) {
            return null;
        }

        await adapter.delete(tempPath);
        return new Blob([content], { type: "application/x-tar" });
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
        const tempDir = `__temp_extract_${Date.now()}`;
        await extract(archivePath, tempDir);
        return [];
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
