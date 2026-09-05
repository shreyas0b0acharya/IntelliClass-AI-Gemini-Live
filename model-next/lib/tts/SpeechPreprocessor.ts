// model-next/lib/tts/SpeechPreprocessor.ts
//
// Preprocesses raw lecture scripts and conversational prompts into TTS-optimized text.
// Normalizes formulas, academic acronyms, and markdown formatting while strictly preserving
// meaningful punctuation for natural breathing and neural prosody cues.

export const SPEECH_PREPROCESSOR_VERSION = 1;

export class SpeechPreprocessor {
  /**
   * Preprocess and normalize text for speech synthesis.
   */
  static process(rawText: string): string {
    if (!rawText) return "";

    let text = rawText;

    // 1. Remove Markdown syntax (headers, bold/italic, code blocks, lists)
    text = text.replace(/^#+\s+/gm, ""); // Headers
    text = text.replace(/\*\*(.*?)\*\*/g, "$1"); // Bold
    text = text.replace(/\*(.*?)\*/g, "$1"); // Italic
    text = text.replace(/`([^`]+)`/g, "$1"); // Inline code
    text = text.replace(/```[\s\S]*?```/g, ""); // Code blocks
    text = text.replace(/^\s*[-*+]\s+/gm, ""); // Unordered list bullets
    text = text.replace(/^\s*\d+\.\s+/gm, ""); // Numbered lists

    // 2. Common Big-O and mathematical formulas
    text = text.replace(/\bO\(1\)/gi, "O of 1");
    text = text.replace(/\bO\(n\s*\*\s*log\s*n\)/gi, "O of N log N");
    text = text.replace(/\bO\(n\s*log\s*n\)/gi, "O of N log N");
    text = text.replace(/\bO\(n\^2\)/gi, "O of N squared");
    text = text.replace(/\bO\(n\^3\)/gi, "O of N cubed");
    text = text.replace(/\bO\(2\^n\)/gi, "O of 2 to the N");
    text = text.replace(/\bO\(n\)/gi, "O of N");
    text = text.replace(/\bO\(log\s*n\)/gi, "O of log N");

    // Math symbols
    text = text.replace(/(\w+)\^2\b/g, "$1 squared");
    text = text.replace(/(\w+)\^3\b/g, "$1 cubed");
    text = text.replace(/\s*>=\s*/g, " greater than or equal to ");
    text = text.replace(/\s*<=\s*/g, " less than or equal to ");
    text = text.replace(/\s*!=\s*/g, " not equal to ");
    text = text.replace(/\s*==\s*/g, " equals ");

    // 3. Common computer science acronyms for clear articulation
    text = text.replace(/\bAPI\b/g, "A-P-I");
    text = text.replace(/\bAPIs\b/g, "A-P-Is");
    text = text.replace(/\bURL\b/g, "U-R-L");
    text = text.replace(/\bURLs\b/g, "U-R-Ls");
    text = text.replace(/\bHTTP\b/g, "H-T-T-P");
    text = text.replace(/\bHTTPS\b/g, "H-T-T-P-S");
    text = text.replace(/\bJSON\b/g, "jay-sahn");
    text = text.replace(/\bSQL\b/g, "sequel");
    text = text.replace(/\bUUID\b/g, "U-U-I-D");
    text = text.replace(/\bUUIDs\b/g, "U-U-I-Ds");
    text = text.replace(/\bHTML\b/g, "H-T-M-L");
    text = text.replace(/\bCSS\b/g, "C-S-S");
    text = text.replace(/\bSDK\b/g, "S-D-K");
    text = text.replace(/\bSDKs\b/g, "S-D-Ks");
    text = text.replace(/\bAI\b/g, "A-I");
    text = text.replace(/\bML\b/g, "M-L");
    text = text.replace(/\bGPU\b/g, "G-P-U");
    text = text.replace(/\bCPU\b/g, "C-P-U");

    // 4. Clean up whitespace while strictly keeping punctuation intact
    text = text.replace(/\s+/g, " ").trim();

    return text;
  }
}
