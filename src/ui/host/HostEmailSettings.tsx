import { useEffect, useState, type FormEvent } from "react";
import { hostCall } from "./GuestReviewPanel";

type Settings = {
  needsYou: boolean;
  newMemories: boolean;
  feedback: boolean;
  frequency: "hourly" | "daily";
  email: string;
};

const topics: { key: "needsYou" | "newMemories" | "feedback"; label: string; hint: string }[] = [
  { key: "needsYou", label: "Memories that need you",
    hint: "Waiting for your approval, hidden after a guest report, or held by our safety team." },
  { key: "newMemories", label: "New memories on your walls",
    hint: "Memories that passed the safety checks and went straight on the wall." },
  { key: "feedback", label: "Private feedback",
    hint: "Messages guests send to you alone." }
];

/**
 * Which guest activity a Host is emailed about, how often, and where. One
 * digest covers every property; it counts what arrived and links to the inbox,
 * and never carries a guest's words or photographs.
 */
export function HostEmailSettings({ signInEmail }: { signInEmail: string | null }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    let live = true;
    hostCall<Settings>("getHostNotificationSettings", {})
      .then(value => { if (live) setSettings(value); })
      .catch(() => { if (live) setNotice({ tone: "error", message: "Your email settings could not be loaded. Refresh the page to try again." }); });
    return () => { live = false; };
  }, []);

  function change<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings(current => current && { ...current, [key]: value });
    setNotice(null);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setBusy(true); setNotice(null);
    try {
      setSettings(await hostCall<Settings>("saveHostNotificationSettings", settings));
      setNotice({ tone: "success", message: "Your email settings have been saved." });
    } catch (error) {
      const message = error instanceof Error && /valid email/i.test(error.message) ? error.message : "Your email settings could not be saved. Try again in a moment.";
      setNotice({ tone: "error", message });
    } finally { setBusy(false); }
  }

  const off = settings && !settings.needsYou && !settings.newMemories && !settings.feedback;

  return <section className="account-section" id="account-notifications" aria-labelledby="account-notifications-title">
    <h2 id="account-notifications-title">Email from your walls</h2>
    <p className="field-hint">One email covers all your properties. It says what arrived and links to your inbox; guests’ messages and photos stay in the inbox.</p>
    {notice && <div className="notice" role={notice.tone === "error" ? "alert" : "status"}>{notice.message}</div>}
    {!settings ? (!notice && <p className="field-hint">Loading your email settings…</p>) :
      <form className="stacked-form" onSubmit={event => void save(event)}>
        <fieldset className="account-fieldset">
          <legend>Email me about</legend>
          {topics.map(topic => (
            <label key={topic.key} className="check-row">
              <input type="checkbox" checked={settings[topic.key]} disabled={busy} onChange={event => change(topic.key, event.target.checked)} />
              <span><strong>{topic.label}</strong><br />{topic.hint}</span>
            </label>
          ))}
        </fieldset>
        <label htmlFor="account-notify-frequency">How often</label>
        <select id="account-notify-frequency" value={settings.frequency} disabled={busy || !!off}
          onChange={event => change("frequency", event.target.value === "daily" ? "daily" : "hourly")}>
          <option value="hourly">As things arrive (at most once an hour)</option>
          <option value="daily">Once a day, as a summary</option>
        </select>
        <label htmlFor="account-notify-email">Send to <span className="label-optional">Optional</span></label>
        <input id="account-notify-email" type="email" autoComplete="email" maxLength={254} value={settings.email}
          placeholder={signInEmail ?? "Your sign-in email"} disabled={busy || !!off} onChange={event => change("email", event.target.value)} />
        <p className="field-hint">Leave blank to use your sign-in email{signInEmail ? ` (${signInEmail})` : ""}. Use another address if someone else looks after your guests.</p>
        <button className="btn btn-primary" disabled={busy}>Save email settings</button>
      </form>}
  </section>;
}
