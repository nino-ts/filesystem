import type { FilesystemDisk } from "../contracts/filesystem";

/**
 * Cron job callback.
 */
export type CronJobCallback = () => void | Promise<void>;

/**
 * Cron job handle.
 */
export interface CronJob {
    /**
     * Start the cron job.
     */
    start(): void;

    /**
     * Stop the cron job.
     */
    stop(): void;

    /**
     * Check if the job is running.
     */
    isRunning(): boolean;
}

/**
 * Filesystem scheduler for automated tasks.
 *
 * Uses Bun's native {@link Bun.cron} API for scheduling filesystem operations.
 *
 * @example
 * ```typescript
 * const scheduler = new FilesystemScheduler(adapter);
 *
 * // Schedule daily cleanup of temp files
 * scheduler.scheduleCleanup('temp/', '0 0 * * *'); // Every day at midnight
 *
 * // Schedule hourly backup
 * scheduler.scheduleBackup('important/', './backups/backup.tar', '0 * * * *');
 * ```
 */
export class FilesystemScheduler {
    private adapter: FilesystemDisk;
    private jobs = new Map<string, CronJob>();

    constructor(adapter: FilesystemDisk) {
        this.adapter = adapter;
    }

    /**
     * Schedule a cleanup job.
     *
     * @param pattern - File pattern to clean (glob pattern)
     * @param cronExpression - Cron expression (e.g., '0 0 * * *' for daily at midnight)
     * @param options - Cleanup options
     * @returns Cron job handle
     */
    scheduleCleanup(
        pattern: string,
        cronExpression: string,
        options?: {
            /**
             * Maximum age of files to delete (in milliseconds).
             * @default 86400000 (24 hours)
             */
            maxAge?: number;

            /**
             * Whether to delete directories.
             * @default false
             */
            includeDirectories?: boolean;
        },
    ): CronJob {
        const jobId = `cleanup_${pattern.replace(/[^a-z0-9]/gi, "_")}`;
        return this.registerJob(jobId, cronExpression, async () => {
            await this.cleanup(pattern, options);
        });
    }

    /**
     * Schedule a backup job.
     *
     * @param source - Source directory to backup
     * @param destination - Destination path for backup archive
     * @param cronExpression - Cron expression
     * @returns Cron job handle
     */
    scheduleBackup(source: string, destination: string, cronExpression: string): CronJob {
        const jobId = `backup_${source.replace(/[^a-z0-9]/gi, "_")}`;
        return this.registerJob(jobId, cronExpression, async () => {
            await this.backup(source, destination);
        });
    }

    /**
     * Schedule a custom job.
     *
     * @param jobId - Unique job identifier
     * @param cronExpression - Cron expression
     * @param callback - Job callback
     * @returns Cron job handle
     */
    schedule(jobId: string, cronExpression: string, callback: CronJobCallback): CronJob {
        return this.registerJob(jobId, cronExpression, callback);
    }

    /**
     * Stop all scheduled jobs.
     */
    stopAll(): void {
        for (const job of this.jobs.values()) {
            job.stop();
        }
        this.jobs.clear();
    }

    /**
     * Get the number of scheduled jobs.
     */
    getJobCount(): number {
        return this.jobs.size;
    }

    private registerJob(jobId: string, cronExpression: string, callback: CronJobCallback): CronJob {
        let running = false;
        let bunJob: import("bun").CronJob | null = null;
        let timerId: ReturnType<typeof setInterval> | null = null;

        const job: CronJob = {
            isRunning: () => running,
            start: () => {
                if (running) {
                    return;
                }

                if (typeof Bun.cron === "function") {
                    bunJob = Bun.cron(cronExpression, callback);
                    running = true;
                    this.jobs.set(jobId, job);
                    return;
                }

                const interval = this.cronToInterval(cronExpression);
                if (interval) {
                    timerId = setInterval(callback, interval);
                    running = true;
                    this.jobs.set(jobId, job);
                }
            },
            stop: () => {
                bunJob?.stop();
                bunJob = null;
                if (timerId !== null) {
                    clearInterval(timerId);
                    timerId = null;
                }
                running = false;
                this.jobs.delete(jobId);
            },
        };

        job.start();
        return job;
    }

    /**
     * Perform cleanup operation.
     */
    private async cleanup(
        pattern: string,
        options?: {
            maxAge?: number;
            includeDirectories?: boolean;
        },
    ): Promise<void> {
        const maxAge = options?.maxAge ?? 86400000; // 24 hours
        const now = Date.now();

        try {
            const files = await this.adapter.allFiles();

            for (const file of files) {
                if (this.matchesPattern(file, pattern)) {
                    const lastModified = await this.adapter.lastModified(file);
                    const age = now - lastModified * 1000;

                    if (age > maxAge) {
                        await this.adapter.delete(file);
                    }
                }
            }

            if (options?.includeDirectories) {
                const directories = await this.adapter.allDirectories();
                for (const dir of directories) {
                    if (this.matchesPattern(dir, pattern)) {
                        const lastModified = await this.adapter.lastModified(dir);
                        const age = now - lastModified * 1000;

                        if (age > maxAge) {
                            await this.adapter.deleteDirectory(dir);
                        }
                    }
                }
            }
        } catch (_error) {}
    }

    /**
     * Perform backup operation.
     */
    private async backup(source: string, destination: string): Promise<void> {
        try {
            const { ArchiveUtils } = await import("./archive");

            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const backupPath = `${destination}_${timestamp}.tar`;

            await ArchiveUtils.createFromDirectory(backupPath, source, this.adapter);
        } catch (_error) {}
    }

    /**
     * Check if a path matches a glob pattern.
     */
    private matchesPattern(path: string, pattern: string): boolean {
        const regex = new RegExp(`^${pattern.replace(/\./g, "\\.").replace(/\*/g, ".*").replace(/\?/g, ".")}$`);
        return regex.test(path);
    }

    /**
     * Convert cron expression to interval in milliseconds.
     * Supports basic expressions only (fallback when Bun.cron is unavailable).
     */
    private cronToInterval(cronExpression: string): number | null {
        const parts = cronExpression.split(" ");
        if (parts.length !== 5) {
            return null;
        }

        const [minute, hour, day, month, weekday] = parts;

        if (minute === "*" && hour === "*" && day === "*" && month === "*" && weekday === "*") {
            return 60000;
        }

        if (minute === "0" && hour === "*" && day === "*" && month === "*" && weekday === "*") {
            return 3600000;
        }

        if (minute !== "*" && hour !== "*" && day === "*" && month === "*" && weekday === "*") {
            return 86400000;
        }

        return null;
    }
}
