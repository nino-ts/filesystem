/**
 * Contract defining standard filesystem storage operations.
 *
 * This matches the flexibility found in Laravel's Storage facade and Flysystem,
 * allowing application code to remain entirely agnostic to where files
 * are physically stored (local disk, cloud, etc.).
 */
export interface FilesystemDisk {
    /**
     * Determine if a file exists.
     *
     * @param path - The path to check
     * @returns A promise resolving to true if it exists, false otherwise
     */
    exists(path: string): Promise<boolean>;

    /**
     * Get the contents of a file.
     *
     * @param path - The path to the file
     * @returns A promise resolving to the string contents, or null if missing
     */
    get(path: string): Promise<string | null>;

    /**
     * Write the contents of a file.
     *
     * @param path - The path to the file
     * @param contents - The contents to write
     * @returns A promise resolving to true on success
     */
    put(path: string, contents: string | Blob | ArrayBuffer | Uint8Array): Promise<boolean>;

    /**
     * Delete the file at a given path.
     *
     * @param path - The path(s) to the file
     * @returns A promise resolving to true on success
     */
    delete(path: string | string[]): Promise<boolean>;

    /**
     * Copy a file to a new location.
     *
     * @param from - The original file path
     * @param to - The destination path
     * @returns A promise resolving to true on success
     */
    copy(from: string, to: string): Promise<boolean>;

    /**
     * Move a file to a new location.
     *
     * @param from - The original file path
     * @param to - The destination path
     * @returns A promise resolving to true on success
     */
    move(from: string, to: string): Promise<boolean>;

    /**
     * Get the file size of a given file.
     *
     * @param path - The file path
     * @returns A promise resolving to the size in bytes
     */
    size(path: string): Promise<number>;

    /**
     * Get the file's last modification time.
     *
     * @param path - The file path
     * @returns A promise resolving to the UNIX timestamp of the last modification
     */
    lastModified(path: string): Promise<number>;

    /**
     * Get an array of all files in a directory.
     *
     * @param directory - The directory path
     * @returns A promise resolving to an array of file paths
     */
    files(directory?: string): Promise<string[]>;

    /**
     * Get all of the files from the given directory (recursive).
     *
     * @param directory - The directory path
     * @returns A promise resolving to an array of all file paths
     */
    allFiles(directory?: string): Promise<string[]>;

    /**
     * Get all of the directories within a given directory.
     *
     * @param directory - The directory path
     * @returns A promise resolving to an array of directory paths
     */
    directories(directory?: string): Promise<string[]>;

    /**
     * Get all (recursive) of the directories within a given directory.
     *
     * @param directory - The directory path
     * @returns A promise resolving to an array of all directory paths
     */
    allDirectories(directory?: string): Promise<string[]>;

    /**
     * Create a directory.
     *
     * @param path - The directory path
     * @returns A promise resolving to true on success
     */
    makeDirectory(path: string): Promise<boolean>;

    /**
     * Recursively delete a directory.
     *
     * @param directory - The directory path
     * @returns A promise resolving to true on success
     */
    deleteDirectory(directory: string): Promise<boolean>;

    /**
     * Append to a file.
     *
     * @param path - The file path
     * @param data - The data to append
     * @returns A promise resolving to true on success
     */
    append(path: string, data: string): Promise<boolean>;

    /**
     * Get the visibility of a file (public/private).
     */
    getVisibility(path: string): Promise<string | null>;

    /**
     * Set the visibility of a file.
     */
    setVisibility(path: string, visibility: string): Promise<boolean>;

    /**
     * Get the MIME type of a file.
     */
    mimeType(path: string): Promise<string | null>;

    /**
     * Get a public URL for the file.
     */
    url(path: string): Promise<string>;

    /**
     * Create a temporary signed URL for the file.
     */
    temporaryUrl(path: string, expiresInSeconds: number): Promise<string>;
}
