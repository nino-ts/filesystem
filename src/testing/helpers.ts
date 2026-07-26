import crypto from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { LocalAdapter } from "../adapters/local-adapter";
import { MemoryAdapter } from "../adapters/memory-adapter";
import type { FilesystemDisk } from "../contracts/filesystem";

/**
 * Options for creating a test adapter.
 */
export interface CreateTestAdapterOptions {
    /**
     * Type of adapter to create ('local' or 'memory').
     * @default 'local'
     */
    type?: "local" | "memory";
}

/**
 * Result of creating a test adapter.
 */
export interface TestAdapterResult {
    /**
     * The filesystem adapter instance.
     */
    adapter: FilesystemDisk;
    /**
     * Cleanup function to remove test files.
     */
    cleanup: () => Promise<void>;
}

/**
 * Create a test adapter with isolated storage.
 *
 * @param options - Configuration options
 * @returns Adapter instance and cleanup function
 *
 * @example
 * ```typescript
 * const { adapter, cleanup } = await createTestAdapter();
 * await adapter.put('file.txt', 'Content');
 * await cleanup();
 * ```
 */
export async function createTestAdapter(options: CreateTestAdapterOptions = {}): Promise<TestAdapterResult> {
    const type = options.type ?? "local";

    if (type === "memory") {
        return {
            adapter: new MemoryAdapter(),
            cleanup: async () => {
                // Memory adapter doesn't need cleanup
            },
        };
    }

    // Local adapter with temporary directory
    const tempDir = path.join(
        process.cwd(),
        "tests",
        "var",
        "filesystem",
        `test-${Date.now()}-${crypto.randomUUID().split("-")[0]}`,
    );

    await mkdir(tempDir, { recursive: true });

    const adapter = new LocalAdapter({ root: tempDir });

    return {
        adapter,
        cleanup: async () => {
            await rm(tempDir, { force: true, recursive: true });
        },
    };
}

/**
 * Assert that a file exists on the given disk.
 *
 * @param disk - The filesystem disk to check
 * @param path - The path to the file
 * @throws Error if the file does not exist
 *
 * @example
 * ```typescript
 * await assertExists(adapter, 'file.txt');
 * ```
 */
export async function assertExists(disk: FilesystemDisk, path: string): Promise<void> {
    if (!(await disk.exists(path))) {
        throw new Error(`File [${path}] does not exist`);
    }
}

/**
 * Assert that a file is missing from the given disk.
 *
 * @param disk - The filesystem disk to check
 * @param path - The path to the file
 * @throws Error if the file exists
 *
 * @example
 * ```typescript
 * await assertMissing(adapter, 'deleted.txt');
 * ```
 */
export async function assertMissing(disk: FilesystemDisk, path: string): Promise<void> {
    if (await disk.exists(path)) {
        throw new Error(`File [${path}] exists but should not`);
    }
}

/**
 * Run a standard suite of filesystem adapter tests.
 *
 * This function provides a reusable test suite that can be used to verify
 * that any adapter implementation conforms to the FilesystemDisk contract.
 *
 * @param name - Name of the adapter being tested
 * @param createAdapter - Function to create a fresh adapter instance
 *
 * @example
 * ```typescript
 * runFilesystemAdapterTests('LocalAdapter', async () => {
 *   const { adapter, cleanup } = await createTestAdapter({ type: 'local' });
 *   return { adapter, cleanup };
 * });
 * ```
 */
export function runFilesystemAdapterTests(
    name: string,
    createAdapter: () => Promise<{
        adapter: FilesystemDisk;
        cleanup: () => Promise<void>;
    }>,
): void {
    describe(name, () => {
        let adapter: FilesystemDisk;
        let cleanup: () => Promise<void>;

        beforeEach(async () => {
            const result = await createAdapter();
            adapter = result.adapter;
            cleanup = result.cleanup;
        });

        afterEach(async () => {
            await cleanup();
        });

        describe("put() and get()", () => {
            test("put() writes string content and get() reads it back", async () => {
                await adapter.put("file.txt", "Hello World");
                const content = await adapter.get("file.txt");
                expect(content).toBe("Hello World");
            });

            test("put() overwrites existing file", async () => {
                await adapter.put("file.txt", "First");
                await adapter.put("file.txt", "Second");
                const content = await adapter.get("file.txt");
                expect(content).toBe("Second");
            });

            test("get() returns null for missing file", async () => {
                const content = await adapter.get("missing.txt");
                expect(content).toBe(null);
            });
        });

        describe("exists() and missing()", () => {
            test("exists() returns true for existing file", async () => {
                await adapter.put("exists.txt", "Content");
                expect(await adapter.exists("exists.txt")).toBe(true);
            });

            test("exists() returns false for missing file", async () => {
                expect(await adapter.exists("missing.txt")).toBe(false);
            });

            test("missing() is inverse of exists()", async () => {
                await adapter.put("file.txt", "Content");
                expect(await adapter.missing("file.txt")).toBe(false);
                expect(await adapter.missing("missing.txt")).toBe(true);
            });
        });

        describe("delete()", () => {
            test("delete() removes single file", async () => {
                await adapter.put("todelete.txt", "Content");
                const deleted = await adapter.delete("todelete.txt");
                expect(deleted).toBe(true);
                expect(await adapter.exists("todelete.txt")).toBe(false);
            });

            test("delete() removes multiple files", async () => {
                await adapter.put("del1.txt", "1");
                await adapter.put("del2.txt", "2");
                const deleted = await adapter.delete(["del1.txt", "del2.txt"]);
                expect(deleted).toBe(true);
                expect(await adapter.exists("del1.txt")).toBe(false);
                expect(await adapter.exists("del2.txt")).toBe(false);
            });
        });

        describe("copy() and move()", () => {
            test("copy() duplicates file", async () => {
                await adapter.put("source.txt", "Content");
                const copied = await adapter.copy("source.txt", "dest.txt");
                expect(copied).toBe(true);
                expect(await adapter.get("dest.txt")).toBe("Content");
                expect(await adapter.get("source.txt")).toBe("Content");
            });

            test("move() relocates file", async () => {
                await adapter.put("source.txt", "Content");
                const moved = await adapter.move("source.txt", "dest.txt");
                expect(moved).toBe(true);
                expect(await adapter.get("dest.txt")).toBe("Content");
                expect(await adapter.exists("source.txt")).toBe(false);
            });
        });

        describe("size() and lastModified()", () => {
            test("size() returns file size in bytes", async () => {
                const content = "Hello World";
                await adapter.put("file.txt", content);
                const size = await adapter.size("file.txt");
                expect(size).toBe(Buffer.byteLength(content));
            });

            test("size() returns 0 for missing file", async () => {
                const size = await adapter.size("missing.txt");
                expect(size).toBe(0);
            });

            test("lastModified() returns timestamp", async () => {
                await adapter.put("file.txt", "Content");
                const timestamp = await adapter.lastModified("file.txt");
                expect(timestamp).toBeGreaterThan(0);
            });
        });

        describe("directories", () => {
            test("makeDirectory() creates directory", async () => {
                const result = await adapter.makeDirectory("subdir");
                expect(result).toBe(true);
            });

            test("files() lists files in directory", async () => {
                await adapter.put("file1.txt", "1");
                await adapter.put("file2.txt", "2");
                const files = await adapter.files();
                expect(files).toContain("file1.txt");
                expect(files).toContain("file2.txt");
            });

            test("deleteDirectory() removes directory", async () => {
                await adapter.makeDirectory("subdir");
                await adapter.put("subdir/file.txt", "Content");
                await adapter.deleteDirectory("subdir");
                expect(await adapter.exists("subdir/file.txt")).toBe(false);
            });
        });

        describe("append() and prepend()", () => {
            test("append() adds data to end of file", async () => {
                await adapter.put("file.txt", "Hello");
                await adapter.append("file.txt", " World");
                const content = await adapter.get("file.txt");
                expect(content).toBe("Hello World");
            });

            test("prepend() adds data to beginning of file", async () => {
                await adapter.put("file.txt", "World");
                await adapter.prepend("file.txt", "Hello ");
                const content = await adapter.get("file.txt");
                expect(content).toBe("Hello World");
            });
        });
    });
}
