import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { LocalAdapter } from "../../src/adapters/local-adapter";

const tempDrive = path.join(process.cwd(), "tests", "var", "storage");
const adapter = new LocalAdapter({ root: tempDrive });

beforeAll(async () => {
    await rm(tempDrive, { force: true, recursive: true }).catch(() => {});
    await mkdir(tempDrive, { recursive: true });
});

afterAll(async () => {
    await rm(tempDrive, { force: true, recursive: true }).catch(() => {});
});

describe("LocalAdapter - put() and get()", () => {
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

    test("put() creates nested directories automatically", async () => {
        await adapter.put("nested/deep/path/file.txt", "Content");
        const content = await adapter.get("nested/deep/path/file.txt");
        expect(content).toBe("Content");
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

    test("get() returns null for missing file", async () => {
        const content = await adapter.get("missing.txt");
        expect(content).toBe(null);
    });

    test("get() preserves unicode characters", async () => {
        await adapter.put("unicode.txt", "Hello 世界 🌍");
        const content = await adapter.get("unicode.txt");
        expect(content).toBe("Hello 世界 🌍");
    });
});

describe("LocalAdapter", () => {
    test("put and get files", async () => {
        const success = await adapter.put("test.txt", "Hello Flysystem");
        expect(success).toBe(true);

        const content = await adapter.get("test.txt");
        expect(content).toBe("Hello Flysystem");
    });

    test("exists returns correct boolean", async () => {
        await adapter.put("exists.txt", "123");
        expect(await adapter.exists("exists.txt")).toBe(true);
        expect(await adapter.exists("missing.txt")).toBe(false);
    });

    test("delete removes files", async () => {
        await adapter.put("todelete.txt", "123");
        expect(await adapter.exists("todelete.txt")).toBe(true);

        const deleted = await adapter.delete("todelete.txt");
        expect(deleted).toBe(true);
        expect(await adapter.exists("todelete.txt")).toBe(false);
    });

    test("delete handles multiple files", async () => {
        await adapter.put("del1.txt", "1");
        await adapter.put("del2.txt", "2");

        const deleted = await adapter.delete(["del1.txt", "del2.txt"]);
        expect(deleted).toBe(true);
        expect(await adapter.exists("del1.txt")).toBe(false);
        expect(await adapter.exists("del2.txt")).toBe(false);
    });

    test("copy and move files", async () => {
        await adapter.put("source.txt", "copy me");

        // Copy
        await adapter.copy("source.txt", "dest.txt");
        expect(await adapter.exists("dest.txt")).toBe(true);
        expect(await adapter.get("dest.txt")).toBe("copy me");
        expect(await adapter.exists("source.txt")).toBe(true);

        // Move
        await adapter.move("dest.txt", "moved.txt");
        expect(await adapter.exists("moved.txt")).toBe(true);
        expect(await adapter.exists("dest.txt")).toBe(false);
        expect(await adapter.get("moved.txt")).toBe("copy me");
    });

    test("size and lastModified", async () => {
        const text = "size testing";
        await adapter.put("metrics.txt", text);

        const size = await adapter.size("metrics.txt");
        expect(size).toBe(Buffer.byteLength(text));

        const time = await adapter.lastModified("metrics.txt");
        expect(time).toBeGreaterThan(0);
    });

    test("directory creation and list files", async () => {
        await adapter.makeDirectory("subdir");
        await adapter.put("subdir/deep.txt", "deep file");
        await adapter.put("subdir/another.txt", "deep file 2");
        await adapter.makeDirectory("subdir/nested");
        await adapter.put("subdir/nested/n.txt", "n file");

        const files = await adapter.files("subdir");
        expect(files).toContain("subdir/deep.txt");
        expect(files).toContain("subdir/another.txt");
        // Non-recursive should not contain nested/n.txt
        expect(files).not.toContain("subdir/nested/n.txt");

        const allFiles = await adapter.allFiles("subdir");
        expect(allFiles).toContain("subdir/deep.txt");
        expect(allFiles).toContain("subdir/nested/n.txt");

        const dirs = await adapter.directories("subdir");
        expect(dirs).toContain("subdir/nested");

        // Delete folder
        await adapter.deleteDirectory("subdir");
        expect(await adapter.exists("subdir/deep.txt")).toBe(false);
    });

    test("append data to files", async () => {
        await adapter.put("append.txt", "Hello");
        await adapter.append("append.txt", " World");

        const content = await adapter.get("append.txt");
        expect(content).toBe("Hello World");
    });
});
