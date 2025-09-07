export interface HarmonyMessage {
  role: "system" | "user" | "assistant" | "tool" | "developer";
  content: string;
  channel?: "analysis" | "commentary" | "final";
}

// Format Harmony officiel pour GPT-OSS
export function formatHarmonyPrompt(
  messages: HarmonyMessage[],
  reasoningMode: "low" | "medium" | "high" = "low",
): string {
  let prompt = "";

  // Message système avec configuration Harmony
  const systemMessage = messages.find((m) => m.role === "system");
  if (systemMessage) {
    prompt += "<|start|>system<|message|>\n";
    prompt += `Reasoning: ${reasoningMode}\n`; // low = réponse directe, medium = un peu de raisonnement, high = beaucoup
    if (reasoningMode !== "low") {
      prompt +=
        "# Always provide your final answer in the 'final' channel after any analysis\n";
    }
    prompt += systemMessage.content + "\n";
    prompt += "<|end|>\n\n";
  }

  // Messages utilisateur et assistant
  for (const message of messages) {
    if (message.role === "system") continue;

    switch (message.role) {
      case "user":
        prompt += `<|start|>user<|message|>\n${message.content}\n<|end|>\n\n`;
        break;
      case "assistant":
        // L'assistant peut utiliser des canaux
        if (message.channel) {
          prompt += `<|start|>assistant<|channel|>${message.channel}<|message|>\n${message.content}\n<|end|>\n\n`;
        } else {
          prompt += `<|start|>assistant<|message|>\n${message.content}\n<|end|>\n\n`;
        }
        break;
    }
  }

  // Début de la réponse de l'assistant
  // Pour 'low', forcer le canal final pour une réponse directe
  // Pour 'medium/high', commencer par le canal analysis puis laisser le modèle continuer
  if (reasoningMode === "low") {
    prompt += "<|start|>assistant<|channel|>final<|message|>";
  } else {
    // Start with analysis channel to guide the model
    prompt += "<|start|>assistant<|channel|>analysis<|message|>";
  }

  return prompt;
}

export function parseAssistantResponse(text: string): {
  content: string;
  reasoning?: string;
  commentary?: string;
  functionCalls?: any[];
  hasChannels?: boolean;
} {
  // Parser pour le format Harmony avec canaux
  const channelRegex =
    /<\|channel\|>(\w+)<\|message\|>([\s\S]*?)(?=<\|channel\||<\|end\||$)/g;
  const channels: Record<string, string> = {};

  let match;
  let hasChannels = false;
  while ((match = channelRegex.exec(text)) !== null) {
    channels[match[1]] = match[2].trim();
    hasChannels = true;
  }

  // Si pas de canaux trouvés, on cherche des patterns de raisonnement
  let reasoning = channels["analysis"] || "";
  let commentary = channels["commentary"] || "";
  let finalResponse = channels["final"] || "";

  // Si pas de canaux, tout est potentiellement du raisonnement en mode reasoning
  if (!hasChannels && text.length > 0) {
    // On ne peut pas savoir si c'est du raisonnement ou une réponse sans les balises
    // On va laisser la logique de continuation décider
    finalResponse = text.trim();
  }

  return {
    content: finalResponse,
    reasoning: reasoning || undefined,
    commentary: commentary || undefined,
    hasChannels,
  };
}
