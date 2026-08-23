import { splitIntoSmallChunks } from "@/components/TTS/sentenceSplitter";

export type BaseLectureItem = {
  id: string;
  order: number;
};

export type LectureSpeechItem = BaseLectureItem & {
  type: "speech";
  text: string;
};

export type LecturePauseItem = BaseLectureItem & {
  type: "pause";
  durationMs: number;
};

export type LectureEngagementItem = BaseLectureItem & {
  type: "engagement";
  prompt: string;
};

export type LectureImageItem = BaseLectureItem & {
  type: "image";
  mediaRef: string;
  caption?: string;
};

export type LectureVideoItem = BaseLectureItem & {
  type: "video";
  mediaRef: string;
  caption?: string;
};

export type LectureItem =
  | LectureSpeechItem
  | LecturePauseItem
  | LectureEngagementItem
  | LectureImageItem
  | LectureVideoItem;

export interface ParsedLecture {
  items: LectureItem[];
  speechItems: LectureSpeechItem[];
  mediaMap: Map<string, { type: "image" | "video"; ref: string; caption?: string }>;
}

export function parseLectureScript(script: string): ParsedLecture {
  const items: LectureItem[] = [];
  const speechItems: LectureSpeechItem[] = [];
  const mediaMap = new Map<string, { type: "image" | "video"; ref: string; caption?: string }>();

  if (!script || !script.trim()) {
    return { items, speechItems, mediaMap };
  }

  // Tokenize pauses, engagement, and media tags in order
  const processed = script
    .replace(/\[PAUSE\]/gi, "|||PAUSE|||")
    .replace(/\[ENGAGEMENT\]/gi, "|||ENGAGEMENT|||")
    .replace(/\[IMAGE:\s*([^\]]+)\]/gi, "|||IMAGE:$1|||")
    .replace(/\[VIDEO:\s*([^\]]+)\]/gi, "|||VIDEO:$1|||");

  const rawChunks = processed.split("|||");
  let orderIndex = 0;

  for (const chunk of rawChunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    if (trimmed === "PAUSE") {
      const pauseItem: LecturePauseItem = {
        id: `pause_${orderIndex}`,
        type: "pause",
        durationMs: 1200,
        order: orderIndex++,
      };
      items.push(pauseItem);
      continue;
    }

    if (trimmed === "ENGAGEMENT") {
      const engItem: LectureEngagementItem = {
        id: `engagement_${orderIndex}`,
        type: "engagement",
        prompt: "Check your understanding",
        order: orderIndex++,
      };
      items.push(engItem);
      continue;
    }

    if (trimmed.startsWith("IMAGE:")) {
      const payload = trimmed.replace(/^IMAGE:/, "").trim();
      let ref = payload;
      let caption: string | undefined = undefined;

      if (payload.includes("|")) {
        const parts = payload.split("|");
        ref = parts[0].trim();
        caption = parts[1].trim();
      }

      // Automatically normalize any Supabase course-files URL to the authenticated media proxy
      const match = ref.match(/course-files\/(.+)$/);
      if (match && match[1]) {
        const cleanPath = match[1].split("?")[0];
        ref = `/api/media/${cleanPath}`;
      }

      const imgItem: LectureImageItem = {
        id: `img_${orderIndex}`,
        type: "image",
        mediaRef: ref,
        caption,
        order: orderIndex++,
      };
      items.push(imgItem);
      mediaMap.set(imgItem.id, { type: "image", ref, caption });
      continue;
    }

    if (trimmed.startsWith("VIDEO:")) {
      const payload = trimmed.replace(/^VIDEO:/, "").trim();
      let ref = payload;
      let caption: string | undefined = undefined;

      if (payload.includes("|")) {
        const parts = payload.split("|");
        ref = parts[0].trim();
        caption = parts[1].trim();
      }

      const vidItem: LectureVideoItem = {
        id: `vid_${orderIndex}`,
        type: "video",
        mediaRef: ref,
        caption,
        order: orderIndex++,
      };
      items.push(vidItem);
      mediaMap.set(vidItem.id, { type: "video", ref, caption });
      continue;
    }

    // Split speech into natural conversational chunks
    const spokenPhrases = splitIntoSmallChunks(trimmed, 75);

    for (const phrase of spokenPhrases) {
      const cleanPhrase = phrase
        .replace(/[*#`_~]/g, "")
        .replace(/\s+/g, " ")
        .trim();

      if (!cleanPhrase) continue;

      const speechItem: LectureSpeechItem = {
        id: `speech_${orderIndex}`,
        type: "speech",
        text: cleanPhrase,
        order: orderIndex++,
      };
      items.push(speechItem);
      speechItems.push(speechItem);
    }
  }

  return { items, speechItems, mediaMap };
}
