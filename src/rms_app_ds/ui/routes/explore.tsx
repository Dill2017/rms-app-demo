import { createFileRoute } from "@tanstack/react-router";
import { useRef, useEffect, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RotateCcw,
  Sparkles,
  Database,
  TrendingUp,
  BedDouble,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import { useGenieChat } from "@/components/genie/use-genie-chat";
import { ChatMessage } from "@/components/genie/chat-message";
import { ChatInput } from "@/components/genie/chat-input";

export const Route = createFileRoute("/explore")({
  component: ExplorePage,
});

const GENIE_SPACE_ID = "01f1187b51271f3c809cd77fbc42e1a8";
const WORKSPACE_HOST = "https://adb-984752964297111.11.azuredatabricks.net";
const GENIE_WORKSPACE_URL = `${WORKSPACE_HOST}/sql/genie/${GENIE_SPACE_ID}`;

const SAMPLE_QUESTIONS = [
  "Which hotels have the highest demand scores this week?",
  "What is the average predicted occupancy by room type?",
  "Show hotels with Very High demand in the next 7 days",
  "Compare Standard vs Deluxe room occupancy forecasts",
  "Top 10 hotels by expected bookings tomorrow",
  "How does demand change over the 30-day horizon?",
];

function ExplorePage() {
  const { messages, sendMessage, isLoading, resetConversation, conversationId } =
    useGenieChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSuggestionClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const target = e.target as HTMLElement;
      const badge = target.closest("[data-suggestion]") as HTMLElement | null;
      if (badge?.dataset.suggestion) {
        sendMessage(badge.dataset.suggestion);
      }
    },
    [sendMessage]
  );

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Data Explorer</h1>
            <p className="text-xs text-muted-foreground">
              Ask questions about hotel demand & occupancy forecasts
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {conversationId && (
            <Badge variant="secondary" className="text-xs">
              Active conversation
            </Badge>
          )}
          {hasMessages && (
            <Button
              variant="outline"
              size="sm"
              onClick={resetConversation}
              className="gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              New chat
            </Button>
          )}
          <Button variant="ghost" size="sm" asChild className="gap-1.5">
            <a href={GENIE_WORKSPACE_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              Open in workspace
            </a>
          </Button>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-hidden">
        {!hasMessages ? (
          <div className="flex flex-col items-center justify-center h-full px-6 max-w-3xl mx-auto">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-6">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Explore Your Data</h2>
            <p className="text-muted-foreground text-center mb-8 max-w-md">
              Ask natural language questions about hotel demand forecasts and
              occupancy predictions. Powered by Databricks Genie.
            </p>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 w-full mb-8">
              <Card className="border-dashed hover:border-primary/50 transition-colors cursor-default">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Demand Analysis</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Explore demand scores, levels, expected searches and
                    bookings across 800+ hotels
                  </p>
                </CardContent>
              </Card>
              <Card className="border-dashed hover:border-primary/50 transition-colors cursor-default">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <BedDouble className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Occupancy Forecasts</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Predicted occupancy by room type with confidence intervals
                    and rooms sold estimates
                  </p>
                </CardContent>
              </Card>
              <Card className="border-dashed hover:border-primary/50 transition-colors cursor-default">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Cross-Table Queries</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Join demand and occupancy data to discover correlations and
                    optimize revenue strategies
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="w-full space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <HelpCircle className="h-4 w-4" />
                <span>Try asking:</span>
              </div>
              <div
                className="flex flex-wrap gap-2"
                onClick={handleSuggestionClick}
              >
                {SAMPLE_QUESTIONS.map((q) => (
                  <Badge
                    key={q}
                    variant="outline"
                    className="cursor-pointer hover:bg-accent transition-colors py-1.5 px-3 text-xs font-normal"
                    data-suggestion={q}
                  >
                    {q}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full" ref={scrollRef}>
            <div
              className="max-w-3xl mx-auto px-6 py-4 space-y-1"
              onClick={handleSuggestionClick}
            >
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
              {isLoading && (
                <div className="flex gap-3 py-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Sparkles className="h-4 w-4 animate-pulse" />
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-2.5 rounded-bl-md">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 rounded-full bg-foreground/30 animate-bounce [animation-delay:-0.3s]" />
                      <span className="h-2 w-2 rounded-full bg-foreground/30 animate-bounce [animation-delay:-0.15s]" />
                      <span className="h-2 w-2 rounded-full bg-foreground/30 animate-bounce" />
                    </div>
                    <span className="text-xs text-muted-foreground ml-1">
                      Analyzing your data...
                    </span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Input area */}
      <div className="border-t bg-background/95 backdrop-blur p-4">
        <div className="max-w-3xl mx-auto">
          <ChatInput onSend={sendMessage} isLoading={isLoading} />
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Genie translates your questions into SQL and runs them against hotel
            forecast data in Unity Catalog
          </p>
        </div>
      </div>
    </div>
  );
}
