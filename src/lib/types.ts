export type Message = {
  role: "user" | "assistant";
  content: string;
};

export type GeneratedFile = {
  name: string;
  content: string;
};

export type SharingSetting = {
  file_name: string;
  shared: boolean;
};

export type Partnership = {
  id: string;
  partnerId: string;
  partnerEmail: string;
} | null;

export type AppMode = "loading" | "welcome" | "onboarding" | "results" | "brain" | "partner-chat" | "settings";
