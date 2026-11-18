"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { api } from "@/lib/api";
import { Sparkles, MessageSquare, User, Send, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/lib/supabase/types";

interface ChatPanelProps {
  sessionId: string;
  userId?: string;
  courseId?: string;
  sessionTopic?: string;
  userName?: string;
}

export function ChatPanel({
  sessionId,
  userId,
  courseId,
  sessionTopic,
  userName = "Student",
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const { messages: fetchedMessages } = await api.getMessages(sessionId);
        if (fetchedMessages) setMessages(fetchedMessages);
      } catch (err) {
        console.warn("Message poll notice:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);

    const channel = supabase
      .channel(`chat:classroom:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          if (newMsg) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || isSending) return;

    const questionText = inputText.trim();
    setInputText("");
    setIsSending(true);

    try {
      // 1. Optimistic user message in chat
      const tempId = `temp_${Date.now()}`;
      const userMsg: ChatMessage = {
        id: tempId,
        session_id: sessionId,
        user_id: userId || null,
        role: "user",
        message: questionText,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // 2. Persist user message to Supabase
      await api.sendMessage(sessionId, {
        role: "user",
        message: questionText,
        user_id: userId,
      });

      // 3. Generate instant AI reply in chat (pure text — does NOT interrupt spoken class lecture)
      if (courseId) {
        const askRes = await api.askQuestion(sessionId, {
          question: questionText,
          courseId,
          studentName: userName,
          lecturerName: "Prof. Arthur",
          sessionTopic: sessionTopic || "Live Lecture",
        });

        if (askRes?.answer) {
          const aiMsg: ChatMessage = {
            id: `ai_${Date.now()}`,
            session_id: sessionId,
            user_id: null,
            role: "ai",
            message: askRes.answer,
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, aiMsg]);

          // Persist AI answer to DB
          await api.sendMessage(sessionId, {
            role: "ai",
            message: askRes.answer,
          });
        }
      }
    } catch (err) {
      console.warn("Failed to process chat message:", err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card/40 backdrop-blur-xl border-l border-border/40 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border/40 bg-card/60 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-foreground flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          Live Chat &amp; Transcript
        </h3>
        <span className="text-xs text-muted-foreground font-semibold px-2 py-0.5 rounded-full bg-muted/60">
          {messages.length} notes
        </span>
      </div>

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="flex flex-col gap-1 items-start">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-16 w-3/4" />
            </div>
            <div className="flex flex-col gap-1 items-end">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-12 w-2/3" />
            </div>
            <div className="flex flex-col gap-1 items-start">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-20 w-4/5" />
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-muted/40 flex items-center justify-center text-muted-foreground">
              <MessageSquare className="h-5 w-5" />
            </div>
            <p className="text-xs font-bold text-foreground">Lecture stream initialized</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Questions asked in chat will be answered by Prof. Arthur right here without interrupting the spoken lecture.
            </p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isAI = msg.role === "ai";
            const isMe = !isAI && msg.user_id === userId;

            return (
              <div
                key={msg.id || i}
                className={`flex flex-col gap-1 animate-in fade-in duration-300 ${
                  isMe ? "items-end" : "items-start"
                }`}
              >
                <div className="flex items-center gap-1.5 px-1 w-full justify-between">
                  {isAI ? (
                    <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Professor Arthur
                    </span>
                  ) : (
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" /> {isMe ? "You" : "Student"}
                    </span>
                  )}
                  {msg.created_at && (
                    <span className="text-xs text-muted-foreground/70 font-mono">
                      {new Date(msg.created_at).toLocaleString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>

                <div
                  className={`max-w-[88%] p-3.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                    isAI
                      ? "bg-primary/10 border border-primary/20 text-foreground rounded-tl-sm"
                      : isMe
                      ? "bg-primary text-primary-foreground rounded-tr-sm shadow-md shadow-primary/15"
                      : "bg-muted/60 border border-border/50 text-foreground rounded-tl-sm"
                  }`}
                >
                  {msg.message}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Google Meet In-Call Message Input */}
      <form
        onSubmit={handleSendMessage}
        className="p-3 bg-card/70 border-t border-border/40 flex items-center gap-2"
      >
        <Input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Send a message to everyone..."
          disabled={isSending}
          className="h-10 flex-1 text-xs rounded-xl bg-background/60 focus-visible:ring-primary/40"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!inputText.trim() || isSending}
          className="h-10 w-10 p-0 rounded-xl shrink-0"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
export default ChatPanel;
