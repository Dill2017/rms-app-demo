import { useCallback, useState } from "react";

interface QueryResult {
  columns: string[];
  data: (string | number | null)[][];
  row_count: number;
}

export interface GenieMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sql?: string;
  queryResult?: QueryResult;
  suggestedQuestions?: string[];
  status?: string;
  error?: string;
}

interface GenieResponse {
  conversation_id: string;
  message_id: string;
  status: string;
  text: string | null;
  sql: string | null;
  query_result: QueryResult | null;
  suggested_questions: string[] | null;
  error: string | null;
}

export function useGenieChat() {
  const [messages, setMessages] = useState<GenieMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(
    async (question: string) => {
      const userMsg: GenieMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: question,
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const resp = await fetch("/api/genie/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            conversation_id: conversationId,
          }),
        });

        if (!resp.ok) {
          const errBody = await resp.json().catch(() => null);
          throw new Error(
            errBody?.detail || `Request failed with status ${resp.status}`
          );
        }

        const data: GenieResponse = await resp.json();
        setConversationId(data.conversation_id);

        const assistantMsg: GenieMessage = {
          id: data.message_id,
          role: "assistant",
          content:
            data.text ||
            (data.sql ? "Here are the results:" : "I couldn't generate a response."),
          sql: data.sql ?? undefined,
          queryResult: data.query_result ?? undefined,
          suggestedQuestions: data.suggested_questions ?? undefined,
          status: data.status,
          error: data.error ?? undefined,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const errorMsg: GenieMessage = {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: "Sorry, something went wrong.",
          error:
            err instanceof Error ? err.message : "An unexpected error occurred",
          status: "FAILED",
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId]
  );

  const resetConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
  }, []);

  return { messages, sendMessage, isLoading, resetConversation, conversationId };
}
