import { retentionPolicy } from "./retention";

describe("retention policy", () => {
  it("keeps the approved operational defaults explicit", () => {
    expect(retentionPolicy).toMatchObject({ unpaidDraftDays: 30, dormantPropertyMonths: 12, privacyRequestEscalationDays: 14, backupExpiryDaysAfterPrimaryDeletion: 30 });
  });
});
