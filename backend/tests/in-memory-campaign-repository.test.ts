import { describe, expect, it } from "vitest";

import { createInMemoryRepositories } from "../src/repositories/in-memory-repositories.js";

describe("in-memory campaign repository", () => {
  it("only transitions dispatch state when the expected current status matches", async () => {
    const repositories = createInMemoryRepositories();

    await repositories.campaigns.assignContacts("camp-001", ["contact-001"]);

    const prematureTerminalUpdate = await repositories.campaigns.updateDialerContactDispatch({
      campaignId: "camp-001",
      contactId: "contact-001",
      dispatchStatus: "transferred",
      expectedCurrentStatus: "in_progress",
    });

    expect(prematureTerminalUpdate).toBe(false);
    expect((await repositories.campaigns.listDialerContacts("camp-001"))[0]?.dispatchStatus).toBe("pending");

    const reserved = await repositories.campaigns.updateDialerContactDispatch({
      campaignId: "camp-001",
      contactId: "contact-001",
      dispatchStatus: "in_progress",
    });
    const finalized = await repositories.campaigns.updateDialerContactDispatch({
      campaignId: "camp-001",
      contactId: "contact-001",
      dispatchStatus: "transferred",
      expectedCurrentStatus: "in_progress",
    });

    expect(reserved).toBe(true);
    expect(finalized).toBe(true);
    expect((await repositories.campaigns.listDialerContacts("camp-001"))[0]?.dispatchStatus).toBe("transferred");
  });
});
