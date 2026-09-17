import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AuthContext, type AuthState } from "../auth/AuthProvider";
import { HostBillingPage } from "./HostBillingPage";
import { emptyProfile } from "../../domain/propertyProfile";
import type { HostProperty } from "../host/propertyStore";

vi.mock("../../lib/firebaseConfig", () => ({
  firebaseConfig: {},
  firebaseConfigured: true
}));

const loadProperty = vi.fn();

vi.mock("../host/propertyStore", () => ({
  loadProperty: (...args: unknown[]) => loadProperty(...args)
}));

const detectBillingCountry = vi.fn();
const loadActivationOffer = vi.fn();
const startActivationCheckout = vi.fn();
const redirectToCheckout = vi.fn();

vi.mock("../host/billingCountry", () => ({
  detectBillingCountry: () => detectBillingCountry()
}));

const cancelSubscription = vi.fn();
const resumeSubscription = vi.fn();

vi.mock("../host/billingStore", () => ({
  loadActivationOffer: (...args: unknown[]) => loadActivationOffer(...args),
  startActivationCheckout: (...args: unknown[]) => startActivationCheckout(...args),
  redirectToCheckout: (...args: unknown[]) => redirectToCheckout(...args),
  cancelSubscription: (...args: unknown[]) => cancelSubscription(...args),
  resumeSubscription: (...args: unknown[]) => resumeSubscription(...args)
}));

function hostProperty(overrides: Partial<HostProperty> = {}): HostProperty {
  return {
    id: "prop-1",
    ownerUid: "host-a",
    name: "Seabreeze Cottage",
    slug: "seabreeze-cottage",
    lifecycle: "active",
    mode: "live",
    foundationalPostCount: 3,
    createdAt: "2026-05-01T10:00:00.000Z",
    updatedAt: "2026-05-01T10:00:00.000Z",
    billing: {
      trialEndsAt: "2026-05-29T00:00:00.000Z",
      currentPeriodEndsAt: "2026-10-01T00:00:00.000Z",
      lastPaymentAt: "2026-09-01T00:00:00.000Z",
      renewalAmount: 1500,
      renewalCurrency: "aud",
      renewalInterval: "month"
    },
    profile: emptyProfile(),
    ...overrides
  };
}

const offer = {
  currency: "aud",
  trialAvailable: true,
  trialDays: 28,
  trialEndsAt: 1_760_000_000,
  version: "handbook-6.3.4-v1",
  plans: [
    {
      plan: "monthly" as const,
      price: "A$15.00",
      chargedPrice: "A$15.00",
      chargedAmount: 1500,
      discount: null,
      disclosure: "Start your 28-day free trial. …renew at A$15.00/month until you cancel.",
      acknowledgement: "I understand I will be billed A$15.00 on 6 October 2026 if I do not cancel."
    },
    {
      plan: "annual" as const,
      price: "A$150.00",
      chargedPrice: "A$150.00",
      chargedAmount: 15_000,
      discount: null,
      disclosure: "Start your 28-day free trial. …charged A$150.00 for your first year.",
      acknowledgement: "I understand I will be billed A$150.00 on 6 October 2026 if I do not cancel."
    }
  ]
};

const draftProperty = () =>
  hostProperty({ lifecycle: "draft", mode: "sandbox", billing: null, foundationalPostCount: 0 });

const hostSession = { status: "host", user: { uid: "host-a", email: "host@example.com" } } as unknown as AuthState;

function renderPage(state: AuthState = hostSession) {
  return render(
    <AuthContext.Provider value={state}>
      <HostBillingPage propertyId="prop-1" />
    </AuthContext.Provider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Most Hosts arrive from a browser that names a country we serve; the tests
  // that care about the other case say so.
  detectBillingCountry.mockReturnValue("AU");
  loadProperty.mockResolvedValue({ status: "ok", value: hostProperty() });
});

afterEach(() => {
  window.history.replaceState({}, "", "/");
});

const facts = () => within(document.querySelector(".property-facts") as HTMLElement);

describe("property billing", () => {
  it("reports the subscription state and the dates the server holds", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Billing", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("The subscription is paid and the wall is live.")).toBeInTheDocument();
    expect(screen.getByText("Renews at A$15.00 on 1 October 2026.")).toBeInTheDocument();
    expect(screen.queryByText("29 May 2026")).not.toBeInTheDocument();
    expect(facts().getByText("1 September 2026")).toBeInTheDocument();
  });

  it("keeps the wall control in the property header", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Billing", level: 2 });

    expect(screen.getByRole("link", { name: "View in-stay wall" })).toBeInTheDocument();
  });

  it("offers nothing that would set a lifecycle or take a payment from this client", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Billing", level: 2 });

    // Cancelling is the one control here, and it does not write the property:
    // it asks the server, which asks Stripe, whose webhook writes the
    // lifecycle. Anything beyond that button would be claiming an authority
    // this client does not have.
    const page = within(document.querySelector(".property-shell-main") as HTMLElement);
    expect(page.getAllByRole("button")).toHaveLength(1);
    expect(page.getByRole("button", { name: "Cancel this subscription" })).toBeInTheDocument();
    expect(screen.queryByText(/written by our server from Stripe/i)).not.toBeInTheDocument();
  });

  it("states the next charge as an amount and a date, and hides a payment never taken", async () => {
    loadProperty.mockResolvedValue({
      status: "ok",
      value: hostProperty({
        lifecycle: "trialing",
        billing: {
          trialEndsAt: "2026-10-08T00:00:00.000Z",
          // Stripe reports the trial as the current period, so these agree.
          // The screen must not therefore print the same date twice.
          currentPeriodEndsAt: "2026-10-08T00:00:00.000Z",
          lastPaymentAt: null,
          renewalAmount: 1500,
          renewalCurrency: "aud",
          renewalInterval: "month"
        }
      })
    });
    renderPage();
    await screen.findByRole("heading", { name: "Billing", level: 2 });

    expect(screen.getByText("Your card will be charged A$15.00 on 8 October 2026.")).toBeInTheDocument();
    expect(screen.queryByText("Trial ends")).not.toBeInTheDocument();
    expect(screen.queryByText("Current period ends")).not.toBeInTheDocument();
    // The row that used to read "Last payment: <the day the trial started>".
    expect(screen.queryByText("Last payment")).not.toBeInTheDocument();
  });

  it("cancels a trial through the server and confirms the date service stops", async () => {
    loadProperty.mockResolvedValue({
      status: "ok",
      value: hostProperty({
        lifecycle: "trialing",
        billing: {
          trialEndsAt: "2026-10-08T00:00:00.000Z",
          currentPeriodEndsAt: "2026-10-08T00:00:00.000Z",
          lastPaymentAt: null,
          renewalAmount: 1500,
          renewalCurrency: "aud",
          renewalInterval: "month"
        }
      })
    });
    cancelSubscription.mockResolvedValue({
      status: "ok",
      value: { serviceEndsAt: 1_791_000_000, serviceEndsOn: "8 October 2026", alreadySet: false, chargedAgain: false }
    });
    renderPage();
    await screen.findByRole("heading", { name: "Billing", level: 2 });

    // Cancelling is two deliberate steps, and the middle one is where the date
    // and the consequences are stated.
    fireEvent.click(screen.getByRole("button", { name: "Cancel the free trial" }));
    expect(
      screen.getByText(/stays live until 8 October 2026, and then its wall stops being served/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/You will not be charged\./i)).toBeInTheDocument();
    expect(cancelSubscription).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Yes, cancel" }));
    await waitFor(() => expect(cancelSubscription).toHaveBeenCalledWith("prop-1"));
    expect(await screen.findByText(/Cancelled\. This property stays live until 8 October 2026\./i)).toBeInTheDocument();
  });

  it("keeps the cancellation standing when the server refuses", async () => {
    loadProperty.mockResolvedValue({ status: "ok", value: hostProperty({ lifecycle: "trialing" }) });
    cancelSubscription.mockResolvedValue({ status: "error", message: "We could not reach Stripe." });
    renderPage();
    await screen.findByRole("heading", { name: "Billing", level: 2 });

    fireEvent.click(screen.getByRole("button", { name: "Cancel the free trial" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, cancel" }));

    expect(await screen.findByText("We could not reach Stripe.")).toBeInTheDocument();
    // Still on the confirmation, so the Host can try the same decision again.
    expect(screen.getByRole("button", { name: "Yes, cancel" })).toBeInTheDocument();
  });

  it("offers the undo, not a second cancellation, once a property is cancelled", async () => {
    loadProperty.mockResolvedValue({
      status: "ok",
      value: hostProperty({
        lifecycle: "cancelled_pending_end",
        serviceEndsAt: "2026-10-08T00:00:00.000Z"
      })
    });
    renderPage();
    await screen.findByRole("heading", { name: "Billing", level: 2 });

    expect(screen.getByText(/stays live until 8 October 2026/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep this subscription" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cancel/ })).not.toBeInTheDocument();
  });

  it("carries the property nav, with billing marked as the screen you are on", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Billing", level: 2 });

    const nav = within(screen.getByRole("navigation", { name: "This property" }));
    expect(nav.getByText("Billing", { selector: "span[aria-current]" })).toHaveAttribute("aria-current", "page");
    expect(nav.getByRole("link", { name: "Moderation" })).toHaveAttribute(
      "href",
      "/host/property/prop-1/moderation"
    );
  });

  it("refuses a property owned by another host account", async () => {
    loadProperty.mockResolvedValue({ status: "ok", value: hostProperty({ ownerUid: "host-b" }) });
    renderPage();

    expect(await screen.findByText(/belongs to another host account/i)).toBeInTheDocument();
    expect(screen.queryByText("1 October 2026")).not.toBeInTheDocument();
  });
});

describe("activating a draft property", () => {
  const draft = (overrides: Partial<HostProperty> = {}) =>
    hostProperty({ lifecycle: "draft", mode: "sandbox", billing: null, ...overrides });

  it("shows plans with no welcome content or wall posts", async () => {
    loadProperty.mockResolvedValue({ status: "ok", value: draft({ foundationalPostCount: 0 }) });
    loadActivationOffer.mockResolvedValue({ status: "ok", value: offer });
    renderPage();
    expect(await screen.findByRole("radio", { name: /A\$15\.00 per month/ })).toBeInTheDocument();
    expect(loadActivationOffer).toHaveBeenCalledWith("prop-1", "AU");
    expect(screen.queryByText("Write a welcome post first")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Welcome message" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start free trial" })).toBeDisabled();
  });
  it("quotes against the country it detected, then goes to Stripe on a ticked acknowledgement", async () => {
    loadProperty.mockResolvedValue({ status: "ok", value: draft({ foundationalPostCount: 0 }) });
    loadActivationOffer.mockResolvedValue({ status: "ok", value: offer });
    startActivationCheckout.mockResolvedValue({
      status: "ok",
      value: { url: "https://checkout.stripe.com/c/pay/cs_test_123" }
    });
    renderPage();

    await screen.findByRole("heading", { name: "Activate this property", level: 2 });
    // The Host is told where they are billed rather than asked, and the quote
    // is already on its way.
    expect(await screen.findByText(/Billed in Australia/)).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Australia" })).not.toBeInTheDocument();
    expect(await screen.findByText(/28 days free/)).toBeInTheDocument();
    // The plans are a comparison, so both prices and the annual saving are on
    // screen before either is chosen, and the terms are not.
    expect(screen.getByRole("radio", { name: /A\$150\.00 per year/ })).toBeInTheDocument();
    expect(screen.getByText("Two months free")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(loadActivationOffer).toHaveBeenCalledWith("prop-1", "AU");

    fireEvent.click(screen.getByRole("radio", { name: /A\$15\.00 per month/ }));

    const acknowledgement = await screen.findByRole("checkbox");
    expect(acknowledgement).toHaveAccessibleName(
      "I understand I will be billed A$15.00 on 6 October 2026 if I do not cancel."
    );
    expect(screen.getByRole("button", { name: "Start free trial" })).toBeDisabled();

    fireEvent.click(acknowledgement);
    fireEvent.click(screen.getByRole("button", { name: "Start free trial" }));

    await waitFor(() =>
      expect(redirectToCheckout).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/cs_test_123")
    );
    expect(startActivationCheckout).toHaveBeenCalledWith({
      propertyId: "prop-1",
      country: "AU",
      plan: "monthly",
      version: "handbook-6.3.4-v1",
      trialEndsAt: 1_760_000_000,
      // No code was typed, so nothing is echoed and the server keeps Stripe's
      // own promotion field on the checkout page.
      promotionCode: null,
      chargedAmount: 1500
    });
  });

  it("still asks outright when the browser names no country we serve", async () => {
    detectBillingCountry.mockReturnValue(null);
    loadProperty.mockResolvedValue({ status: "ok", value: draft({ foundationalPostCount: 0 }) });
    loadActivationOffer.mockResolvedValue({ status: "ok", value: offer });
    renderPage();

    // A wrong guess would price the acknowledgement in the wrong currency, so
    // nothing is quoted until the Host answers.
    expect(await screen.findByRole("radio", { name: "Australia" })).toBeInTheDocument();
    expect(loadActivationOffer).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("radio", { name: "United States" }));
    await waitFor(() => expect(loadActivationOffer).toHaveBeenCalledWith("prop-1", "US"));
  });

  it("surfaces the server's reason when checkout is refused", async () => {
    loadProperty.mockResolvedValue({ status: "ok", value: draft({ foundationalPostCount: 0 }) });
    loadActivationOffer.mockResolvedValue({ status: "ok", value: offer });
    startActivationCheckout.mockResolvedValue({
      status: "error",
      message: "The trial dates have moved on. Reload the page and try again."
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Not right?" }));
    fireEvent.click(await screen.findByRole("radio", { name: "United States" }));
    await waitFor(() => expect(loadActivationOffer).toHaveBeenLastCalledWith("prop-1", "US"));
    fireEvent.click(await screen.findByRole("radio", { name: /A\$150\.00 per year/ }));
    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Start free trial" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The trial dates have moved on");
    expect(redirectToCheckout).not.toHaveBeenCalled();
  });

  it("watches the property document after the redirect back from Stripe", async () => {
    window.history.replaceState({}, "", "/host/property/prop-1/billing?activating=1");
    loadProperty.mockResolvedValue({ status: "ok", value: draft({ foundationalPostCount: 0 }) });
    renderPage();

    expect(await screen.findByText(/Finishing activation/)).toBeInTheDocument();
    // The redirect return does not render the plan chooser again.
    expect(screen.queryByText(/Billed in/)).not.toBeInTheDocument();
  });
});

/* ---------------------------------------------------------------------------
   A promotion code, applied before Stripe rather than on it.

   §4.1's 100% code is not marketed, so the field is collapsed until asked for
   — and applying one re-quotes the whole offer, because the terms a Host ticks
   a box against have to describe the charge they will actually see.         */

describe("applying a promotion code", () => {
  const discounted = {
    ...offer,
    plans: [
      {
        ...offer.plans[0]!,
        chargedPrice: "A$0.00",
        chargedAmount: 0,
        discount: { code: "LAUNCH100", label: "100% off" },
        disclosure: "…your code LAUNCH100 applies 100% off to the standard A$15.00/month…",
        acknowledgement: "I understand I will be billed A$0.00 on 6 October 2026 if I do not cancel."
      },
      offer.plans[1]!
    ]
  };

  const openDraft = async () => {
    loadProperty.mockResolvedValue({ status: "ok", value: draftProperty() });
    loadActivationOffer.mockResolvedValue({ status: "ok", value: offer });
    renderPage();
    await screen.findByRole("radio", { name: /A\$15\.00 per month/ });
  };

  it("keeps the field collapsed until a Host says they have one", async () => {
    await openDraft();
    expect(screen.queryByLabelText("Promotion code")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Have a promotion code?" }));
    expect(screen.getByLabelText("Promotion code")).toBeInTheDocument();
  });

  it("re-quotes the offer and carries the code through to checkout", async () => {
    await openDraft();
    startActivationCheckout.mockResolvedValue({
      status: "ok",
      value: { url: "https://checkout.stripe.com/c/pay/cs_test_promo" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Have a promotion code?" }));
    fireEvent.change(screen.getByLabelText("Promotion code"), { target: { value: "LAUNCH100" } });
    loadActivationOffer.mockResolvedValueOnce({ status: "ok", value: discounted });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(loadActivationOffer).toHaveBeenLastCalledWith("prop-1", "AU", "LAUNCH100")
    );
    expect(await screen.findByText(/Code LAUNCH100 applied/)).toBeInTheDocument();

    // The published rate stays in view beside the discounted one: a price that
    // simply changed is a price a Host has to take on trust.
    const monthly = screen.getByRole("radio", { name: /A\$0\.00 per month with code LAUNCH100/ });
    expect(monthly).toBeInTheDocument();

    fireEvent.click(monthly);
    const acknowledgement = await screen.findByRole("checkbox");
    expect(acknowledgement).toHaveAccessibleName(
      "I understand I will be billed A$0.00 on 6 October 2026 if I do not cancel."
    );
    fireEvent.click(acknowledgement);
    fireEvent.click(screen.getByRole("button", { name: "Start free trial" }));

    await waitFor(() => expect(startActivationCheckout).toHaveBeenCalled());
    expect(startActivationCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "monthly", promotionCode: "LAUNCH100", chargedAmount: 0 })
    );
  });

  it("keeps the prices on screen when the code is refused", async () => {
    await openDraft();
    fireEvent.click(screen.getByRole("button", { name: "Have a promotion code?" }));
    fireEvent.change(screen.getByLabelText("Promotion code"), { target: { value: "NOPE" } });
    loadActivationOffer.mockResolvedValueOnce({
      status: "error",
      message: "That promotion code is not valid for this purchase. Check the code and try again."
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("not valid for this purchase");
    // A mistyped code must not blank the quote a Host was reading.
    expect(screen.getByRole("radio", { name: /A\$15\.00 per month/ })).toBeInTheDocument();
  });

  it("drops a code when the billing country changes, since it was checked against a currency", async () => {
    await openDraft();
    fireEvent.click(screen.getByRole("button", { name: "Have a promotion code?" }));
    fireEvent.change(screen.getByLabelText("Promotion code"), { target: { value: "LAUNCH100" } });
    loadActivationOffer.mockResolvedValueOnce({ status: "ok", value: discounted });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await screen.findByText(/Code LAUNCH100 applied/);

    fireEvent.click(screen.getByRole("button", { name: "Not right?" }));
    fireEvent.click(await screen.findByRole("radio", { name: "United States" }));

    await waitFor(() => expect(loadActivationOffer).toHaveBeenLastCalledWith("prop-1", "US"));
    expect(screen.queryByText(/Code LAUNCH100 applied/)).not.toBeInTheDocument();
  });
});

