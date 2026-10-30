import { useEffect, useRef, useState, type FormEvent } from "react";
import { BrandMark } from "../Brand";
import { callHelp, recentHelp, type HelpMessage } from "./helpApi";
import "./help.css";

const greeting: HelpMessage = { role: "assistant", text: "Hi! I’m DigiStayBook’s help guide. Ask me about setting up your guestbook, QR codes or guest memories." };
const suggestions = ["How do I get started?", "Do guests need an app?", "How much does it cost?"];
const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("");
const openEvent = "ds-help-open";

/** A finger-sized "?" for a sticky action bar. On a phone it stands in for the
    floating launcher, which would otherwise sit on top of the bar's buttons. */
export function HelpBarButton() {
  return <button type="button" className="btn btn-secondary ds-help-bar" aria-label="Questions? Ask us" aria-haspopup="dialog" aria-controls="digistaybook-help" onClick={e => window.dispatchEvent(new CustomEvent<HTMLElement>(openEvent, { detail: e.currentTarget }))}>?</button>;
}

export function HelpWidget() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"chat" | "contact" | "sent">("chat");
  const [messages, setMessages] = useState<HelpMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [contact, setContact] = useState({ name: "", email: "", message: "" });
  const [includeChat, setIncludeChat] = useState(true);
  const requestId = useRef("");
  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const question = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const close = () => { setOpen(false); (opener.current?.isConnected ? opener.current : launcher.current)?.focus(); opener.current = null; };

  // On a phone the launcher waits for the site footer, so it never covers the
  // page while someone is reading or filling it in. No footer, no waiting.
  const [atFooter, setAtFooter] = useState(true);
  useEffect(() => {
    const footer = document.querySelector(".site-footer");
    if (!footer || typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver(([entry]) => setAtFooter(entry.isIntersecting));
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const openFrom =(e: Event) => { opener.current = (e as CustomEvent<HTMLElement>).detail; setOpen(true); };
    window.addEventListener(openEvent, openFrom);
    return () => window.removeEventListener(openEvent, openFrom);
  }, []);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>(view === "chat" ? "input" : "button")?.focus();
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open, view]);
  useEffect(() => { if (list.current) list.current.scrollTop = list.current.scrollHeight; }, [messages, busy, open]);

  function changeView(next: typeof view) { setError(""); setView(next); }
  async function ask(text: string) {
    text = text.trim();
    if (busy || !text) return;
    const previous = messages;
    const next: HelpMessage[] = [...messages, { role: "user", text }];
    setMessages(next); setDraft(""); setError(""); setBusy(true);
    try {
      const answer = await callHelp<{ reply: string }>("helpChat", { messages: recentHelp(next) });
      setMessages([...next, { role: "assistant", text: answer.reply }]);
    } catch (err) {
      setMessages(previous); setDraft(text);
      setError((err as Error).message);
    } finally { setBusy(false); question.current?.focus(); }
  }
  async function sendContact(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    requestId.current ||= newId();
    try {
      await callHelp("helpContact", { ...contact, requestId: requestId.current, transcript: includeChat ? recentHelp(messages).map(m => ({ ...m, text: m.text.slice(0, 1000) })) : [] });
      changeView("sent"); setContact({ name: "", email: "", message: "" }); requestId.current = "";
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return <aside className={`ds-help${atFooter || open ? "" : " ds-help-waiting"}`} aria-label="DigiStayBook help">
    {open && <section ref={panel} className="ds-help-panel" id="digistaybook-help" role="dialog" aria-labelledby="ds-help-title">
      <header className="ds-help-head"><BrandMark height={24} /><div><strong id="ds-help-title">{view === "chat" ? "DigiStayBook help" : "Message us"}</strong><small>{view === "chat" ? "Quick answers · Email support" : "Product support by email"}</small></div><button type="button" onClick={close} aria-label="Close help">×</button></header>
      {view === "chat" && <>
        <div className="ds-help-messages" ref={list} role="log" aria-live="polite" aria-relevant="additions">
          {[greeting, ...messages].map((m, i) => <p key={i} className={`ds-help-message ${m.role}`}>{m.text}</p>)}
          {!messages.length && <div className="ds-help-suggestions">{suggestions.map(s => <button type="button" disabled={busy} key={s} onClick={() => void ask(s)}>{s}</button>)}</div>}
          {busy && <p role="status" className="ds-help-message assistant">Thinking…</p>}
        </div>
        {error && <p className="ds-help-error" role="alert">{error}</p>}
        <form className="ds-help-input" onSubmit={e => { e.preventDefault(); void ask(draft); }}><input ref={question} aria-label="Your question" placeholder="Ask about DigiStayBook…" value={draft} onChange={e => setDraft(e.target.value)} maxLength={1000} disabled={busy} /><button className="btn btn-primary" type="submit" disabled={busy || !draft.trim()}>Send</button></form>
        <p className="ds-help-note">Built-in answers to common questions. Don’t share passwords, door codes or payment details. <a href="/privacy">Privacy</a></p>
        <button className="ds-help-contact" type="button" disabled={busy} onClick={() => changeView("contact")}>Rather talk to a person? <strong>Message us</strong></button>
      </>}
      {view === "contact" && <form className="ds-help-form" onSubmit={e => void sendContact(e)}>
        <p>For help with DigiStayBook, leave a message and we’ll reply by email. For help during your stay, contact your property host through your booking app.</p>
        <label>Your name (optional)<input autoComplete="name" maxLength={100} value={contact.name} onChange={e => setContact({ ...contact, name: e.target.value })} disabled={busy} /></label>
        <label>Email<input type="email" autoComplete="email" required maxLength={200} value={contact.email} onChange={e => setContact({ ...contact, email: e.target.value })} disabled={busy} /></label>
        <label>How can we help?<textarea required rows={4} maxLength={4000} value={contact.message} onChange={e => setContact({ ...contact, message: e.target.value })} disabled={busy} /></label>
        {!!messages.length && <label className="ds-help-check"><input type="checkbox" checked={includeChat} onChange={e => setIncludeChat(e.target.checked)} disabled={busy} />Include recent chat with my message</label>}
        <p className="ds-help-note">Messages are stored for up to 180 days and emailed to support. <a href="/privacy">Privacy</a></p>
        {error && <p className="ds-help-error" role="alert">{error}</p>}
        <div className="ds-help-actions"><button className="btn btn-secondary" type="button" disabled={busy} onClick={() => changeView("chat")}>Back to chat</button><button className="btn btn-primary" disabled={busy} type="submit">{busy ? "Sending…" : "Send message"}</button></div>
      </form>}
      {view === "sent" && <div className="ds-help-form" role="status"><h2>Thanks for your message.</h2><p>{import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true" ? "Local preview: your message was saved locally. No email was sent." : "Your message has been sent to support. We’ll reply to the email address you supplied."}</p><button className="btn btn-secondary" onClick={() => changeView("chat")}>Back to chat</button></div>}
    </section>}
    <button ref={launcher} type="button" className="ds-help-launcher" aria-expanded={open} aria-controls="digistaybook-help" onClick={() => open ? close() : setOpen(true)}><span className="ds-help-short" aria-hidden="true">{open ? "Close" : "Ask us"}</span><span className="ds-help-label">{open ? "Close help ×" : "Questions? Ask us"}</span></button>
  </aside>;
}
