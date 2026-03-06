import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { User, Sparkles, AlertCircle, Code, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { QueryResultTable } from "./query-result-table";
import type { GenieMessage } from "./use-genie-chat";

export function ChatMessage({ message }: { message: GenieMessage }) {
  const [showSql, setShowSql] = useState(false);
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 py-4",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
      )}

      <div
        className={cn(
          "space-y-3 max-w-[85%]",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-muted rounded-bl-md"
          )}
        >
          {message.error && !isUser ? (
            <div className="flex items-start gap-2 text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{message.error}</span>
            </div>
          ) : (
            message.content
          )}
        </div>

        {message.sql && (
          <div className="w-full">
            <button
              onClick={() => setShowSql(!showSql)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Code className="h-3 w-3" />
              <span>SQL Query</span>
              {showSql ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
            {showSql && (
              <pre className="mt-2 rounded-lg bg-muted/80 border p-3 text-xs overflow-x-auto font-mono">
                {message.sql}
              </pre>
            )}
          </div>
        )}

        {message.queryResult && (
          <div className="w-full">
            <QueryResultTable result={message.queryResult} />
          </div>
        )}

        {message.suggestedQuestions && message.suggestedQuestions.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">
              Suggested follow-ups:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {message.suggestedQuestions.map((q, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent transition-colors text-xs font-normal"
                  data-suggestion={q}
                >
                  {q}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-foreground">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
