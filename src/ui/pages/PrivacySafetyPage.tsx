export function PrivacySafetyPage() {
  return (
    <div className="page narrow-page">
      <p className="eyebrow">Public support route</p>
      <h1>Privacy &amp; Safety</h1>
      <p className="lede">
        Use this route for a personal-data request, content takedown request or urgent platform safety concern.
        Booking, property and in-stay support remain with the Host or booking provider.
      </p>

      <div className="notice">
        <strong>DigiStayBook cannot help with bookings, property access, maintenance or in-stay issues.</strong>
        <p>Contact your host through your booking platform for stay support. Use this form only for privacy, personal-data or DigiStayBook content-safety concerns.</p>
      </div>

      <form className="stacked-form">
        <label htmlFor="request-kind">Request type</label>
        <select id="request-kind" defaultValue="privacy">
          <option value="privacy">Privacy request</option>
          <option value="takedown">Content takedown</option>
          <option value="urgent_safety">Urgent safety concern</option>
        </select>
        <label htmlFor="request-details">Details</label>
        <textarea id="request-details" maxLength={2000} />
        <p className="field-hint">Include the property or wall reference, and the post reference if you have one.</p>
        <label htmlFor="contact">Contact email</label>
        <input id="contact" type="email" />
        <p className="field-hint">Used only to verify and respond to this request.</p>
        <button type="button" disabled>Submit after secure endpoint is connected</button>
      </form>

      <p className="form-feedback" style={{ marginTop: "20px" }}>
        Requests will receive a neutral acknowledgement and unresolved verified requests escalate automatically within the defined SLA.
      </p>
    </div>
  );
}
