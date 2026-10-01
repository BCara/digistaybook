# Business and operating documents and the NAS

The repository holds editable, reviewable copies of the business plan, test
procedures and developer checklist. The NAS holds the copies distributed to
the owner and tester. **Neither location is automatically current:** compare
the exact files and timestamps before editing or distributing, then sync the
reviewed version and verify hashes. Do not replace a newer NAS revision with
an older repository copy. Legal text still requires counsel approval; syncing
a draft does not approve it.

The NAS is only reachable on the home network (`192.168.1.71`). Cloud
sessions, CI and the external tester cannot open these links.

## Where they are

Folder: `projects/DigiStayBook/business-operations/`

| How | Address | Use |
| --- | --- | --- |
| Browse (viewer page) | http://192.168.1.71:5000/nas/projects/DigiStayBook/business-operations | Reading in a browser |
| Raw file | `http://192.168.1.71:5000/nas-raw/projects/DigiStayBook/business-operations/<FILE>` | Fetching or diffing the actual file |
| Windows share | `\\192.168.1.71\NAS\projects\DigiStayBook\business-operations\` | Editing |

The viewer page (`/nas/...`) wraps the document in an iframe. Fetch the
`/nas-raw/...` path when you need the file itself.

Documents on the NAS:

- `DIGISTAYBOOK_BUSINESS_AND_OPERATING_PLAN.html` — the authoritative handbook
- `DIGISTAYBOOK_TEST_PROCEDURES.html` — the document handed to the tester
- `DIGISTAYBOOK_DEVELOPER_AND_LAUNCH_CHECKLIST.html` — developer-only checks
- `digistaybook_WIP_v3.html`

## Access

**Reading** works without credentials over HTTP:

```bash
curl -s -o plan.html "http://192.168.1.71:5000/nas-raw/projects/DigiStayBook/business-operations/DIGISTAYBOOK_BUSINESS_AND_OPERATING_PLAN.html"
```

**Writing** needs the SMB share, which requires the owner's mapped login.
Do not enter or request the password. The owner maps it once, with saved credentials:

```bash
net use N: \\192.168.1.71\NAS /persistent:yes /savecred
```

After that, `N:\projects\DigiStayBook\business-operations\` is writable.
This machine may also expose the same location by UNC path. If the share
returns "Permission denied", ask the owner to map it; do not bypass the login.

## Checking whether a repo copy matches the NAS

```powershell
$share = '\\192.168.1.71\NAS\projects\DigiStayBook\business-operations'
$name = 'DIGISTAYBOOK_TEST_PROCEDURES.html'
Get-Item -LiteralPath "docs/handbook/$name", (Join-Path $share $name) |
  Select-Object FullName, Length, LastWriteTime
Get-FileHash -Algorithm SHA256 -LiteralPath "docs/handbook/$name", (Join-Path $share $name)
```
