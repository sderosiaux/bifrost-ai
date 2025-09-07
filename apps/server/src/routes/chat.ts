import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { llamaBinding, SamplerParams } from "../lib/llamaBinding.js";
import { HarmonyMessage, parseAssistantResponse } from "../lib/harmony.js";
import {
  validateMessageStructure,
  MessageValidationError,
} from "../lib/validateMessages.js";
import { validateMessages, validateSamplerParams } from "../lib/validation.js";
import { modelStore } from "../lib/modelStore.js";
import { warmupModel } from "../lib/warmup.js";
import { logger } from "../lib/logger.js";

function parseHarmonyResponse(text: string) {
  return parseAssistantResponse(text);
}

interface ChatStreamBody {
  messages: HarmonyMessage[];
  params?: SamplerParams & { reasoningMode?: "low" | "medium" | "high" };
}

let isWarmupDone = false;

export async function chatRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: ChatStreamBody }>(
    "/chat/stream",
    async (
      request: FastifyRequest<{ Body: ChatStreamBody }>,
      reply: FastifyReply,
    ) => {
      logger.log("[Chat] Received chat request");
      logger.debug("[Chat] Messages count:", request.body.messages?.length);
      logger.debug("[Chat] Params:", request.body.params);

      // Validate and sanitize input
      let validatedMessages: HarmonyMessage[];
      let validatedParams: SamplerParams;

      try {
        validatedMessages = validateMessages(request.body.messages);
        validateMessageStructure(validatedMessages);
        validatedParams = validateSamplerParams(request.body.params);
        logger.debug("[Chat] Validation passed");
      } catch (error: any) {
        console.error("[Chat] Validation error:", error.message);
        return reply.code(400).send({ error: error.message });
      }

      // Check if model is ready
      logger.debug("[Chat] Checking model status...");
      const modelStatus = await modelStore.getStatus();
      if (!modelStatus.present) {
        console.error("[Chat] Model not downloaded");
        return reply.code(503).send({ error: "Model not downloaded" });
      }

      const modelPath = modelStore.getModelPath();
      logger.debug("[Chat] Model path:", modelPath);

      // Ensure model is loaded and warmed up
      if (!llamaBinding.isReady()) {
        console.log("[Chat] Loading model...");
        await llamaBinding.ensureReady(modelPath);

        if (!isWarmupDone) {
          console.log("[Chat] Running warmup...");
          await warmupModel(modelPath);
          isWarmupDone = true;
          console.log("[Chat] Warmup complete");
        }
      } else {
        logger.debug("[Chat] Model already loaded");
      }

      // Set up SSE
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      try {
        console.log("[Chat] Starting generation...");
        let tokenCount = 0;

        // Get reasoning mode first
        const reasoningMode = request.body.params?.reasoningMode || "low";

        // More reasonable token limits for actual conversations
        const baseMaxTokens = validatedParams?.maxTokens ?? 1024;
        const maxTokens =
          reasoningMode !== "low" ? baseMaxTokens * 2 : baseMaxTokens;

        let fullResponse = "";

        // Pass reasoning mode to the messages
        const messagesWithReasoning = validatedMessages.map((msg) => ({
          ...msg,
          reasoningMode: msg.role === "system" ? reasoningMode : undefined,
        }));

        // First generation
        for await (const { token } of llamaBinding.generate({
          messages: messagesWithReasoning,
          params: validatedParams,
          reasoningMode,
        })) {
          logger.model("[Chat] Generated token:", token);
          fullResponse += token;

          // Pour l'instant, on envoie tout et on parse côté client
          // Car les balises arrivent mélangées avec le texte
          reply.raw.write(`data: ${JSON.stringify({ token })}\n\n`);
          tokenCount++;

          if (tokenCount >= maxTokens) {
            console.log("[Chat] Max tokens reached:", maxTokens);
            break;
          }
        }

        // Check if we only got analysis and no final response
        const harmonyParsed = parseHarmonyResponse(fullResponse);
        logger.log("[Chat] First generation parsed:", {
          hasChannels: harmonyParsed.hasChannels,
          hasAnalysis: !!harmonyParsed.reasoning,
          hasFinal: !!harmonyParsed.content,
        });

        // If reasoning mode is on and we don't have a proper final channel, continue
        // This happens when:
        // 1. We have analysis channel but no final channel
        // 2. We have no channels at all (model just generated text without structure)
        const needsContinuation = reasoningMode !== "low" && (
          (harmonyParsed.reasoning && !harmonyParsed.content) || // Has analysis, no final
          (!harmonyParsed.hasChannels && fullResponse.length > 0) // No channels at all
        );

        if (needsContinuation) {
          logger.log("[Chat] Need continuation for final response...");
          
          // Send a marker to the client that we're switching from reasoning to answer
          reply.raw.write(`data: ${JSON.stringify({ phase: "reasoning_complete" })}\n\n`);
          
          // Build continuation with the analysis and force final response
          const analysisMessage = fullResponse.includes("<|channel|>") 
            ? fullResponse + "<|end|>\n\n"
            : `<|channel|>analysis<|message|>${fullResponse}<|end|>\n\n`;
          
          // Add the analysis as an assistant message and continue with explicit final channel
          // Simply start the final response without any meta-text
          const continuationMessages = [
            ...validatedMessages, // Use original messages, not with reasoning
            {
              role: "assistant" as const,
              content: analysisMessage + "<|start|>assistant<|channel|>final<|message|>",
            }
          ];

          // Send a marker that final answer is starting
          reply.raw.write(`data: ${JSON.stringify({ phase: "final_answer" })}\n\n`);

          // Continue generation for final response
          for await (const { token } of llamaBinding.generate({
            messages: continuationMessages,
            params: { ...validatedParams, maxTokens: baseMaxTokens }, // Use base tokens for final response
            reasoningMode: "low", // Force direct response for continuation
          })) {
            logger.model("[Chat] Generated continuation token:", token);
            fullResponse += token;
            
            reply.raw.write(`data: ${JSON.stringify({ token })}\n\n`);
            tokenCount++;

            if (tokenCount >= maxTokens) {
              console.log("[Chat] Max tokens reached in continuation:", maxTokens);
              reply.raw.write(
                `data: ${JSON.stringify({ done: true, reason: "max_tokens" })}\n\n`,
              );
              break;
            }
          }
        }

        // Final parsing
        logger.debug("[Chat] Full response:", fullResponse);
        const finalParsed = parseHarmonyResponse(fullResponse);
        logger.debug("[Chat] Final parsed channels:", finalParsed);

        console.log("[Chat] Generation complete. Total tokens:", tokenCount);
        reply.raw.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      } catch (error: any) {
        if (error.name === "AbortError") {
          reply.raw.write(
            `data: ${JSON.stringify({ done: true, reason: "stopped" })}\n\n`,
          );
        } else {
          reply.raw.write(
            `data: ${JSON.stringify({ error: error.message })}\n\n`,
          );
        }
      } finally {
        reply.raw.end();
      }
    },
  );

  fastify.post(
    "/chat/stop",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await llamaBinding.stop();
      return { message: "Chat stopped" };
    },
  );

  fastify.get(
    "/chat/context",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return {
        contextSize: llamaBinding.getContextSize(),
        ready: llamaBinding.isReady(),
      };
    },
  );
}
