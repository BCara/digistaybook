import { formatRate, publishedRates, trialDays } from "../../domain/pricing";

/** Curated answers run entirely in the browser. Unknown questions go to a person. */
export function helpAnswer(question: string): string {
  const text = question.toLowerCase().replace(/[’']/g, "");
  if (/\b(wi-?fi|door code|check.?in|check.?out|maintenance|booking|emergency|locked out)\b/.test(text))
    return "For help during your stay, please contact your property host through your booking app. DigiStayBook support can help with the guestbook itself, but cannot access accommodation details. If anyone is in immediate danger, contact local emergency services.";
  if (/\b(cancel|cancellation|stop paying|stop my subscription)\b/.test(text))
    return "You can cancel in your host dashboard before the next billing date. Access continues until the end of your current paid billing cycle or trial. Chat and email requests cannot cancel your subscription.";
  if (/\b(refund|charged|charge|payment failed|card declined|invoice|bug|broken|not working|error)\b/.test(text))
    return "Please use Message us below so a person can help with your specific issue by email. Include what you were trying to do and what happened, but never include passwords or payment details. This helper cannot inspect accounts, payments or property records.";
  if (/\b(price|pricing|cost|much|free|trial|plan|subscription|pay|billing)\b/.test(text)) {
    const rates = Object.entries(publishedRates).map(([currency, rate]) => `${formatRate(rate.monthly, currency as keyof typeof publishedRates)} a month or ${formatRate(rate.annual, currency as keyof typeof publishedRates)} a year`).join("; ");
    return `Plans are per property: ${rates}. Your first activated property is eligible for a ${trialDays}-day trial, with a payment method required; plans renew automatically. See the Pricing page for full terms and current offers.`;
  }
  if (/\b(password|log.?in|sign.?in|account|verification|verify|reset)\b/.test(text))
    return "Hosts sign in through Host sign in. If you have forgotten your password, use Forgot password on that page to request a reset email. Account settings are in your host dashboard; use Message us for account-specific help.";
  if (/\b(app|download|install|guest accounts?|guest login|guests.*sign)\b/.test(text))
    return "Guests scan the QR display and open DigiStayBook in their phone browser. They do not need to download an app or create an account. Hosts use their own account to manage the property and guestbook.";
  if (/\b(privacy|safety|report|takedown|personal data|remove my|delete my)\b/.test(text))
    return "Use Privacy & Safety for personal-data or content-safety requests. Guests can also use the Report control on a memory, or self-service deletion from the device that made the post when available. Please keep sensitive details out of this chat.";
  if (/\b(feedback|private review|private message)\b/.test(text))
    return "Private guest feedback goes to the host and is separate from memories on the walls. It is not monitored in real time and hosts cannot reply to it here. For help during a stay, contact the host through your booking app.";
  if (/\b(moderat\w*|approv\w*|screen\w*|hide|pin|delete|inappropriate)\b/.test(text))
    return "Hosts can review, pin, hide and delete memories from the dashboard. Automated content screening checks submissions, with flagged posts held for review. Screening is not a guarantee that every issue will be caught.";
  if (/\b(qr|print|display|scan|public wall|public page|private link|stay link)\b/.test(text))
    return "Open your property's QR kit in the host dashboard to print or download the display. The private stay link lets guests contribute; the public page is for viewing. Keep the private stay link for your guests rather than sharing it publicly.";
  if (/\b(start\w*|set.?up|create|add a property|how.*work|what is|guestbook|photos?|memor\w*)\b/.test(text))
    return "Create a host account, add your property and activate it from the dashboard. Customize your guestbook and house guidance, then print the property's QR kit. Guests can scan it to read your welcome, explore local favorites and leave memories with photos.";
  return "I have built-in answers about setup, pricing, QR codes, guest access and moderation. Try one of those topics, or use Message us below and a person can help by email.";
}
