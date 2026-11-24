export type EventType = "quiz" | "survey";

export type EventStatus =
  | "draft"
  | "open"
  | "registration_closed"
  | "live"
  | "ended"
  | "cancelled";

export type EventItem = {
  id: string;
  org_id: string;
  org_name: string;
  title: string;
  theme: string;
  description: string;
  type: EventType;
  capacity: number;
  registration_count: number;
  registration_deadline: string;
  start_at: string;
  end_at: string | null;
  per_question_seconds: number;
  status: EventStatus;
  registration_open: boolean;
  question_count: number;
  cover_image?: string | null;
  join_code?: string | null;
  live_phase?: string;
  live_question_index?: number;
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  org_ids: string[];
  company_name?: string | null;
  subscription_active?: boolean;
  subscription_plan?: string | null;
};

export type Org = {
  id: string;
  name: string;
  owner_user_id: string;
  member_user_ids: string[];
};

export type Option = { id: string; text: string };

export type Question = {
  id: string;
  event_id: string;
  order: number;
  text: string;
  options: Option[];
  correct_option_id: string | null;
  source: string;
};

export type AttemptState = {
  attempt_id: string;
  question_index: number;
  total_questions: number;
  per_question_seconds: number;
  question_started_at: string;
  question: Question | null;
  completed: boolean;
  score: number | null;
  max_score: number | null;
};

export type SubscriptionPlan = {
  id: string;
  name: string;
  price_inr: number;
  interval: string;
  description: string;
};

export type LiveState = {
  event_id: string;
  title: string;
  join_code?: string;
  live_phase: "waiting" | "question" | "reveal" | "finished" | string;
  live_question_index: number;
  total_questions: number;
  per_question_seconds: number;
  question_opened_at?: string | null;
  seconds_left?: number | null;
  question: Question | null;
  start_at?: string;
  status?: string;
  my_answers?: Array<{
    question_id: string;
    correct?: boolean;
    points?: number;
    elapsed_ms?: number;
  }>;
  correct_this_question?: Array<{
    name: string;
    elapsed_ms?: number;
    points?: number;
  }>;
  leaderboard?: Array<{
    name: string;
    score: number;
    correct_count: number;
  }>;
  registration_count?: number;
};
