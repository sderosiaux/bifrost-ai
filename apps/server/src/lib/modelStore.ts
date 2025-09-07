import {
  createReadStream,
  createWriteStream,
  existsSync,
  statSync,
  unlinkSync,
  renameSync,
} from "fs";
import { mkdir } from "fs/promises";
import { join, dirname, basename, resolve } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";
import { pipeline } from "stream/promises";
import https from "https";
import { EventEmitter } from "events";
import { logger } from "./logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODEL_CACHE_DIR = resolve(join(__dirname, "../../model-cache"));
const DEFAULT_MODEL_NAME = "gpt-oss-20b-Q4_K_M.gguf";

// Validate model name to prevent path traversal
function validateModelName(name: string): string {
  const sanitized = basename(name);
  if (
    sanitized !== name ||
    name.includes("..") ||
    name.includes("/") ||
    name.includes("\\")
  ) {
    throw new Error("Invalid model name");
  }
  return sanitized;
}

export interface ModelStatus {
  present: boolean;
  size: number;
  checksumOk: boolean;
  progress: number;
  path?: string;
}

export interface DownloadProgress {
  downloaded: number;
  total: number;
  percentage: number;
  speed: number;
  eta: number;
}

class ModelStore extends EventEmitter {
  private downloadController: AbortController | null = null;
  private currentDownload: DownloadProgress | null = null;

  async ensureCacheDir(): Promise<void> {
    console.log(
      "[ModelStore] Ensuring cache directory exists:",
      MODEL_CACHE_DIR,
    );
    await mkdir(MODEL_CACHE_DIR, { recursive: true });
    console.log("[ModelStore] Cache directory ready");
  }

  getModelPath(): string {
    const validName = validateModelName(DEFAULT_MODEL_NAME);
    const path = join(MODEL_CACHE_DIR, validName);
    // Ensure the resolved path is within MODEL_CACHE_DIR
    if (!path.startsWith(MODEL_CACHE_DIR)) {
      throw new Error("Invalid model path");
    }
    return path;
  }

  getTempPath(): string {
    const validName = validateModelName(DEFAULT_MODEL_NAME);
    const path = join(MODEL_CACHE_DIR, `${validName}.download`);
    // Ensure the resolved path is within MODEL_CACHE_DIR
    if (!path.startsWith(MODEL_CACHE_DIR)) {
      throw new Error("Invalid temp path");
    }
    return path;
  }

  async getStatus(expectedSha256?: string): Promise<ModelStatus> {
    const modelPath = this.getModelPath();
    logger.debug("[ModelStore] Checking model at path:", modelPath);

    if (!existsSync(modelPath)) {
      console.log("[ModelStore] Model not found at path");
      return {
        present: false,
        size: 0,
        checksumOk: false,
        progress: 0,
      };
    }

    const stats = statSync(modelPath);
    let checksumOk = true;

    if (expectedSha256) {
      checksumOk = await this.verifyChecksum(modelPath, expectedSha256);
    }

    return {
      present: true,
      size: stats.size,
      checksumOk,
      progress: 100,
      path: modelPath,
    };
  }

  async download(url: string, expectedSha256?: string): Promise<void> {
    console.log("[ModelStore] Starting download from:", url);
    await this.ensureCacheDir();

    const tempPath = this.getTempPath();
    const modelPath = this.getModelPath();
    console.log("[ModelStore] Temp path:", tempPath);
    console.log("[ModelStore] Final path:", modelPath);

    // Check if we can resume
    let startByte = 0;
    if (existsSync(tempPath)) {
      const stats = statSync(tempPath);
      startByte = stats.size;
      console.log(
        "[ModelStore] Found partial download, resuming from byte:",
        startByte,
      );
    } else {
      console.log("[ModelStore] Starting fresh download");
    }

    return new Promise((resolve, reject) => {
      this.downloadController = new AbortController();

      const options: https.RequestOptions = {
        headers: startByte > 0 ? { Range: `bytes=${startByte}-` } : {},
        signal: this.downloadController.signal as any,
      };

      const request = https.get(url, options, (response) => {
        console.log("[ModelStore] Response status:", response.statusCode);
        console.log("[ModelStore] Response headers:", response.headers);

        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          console.log("[ModelStore] Redirecting to:", redirectUrl);
          if (redirectUrl) {
            this.download(redirectUrl, expectedSha256)
              .then(resolve)
              .catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200 && response.statusCode !== 206) {
          const error = `HTTP ${response.statusCode}: ${response.statusMessage}`;
          console.error("[ModelStore] Download error:", error);
          reject(new Error(error));
          return;
        }

        const totalSize =
          parseInt(response.headers["content-length"] || "0") + startByte;
        let downloaded = startByte;
        let lastTime = Date.now();
        let lastDownloaded = startByte;

        const writeStream = createWriteStream(tempPath, { flags: "a" });

        response.on("data", (chunk) => {
          downloaded += chunk.length;

          const now = Date.now();
          const timeDiff = (now - lastTime) / 1000;

          if (timeDiff >= 0.5) {
            // Update every 500ms
            const speed = (downloaded - lastDownloaded) / timeDiff;
            const remaining = totalSize - downloaded;
            const eta = remaining / speed;

            this.currentDownload = {
              downloaded,
              total: totalSize,
              percentage: (downloaded / totalSize) * 100,
              speed,
              eta,
            };

            this.emit("progress", this.currentDownload);

            lastTime = now;
            lastDownloaded = downloaded;
          }
        });

        pipeline(response, writeStream)
          .then(async () => {
            // Verify checksum if provided
            if (expectedSha256) {
              const isValid = await this.verifyChecksum(
                tempPath,
                expectedSha256,
              );
              if (!isValid) {
                unlinkSync(tempPath);
                reject(new Error("Checksum verification failed"));
                return;
              }
            }

            // Move temp file to final location
            renameSync(tempPath, modelPath);
            this.currentDownload = null;
            resolve();
          })
          .catch((error) => {
            if (error.name === "AbortError") {
              // Keep partial file for resume
              this.currentDownload = null;
              reject(new Error("Download cancelled"));
            } else {
              // Delete partial file on error
              if (existsSync(tempPath)) {
                unlinkSync(tempPath);
              }
              this.currentDownload = null;
              reject(error);
            }
          });
      });

      request.on("error", (error) => {
        this.currentDownload = null;
        reject(error);
      });
    });
  }

  async verifyChecksum(
    filePath: string,
    expectedSha256: string,
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const hash = createHash("sha256");
      const stream = createReadStream(filePath);

      stream.on("data", (data) => hash.update(data));
      stream.on("end", () => {
        const checksum = hash.digest("hex");
        resolve(checksum.toLowerCase() === expectedSha256.toLowerCase());
      });
      stream.on("error", reject);
    });
  }

  cancelDownload(): void {
    if (this.downloadController) {
      this.downloadController.abort();
      this.downloadController = null;
    }
  }

  getCurrentProgress(): DownloadProgress | null {
    return this.currentDownload;
  }

  cleanupPartialDownload(): void {
    const tempPath = this.getTempPath();
    if (existsSync(tempPath)) {
      unlinkSync(tempPath);
    }
  }
}

export const modelStore = new ModelStore();
