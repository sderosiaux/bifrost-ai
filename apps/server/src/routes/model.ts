import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  modelStore,
  ModelStatus,
  DownloadProgress,
} from "../lib/modelStore.js";
import { logger } from "../lib/logger.js";

export async function modelRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/model/status",
    async (request: FastifyRequest, reply: FastifyReply) => {
      logger.debug("[Model Status] Checking model status...");
      const modelSha256 = process.env.MODEL_SHA256;
      const status = await modelStore.getStatus(modelSha256);
      logger.debug("[Model Status] Status:", JSON.stringify(status, null, 2));
      return status;
    },
  );

  fastify.post(
    "/model/download",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const modelUrl = process.env.MODEL_URL;
      const modelSha256 = process.env.MODEL_SHA256;

      console.log("[Model Download] Starting download...");
      console.log("[Model Download] URL:", modelUrl);
      console.log("[Model Download] SHA256:", modelSha256 || "Not configured");

      if (!modelUrl) {
        console.error(
          "[Model Download] ERROR: MODEL_URL not configured in .env",
        );
        return reply.code(400).send({ error: "MODEL_URL not configured" });
      }

      try {
        // Start download in background
        console.log("[Model Download] Initiating background download...");
        modelStore
          .download(modelUrl, modelSha256)
          .then(() =>
            console.log("[Model Download] Download completed successfully"),
          )
          .catch((error) => {
            console.error("[Model Download] Download failed:", error.message);
            console.error(error);
          });
        return { message: "Download started" };
      } catch (error: any) {
        console.error(
          "[Model Download] Failed to start download:",
          error.message,
        );
        return reply.code(500).send({ error: error.message });
      }
    },
  );

  fastify.get(
    "/model/progress",
    async (request: FastifyRequest, reply: FastifyReply) => {
      console.log("[Model Progress] SSE connection established");
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const sendProgress = (progress: DownloadProgress) => {
        console.log("[Model Progress] Sending progress:", {
          percentage: progress.percentage.toFixed(1) + "%",
          downloaded: (progress.downloaded / 1024 / 1024).toFixed(2) + "MB",
          total: (progress.total / 1024 / 1024).toFixed(2) + "MB",
        });
        reply.raw.write(`data: ${JSON.stringify(progress)}\n\n`);
      };

      const progressListener = (progress: DownloadProgress) => {
        sendProgress(progress);
      };

      modelStore.on("progress", progressListener);

      // Send current progress if any
      const currentProgress = modelStore.getCurrentProgress();
      if (currentProgress) {
        console.log("[Model Progress] Sending current progress");
        sendProgress(currentProgress);
      }

      request.raw.on("close", () => {
        console.log("[Model Progress] SSE connection closed");
        modelStore.off("progress", progressListener);
      });
    },
  );

  fastify.post(
    "/model/cancel",
    async (request: FastifyRequest, reply: FastifyReply) => {
      console.log("[Model Cancel] Cancelling download...");
      modelStore.cancelDownload();
      modelStore.cleanupPartialDownload();
      console.log(
        "[Model Cancel] Download cancelled and partial file cleaned up",
      );
      return { message: "Download cancelled" };
    },
  );
}
