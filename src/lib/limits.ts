/** Input limits enforced on the server (and mirrored in the UI). */
export const LIMITS = {
  /** Characters in a single message. */
  maxMessageChars: 2000,
  /** Messages in one request (user + model turns). 20 = 10 exchanges. */
  maxMessages: 20,
  /** Characters across the whole conversation. */
  maxTotalChars: 24000,
  /** Plausible bounds for an API key string. */
  maxKeyChars: 200,
} as const;

/** Number of question/answer exchanges before the UI asks for a fresh chat. */
export const MAX_EXCHANGES = LIMITS.maxMessages / 2;
