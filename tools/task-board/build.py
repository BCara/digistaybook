from pathlib import Path
from html import unescape
import re, json, shutil

ROOT = Path(__file__).resolve().parents[2]
NAS = Path(r'\\192.168.1.71\nas\projects\DigiStayBook\business-operations')
plan = (NAS / 'DIGISTAYBOOK_BUSINESS_AND_OPERATING_PLAN.html').read_text(encoding='utf-8')
register = plan[plan.index('id="a-decisions"'):plan.index('id="a-reference"')]
def plain(s):
    return re.sub(r'\s+', ' ', unescape(re.sub('<[^>]*>', '', s))).strip()

action_titles = ['Build guest contribution endpoint', 'Build screening and safety routing', 'Build restricted operations controls', 'Enforce App Check', 'Complete retention and backup controls', 'Build marketing consent and suppression', 'Provide host guestbook exports', 'Resolve Functions dependency advisories', 'Complete host management routes', 'Prepare landing-page preview video', 'Fix logo colour tokens', 'Produce logo, icons and placard assets', 'Define status colours and labels', 'Check accessibility contrast', 'Prepare isolated preview environment', 'Configure cloud budget alerts', 'Write support templates and operational checklists', 'Update old requirement references', 'Configure support email forwarding']
decision_titles = ['Confirm business entity and ABN', 'Set paying-property and conversion targets', 'Confirm launch countries', 'Name platform and safety operators', 'Decide on host discovery interviews', 'Decide on competitive review', 'Confirm prices, Stripe objects and GST', 'Set upload fair-use boundary', 'Set refund authority', 'Approve photo upload limits', 'Approve age and minor-photo policy', 'Review selected screening provider arrangements', 'Calibrate screening thresholds', 'Select outbound email provider and domain authentication', 'Confirm Stripe retry policy', 'Set support hours, response target and queue cover', 'Confirm alerting and out-of-hours response', 'Set and measure availability target', 'Obtain final legal approval', 'Define backup and restore controls', 'Confirm registrar ownership and recovery', 'Set password rules', 'Decide host MFA offering', 'Set anonymous account cleanup policy', 'Approve tagline', 'Set logo sizing rules', 'Confirm display-font choice', 'Confirm demo image licences', 'Choose acquisition channel', 'Set launch date and budget', 'Name launch approver and stop authority', 'Set partner/referral terms', 'Validate cost per property', 'Confirm cloud SKU rates and cost assumptions']
tasks = []
for match in re.finditer(r'<tr><td>([CA]-\d+)</td>(.*?)</tr>', register, re.S):
    ref = match.group(1)
    cells = [plain(c) for c in re.findall(r'<td>(.*?)</td>', match.group(0), re.S)]
    number = int(ref[2:]); is_action = ref.startswith('A')
    legal = (not is_action and number in [1,3,9,11,12,19,28])
    controlled = (is_action and number in [1,2,3,4,8,15,16]) or (not is_action and number in [4,10,13,17,20,22,23,24])
    milestone = 'legal' if legal else 'controlled' if controlled else 'launch'
    status = 'Needs verification' if is_action and number <= 18 else 'To do'
    title = (action_titles if is_action else decision_titles)[number - 1]
    description = cells[2] + '\n\n' + ('Consequence: ' if is_action else 'Needed for: ') + cells[3]
    tasks.append(dict(id=ref, title=title, description=description, owner='', status=status,
                      milestone=milestone, lead=10 if legal or controlled else 5, dateMode='auto',
                      fixedDate='', notes='Imported register item; reconcile with current implementation/release evidence.' if status == 'Needs verification' else '',
                      kind='Implementation action' if is_action else 'Decision', source=ref, completedAt=None))
assert len(tasks) == 53, len(tasks)
state = dict(schema=1, updatedAt='2026-10-05T00:00:00Z', milestones=[dict(id='legal', name='Legal review', date=''), dict(id='controlled', name='Controlled guest test', date=''), dict(id='launch', name='Public launch', date='')], tasks=tasks)
template = (Path(__file__).parent / 'board.html').read_text(encoding='utf-8')
output = template.replace('__SEED__', json.dumps(state, ensure_ascii=False).replace('<', '\\u003c'))
board = NAS / 'DigiStayBook-task-board.html'
board.write_text(output, encoding='utf-8')
data = NAS / 'DigiStayBook-tasks.json'
if not data.exists():
    data.write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(Path(__file__).parent / 'seed.json').write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Created board with {len(tasks)} tasks: {board}')
print(f'Shared data: {data}; existing shared data is never overwritten by this builder.')
