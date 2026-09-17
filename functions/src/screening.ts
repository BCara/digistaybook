export type ScreeningResult = { outcome: "clear" | "standard" | "critical" | "reject" | "unavailable"; feedback: "clear" | "held" };
export type ScreeningInput = { message: string; feedback: string; photos: { bucket: string; path: string }[] };
export type Screener = (input: ScreeningInput) => Promise<ScreeningResult>;

// No provider is selected in handbook C-12/C-13. Never substitute profanity
// matching or a host's approval for the required image AND text screening.
export const screenContent: Screener = async () => ({ outcome: "unavailable", feedback: "held" });
