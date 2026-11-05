import type { ReactNode } from "react";

/**
 * Each post's body, keyed by its slug in `domain/blog`. The wording is the
 * reviewed draft in marketing/campaigns/competitor-comparison-2026-10-30/BLOG_POST.md;
 * a change approved there is copied here, word for word.
 */
export const postBodies: Record<string, () => ReactNode> = {
  "digistaybook-vs-touch-stay-hostfully-staypage": ComparisonPost
};

type Row = [label: string, digistaybook: string, touchStay: string, hostfully: string, stayPage: string, paper: string];

const notMentioned = "Not mentioned on its site";

const comparisonRows: Row[] = [
  ["Main job", "Welcome, house guidance and guestbook in one", "Digital guidebook", "Digital guidebook", "Digital guest journal", "Information and memories, on paper"],
  ["Guests need an app?", "No, opens in the browser", "No (“no app required”)", "Shared as a link, PDF or QR code; app not mentioned", "No app, account or password", "No"],
  ["House information (Wi-Fi, checkout, appliances)", "Yes, pinned at the top", "Yes", "Yes", "No; its FAQ says it isn’t a guidebook", "Yes, if kept current"],
  ["Guests leave photos and notes", "Yes, on a shared guest wall", notMentioned, notMentioned, "Yes: stories, photos and local finds", "Handwritten notes"],
  ["Control over guest posts", "Automated screening; borderline posts wait for you; remove anything", "Not applicable", "Not applicable", "Publish instantly or hold each page for approval; hide any page", "None once it’s written"],
  ["Private feedback to the host", "Yes, never published", "Yes, private guest feedback", notMentioned, "“Homeowner-only private pages” (not described further)", "No"],
  ["Joins the Wi-Fi from the sign", "Yes, optional Wi-Fi code on the QR placard", notMentioned, notMentioned, notMentioned, "No"],
  ["Auto-translation", "No", "Yes, 30+ languages", "Yes, 16+ languages", notMentioned, "No"],
  ["Property management system integrations", "No", "40+ listed", "Hostfully’s own software", notMentioned, "No"],
  ["Sell extras to guests", "No", "Built-in upsell store", "Guidebook Marketplace", notMentioned, "No"],
  ["Ways to try it free", "28-day free trial on your first property; free QR welcome sign maker", "Free plan with monthly view limits; 14-day free trial", "First guidebook free", "Free Starter plan; 14-day trial of its Host plan", "Not applicable"],
  ["Pricing model", "One price per property, everything included", "Plans; see its site", "Free and paid; see its site", "Free, Host and Enterprise plans", "A binder and a pen"]
];

const columns = ["DigiStayBook", "Touch Stay", "Hostfully Digital Guidebooks", "StayPage", "Paper binder and guestbook"];

function ComparisonPost() {
  return (
    <>
      <p>
        Most vacation rentals welcome guests in one of three ways: a binder and guestbook on the counter, a digital
        guidebook sent as a link or QR code, or not much at all. A newer option, the digital guest journal, lets guests
        leave something behind for the next people who stay.
      </p>
      <p>
        We make DigiStayBook, so we aren’t neutral. What we can do is be specific. Below we compare DigiStayBook with three
        tools hosts often weigh it against (Touch Stay, Hostfully Digital Guidebooks and StayPage) and with the classic
        paper binder, using only what each company says on its own website as of November 1, 2026. Where another tool
        does something we don’t, we say so.
      </p>

      <h2>Two jobs: informing guests and collecting memories</h2>
      <p>A guest welcome does two different jobs.</p>
      <p>
        <strong>Informing.</strong> Where’s the Wi-Fi password? Which day is trash pickup? How does the heating work?
        What’s the checkout routine? Digital guidebooks such as Touch Stay and Hostfully are built for this, and they do
        it well.
      </p>
      <p>
        <strong>Collecting.</strong> A guestbook gathers the notes, photos and local finds guests leave behind. Paper
        guestbooks do this, and digital guest journals such as StayPage do it on a phone. StayPage’s own FAQ is clear
        that it isn’t a guidebook.
      </p>
      <p>
        <strong>DigiStayBook does both from one QR code.</strong> Guests scan a placard and open a page in their phone’s
        browser. Your house guidance (Wi-Fi, trash day, appliances, checkout) and your local favorites sit at the top.
        Below them is a wall of photos and notes from earlier guests, so every stay adds to the story of your place.
      </p>

      <h2>At a glance</h2>
      <div className="blog-table-scroll" role="region" aria-label="Comparison table" tabIndex={0}>
        <table className="blog-table">
          <thead>
            <tr>
              <th scope="col">What hosts look for</th>
              {columns.map(column => <th key={column} scope="col">{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {comparisonRows.map(([label, ...cells]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                {cells.map((cell, index) => (
                  <td key={columns[index]}>
                    {cell}
                    {index === 0 && label === "Pricing model" && <> (<a href="/pricing">see pricing</a>)</>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="blog-small">
        Checked November 1, 2026, on each company’s own website. “Not mentioned on its site” means we didn’t find it on
        the pages we checked, not that it doesn’t exist. Features and plans change, so check before you decide.
      </p>

      <h2>Touch Stay</h2>
      <p>
        Touch Stay is a dedicated digital guidebook. Its site describes guidebooks that are “mobile-first, with no app
        required,” shared by direct link, QR code or automated messages through a property management system. It lists
        auto-translation in 30+ languages, 40+ integrations, a built-in upsell store and a way to capture private guest
        feedback.
      </p>
      <p>
        <strong>Where it’s stronger:</strong> translation, integrations and selling extras. If you host many
        international guests or want your guide sent automatically from your property management system, Touch Stay
        covers ground DigiStayBook doesn’t. It has a free plan (limited to 20 guest views per guidebook per month) and a
        14-day free trial.
      </p>
      <p>
        <strong>What’s different:</strong> Touch Stay is about the host informing the guest. We didn’t see a place for
        guests to leave photos or notes for the next guest.
      </p>

      <h2>Hostfully Digital Guidebooks</h2>
      <p>
        Hostfully is best known for property management software, and its guidebooks plug into it. Your first guidebook
        is free, with “no credit cards.” Guidebooks offer auto-translation in 16+ languages, can pull recommendations and
        maps from Google, and can be shared as a private link, a PDF or, according to Hostfully’s help center, a QR code.
        A Guidebook Marketplace lets hosts offer paid extras such as early check-in or late checkout.
      </p>
      <p>
        <strong>Where it’s stronger:</strong> if you already run your rentals on Hostfully, a guidebook in the same
        system is hard to beat, and the free first guidebook is an easy way to try a digital guide.
      </p>
      <p>
        <strong>What’s different:</strong> the guidebook content comes from the host. We didn’t see a way for guests to
        add their own photos or notes.
      </p>

      <h2>StayPage</h2>
      <p>
        StayPage is closest to DigiStayBook’s guestbook side. It calls itself “a guest journal for your vacation home”:
        guests scan a QR card and leave stories, photos and local finds from their phone browser, “with no app, account,
        or password.” Hosts can publish pages instantly or hold each one for approval, and hide any page.
      </p>
      <p>
        <strong>Where it’s stronger:</strong> if you only want a guest journal and your house information already lives
        somewhere else, StayPage is focused on exactly that job, and its Starter plan is free.
      </p>
      <p>
        <strong>What’s different:</strong> you’d still need a guidebook or binder for the Wi-Fi, checkout and the rest.
        DigiStayBook puts the practical answers and the guestbook behind the same code, so guests who open it for the
        Wi-Fi also see what earlier guests loved.
      </p>

      <h2>The paper binder and guestbook</h2>
      <p>
        Plenty of lovely rentals still run on paper, and it has real charm. A handwritten note carries a warmth no screen
        quite matches, and paper needs no Wi-Fi or battery.
      </p>
      <p>
        The trade-offs are familiar. When the Wi-Fi password or trash day changes, pages need reprinting. A guestbook
        fills up, gets coffee on it or leaves in a suitcase, and guests can only read what’s on the shelf. And there’s no
        easy way to tell the host privately that something needs fixing while the stay is still underway.
      </p>

      <h2>Where DigiStayBook fits</h2>
      <p>DigiStayBook is built around one idea: a rental should feel like staying in someone’s home, not a business.</p>
      <ul>
        <li>
          <strong>Guests find answers themselves.</strong> Wi-Fi, trash day, appliance quirks and checkout are on the
          counter, on their phone. No app, no guest account. The placard can carry a Wi-Fi code that a phone joins with
          one scan, and the wall copies the password in a tap.
        </li>
        <li>
          <strong>A guestbook that builds up instead of filling up.</strong> Each stay can add photos, notes and local
          tips alongside your own welcome.
        </li>
        <li>
          <strong>You stay in control.</strong> Posts pass automated screening, borderline ones wait for your approval,
          and you can remove anything. Screening reduces risk; no system can promise every post is perfect, which is why
          you have the final say.
        </li>
        <li>
          <strong>Hear about problems while you can fix them.</strong> Guests can send you private feedback that’s never
          published, so you hear about the slow shower during the stay. It isn’t a review and doesn’t replace one.
        </li>
        <li>
          <strong>Update once, every guest sees it.</strong> Change the Wi-Fi password on your phone and the next guest
          sees the new one.
        </li>
        <li>
          <strong>Share the memories.</strong> A separate <a href="/wall/demo-cottage">public page</a> shows guest photos
          and notes, without house details, to share with past guests or embed on your own website.
        </li>
        <li>
          <strong>One price per property, everything included</strong>, with a 28-day free trial on your first
          property. <a href="/pricing">See pricing</a>.
        </li>
      </ul>

      <h2>When DigiStayBook isn’t the right fit</h2>
      <p>
        We’d rather you pick the right tool. DigiStayBook probably isn’t for you if you need your guide in several
        languages, want it sent automatically from your property management system, want to sell extras to guests, or
        don’t want guest posts at all. The guest wall is at the heart of DigiStayBook; if a guestbook isn’t part of your
        plan, a plain guidebook may suit you better.
      </p>

      <h2>Who each option suits</h2>
      <ul>
        <li><strong>Touch Stay:</strong> hosts and managers who want a full-featured guidebook with translation, integrations and upsells.</li>
        <li><strong>Hostfully Digital Guidebooks:</strong> hosts already on Hostfully’s software, or anyone who wants to try one guidebook free.</li>
        <li><strong>StayPage:</strong> hosts who want a guest journal only, with house information handled elsewhere.</li>
        <li><strong>Paper:</strong> hosts who love handwriting and rarely change their details.</li>
        <li>
          <strong>DigiStayBook:</strong> independent hosts and small portfolios who want practical answers and a growing
          guestbook behind one QR code, with screening and private feedback included.
        </li>
      </ul>

      <h2>Questions hosts ask</h2>
      <h3>Do guests need an app or an account?</h3>
      <p>
        No. Guests scan the placard and DigiStayBook opens in their browser. There’s no guest account; a name on a post is
        optional, and we don’t ask guests for an email address or phone number.
      </p>
      <h3>Can I use DigiStayBook alongside another guidebook?</h3>
      <p>
        Yes. Some hosts may keep an existing guidebook and add DigiStayBook for the guest wall and private feedback. Just
        keep the details in both consistent.
      </p>
      <h3>Can I try it first?</h3>
      <p>
        Yes. <a href="/stay/demo-cottage">See what guests see</a> on our demo property, or make a free{" "}
        <a href="/qr-sign-maker">QR welcome sign</a>, no account needed.
      </p>

      <p className="blog-small">
        Last checked November 1, 2026. Competitor details come from each company’s own public website on that date and may
        have changed. Touch Stay, Hostfully and StayPage are trademarks of their respective owners. DigiStayBook isn’t
        affiliated with or endorsed by any of them.
      </p>
    </>
  );
}
