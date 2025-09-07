import { useState, useRef, useEffect } from "react";
import { useStore } from "../lib/store";
import { streamChat, stopChat } from "../lib/api";
import { Message } from "./Message";

// Parser pour extraire les canaux Harmony
function parseHarmonyChannels(text: string): Record<string, string> {
  const channels: Record<string, string> = {};

  // Pattern pour matcher <|channel|>NAME<|message|>CONTENT
  const channelRegex =
    /<\|channel\|>(\w+)<\|message\|>([\s\S]*?)(?=<\|channel\||<\|end\||$)/g;

  let match;
  let hasChannels = false;
  while ((match = channelRegex.exec(text)) !== null) {
    const [, channelName, content] = match;
    channels[channelName] = content.trim();
    hasChannels = true;
  }

  // If no channels found but text contains channel markers that were added by server
  // Try to extract analysis and final parts
  if (!hasChannels && text.includes('<|channel|>analysis<|message|>')) {
    // The server wrapped the reasoning in analysis channel
    const analysisMatch = text.match(/<\|channel\|>analysis<\|message\|>([\s\S]*?)<\|end\|>/);
    if (analysisMatch) {
      channels.analysis = analysisMatch[1].trim();
      // Get everything after the analysis as final
      const afterAnalysis = text.substring(text.indexOf('<|end|>') + 7).trim();
      const finalMatch = afterAnalysis.match(/<\|channel\|>final<\|message\|>([\s\S]*?)(?:<\|end\|>|$)/);
      if (finalMatch) {
        channels.final = finalMatch[1].trim();
      } else {
        // Clean any remaining tags
        const cleanFinal = afterAnalysis
          .replace(/<\|start\|>assistant<\|channel\|>final<\|message\|>/g, '')
          .replace(/<\|.*?\|>/g, '')
          .trim();
        if (cleanFinal) {
          channels.final = cleanFinal;
        }
      }
    }
  }

  // Si aucun canal explicite, chercher le contenu après <|message|>
  if (!hasChannels && !channels.analysis && !channels.final) {
    const messageMatch = text.match(/<\|message\|>([\s\S]*?)(?:<\|end\|>|$)/);
    if (messageMatch) {
      channels.final = messageMatch[1].trim();
    } else {
      // Fallback: nettoyer les balises du texte
      const cleanText = text
        .replace(/<\|channel\|>\w+<\|message\|>/g, "")
        .replace(/<\|message\|>/g, "")
        .replace(/<\|end\|>/g, "")
        .replace(/<\|start\|>\w*\|?>/g, "")
        .trim();

      if (cleanText) {
        channels.final = cleanText;
      }
    }
  }

  return channels;
}

export function Chat() {
  const {
    conversations,
    currentConversationId,
    isStreaming,
    setStreaming,
    addMessage,
    updateLastMessage,
    reasoningMode,
    setReasoningMode,
  } = useStore();

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentConversation = conversations.find(
    (c) => c.id === currentConversationId,
  );
  const messages = currentConversation?.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    // Keep focus on textarea when messages change
    if (textareaRef.current && !isStreaming) {
      textareaRef.current.focus();
    }
  }, [messages, isStreaming]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    setInput("");

    // Force focus back to input immediately
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });

    addMessage({ role: "user", content: userMessage });
    addMessage({ role: "assistant", content: "" });

    setStreaming(true);
    abortControllerRef.current = new AbortController();

    try {
      // Force focus multiple times to ensure it sticks
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);

      let fullResponse = "";
      let reasoningText = "";
      let finalAnswerText = "";
      let currentPhase: "reasoning" | "final" = reasoningMode !== 'low' ? "reasoning" : "final";

      // Create messages with reasoning mode in system message
      const messagesWithReasoning = messages.map(msg => 
        msg.role === 'system' 
          ? { ...msg, reasoningMode } 
          : msg
      );
      
      for await (const chunk of streamChat(
        [
          ...messagesWithReasoning,
          { id: "", role: "user", content: userMessage, timestamp: new Date() },
        ],
        { reasoningMode },
        abortControllerRef.current.signal,
      )) {
        console.log("[Chat Component] Received chunk:", chunk);

        // Handle phase markers
        if (chunk.phase === "reasoning_complete") {
          reasoningText = fullResponse;
          currentPhase = "final";
          console.log("[Chat Component] Reasoning complete, switching to final answer");
          continue;
        }
        
        if (chunk.phase === "final_answer") {
          currentPhase = "final";
          console.log("[Chat Component] Final answer starting");
          continue;
        }

        if (chunk.token) {
          console.log("[Chat Component] Token:", chunk.token);
          fullResponse += chunk.token;
          
          // Track text by phase
          if (currentPhase === "reasoning") {
            reasoningText += chunk.token;
          } else {
            finalAnswerText += chunk.token;
          }

          // Parser les canaux Harmony
          const channels = parseHarmonyChannels(fullResponse);
          
          // Prepare clean reasoning and answer text
          let cleanReasoning = "";
          let cleanAnswer = "";
          
          // Use phase-based tracking if we have it
          if (reasoningMode !== 'low' && (reasoningText || finalAnswerText)) {
            // We have clear phase separation from the server
            if (reasoningText) {
              cleanReasoning = reasoningText
                .replace(/<\|channel\|>\w+<\|message\|>/g, "")
                .replace(/<\|message\|>/g, "")
                .replace(/<\|end\|>/g, "")
                .replace(/<\|start\|>assistant/g, "")
                .trim();
            }
            
            if (finalAnswerText) {
              cleanAnswer = finalAnswerText
                .replace(/<\|channel\|>\w+<\|message\|>/g, "")
                .replace(/<\|message\|>/g, "")
                .replace(/<\|end\|>/g, "")
                .replace(/<\|start\|>assistant/g, "")
                .trim();
            }
          } else {
            // Fallback to channel parsing or full response
            const hasAnalysisChannel = channels.analysis && channels.analysis.length > 0;
            const hasFinalChannel = channels.final && channels.final.length > 0;
            
            if (reasoningMode !== 'low' && (hasAnalysisChannel || hasFinalChannel)) {
              cleanReasoning = channels.analysis || "";
              cleanAnswer = channels.final || "";
            } else {
              // Clean response - remove all Harmony tags only
              cleanAnswer = fullResponse
                .replace(/<\|channel\|>\w+<\|message\|>/g, "")
                .replace(/<\|message\|>/g, "")
                .replace(/<\|end\|>/g, "")
                .replace(/<\|start\|>assistant/g, "")
                .trim();
            }
          }

          // Update the message with separate reasoning and content
          updateLastMessage(cleanAnswer, cleanReasoning);
        }

        if (chunk.done) {
          console.log("[Chat Component] Stream done, reason:", chunk.reason);
          if (chunk.reason === "max_tokens") {
            updateLastMessage(fullResponse + "\n\n[Stopped at 512 tokens]");
          }
          break;
        }

        if (chunk.error) {
          console.error("[Chat Component] Error:", chunk.error);
          updateLastMessage(`Error: ${chunk.error}`);
          break;
        }
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        updateLastMessage(`Error: ${error.message}`);
      }
    } finally {
      setStreaming(false);
      abortControllerRef.current = null;
      // Restore focus to textarea after streaming completes
      textareaRef.current?.focus();
    }
  };

  const handleStop = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      await stopChat();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
      // Force focus after Enter key
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        {messages
          .filter((m) => m.role !== "system")
          .map((message) => (
            <Message key={message.id} message={message} />
          ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">
              Reasoning:
            </label>
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setReasoningMode('low')}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  reasoningMode === 'low'
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Off
              </button>
              <button
                type="button"
                onClick={() => setReasoningMode('medium')}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  reasoningMode === 'medium'
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                On
              </button>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-500">
              {reasoningMode === 'low' ? 'Direct answers' : 'Shows thinking process'}
            </span>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="w-full px-4 py-3 pr-24 bg-gray-100 dark:bg-gray-800 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
            rows={1}
            disabled={false}
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={handleStop}
              className="absolute right-2 bottom-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors text-sm font-medium"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="absolute right-2 bottom-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-md transition-colors text-sm font-medium"
            >
              Send
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
