"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, MessageCircleQuestion, Mic, MicOff } from "lucide-react";

interface QuestionInputProps {
  question: string;
  isThinking: boolean;
  disabled?: boolean;
  canSpeak?: boolean;
  isMicActive?: boolean;
  onToggleMic?: () => void;
  onQuestionChange: (val: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
}

export function QuestionInput({
  question,
  isThinking,
  disabled = false,
  canSpeak = false,
  isMicActive = false,
  onToggleMic,
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
              ? "Professor is addressing your question..."
              : canSpeak
                ? "Microphone floor granted! Speak or type..."
                : disabled
                  ? "Classroom standby — questions enabled during live lecture."
                  : "Ask a doubt or question to Professor..."
          }
          disabled={disabled || isThinking}
          className="flex-1 h-9 "
        />

        {canSpeak && onToggleMic && (
          <Button
            type="button"
            size="sm"
            variant={isMicActive ? "destructive" : "secondary"}
            onClick={onToggleMic}
            className={`h-9 px-3 rounded-xl shrink-0 inline-flex items-center gap-1.5 transition-all ${
              isMicActive ? "animate-pulse shadow-md shadow-destructive/30" : ""
            }`}
            title={isMicActive ? "Mute microphone" : "Speak to AI Professor"}
          >
            {isMicActive ? (
              <>
                <MicOff className="h-4 w-4" />
                <span className="hidden sm:inline text-xs font-semibold">Mute Mic</span>
              </>
            ) : (
              <>
                <Mic className="h-4 w-4 text-chart-2" />
                <span className="hidden sm:inline text-xs font-semibold">Speak Now</span>
              </>
            )}
          </Button>
        )}

        <Button
          type="submit"
          size="sm"
          variant="default"
          disabled={disabled || isThinking || !question.trim()}
 className="h-9 shrink-0 inline-flex items-center "
        >
          {isThinking ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              <span>Thinking...</span>
            </>
          ) : (
            <>
              <span>Ask Doubt</span>
              <Send className="h-3.5 w-3.5" />
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
