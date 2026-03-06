import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Sparkles,
  AlertCircle,
  Code,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Copy,
  Check,
} from "lucide-react";
import { useState, useCallback } from "react";
import { QueryResultTable } from "./query-result-table";
import type { GenieMessage } from "./use-genie-chat";

function FormattedText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        const formatted = line.replace(
          /\*\*(.*?)\*\*/g,
          '<strong class="font-semibold">$1</strong>'
        );
        return (
          <p
            key={i}
            className="leading-relaxed"
            dangerouslySetInnerHTML={{ __html: formatted }}
          />
        );
      })}
    </div>
  );
}

function SqlBlock({ sql }: { sql: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [sql]);

  return (
    <div className="w-full rounded-lg border bg-muted/30 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <Code className="h-3.5 w-3.5" />
          <span className="font-medium">Generated SQL</span>
        </div>
        {isOpen ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
      </button>
      {isOpen && (
        <div className="relative border-t">
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Copy SQL"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          <pre className="p-3 pr-10 text-xs overflow-x-auto font-mono leading-relaxed text-foreground/90">
            {sql}
          </pre>
        </div>
      )}
    </div>
  );
}

export function ChatMessage({ message }: { message: GenieMessage }) {
  const isUser = message.role === "user";
  const hasData = !!message.queryResult;
  const hasSql = !!message.sql;

  return (
    <div
      className={cn(
        "flex gap-3 py-4",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
          <Sparkles className="h-4 w-4" />
        </div>
      )}

      <div
        className={cn(
          "max-w-[85%] min-w-0",
          isUser ? "items-end" : "items-start",
          !isUser && (hasData || hasSql) ? "space-y-3" : "space-y-2"
        )}
      >
        {/* Text bubble */}
        {message.error && !isUser ? (
          <div className="flex items-start gap-2.5 rounded-2xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive rounded-bl-md">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{message.error}</span>
          </div>
        ) : (
          <div
            className={cn(
              "rounded-2xl px-4 py-2.5 text-sm",
              isUser
                ? "bg-primary text-primary-foreground rounded-br-md"
                : "bg-muted rounded-bl-md"
            )}
          >
            {!isUser ? (
              <FormattedText text={message.content} />
            ) : (
              message.content
            )}
          </div>
        )}

        {/* Success indicator + SQL block */}
        {hasSql && !isUser && (
          <div className="space-y-2 w-full">
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Query executed successfully</span>
            </div>
            <SqlBlock sql={message.sql!} />
          </div>
        )}

        {/* Data table */}
        {hasData && (
          <div className="w-full">
            <QueryResultTable result={message.queryResult!} />
          </div>
        )}

        {/* Suggested follow-ups */}
        {message.suggestedQuestions && message.suggestedQuestions.length > 0 && (
          <div className="space-y-2 pt-1">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
              Follow-up questions
            </p>
            <div className="flex flex-wrap gap-1.5">
              {message.suggestedQuestions.map((q, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary/5 hover:border-primary/30 transition-colors text-xs font-normal py-1 px-2.5"
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
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-foreground mt-0.5">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
