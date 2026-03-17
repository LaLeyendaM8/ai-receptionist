import type { SupabaseClient } from "@supabase/supabase-js";

export type FlowType = "idle" | "appointment" | "faq" | "handoff" | "fallback";

export type AppointmentMode =
  | "booking"
  | "availability"
  | "info"
  | "cancel"
  | "reschedule";

export type AppointmentStep =
  | "start"
  | "service"
  | "date"
  | "time"
  | "name"
  | "confirm"
  | "done";

export type HandoffStage =
  | "awaiting_choice"
  | "awaiting_message"
  | "awaiting_name"
  | "awaiting_phone"
  | "awaiting_phone_confirm";

export type AppointmentState = {
  mode?: AppointmentMode;
  draftId?: string | null;
  date?: string | null;
  time?: string | null;
  serviceId?: string | null;
  serviceName?: string | null;
  staffId?: string | null;
  staffName?: string | null;
  customerName?: string | null;
  phone?: string | null;
  confirmed?: boolean;
};

export type HandoffState = {
  mode?: "escalation" | null;
  source?: "faq" | "human_handoff" | "fallback" | null;
  choice?: "transfer" | "message" | null;
  stage?: HandoffStage | null;
  question?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
};

export type ConversationStateJson = {
  flow?: FlowType;
  step?: string;
  lastIntent?: string;

  appointment?: AppointmentState;
  handoff?: HandoffState;

  noSpeechCount?: number;
  noUnderstandCount?: number;
};

export type ActivePlan = "faq_basic" | "starter" | "none";

export type ResolvedCallContext = {
  clientId: string | null;
  ownerUserId: string | null;
  timezone: string;
  staffEnabled: boolean;
  activePlan: ActivePlan;
  aiProfile: string;
};

export type OrchestratorInput = {
  supabase: SupabaseClient;
  text: string;
  fromNumber?: string | null;
  toNumber?: string | null;
  clientId?: string | null;
  sessionId?: string | null;
};

export type OrchestratorResult = {
  success: true;
  intent: string;
  confidence: number;
  end_call: boolean;
  reply: string;

  status?: string;
  message?: string;
  question?: string;
  missing?: string;
  suggestions?: string[];
  staff?: string | null;
  date?: string | null;

  appointment?: any;
  appointmentId?: string;
  preview?: string;
  phrase?: string;
  draftId?: string | null;
  calendarSynced?: boolean;
  calendarError?: string | null;

  answer?: string;
  handoffId?: string;

  brain?: {
    raw?: unknown;
    meta?: any;
  };
};

export type OrchestratorFailure = {
  success: false;
  error: string;
  details?: string;
};

export type IntentRoute =
  | "appointment"
  | "faq"
  | "handoff"
  | "fallback";