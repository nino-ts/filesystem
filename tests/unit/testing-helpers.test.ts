import { describe, expect, test } from "bun:test";
import { assertExists, assertMissing, createTestAdapter, runFilesystemAdapterTests } from "../../src/testing/helpers";

describe("Testing Helpers", () => {
    describe("createTestAdapter()", () => {
        test("creates local adapter with cleanup", async () => {
            const { adapter, cleanup } = await createTestAdapter({ type: "local" });
            await adapter.put("file.txt", "Content");
            expect(await adapter.get("file.txt")).toBe("Content");
            await cleanup();
        });

        test("creates memory adapter", async () => {
            const { adapter, cleanup } = await createTestAdapter({ type: "memory" });
            await adapter.put("file.txt", "Content");
            expect(await adapter.get("file.txt")).toBe("Content");
            await cleanup();
        });

        test("defaults to local adapter", async () => {
            const { adapter, cleanup } = await createTestAdapter();
            await adapter.put("file.txt", "Content");
            expect(await adapter.get("file.txt")).toBe("Content");
            await cleanup();
        });
    });

    describe("assertExists()", () => {
        test("does not throw when file exists", async () => {
            const { adapter, cleanup } = await createTestAdapter({ type: "memory" });
            await adapter.put("file.txt", "Content");
            await expect(assertExists(adapter, "file.txt")).resolves.toBeUndefined();
            await cleanup();
        });

        test("throws when file does not exist", async () => {
            const { adapter, cleanup } = await createTestAdapter({ type: "memory" });
            await expect(assertExists(adapter, "missing.txt")).rejects.toThrow("File [missing.txt] does not exist");
            await cleanup();
        });
    });

    describe("assertMissing()", () => {
        test("does not throw when file does not exist", async () => {
            const { adapter, cleanup } = await createTestAdapter({ type: "memory" });
            await expect(assertMissing(adapter, "missing.txt")).resolves.toBeUndefined();
            await cleanup();
        });

        test("throws when file exists", async () => {
            const { adapter, cleanup } = await createTestAdapter({ type: "memory" });
            await adapter.put("file.txt", "Content");
            await expect(assertMissing(adapter, "file.txt")).rejects.toThrow("File [file.txt] exists but should not");
            await cleanup();
        });
    });

    describe("runFilesystemAdapterTests()", () => {
        test("provides reusable test suite", async () => {
            // This test verifies that the function exists and can be called
            // The actual tests are run by Jest/Bun test runner
            expect(typeof runFilesystemAdapterTests).toBe("function");
        });
    });
});
