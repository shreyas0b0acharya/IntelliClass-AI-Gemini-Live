"use client";

import { AppButton } from "@/components/app/AppButton";
import { Input } from "@/components/ui/input";
import { Send, Loader2, MessageCircleQuestion } from "lucide-react";

interface QuestionInputProps {
  question: string;
  isThinking: boolean;
  disabled?: boolean;
  onQuestionChange: (val: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
}

export function QuestionInput({
  question,
  isThinking,
  disabled = false,
  onQuestionChange,
  onSubmit,
}: QuestionInputProps) {
  return (
    <div className="w-full max-w-xl px-4">
      <form
        onSubmit={onSubmit}
        className="flex items-center gap-2 p-2 rounded-2xl bg-card/90 backdrop-blur-2xl border border-border/60 shadow-2xl transition-all focus-within:border-primary/60"
      >
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
          {isThinking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MessageCircleQuestion className="h-4 w-4" />
          )}
        </div>

        <Input
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          placeholder={
            isThinking
              ? "Professor Sharma is analyzing your question..."
              : disabled
              ? "Classroom standby — questions enabled during live lecture."
              : "Ask a doubt or interrupt Professor Sharma..."
          }
          disabled={disabled || isThinking}
          className="flex-1 h-9 border-none bg-transparent shadow-none text-xs focus-visible:ring-0 placeholder:text-muted-foreground/70"
        />

        <AppButton
          type="submit"
          size="sm"
          variant="primary"
          shape="rounded"
          disabled={disabled || isThinking || !question.trim()}
          isLoading={isThinking}
          loadingText="Thinking..."
          rightIcon={<Send className="h-3.5 w-3.5" />}
          className="h-9 px-4 text-xs font-semibold shrink-0"
        >
          <span>Ask Doubt</span>
        </AppButton>
      </form>
    </div>
  );
}
