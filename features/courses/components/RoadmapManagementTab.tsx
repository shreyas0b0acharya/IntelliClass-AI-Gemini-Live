"use client";

import { useState, useEffect, useCallback } from "react";
import type { CourseRoadmapItem, CourseFile } from "@/lib/supabase/types";
import type { SessionRoadmap, RoadmapTopic } from "@/features/classroom/types/roadmap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MapPin,
  Plus,
  Sparkles,
  Clock,
  BookOpen,
  FileText,
  ChevronDown,
  ChevronUp,
  Trash2,
  CheckCircle2,
  Loader2,
  Radio,
  Layers,
  Edit3,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface RoadmapManagementTabProps {
  courseId: string;
  isLecturer: boolean;
  materials: CourseFile[];
}

export function RoadmapManagementTab({
  courseId,
  isLecturer,
  materials,
}: RoadmapManagementTabProps) {
  const [roadmaps, setRoadmaps] = useState<CourseRoadmapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoadmap, setSelectedRoadmap] = useState<CourseRoadmapItem | null>(null);

  // Synchronized course materials state
  const [availableMaterials, setAvailableMaterials] = useState<CourseFile[]>(materials);

  useEffect(() => {
    setAvailableMaterials(materials);
  }, [materials]);

  const refreshMaterials = useCallback(async () => {
    try {
      const { files } = await api.getCourseFiles(courseId);
      if (files) {
        setAvailableMaterials(files);
        return files;
      }
    } catch (err) {
      console.warn("Failed to fetch fresh materials for roadmap:", err);
    }
    return materials;
  }, [courseId, materials]);

  useEffect(() => {
    const handler = () => {
      refreshMaterials();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("intelliclass:materials-updated", handler);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("intelliclass:materials-updated", handler);
      }
    };
  }, [refreshMaterials]);

  // Creation & Full Editor Dialog State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRoadmapId, setEditingRoadmapId] = useState<string | null>(null);
  const [creationMode, setCreationMode] = useState<"ai" | "manual">("ai");
  const [roadmapTitle, setRoadmapTitle] = useState("");
  const [learningGoals, setLearningGoals] = useState("");
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // Unified Editor Canvas State
  const [editorTopics, setEditorTopics] = useState<RoadmapTopic[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Delete Roadmap Confirmation Dialog State
  const [deleteTargetRoadmap, setDeleteTargetRoadmap] = useState<CourseRoadmapItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Focused Topic Editing Modal State (for quick edits directly in the inspection view)
  const [focusedTopicEdit, setFocusedTopicEdit] = useState<{
    topicIndex: number;
    topic: RoadmapTopic;
  } | null>(null);
  const [isUpdatingTopic, setIsUpdatingTopic] = useState(false);

  const fetchRoadmaps = async () => {
    setLoading(true);
    try {
      const res = await api.getCourseRoadmaps(courseId);
      setRoadmaps(res.roadmaps || []);
      if (res.roadmaps && res.roadmaps.length > 0) {
        // Keep selected roadmap if still present, otherwise default to first
        setSelectedRoadmap((prev) => {
          if (!prev) return res.roadmaps[0];
          const match = res.roadmaps.find((r) => r.id === prev.id);
          return match || res.roadmaps[0];
        });
      } else {
        setSelectedRoadmap(null);
      }
    } catch (err) {
      console.error("Error fetching roadmaps:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoadmaps();
  }, [courseId]);

  const openCreateDialog = async () => {
    setEditingRoadmapId(null);
    setRoadmapTitle("");
    setLearningGoals("");
    const fresh = await refreshMaterials();
    const filesToUse = fresh && fresh.length > 0 ? fresh : availableMaterials;
    setSelectedMaterials(filesToUse.map((m: CourseFile) => m.file_name));
    setEditorTopics([]);
    setCreationMode("ai");
    setIsCreateOpen(true);
  };

  const openEditDialog = (rm: CourseRoadmapItem) => {
    setEditingRoadmapId(rm.id);
    setRoadmapTitle(rm.title);
    setLearningGoals(rm.roadmap?.learningGoals || "");
    const sources = (rm.roadmap?.sources?.map((s: { fileName: string }) => s.fileName) || []) as string[];
    setSelectedMaterials(sources);
    setEditorTopics(Array.isArray(rm.roadmap?.topics) ? [...rm.roadmap.topics] : []);
    setCreationMode("manual");
    setIsCreateOpen(true);
  };

  // Handle "Create with AI" Generation
  const handleAIGenerate = async () => {
    if (selectedMaterials.length === 0) {
      toast.error("Please select at least 1 source material to ground the roadmap.");
      return;
    }
    if (!roadmapTitle.trim()) {
      toast.error("Please provide a roadmap title.");
      return;
    }

    setIsGeneratingAI(true);
    try {
      const sources = selectedMaterials.map((f) => ({ fileName: f }));
      const res = await api.generateCourseRoadmap(courseId, {
        lectureTopic: roadmapTitle.trim(),
        targetDurationMinutes: 45,
        sources,
        customPrompt: learningGoals.trim() ? `Learning Goals: ${learningGoals.trim()}` : undefined,
      });

      if (res.roadmap?.topics) {
        const taggedTopics = res.roadmap.topics.map((t) => ({
          ...t,
          sourceReferences: t.sourceReferences && t.sourceReferences.length > 0 ? t.sourceReferences : selectedMaterials,
        }));
        setEditorTopics(taggedTopics);
        toast.success("AI generated curriculum topics grounded in your materials! Review and edit them below.");
      }
    } catch (err: unknown) {
      console.error("AI Roadmap Generation error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to generate roadmap.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Add a blank manual topic in editor
  const handleAddManualTopic = () => {
    const nextOrder = editorTopics.length + 1;
    const newTopic: RoadmapTopic = {
      id: `topic_${Date.now()}`,
      order: nextOrder,
      title: `Topic ${nextOrder}: New Objective`,
      description: "Explain core fundamentals and provide practical examples.",
      learningObjectives: ["Understand fundamental definitions", "Analyze practical implementations"],
      subtopics: [],
      suggestedAnalogies: [],
      suggestedVisualAssets: [],
      estimatedDurationMinutes: 10,
    };
    setEditorTopics([...editorTopics, newTopic]);
  };

  // Update a field in an editor topic
  const handleUpdateTopic = (idx: number, updates: Partial<RoadmapTopic>) => {
    setEditorTopics((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...updates };
      return copy;
    });
  };

  // Delete a topic in editor
  const handleDeleteTopic = (idx: number) => {
    setEditorTopics((prev) => prev.filter((_, i) => i !== idx));
  };

  // Reorder topics in editor
  const handleMoveEditorTopic = (idx: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= editorTopics.length) return;
    setEditorTopics((prev) => {
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy.map((t, i) => ({ ...t, order: i + 1 }));
    });
  };

  // Save Roadmap (Create or Update)
  const handleSaveRoadmap = async (publish: boolean) => {
    if (!roadmapTitle.trim()) {
      toast.error("Please provide a roadmap title.");
      return;
    }
    if (editorTopics.length === 0) {
      toast.error("Please add at least one topic to the roadmap.");
      return;
    }

    setIsSaving(true);
    try {
      const fullRoadmap: SessionRoadmap = {
        version: "2.0",
        courseId,
        sessionId: "",
        lectureTopic: roadmapTitle.trim(),
        totalEstimatedMinutes: editorTopics.reduce(
          (acc, t) => acc + (t.estimatedDurationMinutes || 10),
          0
        ),
        sources: selectedMaterials.map((f) => ({ fileName: f })),
        topics: editorTopics,
      };

      if (editingRoadmapId) {
        const res = await api.updateCourseRoadmap(courseId, editingRoadmapId, {
          title: roadmapTitle.trim(),
          roadmap: fullRoadmap,
          publish,
        });
        if (res.roadmapItem) {
          setRoadmaps((prev) => prev.map((r) => (r.id === editingRoadmapId ? res.roadmapItem : r)));
          if (selectedRoadmap?.id === editingRoadmapId) {
            setSelectedRoadmap(res.roadmapItem);
          }
        }
        toast.success(publish ? "Roadmap updated and published!" : "Roadmap updated and saved as draft.");
      } else {
        await api.createCourseRoadmap(courseId, {
          title: roadmapTitle.trim(),
          roadmap: fullRoadmap,
          publish,
        });
        toast.success(publish ? "Roadmap published to course space!" : "Roadmap saved as draft.");
      }

      setIsCreateOpen(false);
      setEditingRoadmapId(null);
      setEditorTopics([]);
      setRoadmapTitle("");
      setLearningGoals("");
      fetchRoadmaps();
    } catch (err: unknown) {
      console.error("Save roadmap error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to save roadmap.");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Roadmap
  const handleDeleteRoadmap = async () => {
    if (!deleteTargetRoadmap) return;
    setIsDeleting(true);
    try {
      await api.deleteCourseRoadmap(courseId, deleteTargetRoadmap.id);
      toast.success(`Roadmap "${deleteTargetRoadmap.title}" deleted.`);
      const remaining = roadmaps.filter((r) => r.id !== deleteTargetRoadmap.id);
      setRoadmaps(remaining);
      if (selectedRoadmap?.id === deleteTargetRoadmap.id) {
        setSelectedRoadmap(remaining[0] || null);
      }
      setDeleteTargetRoadmap(null);
    } catch (err: unknown) {
      console.error("Delete roadmap error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to delete roadmap.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Toggle Publish / Draft
  const handleTogglePublish = async (rm: CourseRoadmapItem) => {
    const newStatus = rm.status === "published" ? "draft" : "published";
    try {
      const res = await api.updateCourseRoadmap(courseId, rm.id, {
        publish: newStatus === "published",
      });
      if (res.roadmapItem) {
        setRoadmaps((prev) =>
          prev.map((r) => (r.id === rm.id ? { ...r, status: newStatus } : r))
        );
        if (selectedRoadmap?.id === rm.id) {
          setSelectedRoadmap((prev) => (prev ? { ...prev, status: newStatus } : null));
        }
      }
      toast.success(newStatus === "published" ? "Roadmap published to course space!" : "Roadmap changed to draft.");
    } catch (err: unknown) {
      console.error("Toggle publish error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to update roadmap status.");
    }
  };

  // Direct Topic Reorder on Selected Roadmap
  const handleMoveSelectedTopic = async (topicIdx: number, direction: "up" | "down") => {
    if (!selectedRoadmap || !selectedRoadmap.roadmap?.topics) return;
    const topics = [...selectedRoadmap.roadmap.topics];
    const targetIdx = direction === "up" ? topicIdx - 1 : topicIdx + 1;
    if (targetIdx < 0 || targetIdx >= topics.length) return;

    const temp = topics[topicIdx];
    topics[topicIdx] = topics[targetIdx];
    topics[targetIdx] = temp;

    const updatedTopics = topics.map((t, idx) => ({ ...t, order: idx + 1 }));
    const updatedRoadmap = {
      ...selectedRoadmap.roadmap,
      topics: updatedTopics,
    };

    try {
      await api.updateCourseRoadmap(courseId, selectedRoadmap.id, {
        roadmap: updatedRoadmap,
      });
      const updatedItem = {
        ...selectedRoadmap,
        roadmap: updatedRoadmap,
      };
      setSelectedRoadmap(updatedItem);
      setRoadmaps((prev) => prev.map((r) => (r.id === selectedRoadmap.id ? updatedItem : r)));
      toast.success("Topic sequence updated.");
    } catch (err) {
      console.error("Failed to reorder topic:", err);
      toast.error("Failed to update topic order.");
    }
  };

  // Direct Topic Delete from Selected Roadmap
  const handleDeleteSelectedTopic = async (topicIdx: number) => {
    if (!selectedRoadmap || !selectedRoadmap.roadmap?.topics) return;
    const topics = selectedRoadmap.roadmap.topics.filter((_: unknown, i: number) => i !== topicIdx);
    const updatedTopics = topics.map((t: RoadmapTopic, idx: number) => ({ ...t, order: idx + 1 }));

    const updatedRoadmap = {
      ...selectedRoadmap.roadmap,
      topics: updatedTopics,
      totalEstimatedMinutes: updatedTopics.reduce(
        (acc: number, t: RoadmapTopic) => acc + (t.estimatedDurationMinutes || 10),
        0
      ),
    };

    try {
      await api.updateCourseRoadmap(courseId, selectedRoadmap.id, {
        roadmap: updatedRoadmap,
      });
      const updatedItem = {
        ...selectedRoadmap,
        topicsCount: updatedTopics.length,
        roadmap: updatedRoadmap,
      };
      setSelectedRoadmap(updatedItem);
      setRoadmaps((prev) => prev.map((r) => (r.id === selectedRoadmap.id ? updatedItem : r)));
      toast.success("Topic removed from roadmap.");
    } catch (err) {
      console.error("Failed to delete topic:", err);
      toast.error("Failed to delete topic.");
    }
  };

  // Direct Topic Add to Selected Roadmap
  const handleAddTopicToSelectedRoadmap = async () => {
    if (!selectedRoadmap || !selectedRoadmap.roadmap) return;
    const currentTopics = selectedRoadmap.roadmap.topics || [];
    const nextOrder = currentTopics.length + 1;
    const newTopic: RoadmapTopic = {
      id: `topic_${Date.now()}`,
      order: nextOrder,
      title: `Topic ${nextOrder}: New Objective`,
      description: "Explain core fundamentals and provide practical examples.",
      learningObjectives: ["Understand fundamental definitions", "Analyze practical implementations"],
      subtopics: [],
      suggestedAnalogies: [],
      suggestedVisualAssets: [],
      estimatedDurationMinutes: 10,
    };

    const updatedTopics = [...currentTopics, newTopic];
    const updatedRoadmap = {
      ...selectedRoadmap.roadmap,
      topics: updatedTopics,
      totalEstimatedMinutes: updatedTopics.reduce(
        (acc: number, t: RoadmapTopic) => acc + (t.estimatedDurationMinutes || 10),
        0
      ),
    };

    try {
      await api.updateCourseRoadmap(courseId, selectedRoadmap.id, {
        roadmap: updatedRoadmap,
      });
      const updatedItem = {
        ...selectedRoadmap,
        topicsCount: updatedTopics.length,
        roadmap: updatedRoadmap,
      };
      setSelectedRoadmap(updatedItem);
      setRoadmaps((prev) => prev.map((r) => (r.id === selectedRoadmap.id ? updatedItem : r)));
      toast.success("Added new topic to roadmap.");
    } catch (err) {
      console.error("Failed to add topic:", err);
      toast.error("Failed to add new topic.");
    }
  };

  // Save Focused Topic Modal Edit
  const handleSaveFocusedTopicEdit = async () => {
    if (!focusedTopicEdit || !selectedRoadmap || !selectedRoadmap.roadmap?.topics) return;
    setIsUpdatingTopic(true);
    try {
      const topics = [...selectedRoadmap.roadmap.topics];
      topics[focusedTopicEdit.topicIndex] = focusedTopicEdit.topic;

      const updatedRoadmap = {
        ...selectedRoadmap.roadmap,
        topics,
        totalEstimatedMinutes: topics.reduce(
          (acc: number, t: RoadmapTopic) => acc + (t.estimatedDurationMinutes || 10),
          0
        ),
      };

      await api.updateCourseRoadmap(courseId, selectedRoadmap.id, {
        roadmap: updatedRoadmap,
      });

      const updatedItem = {
        ...selectedRoadmap,
        roadmap: updatedRoadmap,
      };
      setSelectedRoadmap(updatedItem);
      setRoadmaps((prev) => prev.map((r) => (r.id === selectedRoadmap.id ? updatedItem : r)));
      setFocusedTopicEdit(null);
      toast.success("Topic updated successfully.");
    } catch (err) {
      console.error("Failed to update topic:", err);
      toast.error("Failed to save topic changes.");
    } finally {
      setIsUpdatingTopic(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── Header Bar ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-3xl border border-black/5 dark:border-white/5 bg-white dark:bg-card shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-chart-4/15 text-chart-4 flex items-center justify-center shrink-0">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Roadmap Management
              </h2>
              <p className="text-xs text-muted-foreground">
                Author, edit, organize, and publish course learning sequences and pedagogical goals.
              </p>
            </div>
          </div>
        </div>

        {isLecturer && (
          <Button
            variant="default"
            size="sm"
            onClick={openCreateDialog}
            className="h-10 px-4 font-semibold shrink-0"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            <span>Create Roadmap</span>
          </Button>
        )}
      </div>

      {/* ── Main View (Switcher + Inspector) ────────────────────────────── */}
      {loading ? (
        <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span>Loading course curriculum roadmaps...</span>
        </div>
      ) : roadmaps.length === 0 ? (
        <div className="p-12 rounded-3xl border border-dashed border-black/10 dark:border-white/10 text-center space-y-4 bg-black/[0.01] dark:bg-white/[0.01]">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <BookOpen className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-base text-foreground">No Roadmaps Created</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Create your first structured curriculum roadmap. You can generate topics with AI from syllabus PDFs or design topics manually.
            </p>
          </div>
          {isLecturer && (
            <Button
              variant="default"
              size="sm"
              onClick={openCreateDialog}
              className="h-9 px-5"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              <span>Create Curriculum Roadmap</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Roadmap Switcher List (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Course Roadmaps ({roadmaps.length})
              </h3>
            </div>
            <div className="space-y-2">
              {roadmaps.map((rm) => {
                const isSelected = selectedRoadmap?.id === rm.id;
                return (
                  <div
                    key={rm.id}
                    onClick={() => setSelectedRoadmap(rm)}
                    className={`group p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-primary/10 border-primary/40 shadow-xs"
                        : "bg-white dark:bg-card border-black/5 dark:border-white/5 hover:border-black/15"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-foreground truncate flex-1">{rm.title}</h4>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            rm.status === "published"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-zinc-500/10 text-zinc-600"
                          }`}
                        >
                          {rm.status}
                        </span>
                        {isLecturer && (
                          <div className="flex items-center opacity-70 group-hover:opacity-100 transition-opacity">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditDialog(rm);
                              }}
                              title="Edit Roadmap"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTargetRoadmap(rm);
                              }}
                              title="Delete Roadmap"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2 font-medium">
                      <span>{rm.topicsCount} Topics</span>
                      <span>&bull;</span>
                      <span>{rm.objectivesCount} Objectives</span>
                      <span>&bull;</span>
                      <span>~{rm.estimatedMinutes} mins</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Selected Roadmap Topics Inspection & Direct Management (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {selectedRoadmap && selectedRoadmap.roadmap?.topics ? (
              <div className="p-6 rounded-3xl border border-black/5 dark:border-white/5 bg-white dark:bg-card shadow-xs space-y-6">
                {/* Selected Roadmap Header with Full Action Controls */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-black/5 dark:border-white/5">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-lg font-bold text-foreground">{selectedRoadmap.title}</h3>
                      <span
                        className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                          selectedRoadmap.status === "published"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-zinc-500/10 text-zinc-600 border border-zinc-500/20"
                        }`}
                      >
                        {selectedRoadmap.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" />
                      <span>~{selectedRoadmap.estimatedMinutes} minutes total</span>
                      <span>&bull;</span>
                      <span>{selectedRoadmap.topicsCount} sequential learning topics</span>
                    </p>
                  </div>

                  {isLecturer && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTogglePublish(selectedRoadmap)}
                        className="h-8 text-xs font-semibold gap-1.5"
                      >
                        {selectedRoadmap.status === "published" ? (
                          <>
                            <Radio className="h-3.5 w-3.5 text-emerald-500" />
                            <span>Mark Draft</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Publish</span>
                          </>
                        )}
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(selectedRoadmap)}
                        className="h-8 text-xs font-semibold gap-1.5"
                      >
                        <Edit3 className="h-3.5 w-3.5 text-primary" />
                        <span>Edit Roadmap</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteTargetRoadmap(selectedRoadmap)}
                        className="h-8 text-xs font-semibold gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete</span>
                      </Button>
                    </div>
                  )}
                </div>

                {/* Linked Source Materials Banner */}
                {selectedRoadmap.roadmap?.sources && selectedRoadmap.roadmap.sources.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap p-3.5 rounded-2xl bg-sky-500/5 border border-sky-500/20">
                    <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      Grounded In Sources:
                    </span>
                    {selectedRoadmap.roadmap.sources.map((s: { fileName: string }, i: number) => (
                      <span key={i} className="text-xs px-2.5 py-0.5 rounded-lg bg-card border border-border/60 font-medium text-foreground">
                        {s.fileName}
                      </span>
                    ))}
                  </div>
                )}

                {/* Topics List with Inline Action Controls */}
                <div className="space-y-3">
                  {selectedRoadmap.roadmap.topics.map((t: RoadmapTopic, index: number) => (
                    <div
                      key={t.id || index}
                      className="p-4 rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold font-mono">
                            {index + 1}
                          </span>
                          <h4 className="text-sm font-bold text-foreground">{t.title}</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground font-mono">
                            ~{t.estimatedDurationMinutes || 10}m
                          </span>
                          {isLecturer && (
                            <div className="flex items-center gap-0.5 pl-2 border-l border-border/50">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                disabled={index === 0}
                                onClick={() => handleMoveSelectedTopic(index, "up")}
                                title="Move Up"
                                className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-30"
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                disabled={index === (selectedRoadmap.roadmap?.topics?.length || 1) - 1}
                                onClick={() => handleMoveSelectedTopic(index, "down")}
                                title="Move Down"
                                className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-30"
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => setFocusedTopicEdit({ topicIndex: index, topic: { ...t } })}
                                title="Edit Topic Details"
                                className="h-6 w-6 text-muted-foreground hover:text-primary"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => handleDeleteSelectedTopic(index)}
                                title="Delete Topic"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Topic Linked Sources */}
                      {t.sourceReferences && t.sourceReferences.length > 0 && (
                        <div className="pl-9 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">Source Grounding:</span>
                          {t.sourceReferences.map((src, i) => (
                            <span key={i} className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/50 font-medium">
                              {src}
                            </span>
                          ))}
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground leading-relaxed pl-9">
                        {t.description}
                      </p>

                      {t.learningObjectives && t.learningObjectives.length > 0 && (
                        <div className="pl-9 space-y-1">
                          <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                            Objectives:
                          </span>
                          <ul className="text-xs text-muted-foreground space-y-0.5 list-disc pl-4">
                            {t.learningObjectives.map((obj, i) => (
                              <li key={i}>{obj}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add Topic Button in Inspector */}
                  {isLecturer && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddTopicToSelectedRoadmap}
                      className="w-full h-9 border-dashed text-xs text-muted-foreground hover:text-foreground gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Topic to this Roadmap</span>
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground border rounded-2xl">
                Select a roadmap from the left column to inspect and manage its topic sequence.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Create / Edit Full Roadmap Dialog ─────────────────────────── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="w-[85vw] max-w-[85vw] h-[85vh] max-h-[85vh] flex flex-col p-0 overflow-hidden">
          {/* Dialog Header */}
          <div className="p-6 border-b border-black/5 dark:border-white/10 shrink-0 bg-black/[0.02] dark:bg-white/[0.02]">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-chart-4/15 text-chart-4 flex items-center justify-center">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle>{editingRoadmapId ? "Edit Course Roadmap" : "Create Course Roadmap"}</DialogTitle>
                  <DialogDescription>
                    {editingRoadmapId
                      ? "Update the roadmap title, ground in materials, edit topics, or reorder the curriculum sequence."
                      : "Design a structured curriculum sequence. Generate topics with Gemini AI or organize topics manually."}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* Dialog Scrollable Body */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {/* Step 1: Source Material Selection */}
            <div className="space-y-3 p-4 rounded-2xl bg-muted/30 border border-border/60">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  Step 1: Select Source Materials (Required) *
                </Label>
                {materials.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => setSelectedMaterials(materials.map((m) => m.file_name))}
                      className="h-6 text-[11px] px-2 text-primary hover:text-primary/80"
                    >
                      Select All
                    </Button>
                    <span className="text-muted-foreground text-xs">•</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => setSelectedMaterials([])}
                      className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>

              {materials.length === 0 ? (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 space-y-2">
                  <p className="font-semibold">No course materials uploaded yet</p>
                  <p>
                    Roadmaps must be grounded in your syllabus or textbook content. Please upload materials in the Materials tab first.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 rounded-xl border border-border/60 bg-background">
                    {materials.map((m) => {
                      const isSelected = selectedMaterials.includes(m.file_name);
                      return (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => {
                            setSelectedMaterials((prev) =>
                              isSelected ? prev.filter((f) => f !== m.file_name) : [...prev, m.file_name]
                            );
                          }}
                          className={`text-xs px-3 py-1.5 rounded-xl border transition-all flex items-center gap-2 ${
                            isSelected
                              ? "bg-primary/10 text-primary border-primary/40 font-semibold shadow-xs ring-1 ring-primary/20"
                              : "bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted/70"
                          }`}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span className="truncate max-w-xs">{m.file_name}</span>
                          {isSelected && <CheckCircle2 className="h-3.5 w-3.5 ml-1 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  {selectedMaterials.length === 0 ? (
                    <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      ⚠️ Please select at least 1 source material to ground the curriculum topics and objectives in your content.
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      ✓ {selectedMaterials.length} of {materials.length} material{materials.length !== 1 ? "s" : ""} selected for grounding.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rm-title" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Step 2: Roadmap Title *
                </Label>
                <Input
                  id="rm-title"
                  placeholder="e.g. Object-Oriented Programming Fundamentals"
                  value={roadmapTitle}
                  onChange={(e) => setRoadmapTitle(e.target.value)}
                  disabled={isGeneratingAI || isSaving}
                  required
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rm-goals" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Learning Focus / Scope (Optional)
                </Label>
                <Input
                  id="rm-goals"
                  placeholder="e.g. Focus on memory layout, polymorphism, and Java design patterns"
                  value={learningGoals}
                  onChange={(e) => setLearningGoals(e.target.value)}
                  disabled={isGeneratingAI || isSaving}
                  className="rounded-xl"
                />
              </div>
            </div>

            {/* Topic Generation / Assembly Options */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-muted/30 border border-border/60">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mr-1">
                  Topic Assembly:
                </span>
                <Button
                  type="button"
                  variant={creationMode === "ai" ? "default" : "outline"}
                  size="xs"
                  onClick={() => setCreationMode("ai")}
                  className="h-8 text-xs font-medium rounded-xl"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  <span>{editingRoadmapId ? "Regenerate with AI" : "Create with AI"}</span>
                </Button>
                <Button
                  type="button"
                  variant={creationMode === "manual" ? "default" : "outline"}
                  size="xs"
                  onClick={() => setCreationMode("manual")}
                  className="h-8 text-xs font-medium rounded-xl"
                >
                  <Edit3 className="h-3 w-3 mr-1" />
                  <span>Manual Editing</span>
                </Button>
              </div>

              {creationMode === "ai" && (
                <Button
                  type="button"
                  variant="default"
                  size="xs"
                  onClick={handleAIGenerate}
                  disabled={isGeneratingAI || !roadmapTitle.trim() || selectedMaterials.length === 0}
                  className="h-8 text-xs font-semibold rounded-xl gap-1.5 shadow-xs"
                >
                  {isGeneratingAI ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Retrieving &amp; Grounding...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5 text-chart-4" />
                      <span>Generate Grounded Topics</span>
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Unified Editor Canvas */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <span>Curriculum Topics ({editorTopics.length})</span>
                </h4>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={handleAddManualTopic}
                  className="h-7 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  <span>Add Topic</span>
                </Button>
              </div>

              {editorTopics.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-2xl">
                  {creationMode === "ai"
                    ? "Click 'Generate Grounded Topics' to let Gemini build a structured roadmap from your materials, or add topics manually."
                    : "Click '+ Add Topic' to assemble your curriculum topics and learning objectives."}
                </div>
              ) : (
                <div className="space-y-3">
                  {editorTopics.map((topic, idx) => (
                    <div
                      key={topic.id || idx}
                      className="p-4 rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-card space-y-3 shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-bold font-mono">
                            {idx + 1}
                          </span>
                          <Input
                            value={topic.title}
                            onChange={(e) => handleUpdateTopic(idx, { title: e.target.value })}
                            className="h-8 text-xs font-semibold"
                            placeholder="Topic title..."
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            min={1}
                            max={120}
                            value={topic.estimatedDurationMinutes || 10}
                            onChange={(e) =>
                              handleUpdateTopic(idx, {
                                estimatedDurationMinutes: parseInt(e.target.value, 10) || 10,
                              })
                            }
                            className="w-16 h-8 text-xs font-mono text-center"
                            title="Duration (mins)"
                          />
                          <span className="text-[11px] text-muted-foreground mr-1">mins</span>

                          {/* Reorder and Delete Controls */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            disabled={idx === 0}
                            onClick={() => handleMoveEditorTopic(idx, "up")}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-30"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            disabled={idx === editorTopics.length - 1}
                            onClick={() => handleMoveEditorTopic(idx, "down")}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-30"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleDeleteTopic(idx)}
                            className="h-8 w-8 text-muted-foreground hover:text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <Textarea
                        rows={2}
                        value={topic.description}
                        onChange={(e) => handleUpdateTopic(idx, { description: e.target.value })}
                        className="text-xs resize-none"
                        placeholder="Pedagogical explanation, key concepts, and overview..."
                      />

                      {/* Learning Objectives Editor */}
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                          Learning Objectives (one per line)
                        </Label>
                        <Textarea
                          rows={2}
                          value={(topic.learningObjectives || []).join("\n")}
                          onChange={(e) =>
                            handleUpdateTopic(idx, {
                              learningObjectives: e.target.value
                                .split("\n")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          className="text-xs font-mono resize-none"
                          placeholder="Understand core terminology&#10;Analyze design trade-offs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Dialog Footer Actions */}
          <div className="p-4 border-t border-black/5 dark:border-white/10 shrink-0 flex items-center justify-between bg-black/[0.01]">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsCreateOpen(false);
                setEditingRoadmapId(null);
              }}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleSaveRoadmap(false)}
                disabled={isSaving || editorTopics.length === 0}
              >
                {editingRoadmapId ? "Save as Draft" : "Save Draft"}
              </Button>
              <Button
                type="button"
                variant="default"
                onClick={() => handleSaveRoadmap(true)}
                disabled={isSaving || editorTopics.length === 0}
              >
                {isSaving ? "Saving..." : editingRoadmapId ? "Update & Publish" : "Publish Roadmap"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Roadmap Confirmation Dialog ────────────────────────── */}
      <Dialog
        open={Boolean(deleteTargetRoadmap)}
        onOpenChange={(open) => !open && setDeleteTargetRoadmap(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="w-10 h-10 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-2">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle>Delete Curriculum Roadmap</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the roadmap{" "}
              <strong className="text-foreground font-semibold">
                &ldquo;{deleteTargetRoadmap?.title}&rdquo;
              </strong>
              ? This will remove this roadmap sequence from the course space.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTargetRoadmap(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteRoadmap}
              disabled={isDeleting}
              className="gap-1.5"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  <span>Delete Roadmap</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Focused Topic Edit Modal (for quick direct edits from inspector) ── */}
      <Dialog
        open={Boolean(focusedTopicEdit)}
        onOpenChange={(open) => !open && setFocusedTopicEdit(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Edit Topic {focusedTopicEdit ? focusedTopicEdit.topicIndex + 1 : ""}
            </DialogTitle>
            <DialogDescription>
              Modify the title, duration, overview, and learning objectives for this topic.
            </DialogDescription>
          </DialogHeader>

          {focusedTopicEdit && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-3 space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Title</Label>
                  <Input
                    value={focusedTopicEdit.topic.title}
                    onChange={(e) =>
                      setFocusedTopicEdit({
                        ...focusedTopicEdit,
                        topic: { ...focusedTopicEdit.topic, title: e.target.value },
                      })
                    }
                    className="text-xs"
                  />
                </div>
                <div className="col-span-1 space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Duration</Label>
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    value={focusedTopicEdit.topic.estimatedDurationMinutes || 10}
                    onChange={(e) =>
                      setFocusedTopicEdit({
                        ...focusedTopicEdit,
                        topic: {
                          ...focusedTopicEdit.topic,
                          estimatedDurationMinutes: parseInt(e.target.value, 10) || 10,
                        },
                      })
                    }
                    className="text-xs font-mono text-center"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">
                  Overview &amp; Description
                </Label>
                <Textarea
                  rows={3}
                  value={focusedTopicEdit.topic.description}
                  onChange={(e) =>
                    setFocusedTopicEdit({
                      ...focusedTopicEdit,
                      topic: { ...focusedTopicEdit.topic, description: e.target.value },
                    })
                  }
                  className="text-xs resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">
                  Learning Objectives (one per line)
                </Label>
                <Textarea
                  rows={3}
                  value={(focusedTopicEdit.topic.learningObjectives || []).join("\n")}
                  onChange={(e) =>
                    setFocusedTopicEdit({
                      ...focusedTopicEdit,
                      topic: {
                        ...focusedTopicEdit.topic,
                        learningObjectives: e.target.value
                          .split("\n")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      },
                    })
                  }
                  className="text-xs font-mono resize-none"
                  placeholder="Understand definitions&#10;Implement solution"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFocusedTopicEdit(null)}
              disabled={isUpdatingTopic}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleSaveFocusedTopicEdit}
              disabled={isUpdatingTopic}
            >
              {isUpdatingTopic ? "Saving..." : "Save Topic Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
