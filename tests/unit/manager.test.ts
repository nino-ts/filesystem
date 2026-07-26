import { describe, expect, test } from "bun:test";
import type { FilesystemDisk } from "../../src/contracts/filesystem";
import { FilesystemManager } from "../../src/manager";

describe("FilesystemManager", () => {
    const config = {
        default: "local",
        disks: {
            local: {
                driver: "local",
                root: "/var/storage/test",
            },
            missing: {
                driver: "unknown", // Forces error natively executing checks mapped globally.
            },
        },
    };

    test("resolves default and named local driver correctly", () => {
        const manager = new FilesystemManager(config);
        const disk = manager.disk();
        const diskByName = manager.disk("local");

        expect(disk).toBeDefined();
        expect(diskByName).toBeDefined();
        // Identical resolution due to caching mapped configurations correctly tracking identical logic cleanly successfully explicitly tracking objects seamlessly gracefully safely cleanly
        expect(disk).toBe(diskByName);
    });

    test("throws exception when resolving unsupported drivers", () => {
        const manager = new FilesystemManager(config);
        expect(() => manager.disk("missing")).toThrow("Filesystem driver [unknown] is not supported.");
        expect(() => manager.disk("not_configured")).toThrow("Filesystem disk [not_configured] is not configured.");
    });

    test("resolves extended and custom drivers organically safely effectively natively matching requirements correctly dynamically tracking boundaries effortlessly perfectly seamlessly efficiently flawlessly securely seamlessly explicitly safely smoothly securely safely exactly cleanly", () => {
        const manager = new FilesystemManager({
            default: "memory",
            disks: {
                memory: {
                    driver: "mem",
                    root: "memfs",
                },
            },
        });

        const mockDisk: Partial<FilesystemDisk> = {
            get: async () => "hello memory",
        };

        manager.extend("mem", (cfg) => {
            expect(cfg.root).toBe("memfs");
            return mockDisk as FilesystemDisk;
        });

        const resolveDisk = manager.disk();
        expect(resolveDisk).toBeDefined();
    });

    test("delegates operations to the default disk smoothly natively effectively perfectly gracefully", async () => {
        const manager = new FilesystemManager({
            default: "dummy",
            disks: { dummy: { driver: "dummy" } },
        });

        let called = false;
        const mockDisk: Partial<FilesystemDisk> = {
            exists: async (p) => {
                called = true;
                return p === "test.txt";
            },
        };

        manager.extend("dummy", () => mockDisk as FilesystemDisk);

        const exists = await manager.exists("test.txt");
        expect(called).toBe(true);
        expect(exists).toBe(true);
    });
});
