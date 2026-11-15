"use client";

import { useState } from "react";
import type { SessionRoadmap, RoadmapTopic } from "../types/roadmap";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  Play,
  Lightbulb,
  ImageIcon,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface RoadmapInspectorProps {
  roadmap: SessionRoadmap | null;
  currentTopicId: string | null;
  isLecturer: boolean;
  isGenerating?: boolean;
  onGenerateRoadmap?: () => Promise<void>;
  onSelectTopic?: (topicId: string) => void;
}

export function RoadmapInspector({
  roadmap,
  currentTopicId,
  isLecturer,
  isGenerating = false,
  onGenerateRoadmap,
  onSelectTopic,
}: RoadmapInspectorProps) {
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  if (!roadmap || !roadmap.topics || roadmap.topics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-border/60 rounded-3xl space-y-4 bg-muted/10">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <BookOpen className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-lg text-foreground">No Topic Roadmap Generated</h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            Generate a dynamic 4-to-8 topic lecture roadmap powered by Gemini AI to guide real-time classroom teaching.
          </p>
        </div>
        {isLecturer && onGenerateRoadmap && (
          <Button
            onClick={onGenerateRoadmap}
            disabled={isGenerating}
            size="sm"
            className="rounded-full px-5 h-9 font-medium"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Roadmap...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2 text-chart-4" />
                Generate AI Lecture Roadmap
              </>
            )}
          </Button>
        )}
      </div>
    );
  }

  const activeTopic =
    roadmap.topics.find((t) => t.id === (selectedTopicId || currentTopicId)) ||
    roadmap.topics[0];

  return (
    <div className="space-y-4">
      {/* Roadmap Header Summary */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border/60 shadow-sm">
        <div>
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            <span>{roadmap.lectureTopic}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
              Live AI Roadmap
            </span>
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> ~{roadmap.totalEstimatedMinutes} mins total
            </span>
            <span>•</span>
            <span>{roadmap.topics.length} Interactive Topics</span>
          </p>
        </div>

        {isLecturer && onGenerateRoadmap && (
          <Button
            variant="outline"
            size="sm"
            onClick={onGenerateRoadmap}
            disabled={isGenerating}
            className="h-8 text-xs rounded-full"
          >
            {isGenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 mr-1.5 text-chart-4" />
                Regenerate
              </>
            )}
          </Button>
        )}
      </div>

      {/* Topics Timeline Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Left Column: Topic List */}
        <div className="md:col-span-1 space-y-2 max-h-96 overflow-y-auto pr-1">
          {roadmap.topics.map((topic, index) => {
            const isCurrent = topic.id === currentTopicId;
            const isSelected = topic.id === activeTopic.id;

            return (
              <button
                key={topic.id}
                onClick={() => setSelectedTopicId(topic.id)}
                className={cn(
                  "w-full text-left p-3 rounded-xl border transition-all text-xs flex flex-col gap-1.5",
                  isSelected
                    ? "bg-primary/5 border-primary shadow-sm"
                    : "bg-card border-border/60 hover:bg-muted/40",
                  isCurrent && "ring-2 ring-primary/40"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px]">
                      {index + 1}
                    </span>
                    {topic.title}
                  </span>
                  {isCurrent && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-chart-2/20 text-chart-2 font-bold uppercase tracking-wider">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground line-clamp-1">{topic.description}</p>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                  <span>~{topic.estimatedDurationMinutes} mins</span>
                  {isLecturer && onSelectTopic && isCurrent && (
                    <span className="text-primary font-medium flex items-center">
                      Teaching Now
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Column: Detailed Active Topic View */}
        <div className="md:col-span-2 p-4 rounded-2xl bg-card border border-border/60 space-y-4">
          <div className="flex items-start justify-between border-b border-border/40 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase text-primary tracking-wider">
                Topic {activeTopic.order}
              </span>
              <h3 className="text-base font-bold text-foreground mt-0.5">{activeTopic.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{activeTopic.description}</p>
            </div>
            {isLecturer && onSelectTopic && activeTopic.id !== currentTopicId && (
              <Button
                size="sm"
                variant="default"
                onClick={() => onSelectTopic(activeTopic.id)}
                className="h-8 text-xs rounded-full"
              >
                <Play className="h-3.5 w-3.5 mr-1" /> Jump to Topic
              </Button>
            )}
          </div>

          {/* Learning Objectives */}
          {activeTopic.learningObjectives?.length > 0 && (
            <div className="space-y-1.5">
              <h5 className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                Learning Objectives
              </h5>
              <ul className="space-y-1">
                {activeTopic.learningObjectives.map((obj, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-chart-2 shrink-0 mt-0.5" />
                    <span>{obj}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggested Intuitive Analogies */}
          {activeTopic.suggestedAnalogies?.length > 0 && (
            <div className="space-y-1.5">
              <h5 className="text-[11px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5 text-chart-4" />
                Real-World Pedagogical Analogies
              </h5>
              <div className="space-y-1.5">
                {activeTopic.suggestedAnalogies.map((analogy, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-xl bg-chart-4/5 border border-chart-4/20 text-xs text-foreground/90 leading-relaxed"
                  >
                    {analogy}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Visual Assets Attached */}
          {activeTopic.suggestedVisualAssets && activeTopic.suggestedVisualAssets.length > 0 && (
            <div className="space-y-1.5">
              <h5 className="text-[11px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5 text-chart-2" />
                Visual Diagrams & Slides
              </h5>
              <div className="grid grid-cols-2 gap-2">
                {activeTopic.suggestedVisualAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex items-center gap-2 p-2 rounded-xl bg-muted/30 border border-border/40 text-xs"
                  >
                    <span className="font-medium text-foreground truncate">{asset.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
