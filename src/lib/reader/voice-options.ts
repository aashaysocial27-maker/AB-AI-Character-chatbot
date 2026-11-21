/** Reading styles and OpenAI voice options. Safe for both browser and server. */

export type ReadingStyle = "plain" | "storyteller" | "teacher";
export type VoiceEngine = "device" | "openai";
export type CheckIns = "off" | "page" | "chapter";

export const STYLES: { id: ReadingStyle; label: string; hint: string }[] = [
  { id: "storyteller", label: "Storyteller", hint: "Expressive, with pauses and livelier dialogue" },
  { id: "teacher", label: "Teacher", hint: "Slower and clear, with time to think" },
  { id: "plain", label: "Plain", hint: "Straight reading" },
];

/** How the OpenAI voice is asked to perform each style. */
export const STYLE_INSTRUCTIONS: Record<ReadingStyle, string> = {
  storyteller:
    "You are a warm, expressive audiobook narrator. Read with feeling: let the tone follow the mood of the scene, slow down for tense or tender moments, give characters' dialogue its own life and emotion, and use natural dramatic pauses. Never sound flat or robotic.",
  teacher:
    "You are a patient, encouraging teacher reading aloud to a student. Speak clearly at a calm, measured pace, gently stress key words and ideas, and pause naturally so the listener can follow and think.",
  plain: "Read clearly and naturally at a comfortable pace.",
};

export const OPENAI_VOICES: { id: string; label: string }[] = [
  { id: "coral", label: "Coral — warm, friendly" },
  { id: "marin", label: "Marin — natural, clear" },
  { id: "cedar", label: "Cedar — deep, calm" },
  { id: "fable", label: "Fable — storyteller, British" },
  { id: "sage", label: "Sage — gentle, thoughtful" },
  { id: "nova", label: "Nova — bright, energetic" },
  { id: "shimmer", label: "Shimmer — soft, light" },
  { id: "ballad", label: "Ballad — expressive, lyrical" },
  { id: "verse", label: "Verse — dynamic" },
  { id: "ash", label: "Ash — confident" },
  { id: "onyx", label: "Onyx — deep, authoritative" },
  { id: "echo", label: "Echo — even, steady" },
  { id: "alloy", label: "Alloy — neutral" },
];

export const DEFAULT_TTS_MODEL = "gpt-4o-mini-tts";
