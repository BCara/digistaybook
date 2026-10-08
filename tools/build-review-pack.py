from pathlib import Path
import json, re, html, hashlib, shutil, zipfile, subprocess, datetime
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import letter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/legal-review/reviewer-pack-2026-10-02'
OUT.mkdir(parents=True, exist_ok=True)
legal = json.loads((OUT / 'legal-text.json').read_text(encoding='utf-8-sig'))
live = json.loads((OUT / 'live-metadata.json').read_text(encoding='utf-8-sig'))
blocks = []
def p(text): blocks.append(('p', text))
def h(text, level=1): blocks.append(('h'+str(level), text))
def table(headers, rows): blocks.append(('table', [headers]+rows))
def page(): blocks.append(('page', ''))

h('DigiStayBook legal and privacy review pack', 0)
p('Prepared 2 October 2026 | Updated 5 October 2026 | Review version 2 | Guest contributions and related host terms')
p('Version 2 aligns the memory and private-feedback screening labels and adds automatic restricted safety routing for serious memory text flags. These changes are in the local source; this update does not deploy them. The live metadata below remains the recorded 2 October snapshot. Exact legal drafts remain the supplied draft versions and require review against the updated flow.')
p('Please review the full draft documents and the actual processing and operating arrangements described here. Return amendments, a list of unresolved conditions and an explicit approval record for the final document versions. Public guest submissions remain disabled. This pack records facts, draft commitments and open decisions; it does not supply approval.')
h('How to use this pack')
p('Start with the decision register and the processing inventory. Read the full Host Terms, Guest Terms, Privacy Policy and consent wording in the appendices. Record corrections against the source clause and complete the response form. The ZIP includes the relevant source files, operating handbook, evidence snapshots, screening fixtures and a checksum manifest so review can continue without access to the developer checkout.')
p('Audience: qualified legal/privacy reviewer, product owner and engineering release owner. A reviewer may annotate this PDF or complete reviewer-response.md. No production login, private guest data, credentials or secrets are included.')
table(['Section','Purpose'], [
 ['Review scope and evidence','What is implemented, verified, proposed or unresolved'],
 ['Processing and data inventory','Collection, recipients, access, location and deletion'],
 ['Decision register and controls','Questions needing legal/product/operations decisions'],
 ['Complete legal drafts','Exact Host Terms, Guest Terms, Privacy Policy and consent'],
 ['Guest reporting wording','Current public reporting experience'],
 ['Screening and release checklist','Tests, limits and remaining production proof'],
 ['References and approval form','Evidence index, provider sources and signoff']])
h('Review scope and evidence')
p('Primary scope is guest memories, private feedback, photo handling, consent, overseas screening, content review, reports and deletion. The Host Terms are included in full because account, subscription, liability and host responsibilities interact with this flow. Marketing, billing, exports and host data are included where the Privacy Policy makes statements about them; those statements need their own implementation evidence.')
p('Code and handbook snapshots were assembled from the current working tree, which contains uncommitted work. File hashes identify this pack precisely; a Git commit alone does not identify every attached file. Exact draft wording is preserved, including statements that need correction. Source presence is not proof that a feature is deployed, staffed or compliant.')
table(['Evidence level','Observed state or limitation'], [
 ['Current source','The relevant code has been reviewed, including shared serious-text safety rules and waiting for incomplete scans. Legal sign-off has not been recorded (legalApproval is null). The 5 October screening changes are local source changes; deployment and live-flow proof remain required.'],
 ['Live metadata on 2 October','finishGuestContribution ACTIVE; revision '+live['revision']+'; production contribution flag false.'],
 ['Live bucket metadata','Both guest buckets are AUSTRALIA-SOUTHEAST1, with uniform access and public-access prevention enforced; recovery retention 604800 seconds (7 days).'],
 ['Earlier session checks','123 Functions tests passed; build and selected function deployments completed. These are recorded checks, not a fresh independent audit.'],
 ['5 October local checks','135 Functions tests passed and Functions build passed. Emulator server checks passed, including memory safety routing/host approval denial and private-feedback outage retry/recovery/exhaustion. These are local checks; provider calibration, deployment and live guest proof remain separate.'],
 ['Email configuration','75-attempt monitoring alert and A$1/A$5 monthly screening warnings configured for codebertcreations@gmail.com. Inbox receipt remains unverified.'],
 ['Outstanding production evidence','Runtime provider access/classification quality, direct object-access denial, guest submission journeys, deletion deadlines, reviewer staffing/MFA and real device behaviour.']])
p('Live metadata snapshot time: '+live['checkedAtUtc']+'. The snapshot intentionally excludes unrelated environment variables. Project and resource identifiers are included for traceability, not as credentials.')
p('Product decisions confirmed final on 6 October 2026. Retain the guest experience and screening rules in operating plan sections 5.3 and 5.4; reopen only if testing discovers an issue. Legal wording approval and live verification are separate work.')
h('Service and processing flow')
p('DigiStayBook provides property-specific guestbooks for short-term rental hosts. A guest opens an in-stay link, establishes a property-specific anonymous Firebase session and chooses either a public memory or private feedback. The product does not provide booking support or a host-to-guest messaging service.')
table(['Step','Memory route','Private feedback route'], [
 ['Collection','Message plus optional photos and public-display consent','Text-only complaint or feedback; no public-display consent'],
 ['Storage','Private quarantine bucket for photos, plus a private guest submission record for the message, photo references and status','Private guest submission record for the feedback text and status'],
 ['Screening','Australia text endpoint; transformed photo bytes to EU Vision endpoint','Australia text moderation endpoint'],
 ['Decision','Clear; Flagged for host; Flagged for safety review; Screening incomplete. See shared outcomes below.','Clear; Flagged for host; Flagged for safety review; Screening incomplete. See shared outcomes below.'],
 ['Public visibility','Only after publication and state checks; photos served through application endpoint','Never shown on the public wall'],
 ['Failure and capacity','Screening incomplete: open a restricted safety case with the reason tag; keep unpublished until authorised review','Screening incomplete: open a restricted safety case with the reason tag; keep undelivered until authorised review'],
 ['Removal','Self-delete hides immediately and queues object deletion; report/lost-session workflows also exist','Safety review can release/delete held feedback; retention schedules need approval']])
h('Shared screening outcomes',2)
table(['Outcome','Memory route','Private feedback route'], [
 ['Clear','Publish to the public guestbook after all required checks pass','Deliver privately to the host; never publish'],
 ['Flagged for host','Hold for host review before publication: profanity or other ordinary flags without a serious safety flag; public contact details and external links also trigger this route','Deliver privately to the host for consideration: profanity or ordinary complaints without a serious safety flag; the host can report a message for safety review'],
 ['Flagged for safety review','Automatically keep unpublished and open a restricted safety case for a serious text flag; the host cannot approve it','Automatically withhold host delivery and open a restricted safety case for a serious text flag'],
 ['Screening incomplete','Open a restricted safety case tagged Screening incomplete, showing the reason; keep unpublished until authorised review','Open a restricted safety case tagged Screening incomplete, showing the reason; keep undelivered until authorised review']])
p('Both text routes use the same serious-category rules: Violent, Sexual, Derogatory, and Firearms & Weapons at the agreed confidence threshold of 0.8, final for testing. A serious flag takes priority over an ordinary profanity flag. Provider confidence measures confidence in a category, not how severe a swear word is. Profanity alone does not open a restricted safety case. Context, slang, reported incidents and benign references still require calibration; these rules do not guarantee every harmful message is detected.')
p('Final routing for testing includes serious memory text and adult/violence photo flags in restricted safety review; medical/racy photo flags use host review. Incomplete checks enter restricted safety review tagged Screening incomplete. There is no automatic rejection. Ordinary private feedback reaches the private inbox. Memory and feedback operations case-opening and resolution controls are implemented; verify the live journeys.')
p('Memory upload allowance: up to ten JPEG/PNG/WebP photos, 5 MiB each, 25 MiB total and 40 megapixels per photo. Processing rotates, strips metadata and converts to WebP within 2000 by 2000. Message and feedback length is 1,200 characters. These upload limits are final for testing; verify device acceptance and record any HEIC issue before proposing a change.')
p('Vision receives transformed image bytes, without guest session ID, property name, caption, storage URL or original filename. Redirects and regional fallback are refused by the adapter. This reduces payload context; it is not a contractual guarantee about every provider processing location.')
h('Data inventory')
table(['Data class','Purpose and recipient','Storage and retention evidence'], [
 ['Guest memory text and photos','Property guestbook; host review or restricted safety review; public audience after publication; Google screening','Private submission records; photos in private Sydney buckets. Sydney location is evidenced for the photo buckets only. Approved lifecycle schedules and live object deletion proof pending.'],
 ['Private feedback','Host complaint inbox or restricted safety review; Google text screening','Submission text moves to host inbox/safety case after delivery/hold. Remaining feedback retention schedules pending.'],
 ['Consent evidence','Record public-display acknowledgement and exact versions','guestConsent stores wording/version, terms/privacy versions, timestamp, post/property/session reference. Kept while the associated content exists, then 24 months after content deletion or final dispute closure, whichever is later. Manual-deletion reminders deployed 5 October; no automatic consent deletion. Email receipt and manual completion in production remain unverified.'],
 ['Anonymous session and abuse records','Route guest actions and prevent cross-property misuse; App Check and security controls','Property-specific anonymous Firebase identity. Ten new attempts per UID/hour; cross-identity protection/account expiry incomplete. Firestore/Auth locations require account-specific confirmation.'],
 ['Reports and privacy requests','Verify requests, takedown, escalation; host or safety operations','Contact email/details, report references and pseudonymous reporter key. 14-day review deadline does not establish final retention/deletion periods.'],
 ['Restricted safety evidence and access audits','Assess safety/legal cases and record restricted access','Operations requires admin claim plus second-factor token in code. Live MFA, staffing, holds and authorised disclosure process require proof.'],
 ['Host identity and configuration','Login, property settings, support and communications','Firebase Auth/Firestore and host assets; complete regional inventory and processing role review pending.'],
 ['Billing and accounting metadata','Stripe checkout/subscriptions and business records','DigiStayBook does not store full card details. Five-year accounting value is declared; legal suitability/enforcement requires review.'],
 ['Marketing preference and suppression records','Express consent, withdrawal and prevention of promotional sends','Privacy draft describes detailed marketing records. Runtime/provider and retention evidence must be reconciled separately.'],
 ['Logs and daily usage counters','Security, diagnosis, screening capacity and alerts','90-day routine-log value is declared. Screening counters store counts/day/units, not guest text/photos. Full log policy and expiry proof pending.']])
h('Storage access and deletion')
p('Sydney storage is currently evidenced for the two guest-photo buckets only. Do not extend that conclusion to Firebase Auth, Firestore, logs, host photos, email or Stripe. Published photos remain in a private delivery bucket and the application checks property/post/submission state on each read; it does not issue permanent photo download tokens.')
p('Public display can create copies outside DigiStayBook, including screenshots, downloaded host exports and browser copies. A server takedown cannot revoke every external copy. Review the guest wording, host responsibilities and export coverage with that limitation in mind.')
table(['Record or event','Declared target or behaviour','Approval or evidence needed'], [
 ['Guest self-delete','Immediate hide; primary deletion job due within 72 hours','Live worker success, races, alerts and object-access checks'],
 ['Quarantine cleanup','24-hour cleanup target','Live worker execution and overdue monitoring'],
 ['Bucket recovery','7 days of recoverable soft-deleted objects observed','Align restoration rights, privacy disclosure and deletion promises'],
 ['Backup expiry','30 days after primary deletion declared','Actual backup coverage, manifests, restore exclusions and expiry proof'],
 ['Consent evidence','Life of the associated content, then 24 months after content deletion or final dispute closure, whichever is later','Automatic reminders; manual deletion. Review purpose, necessity, linked and external holds, operator completion and backup handling.'],
 ['Routine logs','90 days declared','Actual logging retention settings and content minimisation'],
 ['Unpaid drafts and dormant properties','30 days / 12 months declared','Trigger definition, notices and actual automation'],
 ['Abandoned uploads and rejected content','Schedule not settled','Set duration, owner and cleanup implementation'],
 ['Anonymous accounts and safety holds','Schedule/hold ownership not settled','Set lawful hold criteria, restricted access, review and expiry'],
 ['Reports and held feedback','14-day escalation / 30-day review deadline','These are review deadlines, not approved retention periods']])
h('Provider and overseas processing review')
p('Selected arrangement: guest-photo storage in Sydney; synchronous Google Vision SafeSearch using the EU hostname; text screening using the Australia Natural Language hostname. The owner approved this arrangement, while account-specific legal/privacy review remains open.')
p('Google publishes service and processing terms and a data-use FAQ. The FAQ distinguishes immediate-response image processing from asynchronous processing. The contractual Vision residency listing must be checked for the actual feature; the project review records an OCR listing rather than a SafeSearch exclusive-region commitment. Endpoint selection is therefore not represented as an EU-only contractual guarantee. See the direct provider references at the end of this pack.')
p('Counsel should obtain the accepted Google agreement and DPA version, account contracting entity, applicable service terms, subprocessors/countries, transfer safeguards, incident notification contacts and any evidence required to verify commitments. Published links are supplied as references; they do not prove which terms this account accepted.')
h('Priority decision register')
decisions = [
 ['R01','Operator and jurisdiction','Operator confirmed on 5 October 2026: operates under an ABN in Melbourne, Victoria, Australia. Retain Victoria as the governing-law choice in the drafts for review. Still required: legal entity name, ABN number, full business address and ACN if applicable, plus reviewer confirmation of the final clauses. Operator statement only; no registry verification or legal approval recorded.','Owner and counsel'],
 ['R02','Roles and obligations','Confirm roles by data class and which privacy, consumer and communications obligations apply to the actual business and markets.','Counsel'],
 ['R03','Overseas handling','Approve account agreements, provider disclosure, safeguards/countries and accurate endpoint language.','Counsel'],
 ['R04','Minors and third parties','Approve 16+ wording; address photos of minors/other people, uploader authority and response workflow.','Counsel and owner'],
 ['R05','Publication rights','Approve licence/consent wording, host responsibilities, public visibility, takedown and external-copy limits.','Counsel'],
 ['R06','Retention and recovery','Controlled testing uses dedicated accounts; all their properties, contributions and files are test-only (owner confirmed 6 October). Cleanup timing remains to be selected. General retention, safety holds and recovery schedules remain separate work.','Owner, counsel and engineering'],
 ['R07','Incomplete screening','Owner selected on 6 October: incomplete memory or feedback screening opens a restricted safety-review case tagged Screening incomplete, with the failure reason visible to the reviewer. Memories stay unpublished and feedback stays undelivered until review. An automatic retry cannot bypass the open case. Implemented and verified locally; live deployment and verification pending. Operating plan section 5.4 is the policy reference.','Owner and engineering'],
 ['R08','Screening accuracy and appeals','Product thresholds and routing are final for testing. Verify them using labelled examples, record false positives and missed severe content, and reopen only if testing finds an issue. Review legal uncertainty/appeal wording separately.','Owner and counsel'],
 ['R09','Critical content handling','Final routing: serious memory text or photo flags enter restricted safety review; serious feedback flags enter the same restricted queue. Memory and feedback case-opening and resolution controls are implemented. Verify live host approval denial, operations MFA, case access and provider outcomes. No new product-routing decision is required unless testing finds an issue.','Safety owner and engineering'],
 ['R10','Staffing and notification promises','Name reviewers, hours, urgent handling and incident contacts. Host held-memory/report email worker is not established by the operations-budget email setup.','Owner'],
 ['R11','Billing and consumer wording','Owner confirmed live billing tests on dedicated accounts: scoped 50c payment setup and subscription/trial cancellation. Record actual charges and final subscription states; setup and live evidence remain pending. Legal review of trial, pricing, refunds and consumer wording remains separate.','Counsel and billing owner'],
 ['R12','Marketing and email claims','Verify consent/suppression implementation and provider before approving the Privacy Policy\'s communications claims.','Owner, counsel and engineering'],
 ['R13','Upload and image limitations','Approve limits, transformed-image handling, HEIC outcome and image-contact detection gap; avoid claiming comprehensive safety coverage.','Owner and engineering'],
 ['R14','Approval record','Approve final versions together; record exact texts, reviewer/date, outstanding conditions and scope.','Counsel and release owner']]
table(['ID and topic','Decision required','Decision owner'], [[r[0]+' '+r[1],r[2],r[3]] for r in decisions])
p('Owner confirmation during preparation: the user is the operator and handles privacy/safety requests. Legal name, entity structure, address, ABN/ACN if applicable, state, review hours and backup coverage remain unconfirmed. The operations warning address is codebertcreations@gmail.com; designation of this address for published legal/support requests still needs confirmation.')
h('Owner information needed')
for text in ['Operator and privacy/safety request handler: the user, confirmed as "all me". Legal name and business identifiers: PENDING.', 'Registered/service address and state: PENDING.', 'Approved published support and privacy contact details: PENDING.', 'Safety reviewer: the user. Backup reviewer and review hours: PENDING.', 'Google account agreement and contracting entity: PENDING.', 'Email provider for host notices and actual communications delivery: PENDING.', 'Final retention/backup/hold policy: PENDING. Owner: the user.'] : p(text)
page()
h('Appendix A Full Host Terms')
p('Exact source snapshot. '+legal['hostTerms']['version']+' | '+legal['hostTerms']['lastUpdated']+'. Draft wording is reproduced without silently correcting promises or assumptions.')
def add_legal(doc):
 for text in doc['intro']: p(text)
 for section in doc['sections']:
  h(section['heading'],2)
  for text in section['paragraphs']: p(text)
 h('Source review notes',2)
 for note in doc['reviewNotes']: p(note)
add_legal(legal['hostTerms'])
page(); h('Appendix B Full Guest Terms')
p('Exact source snapshot. '+legal['guestTerms']['version']+' | '+legal['guestTerms']['lastUpdated']+'.')
add_legal(legal['guestTerms'])
page(); h('Appendix C Full Privacy Policy')
p('Exact source snapshot. '+legal['privacyPolicy']['version']+' | '+legal['privacyPolicy']['lastUpdated']+'.')
add_legal(legal['privacyPolicy'])
page(); h('Appendix D Consent and guest reporting')
h('Exact consent wording',2); p('Version '+legal['versions']['consent']); p(legal['consent'])
p('The server stores the exact wording/version and the Guest Terms/Privacy versions with the consent event. Same-session guest controls use the anonymous identity; the public reporting route exists for lost sessions and third-party concerns. The declaration is not evidence of identity/age verification.')
h('Current Privacy and Safety page wording',2)
for text in ['Privacy & Safety', 'Use this route for a personal-data request, content takedown request or urgent platform safety concern. Booking, property and in-stay support remain with the Host or booking provider.', 'DigiStayBook cannot help with bookings, property access, maintenance or in-stay issues.', 'Contact your host through your booking platform for stay support. Use this form only for privacy, personal-data or DigiStayBook content-safety concerns.', 'Request type: Privacy request; Content takedown; Urgent safety concern.', 'Details: include the property or wall reference, and the post reference if you have one. Maximum 2,000 characters.', 'Contact email: used only to verify and respond to this request.', 'Submitting a request does not automatically approve deletion. Your contact details are used to verify and respond to your request.'] : p(text)
p('Success acknowledgement includes a reference and states that the request has not yet been verified or approved. Source: src/ui/pages/PrivacySafetyPage.tsx. Review the word urgent against actual staffing and response capabilities; no staffed emergency response is established by this page.')
h('Private feedback boundary wording',2)
p('It isn’t monitored in real time and your host can’t reply here — for help during your stay, message them through your booking app. Messages are checked automatically; ones containing threats, sexual content or hate may be held for a safety review first.')
h('Appendix E Screening and controlled release')
p('The pack includes 20 labelled synthetic text examples and an image-acquisition plan. Labels are proposed product outcomes. No representative image set or provider calibration results are claimed. There are coverage gaps, including sexual/hate text examples and real image classification; licensed/authorised images must be acquired before those categories are validated.')
table(['Release evidence','Pass criteria and record'], [
 ['Provider access','Deployed runtime identity can call both providers and access transformed photo bytes; record revisions and classifications'],
 ['Calibration','Label cases before execution; record all errors/mismatches, investigate harmful misses and approve thresholds/false-positive target'],
 ['Provider failures','Malformed, missing, timeout and 403/429/5xx responses open tagged incomplete-screening safety cases; verify no publication/delivery or retry bypass, reviewer reason visibility and authorised resolution'],
 ['Shared text decisions','Clear memories publish; ordinary memory flags require host review; serious text flags in both routes open restricted safety cases; ordinary feedback reaches only the private host inbox'],
 ['Daily allowance','100/day shared attempts including edits/feedback/retries; warning at 75; denied 101st call; reset at Sydney midnight; pending work recovers'],
 ['Email warning','Observe receipt at codebertcreations@gmail.com; distinguish configuration from delivery'],
 ['Guest controls','Real QR/stay token, property-specific anonymous identities, App Check, publication/review/edit/delete and isolated private feedback'],
 ['Storage and deletion','Direct-access denial; live cleanup workers and deletion deadlines; no deleted/restricted content in ordinary host exports'],
 ['Operations','Named reviewer, MFA, restricted access, audit/escalation and appropriate host/operations notices'],
 ['Devices','Android/iPhone, HEIC, ten-photo limits, interrupted upload, accessibility and actual wording'],
 ['Legal and release','Final approval recorded, draft notices removed, approved versions deployed and NAS copies synchronised; controlled rollout reviewed before expansion']])
p('The current 100-attempt cap is not a monetary cap. One memory with ten photos is one attempt, and failed provider calls also consume attempts. It does not bound storage/delivery costs. A 24-hour monitoring repeat limit can delay another warning on a subsequent calendar day if it falls within that window; review whether a per-calendar-day notification policy is needed.')
h('Appendix F References and included evidence')
references=[
 ('Google Cloud Data Processing Addendum','https://cloud.google.com/terms/data-processing-addendum','Published processing terms; accepted account agreement still required'),
 ('Google Cloud Services Data Residency','https://cloud.google.com/terms/data-residency','Check exact service and feature commitments'),
 ('Google Vision Data Usage FAQ','https://docs.cloud.google.com/vision/docs/data-usage','Immediate versus asynchronous image processing'),
 ('Google Cloud subprocessors','https://cloud.google.com/terms/subprocessors','Reviewer should retrieve current register; automated retrieval did not succeed'),
 ('Google Cloud service terms','https://cloud.google.com/terms/service-terms','Applicable service commitments and conditions'),
 ('Vision pricing','https://cloud.google.com/vision/pricing','Per-image screening usage'),
 ('Natural Language pricing','https://cloud.google.com/products/natural-language/pricing','Text moderation units'),
 ('OAIC privacy resources','https://www.oaic.gov.au/privacy','Reviewer reference; no applicability opinion supplied')]
for title,url,why in references:
 p(title+' — '+url+'. '+why+'.')
p('Provider DPA, residency and Vision data-use pages were opened during preparation. The subprocessor link is supplied for reviewer follow-up, with retrieval failure disclosed. No complete copyrighted provider contracts have been copied into this pack. Public provider references do not establish account acceptance or legal suitability.')
p('Included evidence: exact legal source and JSON export; processing/screening/reporting/deletion source; Firestore and storage rules; retention and billing policy source; guest issue register; provider review; daily allowance record; handoff; implementation/gap records; full operating handbook; live metadata snapshot; synthetic text fixtures/image plan; reviewer response form; SHA256 manifest.')
page(); h('Appendix G Reviewer response and approval')
p('Please return a marked-up document or complete reviewer-response.md. Approval should identify each document/version, scope, reviewer and date. Record any conditions that prevent release; do not use a blanket approval if the reviewed text differs from the deployed text.')
for text in ['Reviewer name and firm: ______________________________________', 'Review date and scope: ______________________________________', 'Decision: approve / approve subject to conditions / further work required.', 'Approved Host Terms version: ________________________________', 'Approved Guest Terms version: _______________________________', 'Approved Privacy Policy version: ______________________________', 'Approved consent version: __________________________________', 'Required amendments and unresolved decisions: ________________', 'Conditions that must be met before controlled intake: ___________', 'Evidence requested from engineering or the operator: ___________', 'Approver signature or written approval reference: _______________']: p(text)
p('Engineering release record: version all final texts; record legalApproval only after approval is received; deploy; verify visible wording and stored consent versions; synchronise handbook/NAS; perform controlled end-to-end tests; record remaining operational conditions before wider launch.')

# Build a self-contained HTML copy and a PDF from the same ordered content.
def clean(t): return t.replace('\u2011','-').replace('\u2013','-').replace('\u2014',' - ')
def escape(t): return html.escape(clean(t))
html_body=[]
for kind,content in blocks:
 if kind.startswith('h'):
  level=int(kind[1:]); html_body.append(f'<h{min(level+1,3)}>{escape(content)}</h{min(level+1,3)}>')
 elif kind=='p': html_body.append('<p>'+escape(content)+'</p>')
 elif kind=='page': html_body.append('<div class="pagebreak"></div>')
 else:
  rows=[]
  for index,row in enumerate(content):
   tag='th' if index==0 else 'td'; rows.append('<tr>'+''.join(f'<{tag}>{escape(cell)}</{tag}>' for cell in row)+'</tr>')
  html_body.append('<table>'+''.join(rows)+'</table>')
html_doc='<!doctype html><html lang="en"><meta charset="utf-8"><title>DigiStayBook legal and privacy review pack</title><style>body{font:16px/1.55 Arial,sans-serif;color:#172334;max-width:1000px;margin:40px auto;padding:0 24px}h1{font-size:32px;color:#111}h2{font-size:24px;margin-top:36px}h3{font-size:18px;margin-top:24px}table{border-collapse:collapse;width:100%;margin:18px 0}th,td{padding:10px;border:1px solid #d9d9d9;text-align:left;vertical-align:middle}th{background:#e9eef4}tr:nth-child(even){background:#f8fafc}a{color:#23517a}@media print{body{font-size:11pt;margin:0;max-width:none}h2,h3{break-after:avoid}thead{display:table-header-group}tr{break-inside:avoid}.pagebreak{break-before:page}}</style><body>'+''.join(html_body)+'</body></html>'
(OUT/'DigiStayBook-review-pack.html').write_text(html_doc,encoding='utf-8')

pdfmetrics.registerFont(TTFont('PackArial','C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('PackArialBold','C:/Windows/Fonts/arialbd.ttf'))
pdfmetrics.registerFontFamily('PackArial',normal='PackArial',bold='PackArialBold',italic='PackArial',boldItalic='PackArialBold')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='PackBody',fontName='PackArial',fontSize=10.5,leading=14.5,spaceAfter=8))
styles.add(ParagraphStyle(name='PackTitle',fontName='PackArialBold',fontSize=25,leading=30,spaceAfter=16))
styles.add(ParagraphStyle(name='PackH1',fontName='PackArialBold',fontSize=16,leading=20,spaceBefore=16,spaceAfter=9,keepWithNext=True,textColor=colors.HexColor('#18314c')))
styles.add(ParagraphStyle(name='PackH2',fontName='PackArialBold',fontSize=12,leading=16,spaceBefore=10,spaceAfter=6,keepWithNext=True))
styles.add(ParagraphStyle(name='PackCell',fontName='PackArial',fontSize=9,leading=12,spaceAfter=0))
styles.add(ParagraphStyle(name='PackHeader',fontName='PackArialBold',fontSize=9,leading=12,spaceAfter=0))
story=[]
for kind,content in blocks:
 if kind=='page': story.append(PageBreak())
 elif kind.startswith('h'): story.append(Paragraph(escape(content),styles[['PackTitle','PackH1','PackH2'][int(kind[1:])]]))
 elif kind=='p':
  text=escape(content)
  text=re.sub(r'(https?://[^\s<]+)',r'<link href="\1" color="#23517a">\1</link>',text)
  story.append(Paragraph(text,styles['PackBody']))
 else:
  cells=[[Paragraph(escape(cell),styles['PackHeader' if i==0 else 'PackCell']) for cell in row] for i,row in enumerate(content)]
  count=len(content[0]); widths=[160,308] if count==2 else [128,214,126]
  t=Table(cells,colWidths=widths,repeatRows=1,hAlign='LEFT')
  t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e9eef4')),('GRID',(0,0),(-1,-1),0.45,colors.HexColor('#d9d9d9')),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#f8fafc')])]))
  before_table = Spacer(1,4)
  before_table.keepWithNext = True
  story.extend([before_table,t,Spacer(1,12)])
def footer(canvas,doc):
 canvas.setFont('PackArial',8); canvas.setFillColor(colors.HexColor('#526273'))
 canvas.drawString(54,30,'DigiStayBook review pack | Updated 5 October 2026 | Approval pending')
 canvas.drawRightString(558,30,str(doc.page))
pdf=OUT/'DigiStayBook-review-pack.pdf'
SimpleDocTemplate(str(pdf),pagesize=letter,leftMargin=54,rightMargin=90,topMargin=46,bottomMargin=50,title='DigiStayBook legal and privacy review pack',author='DigiStayBook').build(story,onFirstPage=footer,onLaterPages=footer)

response=['# DigiStayBook reviewer response','', 'Reviewer and firm:','Review date:','Scope:','Decision: approve / conditional approval / further work required','', '## Document approval','', '| Document | Exact approved version | Amendments or conditions |','|---|---|---|','| Host Terms | | |','| Guest Terms | | |','| Privacy Policy | | |','| Consent | | |','', '## Decision register responses','']
for r in decisions: response += ['### '+r[0]+' '+r[1],r[2],'Response:','Evidence required:','Owner and due date:','']
response += ['## Conditions before controlled intake','', '## Conditions before general launch','', '## Approval reference or signature','']
(OUT/'reviewer-response.md').write_text('\n'.join(response),encoding='utf-8')
(OUT/'reviewer-cover-note.md').write_text('''# Review request

Please review DigiStayBook-review-pack.pdf and return amendments plus a written
approval record for the final Host Terms, Guest Terms, Privacy Policy and consent
versions. The supporting source and evidence snapshots are enclosed.

The operator is also the privacy/safety request handler. Legal name, business
address, state and any ABN/ACN remain to be confirmed. Please identify the exact
operator details and account agreements you need before your review can conclude.

Please prioritise overseas photo screening, minors/third-party photos, publication
rights, retention/soft deletion, privacy request operations and the wording versus
release evidence and remaining image-policy decisions in R07 and R09. Please distinguish required wording
changes, operating decisions and evidence needed before controlled/public launch.

Guest submissions remain disabled. This request does not ask you to certify
unexecuted technical tests. Use reviewer-response.md or return marked-up copies,
with reviewed versions, date, scope and any conditions on approval.
''',encoding='utf-8')

paths=['src/ui/pages/legal/documents.ts','src/ui/pages/PrivacySafetyPage.tsx','functions/src/legal.ts','functions/src/guestPolicy.ts','functions/src/screening.ts','functions/src/visionScreening.ts','functions/src/screeningBudget.ts','functions/src/screeningRetry.ts','functions/src/guestContributions.ts','functions/src/reporting.ts','functions/src/storageDeletion.ts','functions/src/runtimeOptions.ts','functions/src/billingPolicy.ts','src/domain/retention.ts','firestore.rules','storage.rules','docs/guest-contribution-issues.md','docs/image-screening-provider-review-2026-10-02.md','docs/screening-daily-allowance-2026-10-02.md','docs/handoff-2026-10-01.md','docs/IMPLEMENTATION_SUMMARY.md','docs/PLAN_DEVIATIONS_AND_GAPS.md','docs/NAS_DOCUMENTS.md','docs/handbook/DIGISTAYBOOK_BUSINESS_AND_OPERATING_PLAN.html','docs/screening-validation/README.md','docs/screening-validation/text-fixtures.json']
paths += ['functions/src/screening.test.ts','functions/src/screening.integration.test.ts','functions/src/screeningDiagnostics.ts','tools/verify-guest-contribution.mjs']
for name in paths:
 target=OUT/'sources'/name; target.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(ROOT/name,target)
readme='''# DigiStayBook reviewer pack

Start with DigiStayBook-review-pack.pdf or the self-contained HTML copy.
Return annotations and/or reviewer-response.md. The source snapshots and live
metadata support review; they do not imply legal approval or production readiness.

The full Host Terms, Guest Terms, Privacy Policy and consent are reproduced in
the PDF/HTML. legal-text.json preserves their structured source text. sources/
contains the operating handbook and selected current code/records. No secrets,
environment files, private guest records or production credentials are included.

Missing account agreements, operator details, approved retention schedules,
representative image assets and live flow evidence are explicitly tracked in the
decision register. SHA256SUMS.txt identifies the attached snapshot files.
'''
(OUT/'START-HERE.md').write_text(readme,encoding='utf-8')
manifest=[]
for file in sorted(OUT.rglob('*')):
 if file.is_file() and file.name!='SHA256SUMS.txt': manifest.append(hashlib.sha256(file.read_bytes()).hexdigest()+'  '+file.relative_to(OUT).as_posix())
(OUT/'SHA256SUMS.txt').write_text('\n'.join(manifest)+'\n',encoding='utf-8')
archive=OUT.parent/'DigiStayBook-reviewer-pack-2026-10-02.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for file in sorted(OUT.rglob('*')):
  if file.is_file(): z.write(file,file.relative_to(OUT).as_posix())
print(json.dumps({'pdf':str(pdf),'zip':str(archive),'files':len(manifest)+1,'content_blocks':len(blocks)}))
