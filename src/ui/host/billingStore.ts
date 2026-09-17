import { getFirebaseServices } from "../../lib/firebase";
import { navigate } from "../routing";
import type { StoreOutcome } from "./propertyStore";

/**
 * The billing callables, in the Host's terms.
 *
 * Activation and cancellation are the commercial actions a client may start,
 * and neither grants or revokes anything itself: `activationOptions` is a read
 * that quotes today's price in the wording BOP §6.3.4 fixes,
 * `createActivationCheckout` records the acknowledgement and hands back a
 * Stripe-hosted URL, and `cancelSubscription` sets a flag on Stripe's copy of
 * the subscription. The property changes state only when the
 * signature-verified webhook lands (BOP §4.2) — never when the browser returns
 * from Stripe, and never because this file asked for something.
 *
 * Same shape as `moderationStore`: a callable, a deadline, and the server's
 * answer rather than this file's optimism.
 */

const UNCONFIGURED =
  "No Firebase environment is configured, so activation is unavailable. This build has no development bypass.";

/** Long enough for a cold callable, short enough that a Host is not left waiting. */
const CALL_TIMEOUT_MS = 20_000;

class RequestTimeout extends Error {}

function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new RequestTimeout()), ms);
    void work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

export type BillingCountry = "AU" | "US";

/** One plan as the server quotes it: a price, the §6.3.4 disclosure, the checkbox sentence. */
export type ActivationPlanOffer = {
  plan: "monthly" | "annual";
  /** The published rate. A promotion code does not change it. */
  price: string;
  /** What the card is charged — the same figure as `price` unless a code moved it. */
  chargedPrice: string;
  /** Minor units of the above, echoed back on commitment so the amount cannot drift. */
  chargedAmount: number;
  /** The code the server accepted for this plan, or null when none reaches it. */
  discount: { code: string; label: string } | null;
  disclosure: string;
  acknowledgement: string;
};

export type ActivationOffer = {
  currency: string;
  trialAvailable: boolean;
  trialDays: number;
  /** The exact unix second the server quoted, echoed back on commitment. */
  trialEndsAt: number | null;
  version: string;
  plans: ActivationPlanOffer[];
};

/**
 * `failed-precondition` and `invalid-argument` messages from these callables are
 * written for the Host and name the fix ("The trial dates have moved on…"),
 * so they are passed through.
 * Every other code gets a message this file controls.
 */
const MESSAGES: Record<string, string> = {
  unauthenticated: "Your session has expired. Sign in again to activate this property.",
  "permission-denied": "Activation is not available in this session.",
  "not-found": "That property no longer exists.",
  "resource-exhausted": "Too many attempts at once. Wait a moment and try again.",
  unavailable: "We could not reach the server. Check your connection and try again.",
  internal: "The server could not start activation. Nothing was charged."
};

function describe(error: unknown): StoreOutcome<never> {
  if (error instanceof RequestTimeout) {
    return {
      status: "error",
      message: "The server did not answer in time, so nothing was started. Reload the page before trying again."
    };
  }
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code).replace(/^functions\//, "")
      : "";
  if ((code === "failed-precondition" || code === "invalid-argument") && error instanceof Error && error.message) {
    return { status: "error", message: error.message };
  }
  return { status: "error", message: MESSAGES[code] ?? "Something went wrong starting activation. Please try again." };
}

/**
 * What this property would cost, and in whose words. A read; safe to call repeatedly.
 *
 * `promotionCode` re-quotes rather than annotates: the server rebuilds the
 * disclosure and the acknowledgement around what the card would actually be
 * charged, so a code is refused here — in words the Host can act on — rather
 * than on Stripe's page after the box has been ticked.
 */
export async function loadActivationOffer(
  propertyId: string,
  country: BillingCountry,
  promotionCode?: string | null
): Promise<StoreOutcome<ActivationOffer>> {
  const services = await getFirebaseServices();
  if (!services) return { status: "error", message: UNCONFIGURED };
  try {
    const { httpsCallable } = await import("firebase/functions");
    const call = httpsCallable<Record<string, unknown>, ActivationOffer>(
      services.functions,
      "activationOptions"
    );
    const answer = await withDeadline(
      call(promotionCode ? { propertyId, country, promotionCode } : { propertyId, country }),
      CALL_TIMEOUT_MS
    );
    return { status: "ok", value: answer.data };
  } catch (error) {
    return describe(error);
  }
}

/**
 * The commitment. The server records the acknowledgement — wording, version,
 * price, the trial end the Host actually saw — before it creates the session,
 * so a completed payment can never be the thing that implies consent.
 *
 * `trialEndsAt` is the value the offer returned, passed straight back: the
 * server rejects it if the date has since rolled to another day.
 */
export async function startActivationCheckout(input: {
  propertyId: string;
  country: BillingCountry;
  plan: "monthly" | "annual";
  version: string;
  trialEndsAt: number | null;
  /** The code the offer accepted, and the amount it produced. Sent together or not at all. */
  promotionCode?: string | null;
  chargedAmount?: number;
}): Promise<StoreOutcome<{ url: string }>> {
  const services = await getFirebaseServices();
  if (!services) return { status: "error", message: UNCONFIGURED };
  try {
    const { httpsCallable } = await import("firebase/functions");
    const call = httpsCallable<Record<string, unknown>, { url: string | null }>(
      services.functions,
      "createActivationCheckout"
    );
    const answer = await withDeadline(
      call({
        propertyId: input.propertyId,
        country: input.country,
        plan: input.plan,
        acknowledged: true,
        version: input.version,
        trialEndsAt: input.trialEndsAt,
        // Only when a code is actually in play. Without one the server quotes
        // the published rate and has no echoed amount to check against.
        ...(input.promotionCode
          ? { promotionCode: input.promotionCode, chargedAmount: input.chargedAmount }
          : {})
      }),
      CALL_TIMEOUT_MS
    );
    const url = answer.data?.url;
    if (typeof url !== "string" || !url) {
      return { status: "error", message: "The server did not return a payment link. Try again in a moment." };
    }
    return { status: "ok", value: { url } };
  } catch (error) {
    return describe(error);
  }
}

/**
 * Hand the browser to Stripe's hosted Checkout. `navigate` sends any off-origin
 * URL through a full document load, which is what this is; giving it its own
 * function keeps the jump mockable in a test.
 */
export function redirectToCheckout(url: string): void {
  navigate(url);
}

/* ---------------------------------------------------------------------------
   Cancellation (ST-09).

   Both callables are the same shape as activation: the server decides, this
   file only reports. Neither writes the property — the lifecycle still arrives
   through the webhook (BOP §4.2), so the screen re-reads the property after a
   successful call rather than assuming what the answer did.               */

export type SubscriptionChange = {
  /** Unix seconds, or null when Stripe has no period end to report. */
  serviceEndsAt: number | null;
  /** The house-format date the confirmation screen shows. */
  serviceEndsOn: string | null;
  /** The flag was already in this state — a second click, or a second tab. */
  alreadySet: boolean;
  /** Whether a charge still lands on that date. */
  chargedAgain: boolean;
};

const CHANGE_MESSAGES: Record<string, string> = {
  unauthenticated: "Your session has expired. Sign in again to change this subscription.",
  "permission-denied": "This action is not available in this session.",
  "not-found": "That property no longer exists.",
  "resource-exhausted": "Too many attempts at once. Wait a moment and try again.",
  unavailable: "We could not reach the server. Nothing has changed — check your connection and try again.",
  internal: "The server could not complete that change. Nothing has changed."
};

function describeChange(error: unknown): StoreOutcome<never> {
  if (error instanceof RequestTimeout) {
    return {
      status: "error",
      message:
        "The server did not answer in time. Reload the page to see whether the change went through before trying again."
    };
  }
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code).replace(/^functions\//, "")
      : "";
  if ((code === "failed-precondition" || code === "invalid-argument") && error instanceof Error && error.message) {
    return { status: "error", message: error.message };
  }
  return {
    status: "error",
    message: CHANGE_MESSAGES[code] ?? "Something went wrong changing this subscription. Nothing has changed."
  };
}

async function changeSubscription(
  callable: "cancelSubscription" | "resumeSubscription",
  propertyId: string
): Promise<StoreOutcome<SubscriptionChange>> {
  const services = await getFirebaseServices();
  if (!services) return { status: "error", message: UNCONFIGURED };
  try {
    const { httpsCallable } = await import("firebase/functions");
    const call = httpsCallable<{ propertyId: string }, SubscriptionChange>(services.functions, callable);
    const answer = await withDeadline(call({ propertyId }), CALL_TIMEOUT_MS);
    return { status: "ok", value: answer.data };
  } catch (error) {
    return describeChange(error);
  }
}

/**
 * Stop at the end of the period already paid for (BOP §4.3). The wall stays
 * live until the date this returns, which is the date the confirmation shows.
 */
export function cancelSubscription(propertyId: string): Promise<StoreOutcome<SubscriptionChange>> {
  return changeSubscription("cancelSubscription", propertyId);
}

/** Clear a cancellation that has not taken effect yet. No new checkout, no second trial. */
export function resumeSubscription(propertyId: string): Promise<StoreOutcome<SubscriptionChange>> {
  return changeSubscription("resumeSubscription", propertyId);
}
