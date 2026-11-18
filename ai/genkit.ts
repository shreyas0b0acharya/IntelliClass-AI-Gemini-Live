import "server-only";
import { genkit } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";
import { getPrimaryModel } from "./model-manager";

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GEMINI_API_KEY,
    }),
  ],
  model: googleAI.model(getPrimaryModel()),
});
