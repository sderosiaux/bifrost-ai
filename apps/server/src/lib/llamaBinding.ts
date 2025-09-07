import {
  getLlama,
  LlamaChatSession,
  LlamaModel,
  LlamaContext,
} from "node-llama-cpp";
import { HarmonyMessage, formatHarmonyPrompt } from "./harmony.js";
import { logger } from "./logger.js";

export interface SamplerParams {
  temperature?: number;
  topP?: number;
  repeatPenalty?: number;
  maxTokens?: number;
}

class LlamaBinding {
  private model: LlamaModel | null = null;
  private context: LlamaContext | null = null;
  private session: LlamaChatSession | null = null;
  private abortController: AbortController | null = null;
  private contextSize: number = 4096;
  private activeGenerations = new Set<AbortController>();

  async ensureReady(modelPath: string): Promise<void> {
    if (this.model) return;

    const llama = await getLlama();
    this.model = await llama.loadModel({
      modelPath,
    });

    this.contextSize = this.model.trainContextSize ?? 4096;

    this.context = await this.model.createContext({
      contextSize: Math.min(this.contextSize, 8192),
      sequences: 4, // Allow multiple sequences (warmup + multiple concurrent requests)
    });
  }

  async *generate(options: {
    messages: HarmonyMessage[];
    params?: SamplerParams;
    reasoningMode?: "low" | "medium" | "high";
  }): AsyncIterable<{ token: string }> {
    if (!this.model || !this.context) {
      throw new Error("Model not loaded. Call ensureReady first.");
    }

    const prompt = formatHarmonyPrompt(options.messages, options.reasoningMode);

    const controller = new AbortController();
    this.abortController = controller;
    this.activeGenerations.add(controller);

    let sequence: any = null;

    try {
      // Get a sequence for generation
      sequence = this.context.getSequence();

      // Tokenize the prompt first
      const promptTokens = this.model.tokenize(prompt);
      logger.debug("[LlamaBinding] Prompt tokens:", promptTokens.length);
      logger.debug("[LlamaBinding] Prompt:", prompt.substring(0, 100) + "...");

      const generator = sequence.evaluate(promptTokens, {
        temperature: options.params?.temperature ?? 0.3,
        topP: options.params?.topP ?? 0.9,
        repeatPenalty: {
          penalty: options.params?.repeatPenalty ?? 1.1,
          punishTokens: () => promptTokens,
        },
        yieldEogToken: false,
      });

      logger.debug("[LlamaBinding] Starting token generation...");
      let generatedTokens = 0;
      const maxTokens = options.params?.maxTokens ?? 512;
      const collectedTokens: any[] = []; // Collect tokens for proper detokenization

      for await (const token of generator) {
        logger.model("[LlamaBinding] Raw token received:", token);

        // Add token to collection
        collectedTokens.push(token);

        // Detokenize all collected tokens together for proper character handling
        let fullText: string;
        try {
          fullText = this.model.detokenize(collectedTokens);
        } catch (e) {
          logger.error("[LlamaBinding] Error detokenizing:", e);
          continue;
        }

        // Check if we're about to switch channels (means current channel is done)
        if (fullText.includes("<|channel|>final<|message|>") && !fullText.includes("<|end|>")) {
          logger.model("[LlamaBinding] Final channel started, model should provide answer now");
        }
        
        // Check for Harmony end token
        if (fullText.includes("<|end|>")) {
          logger.model("[LlamaBinding] Harmony end token detected");
          
          const previousText =
            collectedTokens.length > 1
              ? this.model.detokenize(collectedTokens.slice(0, -1))
              : "";
          const currentFullText = fullText.substring(
            0,
            fullText.lastIndexOf("<|end|>"),
          );
          const remainingText = currentFullText.substring(
            previousText.length,
          );

          if (
            remainingText.length > 0 &&
            !remainingText.includes("<|end|>")
          ) {
            logger.model(
              "[LlamaBinding] Yielding final text before end token:",
              JSON.stringify(remainingText),
            );
            yield { token: remainingText };
          }
          break;
        }


        // Get only the new text portion
        const previousText =
          collectedTokens.length > 1
            ? this.model.detokenize(collectedTokens.slice(0, -1))
            : "";
        let newText = fullText.substring(previousText.length);

        logger.model(
          "[LlamaBinding] Full text so far:",
          JSON.stringify(fullText.substring(0, 100)),
        );
        logger.model(
          "[LlamaBinding] New text:",
          JSON.stringify(newText),
          "Length:",
          newText.length,
        );

        // Skip if no new text or if it's just a Harmony tag
        if (newText.length === 0) {
          logger.model("[LlamaBinding] No new text, skipping");
          continue;
        }

        // Don't yield Harmony structural tokens - let the chat route handle them
        // We still yield them but the chat route will parse them
        logger.model("[LlamaBinding] Yielding token:", JSON.stringify(newText));
        yield { token: newText };
        generatedTokens++;

        if (generatedTokens >= maxTokens) {
          logger.model("[LlamaBinding] Max tokens reached");
          break;
        }
      }
      logger.model("[LlamaBinding] Generated tokens total:", generatedTokens);
    } catch (error: any) {
      if (error.name === "AbortError") {
        // Clean stop
        return;
      }
      throw error;
    } finally {
      this.activeGenerations.delete(controller);
      if (this.abortController === controller) {
        this.abortController = null;
      }
      // Dispose of the sequence to free it up
      if (sequence) {
        try {
          sequence.dispose();
        } catch (e) {
          // Ignore disposal errors
        }
      }
    }
  }

  async stop(): Promise<void> {
    // Abort all active generations
    for (const controller of this.activeGenerations) {
      controller.abort();
    }
    this.activeGenerations.clear();

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    // Clean up session
    if (this.session) {
      this.session = null;
    }
  }

  async cleanup(): Promise<void> {
    await this.stop();

    // Dispose of context and model
    if (this.context) {
      await this.context.dispose();
      this.context = null;
    }

    if (this.model) {
      await this.model.dispose();
      this.model = null;
    }
  }

  getContextSize(): number {
    return this.contextSize;
  }

  isReady(): boolean {
    return this.model !== null;
  }
}

export const llamaBinding = new LlamaBinding();
