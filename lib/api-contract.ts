// Request/response shapes for /api/topics. UI and API both import these.
import type { Topic, TopicSummary } from "./schema";

/** POST /api/topics  body: { query: string } */
export type CreateTopicResponse =
  | { status: "ready"; slug: string } // already written: go to /t/{slug}
  | { status: "pending"; slug: string } // being written now: go to /t/{slug} and poll
  | { status: "rejected"; message: string; suggestion?: string } // off-topic / bad faith / too vague
  | { status: "paused"; message: string; suggestions: TopicSummary[] } // no engine or daily budget used up
  | { status: "limited"; message: string; retryAfterSeconds: number } // per-visitor rate limit
  | { status: "error"; message: string };

/** GET /api/topics/{slug} */
export type GetTopicResponse =
  | { status: "ready"; topic: Topic }
  | { status: "pending"; viewsDone: number; partial?: Partial<Topic> }
  | { status: "missing" }
  | { status: "error"; message: string };

/** GET /api/topics?q=... (search existing topics) */
export type SearchTopicsResponse = { topics: TopicSummary[] };
