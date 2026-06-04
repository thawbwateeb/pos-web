export interface WhatsappSettings {
  botEnabled: boolean;
  botName: string;
  botPrompt?: string;
  greeting?: string;
  awayMsg?: string;
  handoffMsg?: string;
  pauseMinutes: number;
  handoffKeywords?: string;
  workingHours?: string;
  afterHoursMsg?: string;
}
