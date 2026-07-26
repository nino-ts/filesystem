import { describe, expect, test } from "bun:test";
import { MemoryAdapter } from "../../src/adapters/memory-adapter";
import { CachedAdapter } from "../../src/decorators/cached-adapter";
import { EventedAdapter } from "../../src/decorators/evented-adapter";
import { ScopedAdapter } from "../../src/decorators/scoped-adapter";

describe("Decorators", () => {
    describe("CachedAdapter", () => {
        test("caches get() operations", async () => {
            const memory = new MemoryAdapter();
            const cached = new CachedAdapter(memory, { ttl: 60000 });

            await memory.put("file.txt", "Content");

            // First call
            const content1 = await cached.get("file.txt");
            expect(content1).toBe("Content");
            expect(cached.getCacheSize()).toBeGreaterThan(0);

            // Second call (should hit cache)
            const content2 = await cached.get("file.txt");
            expect(content2).toBe("Content");
        });

        test("caches exists() operations", async () => {
            const memory = new MemoryAdapter();
            const cached = new CachedAdapter(memory, { ttl: 60000 });

            await memory.put("file.txt", "Content");

            const exists1 = await cached.exists("file.txt");
            expect(exists1).toBe(true);

            const exists2 = await cached.exists("file.txt");
            expect(exists2).toBe(true);
        });

        test("invalidates cache on put()", async () => {
            const memory = new MemoryAdapter();
            const cached = new CachedAdapter(memory, { ttl: 60000 });

            await memory.put("file.txt", "Content 1");
            await cached.get("file.txt"); // Cache it

            await cached.put("file.txt", "Content 2"); // Should invalidate cache

            const content = await cached.get("file.txt");
            expect(content).toBe("Content 2");
        });

        test("invalidates cache on delete()", async () => {
            const memory = new MemoryAdapter();
            const cached = new CachedAdapter(memory, { ttl: 60000 });

            await memory.put("file.txt", "Content");
            await cached.exists("file.txt"); // Cache it

            await cached.delete("file.txt"); // Should invalidate cache

            const exists = await cached.exists("file.txt");
            expect(exists).toBe(false);
        });

        test("respects TTL", async () => {
            const memory = new MemoryAdapter();
            const cached = new CachedAdapter(memory, { ttl: 1 }); // 1ms TTL

            await memory.put("file.txt", "Content");
            await cached.get("file.txt");

            // Wait for cache to expire
            await new Promise((resolve) => setTimeout(resolve, 10));

            // Should fetch from adapter again
            const content = await cached.get("file.txt");
            expect(content).toBe("Content");
        });

        test("clearCache() clears all entries", async () => {
            const memory = new MemoryAdapter();
            const cached = new CachedAdapter(memory, { ttl: 60000 });

            await memory.put("file1.txt", "Content 1");
            await memory.put("file2.txt", "Content 2");

            await cached.get("file1.txt");
            await cached.get("file2.txt");

            expect(cached.getCacheSize()).toBeGreaterThan(0);

            cached.clearCache();

            expect(cached.getCacheSize()).toBe(0);
        });
    });

    describe("ScopedAdapter", () => {
        test("applies scope prefix to paths", async () => {
            const memory = new MemoryAdapter();
            const scoped = new ScopedAdapter(memory, "users/1");

            await scoped.put("file.txt", "Content");

            // File should be stored with scope prefix
            expect(await memory.exists("users/1/file.txt")).toBe(true);
            expect(await memory.exists("file.txt")).toBe(false);
        });

        test("removes scope prefix from results", async () => {
            const memory = new MemoryAdapter();
            const scoped = new ScopedAdapter(memory, "users/1");

            await scoped.put("file1.txt", "Content 1");
            await scoped.put("file2.txt", "Content 2");

            const files = await scoped.files();
            expect(files).toContain("file1.txt");
            expect(files).toContain("file2.txt");
            expect(files).not.toContain("users/1/");
        });

        test("isolates operations between scopes", async () => {
            const memory = new MemoryAdapter();
            const user1 = new ScopedAdapter(memory, "users/1");
            const user2 = new ScopedAdapter(memory, "users/2");

            await user1.put("file.txt", "User 1");
            await user2.put("file.txt", "User 2");

            expect(await user1.get("file.txt")).toBe("User 1");
            expect(await user2.get("file.txt")).toBe("User 2");
        });

        test("getScope() returns the scope prefix", () => {
            const memory = new MemoryAdapter();
            const scoped = new ScopedAdapter(memory, "my/scope");

            expect(scoped.getScope()).toBe("my/scope");
        });

        test("handles empty scope", async () => {
            const memory = new MemoryAdapter();
            const scoped = new ScopedAdapter(memory, "");

            await scoped.put("file.txt", "Content");

            expect(await memory.exists("file.txt")).toBe(true);
        });
    });

    describe("EventedAdapter", () => {
        test("emits file.created event on put()", async () => {
            const memory = new MemoryAdapter();
            const evented = new EventedAdapter(memory);

            let createdPath: string | undefined;
            evented.on("file.created", (path) => {
                createdPath = path;
            });

            await evented.put("file.txt", "Content");

            expect(createdPath).toBe("file.txt");
        });

        test("emits file.updated event on put() for existing file", async () => {
            const memory = new MemoryAdapter();
            const evented = new EventedAdapter(memory);

            await memory.put("file.txt", "Content");

            let updatedPath: string | undefined;
            evented.on("file.updated", (path) => {
                updatedPath = path;
            });

            await evented.put("file.txt", "New Content");

            expect(updatedPath).toBe("file.txt");
        });

        test("emits file.deleted event on delete()", async () => {
            const memory = new MemoryAdapter();
            const evented = new EventedAdapter(memory);

            await memory.put("file.txt", "Content");

            let deletedPath: string | undefined;
            evented.on("file.deleted", (path) => {
                deletedPath = path;
            });

            await evented.delete("file.txt");

            expect(deletedPath).toBe("file.txt");
        });

        test("emits file.moved event on move()", async () => {
            const memory = new MemoryAdapter();
            const evented = new EventedAdapter(memory);

            await memory.put("source.txt", "Content");

            const movedPaths: string[] = [];
            evented.on("file.moved", (path) => {
                movedPaths.push(path);
            });

            await evented.move("source.txt", "dest.txt");

            expect(movedPaths).toContain("source.txt");
            expect(movedPaths).toContain("dest.txt");
        });

        test("emits file.copied event on copy()", async () => {
            const memory = new MemoryAdapter();
            const evented = new EventedAdapter(memory);

            await memory.put("source.txt", "Content");

            const copiedPaths: string[] = [];
            evented.on("file.copied", (path) => {
                copiedPaths.push(path);
            });

            await evented.copy("source.txt", "dest.txt");

            expect(copiedPaths).toContain("source.txt");
            expect(copiedPaths).toContain("dest.txt");
        });

        test("emits directory.created event on makeDirectory()", async () => {
            const memory = new MemoryAdapter();
            const evented = new EventedAdapter(memory);

            let createdPath: string | undefined;
            evented.on("directory.created", (path) => {
                createdPath = path;
            });

            await evented.makeDirectory("subdir");

            expect(createdPath).toBe("subdir");
        });

        test("emits directory.deleted event on deleteDirectory()", async () => {
            const memory = new MemoryAdapter();
            const evented = new EventedAdapter(memory);

            await memory.makeDirectory("subdir");

            let deletedPath: string | undefined;
            evented.on("directory.deleted", (path) => {
                deletedPath = path;
            });

            await evented.deleteDirectory("subdir");

            expect(deletedPath).toBe("subdir");
        });

        test("off() removes event listener", async () => {
            const memory = new MemoryAdapter();
            const evented = new EventedAdapter(memory);

            let callCount = 0;
            const listener = evented.on("file.created", () => {
                callCount++;
            });

            await evented.put("file1.txt", "Content");
            expect(callCount).toBe(1);

            evented.off(listener);

            await evented.put("file2.txt", "Content");
            expect(callCount).toBe(1); // Should not increment
        });

        test("offAll() removes all event listeners", async () => {
            const memory = new MemoryAdapter();
            const evented = new EventedAdapter(memory);

            let callCount = 0;
            evented.on("file.created", () => {
                callCount++;
            });

            evented.offAll();

            await evented.put("file.txt", "Content");
            expect(callCount).toBe(0);
        });

        test("listenerCount() returns number of listeners", () => {
            const memory = new MemoryAdapter();
            const evented = new EventedAdapter(memory);

            expect(evented.listenerCount("file.created")).toBe(0);

            evented.on("file.created", () => {});
            evented.on("file.created", () => {});

            expect(evented.listenerCount("file.created")).toBe(2);
        });
    });

    describe("Stacking decorators", () => {
        test("can stack multiple decorators", async () => {
            const memory = new MemoryAdapter();
            const scoped = new ScopedAdapter(memory, "users/1");
            const cached = new CachedAdapter(scoped, { ttl: 60000 });
            const evented = new EventedAdapter(cached);

            let createdPath: string | undefined;
            evented.on("file.created", (path) => {
                createdPath = path;
            });

            await evented.put("file.txt", "Content");

            expect(createdPath).toBe("file.txt");
            expect(await memory.exists("users/1/file.txt")).toBe(true);
        });
    });
});
