// Verify the current merged plan, including media and preserved browser history.
// Start marketing/campaigns/merged-2026-10-28/preview.mjs with the NAS marketing root first.
process.argv[2] ||= '//192.168.1.71/nas/projects/DigiStayBook/marketing';
process.argv[3] ||= 'http://127.0.0.1:15184/MARKETING_PLAN.html';
await import('../marketing/campaigns/merged-2026-10-28/verify_plan.mjs');
