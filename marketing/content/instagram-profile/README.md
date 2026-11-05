# Instagram profile: @digistaybook

Prepared November 1, 2026. The account exists but was empty: no photo, no bio, no posts, and the display
name was "DigiStaybook" (lowercase b) and the category was "Travel & Transportation".

**Applied November 1, 2026 (on the web):** name, bio, profile photo, and category set to Software.
**Still to do, in the phone app:** the two links below (Instagram only allows link editing on mobile), and the
highlights once there are stories.

## Paste these in (Edit profile)

**Name** (40/64 characters; Instagram allows two name changes in 14 days, so set it once):

    DigiStayBook | Vacation Rental Guestbook

**Username:** keep `digistaybook`.

**Category** (Professional dashboard → Edit profile → Category): `Software`, shown on the profile.

**Bio** (146/150 characters, keep the line breaks):

    Make your vacation rental feel like home.
    One QR code: house guide, local tips and a guestbook that grows every stay.
    No guest app. Try the demo ↓

**Links** (Edit profile → Links → Add external link), in this order:

| Title | URL |
|---|---|
| Try the demo | `https://digistaybook.com/i/demo` |
| 28-day free trial | `https://digistaybook.com/i/trial` |

The `/i/` links are redirects in the app's `firebase.json` (added November 1, 2026) to the demo cottage and the
pricing page, tagged `utm_source=instagram&utm_medium=social_profile&utm_campaign=instagram_profile`. **They only
work once the site is deployed.** Until then use `https://digistaybook.com/stay/demo-cottage` and
`https://digistaybook.com/pricing`.

## Pictures

- `profile-photo-1080.png` (or `.jpg`): profile photo, 1080 x 1080. The real logo (`public/logo.jpg`) on its own
  cream, inset so the roof and book survive the circle crop.
- `highlight-demo.png`, `highlight-guestbook.png`, `highlight-qr-signs.png`, `highlight-setup.png`: story
  highlight covers, 1080 x 1920. A highlight needs at least one story, so add these when the first stories go up
  (share approved Facebook Stories there too). Titles: Demo, Guestbook, QR signs, Setup.
- `preview-profile.png`: a mock of how the header reads on a phone, for review only. Don't upload it.
- `build.py`: rebuilds everything with Pillow. Only the real logo, flat shapes and text; no generated imagery.

## Checked against the marketing rules

- Argues the core reason ("feel like staying in someone's home") and reason 1 ("no app, no account").
- US spelling; no currency; no booking-platform names; no promise of fewer messages, reviews or revenue.
- The trial wording matches the site (28-day free trial).
