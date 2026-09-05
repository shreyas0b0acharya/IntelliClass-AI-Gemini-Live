import type { Course, CourseFile, ClassroomSession, ChatMessage, Profile, MediaAsset } from "@/lib/supabase/types";
import type { User } from "@supabase/supabase-js";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

/**
 * Generic reusable fetch wrapper for all Next.js API requests.
 */
export async function fetchApi<T = unknown>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && options?.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...((options?.headers as Record<string, string>) || {}),
  };

  if (typeof window !== "undefined" && !headers["Authorization"]) {
    try {
      const { supabase } = await import("@/lib/supabase/client");
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
    } catch {}
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    let errorData: unknown = null;

    try {
      errorData = await response.json();
      const errObj = errorData as Record<string, unknown> | null;
      if (typeof errObj?.error === "string") {
        errorMessage = errObj.error;
      } else if (typeof errObj?.message === "string") {
        errorMessage = errObj.message;
      }
    } catch {
      try {
        const text = await response.text();
        if (text) errorMessage = text;
      } catch {}
    }

    throw new ApiError(errorMessage, response.status, errorData);
  }

  // If response is 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

/**
 * Unified Backend API Client
 */
export const api = {
  // ─── Profile ──────────────────────────────────────────────────────────────
  getProfile: async () => {
    try {
      return await fetchApi<{ profile: Profile | null; user: User | null }>("/api/profile");
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        return { profile: null, user: null };
      }
      throw err;
    }
  },

  saveProfile: async (data: { name: string; role: string }) => {
    return fetchApi<{ profile: Profile }>("/api/profile", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateProfile: async (data: { name?: string; role?: "lecturer" | "student" }) => {
    return fetchApi<{ profile: Profile }>("/api/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  deleteAccount: async () => {
    return fetchApi<{ success: boolean; message: string }>("/api/profile", {
      method: "DELETE",
    });
  },

  // ─── Settings & Model Preferences ──────────────────────────────────────────
  getSettings: async () => {
    return fetchApi<{ preferences: import("@/features/settings").ModelPreferences }>("/api/settings");
  },

  saveSettings: async (preferences: Partial<import("@/features/settings").ModelPreferences>) => {
    return fetchApi<{ preferences: import("@/features/settings").ModelPreferences; success: boolean }>("/api/settings", {
      method: "POST",
      body: JSON.stringify(preferences),
    });
  },

  // ─── Courses ──────────────────────────────────────────────────────────────
  getCourses: async () => {
    return fetchApi<{ courses: Course[] }>("/api/courses");
  },

  getCourse: async (courseId: string) => {
    return fetchApi<{ course: Course }>(`/api/courses/${courseId}`);
  },

  createCourse: async (data: { title: string; description?: string }) => {
    const res = await fetchApi<{ course: Course }>("/api/courses", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("intelliclass:courses-changed", { detail: res.course }));
    }
    return res;
  },

  deleteCourse: async (courseId: string) => {
    const res = await fetchApi<{ success: boolean }>(`/api/courses/${courseId}`, {
      method: "DELETE",
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("intelliclass:courses-changed", { detail: { deletedId: courseId } }));
    }
    return res;
  },

  // ─── Course Materials / Files ─────────────────────────────────────────────
  getCourseFiles: async (courseId: string) => {
    return fetchApi<{ files: CourseFile[] }>(`/api/courses/${courseId}/files`);
  },

  getMediaAssets: async (courseId: string) => {
    return fetchApi<{ assets: MediaAsset[] }>(`/api/courses/${courseId}/media-assets`);
  },

  deleteCourseFile: async (courseId: string, fileId: string) => {
    return fetchApi<{ success: boolean }>(`/api/courses/${courseId}/files/${fileId}`, {
      method: "DELETE",
    });
  },

  getCourseFileViewUrl: async (courseId: string, fileId: string) => {
    return fetchApi<{ file: CourseFile; viewUrl: string }>(
      `/api/courses/${courseId}/files/${fileId}`
    );
  },

  uploadCourseFile: async (courseId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("courseId", courseId);

    return fetchApi<{ fileUrl: string; file: CourseFile }>("/api/upload", {
      method: "POST",
      body: formData,
    });
  },

  processCourseFile: async (data: { fileUrl: string; fileName: string; courseId: string }) => {
    return fetchApi<{ status: string; totalChunks?: number }>("/api/process", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // ─── Sessions ─────────────────────────────────────────────────────────────
  getCourseSessions: async (courseId: string) => {
    return fetchApi<{ sessions: ClassroomSession[] }>(`/api/courses/${courseId}/sessions`);
  },

  createCourseSession: async (
    courseId: string,
    data: { topic: string; voice_id?: string; meeting_code?: string }
  ) => {
    return fetchApi<{ session: ClassroomSession }>(`/api/courses/${courseId}/sessions`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  getMeetingSession: async (code: string) => {
    return fetchApi<{ session: ClassroomSession }>(`/api/session/${encodeURIComponent(code)}`);
  },

  getSessionByCode: async (code: string) => {
    return fetchApi<{ session: ClassroomSession }>(`/api/session/${encodeURIComponent(code)}`);
  },

  generateSessionScript: async (
    sessionId: string,
    data: {
      courseId: string;
      topic: string;
      lecturerName?: string;
      sources?: Array<{ fileName: string; startPage?: number; endPage?: number }>;
      customPrompt?: string;
      voice?: string;
    }
  ) => {
    return fetchApi<{ status: string; script: string }>(
      `/api/classroom/${sessionId}/generate-script`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  },

  // ─── Classroom ────────────────────────────────────────────────────────────
  getClassroomSession: async (sessionId: string) => {
    return fetchApi<{ session: ClassroomSession }>(`/api/classroom/${sessionId}`);
  },

  updateClassroomSession: async (
    sessionId: string,
    updates: {
      status?: string;
      sequence?: number;
      current_item_id?: string;
      current_sentence_index?: number;
      stopped_reason?: string;
      script?: string;
      topic?: string;
      voice_id?: string;
      driverTabId?: string;
      releaseLease?: boolean;
      target_epoch_ms?: number;
      duration_ms?: number;
    }
  ) => {
    return fetchApi<{
      session: ClassroomSession;
      success?: boolean;
      isDriver?: boolean;
      activeDriverTabId?: string | null;
      driverLeaseVersion?: number;
    }>(`/api/classroom/${sessionId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  },

  updateSessionMeta: async (
    sessionId: string,
    updates: { topic?: string; voice_id?: string }
  ) => {
    return fetchApi<{ session: ClassroomSession }>(`/api/classroom/${sessionId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  },

  deleteSession: async (sessionId: string) => {
    const res = await fetchApi<{ success: boolean }>(`/api/classroom/${sessionId}`, {
      method: "DELETE",
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("intelliclass:sessions-changed", { detail: { deletedId: sessionId } }));
    }
    return res;
  },

  getClassroomSnapshot: async (sessionId: string) => {
    return fetchApi<{
      session: ClassroomSession;
      myStatus: string;
      myRole: "lecturer" | "student";
      stateVersion: number;
      driverLeaseVersion: number;
      activeDriverTabId: string | null;
      driverLeaseExpiresAt: string | null;
      targetEpochMs: number;
      durationMs: number;
      participants: { userId: string; name: string; role: string; status: string }[];
    }>(`/api/classroom/${sessionId}/snapshot`);
  },


  // ─── Messages & Live Chat ─────────────────────────────────────────────────
  getMessages: async (sessionId: string) => {
    return fetchApi<{ messages: ChatMessage[] }>(`/api/classroom/${sessionId}/messages`);
  },

  sendMessage: async (
    sessionId: string,
    data: {
      role: "user" | "ai";
      message: string;
      user_id?: string;
    }
  ) => {
    return fetchApi<{ message: ChatMessage }>(`/api/classroom/${sessionId}/messages`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  askQuestion: async (
    sessionId: string,
    data: {
      question: string;
      courseId: string;
      studentName: string;
      lecturerName?: string;
      lastSpokenSentence?: string;
      sessionTopic?: string;
      currentIndex?: number;
    }
  ) => {
    return fetchApi<{ answer: string; mode: string }>(`/api/classroom/${sessionId}/ask`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};
