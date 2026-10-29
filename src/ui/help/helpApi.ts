import { getFirebaseServices } from "../../lib/firebase";
import { helpAnswer } from "./helpAnswers";
export type HelpMessage = { role: "user" | "assistant"; text: string };

/** Keep recent whole turns within the server's conversation budget. */
export function recentHelp(messages: HelpMessage[]) {
  let recent = messages.slice(-12).map(m => ({ ...m, text: m.text.slice(0, 1000) }));
  while (recent.length > 1 && (recent[0].role !== "user" || recent.reduce((n, m) => n + m.text.length, 0) > 6000)) recent = recent.slice(1);
  return recent;
}

export async function callHelp<T>(name: "helpChat" | "helpContact", data: unknown): Promise<T> {
  if (name === "helpChat") {
    const messages = (data as { messages: HelpMessage[] }).messages;
    return { reply: helpAnswer(messages.at(-1)?.text ?? "") } as T;
  }
  const services = await getFirebaseServices();
  if (!services) throw new Error("Help is unavailable. Please try again shortly.");
  const { httpsCallable } = await import("firebase/functions");
  try {
    return (await httpsCallable<unknown, T>(services.functions, name)(data)).data;
  } catch (error) {
    const code = (error as { code?: string }).code;
    const message = (error as { message?: string }).message;
    if (["functions/resource-exhausted", "functions/unavailable", "functions/invalid-argument"].includes(code ?? "") && message)
      throw new Error(message);
    throw new Error("Help could not connect. Please try again shortly.");
  }
}
