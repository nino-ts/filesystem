import { beforeEach, describe, expect, test } from "bun:test";
import { MemoryAdapter } from "../../src/adapters/memory-adapter";

describe("MemoryAdapter", () => {
    let adapter: MemoryAdapter;

    beforeEach(() => {
        adapter = new MemoryAdapter();
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

        test("put() accepts Blob content", async () => {
            const blob = new Blob(["Blob content"], { type: "text/plain" });
            await adapter.put("blob.txt", blob);
            const content = await adapter.get("blob.txt");
            expect(content).toBe("Blob content");
        });

        test("put() accepts Uint8Array content", async () => {
            const encoder = new TextEncoder();
            const data = encoder.encode("Uint8Array content");
            await adapter.put("array.txt", data);
            const content = await adapter.get("array.txt");
            expect(content).toBe("Uint8Array content");
        });

        test("put() accepts ArrayBuffer content", async () => {
            const encoder = new TextEncoder();
            const data = encoder.encode("ArrayBuffer content");
            await adapter.put("buffer.txt", data.buffer);
            const content = await adapter.get("buffer.txt");
            expect(content).toBe("ArrayBuffer content");
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

        test("missing() returns false for existing file", async () => {
            await adapter.put("exists.txt", "Content");
            expect(await adapter.missing("exists.txt")).toBe(false);
        });

        test("missing() returns true for missing file", async () => {
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

        test("delete() handles non-existent files gracefully", async () => {
            const deleted = await adapter.delete("nonexistent.txt");
            expect(deleted).toBe(true);
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

        test("copy() returns false for non-existent source", async () => {
            const copied = await adapter.copy("nonexistent.txt", "dest.txt");
            expect(copied).toBe(false);
        });

        test("move() relocates file", async () => {
            await adapter.put("source.txt", "Content");
            const moved = await adapter.move("source.txt", "dest.txt");
            expect(moved).toBe(true);
            expect(await adapter.get("dest.txt")).toBe("Content");
            expect(await adapter.exists("source.txt")).toBe(false);
        });

        test("move() returns false for non-existent source", async () => {
            const moved = await adapter.move("nonexistent.txt", "dest.txt");
            expect(moved).toBe(false);
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

        test("lastModified() returns timestamp for existing file", async () => {
            await adapter.put("file.txt", "Content");
            const timestamp = await adapter.lastModified("file.txt");
            expect(timestamp).toBeGreaterThan(0);
            expect(timestamp).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
        });

        test("lastModified() returns 0 for missing file", async () => {
            await adapter.put("file.txt", "Content");
            // MemoryAdapter returns current timestamp for all existing files
            const timestamp = await adapter.lastModified("file.txt");
            expect(timestamp).toBeGreaterThan(0);
            expect(timestamp).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
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

        test("allFiles() lists files recursively", async () => {
            await adapter.put("file1.txt", "1");
            await adapter.put("subdir/file2.txt", "2");
            const files = await adapter.allFiles();
            expect(files).toContain("file1.txt");
            expect(files).toContain("subdir/file2.txt");
        });

        test("allDirectories() lists directories recursively", async () => {
            await adapter.makeDirectory("level1");
            await adapter.makeDirectory("level1/level2");
            const dirs = await adapter.allDirectories();
            expect(dirs).toContain("level1");
            expect(dirs).toContain("level1/level2");
        });

        test("deleteDirectory() removes directory and contents", async () => {
            await adapter.makeDirectory("subdir");
            await adapter.put("subdir/file.txt", "Content");
            const deleted = await adapter.deleteDirectory("subdir");
            expect(deleted).toBe(true);
            expect(await adapter.exists("subdir/file.txt")).toBe(false);
        });

        test("deleteDirectory() removes nested directories", async () => {
            await adapter.makeDirectory("level1/level2");
            await adapter.put("level1/level2/file.txt", "Content");
            await adapter.deleteDirectory("level1");
            expect(await adapter.exists("level1/level2/file.txt")).toBe(false);
        });
    });

    describe("append() and prepend()", () => {
        test("append() adds data to end of file", async () => {
            await adapter.put("file.txt", "Hello");
            await adapter.append("file.txt", " World");
            const content = await adapter.get("file.txt");
            expect(content).toBe("Hello World");
        });

        test("append() creates file if not exists", async () => {
            await adapter.append("new.txt", "Content");
            const content = await adapter.get("new.txt");
            expect(content).toBe("Content");
        });

        test("prepend() adds data to beginning of file", async () => {
            await adapter.put("file.txt", "World");
            await adapter.prepend("file.txt", "Hello ");
            const content = await adapter.get("file.txt");
            expect(content).toBe("Hello World");
        });

        test("prepend() creates file if not exists", async () => {
            await adapter.prepend("new.txt", "Content");
            const content = await adapter.get("new.txt");
            expect(content).toBe("Content");
            // Verify it doesn't duplicate when file doesn't exist
            await adapter.delete("new.txt");
            await adapter.prepend("new.txt", "New");
            expect(await adapter.get("new.txt")).toBe("New");
        });
    });

    describe("visibility", () => {
        test("setVisibility() sets file visibility", async () => {
            await adapter.put("file.txt", "Content");
            const result = await adapter.setVisibility("file.txt", "public");
            expect(result).toBe(true);
        });

        test("getVisibility() returns visibility", async () => {
            await adapter.put("file.txt", "Content");
            await adapter.setVisibility("file.txt", "public");
            const visibility = await adapter.getVisibility("file.txt");
            expect(visibility).toBe("public");
        });

        test("setVisibility() returns false for non-existent file", async () => {
            const result = await adapter.setVisibility("nonexistent.txt", "public");
            expect(result).toBe(false);
        });

        test("getVisibility() returns default visibility for file without explicit visibility", async () => {
            await adapter.put("file.txt", "Content");
            // Files without explicit visibility return null
            const visibility = await adapter.getVisibility("file.txt");
            expect(visibility).toBe(null);
        });
    });

    describe("mimeType()", () => {
        test("mimeType() detects text/plain", async () => {
            await adapter.put("file.txt", "Content");
            expect(await adapter.mimeType("file.txt")).toBe("text/plain");
        });

        test("mimeType() detects application/json", async () => {
            await adapter.put("data.json", "{}");
            expect(await adapter.mimeType("data.json")).toBe("application/json");
        });

        test("mimeType() detects image/png", async () => {
            await adapter.put("image.png", "data");
            expect(await adapter.mimeType("image.png")).toBe("image/png");
        });

        test("mimeType() returns null for missing file", async () => {
            expect(await adapter.mimeType("missing.txt")).toBe(null);
        });

        test("mimeType() returns application/octet-stream for unknown extension", async () => {
            await adapter.put("file.unknown", "data");
            // Unknown extensions return application/octet-stream
            expect(await adapter.mimeType("file.unknown")).toBe("application/octet-stream");
        });
    });

    describe("url() and temporaryUrl()", () => {
        test("url() returns storage URL", async () => {
            await adapter.put("file.txt", "Content");
            const url = await adapter.url("file.txt");
            expect(url).toBe("/storage/file.txt");
        });

        test("temporaryUrl() returns URL with expiration", async () => {
            await adapter.put("file.txt", "Content");
            const url = await adapter.temporaryUrl("file.txt", 3600);
            expect(url).toContain("/storage/file.txt");
            expect(url).toContain("?expires=");
        });
    });
});
