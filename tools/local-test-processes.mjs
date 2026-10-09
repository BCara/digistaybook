import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {setTimeout as delay} from 'node:timers/promises';

const execute = promisify(execFile);
const inventoryScript = `
$all = @(Get-CimInstance Win32_Process)
$rootId = [int]$env:LOCAL_TEST_ROOT_PID
$root = $all | Where-Object { $_.ProcessId -eq $rootId }
$members = @()
if ($root) {
  $pending = @($root)
  while ($pending.Count -gt 0) {
    $members += $pending
    $parentIds = @($pending | ForEach-Object { $_.ProcessId })
    $pending = @($all | Where-Object { $_.ParentProcessId -in $parentIds -and $_.ProcessId -notin @($members.ProcessId) })
  }
}
$result = @($members | ForEach-Object { @{ pid = [int]$_.ProcessId; created = $_.CreationDate.ToUniversalTime().ToString('o') } })
ConvertTo-Json -InputObject $result -Compress
`;

// Cache child identities while the launcher is alive so an unexpected parent
// exit still permits cleanup, without killing a later process that reuses a PID.
export async function rememberProcessTree(child) {
  if (process.platform !== 'win32' || !child.pid || child.exitCode !== null || child.signalCode !== null) return [];
  const {stdout} = await execute('powershell.exe', ['-NoProfile','-NonInteractive','-Command',inventoryScript], {
    windowsHide:true, timeout:15000, env:{...process.env,LOCAL_TEST_ROOT_PID:String(child.pid)}
  });
  return JSON.parse(stdout.trim() || '[]');
}

export async function stopProcessTree(child, remembered = []) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    let current = await rememberProcessTree(child);
    const originalRoot=remembered.find(member=>member.pid===child.pid);
    const currentRoot=current.find(member=>member.pid===child.pid);
    if(originalRoot && currentRoot && originalRoot.created!==currentRoot.created) current=[];
    const identities = [...remembered,...current];
    if (!identities.length) return;
    const script = `
$identities = ConvertFrom-Json $env:LOCAL_TEST_PROCESS_IDENTITIES
foreach ($identity in $identities | Sort-Object -Property pid -Unique) {
  $target = Get-CimInstance Win32_Process -Filter ("ProcessId = " + [int]$identity.pid)
  if ($target -and $target.CreationDate.ToUniversalTime().ToString('o') -eq $identity.created) {
    Stop-Process -Id $target.ProcessId -Force -ErrorAction SilentlyContinue
  }
}
`;
    await execute('powershell.exe', ['-NoProfile','-NonInteractive','-Command',script], {
      windowsHide:true, timeout:15000, env:{...process.env,LOCAL_TEST_PROCESS_IDENTITIES:JSON.stringify(identities)}
    });
    return;
  }
  // Long-running children are spawned in their own group on Unix.
  try { process.kill(-child.pid,'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  await delay(500);
  try { process.kill(-child.pid,'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
}
