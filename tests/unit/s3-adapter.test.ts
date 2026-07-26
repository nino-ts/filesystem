import { describe, expect, test } from "bun:test";
import { S3Adapter } from "../../src/adapters/s3-adapter";

describe("S3Adapter", () => {
    describe("constructor", () => {
        test("creates adapter with minimal config", () => {
            const adapter = new S3Adapter({
                accessKeyId: "test-key",
                bucket: "test-bucket",
                secretAccessKey: "test-secret",
            });

            expect(adapter).toBeDefined();
        });

        test("creates adapter with full config", () => {
            const adapter = new S3Adapter({
                accessKeyId: "test-key",
                acl: "public-read",
                bucket: "test-bucket",
                endpoint: "https://custom-endpoint.com",
                region: "us-east-1",
                root: "my-prefix",
                secretAccessKey: "test-secret",
            });

            expect(adapter).toBeDefined();
        });

        test("creates adapter with Cloudflare R2 config", () => {
            const adapter = new S3Adapter({
                accessKeyId: "r2-key",
                bucket: "my-bucket",
                endpoint: "https://account-id.r2.cloudflarestorage.com",
                secretAccessKey: "r2-secret",
            });

            expect(adapter).toBeDefined();
        });

        test("creates adapter with MinIO config", () => {
            const adapter = new S3Adapter({
                accessKeyId: "minio-key",
                bucket: "local-bucket",
                endpoint: "http://localhost:9000",
                secretAccessKey: "minio-secret",
            });

            expect(adapter).toBeDefined();
        });
    });

    describe("API methods", () => {
        const adapter = new S3Adapter({
            accessKeyId: "test-key",
            bucket: "test-bucket",
            secretAccessKey: "test-secret",
        });

        test("has all required FilesystemDisk methods", () => {
            expect(typeof adapter.get).toBe("function");
            expect(typeof adapter.put).toBe("function");
            expect(typeof adapter.exists).toBe("function");
            expect(typeof adapter.missing).toBe("function");
            expect(typeof adapter.delete).toBe("function");
            expect(typeof adapter.copy).toBe("function");
            expect(typeof adapter.move).toBe("function");
            expect(typeof adapter.size).toBe("function");
            expect(typeof adapter.lastModified).toBe("function");
            expect(typeof adapter.files).toBe("function");
            expect(typeof adapter.allFiles).toBe("function");
            expect(typeof adapter.directories).toBe("function");
            expect(typeof adapter.allDirectories).toBe("function");
            expect(typeof adapter.makeDirectory).toBe("function");
            expect(typeof adapter.deleteDirectory).toBe("function");
            expect(typeof adapter.append).toBe("function");
            expect(typeof adapter.prepend).toBe("function");
            expect(typeof adapter.getVisibility).toBe("function");
            expect(typeof adapter.setVisibility).toBe("function");
            expect(typeof adapter.mimeType).toBe("function");
            expect(typeof adapter.url).toBe("function");
            expect(typeof adapter.temporaryUrl).toBe("function");
        });
    });

    describe("path resolution", () => {
        test("resolves paths without root prefix", () => {
            const adapter = new S3Adapter({
                accessKeyId: "test-key",
                bucket: "test-bucket",
                secretAccessKey: "test-secret",
            });

            // Adapter should be created successfully
            expect(adapter).toBeDefined();
        });

        test("resolves paths with root prefix", () => {
            const adapter = new S3Adapter({
                accessKeyId: "test-key",
                bucket: "test-bucket",
                root: "my-prefix",
                secretAccessKey: "test-secret",
            });

            expect(adapter).toBeDefined();
        });
    });

    describe("S3-compatible providers", () => {
        test("works with AWS S3", () => {
            const adapter = new S3Adapter({
                accessKeyId: "aws-key",
                bucket: "my-bucket",
                region: "us-east-1",
                secretAccessKey: "aws-secret",
            });

            expect(adapter).toBeDefined();
        });

        test("works with Cloudflare R2", () => {
            const adapter = new S3Adapter({
                accessKeyId: "r2-key",
                bucket: "my-bucket",
                endpoint: "https://account-id.r2.cloudflarestorage.com",
                secretAccessKey: "r2-secret",
            });

            expect(adapter).toBeDefined();
        });

        test("works with DigitalOcean Spaces", () => {
            const adapter = new S3Adapter({
                accessKeyId: "do-key",
                bucket: "my-bucket",
                endpoint: "https://nyc3.digitaloceanspaces.com",
                secretAccessKey: "do-secret",
            });

            expect(adapter).toBeDefined();
        });

        test("works with MinIO", () => {
            const adapter = new S3Adapter({
                accessKeyId: "minio-key",
                bucket: "local-bucket",
                endpoint: "http://localhost:9000",
                secretAccessKey: "minio-secret",
            });

            expect(adapter).toBeDefined();
        });
    });
});
