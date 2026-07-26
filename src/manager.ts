import { LocalAdapter } from "./adapters/local-adapter";
import type { FilesystemDisk } from "./contracts/filesystem";

export interface FilesystemConfig {
    /**
     * The default disk to be used when no specific disk is requested.
     */
    default: string;

    /**
     * Configurations for the available storage disks.
     */
    disks: Record<string, Record<string, unknown>>;
}

export type DiskFactory = (config: Record<string, unknown>) => FilesystemDisk;

/**
 * Manages filesystem disks and resolves configurations into active driver instances.
 */
export class FilesystemManager implements FilesystemDisk {
    private customCreators = new Map<string, DiskFactory>();
    private disks = new Map<string, FilesystemDisk>();

    constructor(private config: FilesystemConfig) {}

    /**
     * Get a filesystem disk instance.
     *
     * @param name - The name of the configured disk
     */
    disk(name?: string): FilesystemDisk {
        const diskName = name ?? this.getDefaultDisk();

        const existing = this.disks.get(diskName);
        if (existing) {
            return existing;
        }

        const disk = this.resolve(diskName);
        this.disks.set(diskName, disk);
        return disk;
    }

    /**
     * Resolve the given disk configuration.
     */
    private resolve(name: string): FilesystemDisk {
        const config = this.getConfig(name);

        if (typeof config.driver === "string") {
            const creator = this.customCreators.get(config.driver);
            if (creator) {
                return creator(config);
            }
        }

        if (config.driver === "local") {
            return new LocalAdapter(config as unknown as { root: string });
        }

        throw new Error(`Filesystem driver [${config.driver}] is not supported.`);
    }

    /**
     * Get the system's default disk name.
     */
    getDefaultDisk(): string {
        return this.config.default;
    }

    /**
     * Get the configuration for a given disk.
     */
    private getConfig(name: string): Record<string, unknown> {
        const config = this.config.disks[name];
        if (!config) {
            throw new Error(`Filesystem disk [${name}] is not configured.`);
        }
        return config;
    }

    /**
     * Register a custom driver creator.
     */
    extend(driver: string, callback: DiskFactory): this {
        this.customCreators.set(driver, callback);
        return this;
    }

    // --- Delegation methods directly reflecting Operations matching default bounds efficiently ---

    async exists(path: string): Promise<boolean> {
        return this.disk().exists(path);
    }
    async get(path: string): Promise<string | null> {
        return this.disk().get(path);
    }
    async put(path: string, contents: string | Blob | ArrayBuffer | Uint8Array): Promise<boolean> {
        return this.disk().put(path, contents);
    }
    async delete(path: string | string[]): Promise<boolean> {
        return this.disk().delete(path);
    }
    async copy(from: string, to: string): Promise<boolean> {
        return this.disk().copy(from, to);
    }
    async move(from: string, to: string): Promise<boolean> {
        return this.disk().move(from, to);
    }
    async size(path: string): Promise<number> {
        return this.disk().size(path);
    }
    async lastModified(path: string): Promise<number> {
        return this.disk().lastModified(path);
    }
    async files(directory?: string): Promise<string[]> {
        return this.disk().files(directory);
    }
    async allFiles(directory?: string): Promise<string[]> {
        return this.disk().allFiles(directory);
    }
    async directories(directory?: string): Promise<string[]> {
        return this.disk().directories(directory);
    }
    async allDirectories(directory?: string): Promise<string[]> {
        return this.disk().allDirectories(directory);
    }
    async makeDirectory(path: string): Promise<boolean> {
        return this.disk().makeDirectory(path);
    }
    async deleteDirectory(directory: string): Promise<boolean> {
        return this.disk().deleteDirectory(directory);
    }
    async append(path: string, data: string): Promise<boolean> {
        return this.disk().append(path, data);
    }

    async getVisibility(path: string): Promise<string | null> {
        return this.disk().getVisibility(path);
    }

    async setVisibility(path: string, visibility: string): Promise<boolean> {
        return this.disk().setVisibility(path, visibility);
    }

    async mimeType(path: string): Promise<string | null> {
        return this.disk().mimeType(path);
    }

    async url(path: string): Promise<string> {
        return this.disk().url(path);
    }

    async temporaryUrl(path: string, expiresInSeconds: number): Promise<string> {
        return this.disk().temporaryUrl(path, expiresInSeconds);
    }
}
