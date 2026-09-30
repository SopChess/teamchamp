import { describe, it, expect } from "vitest";
import { createFakeDb } from "@/test/fakeDb";
import { findOrCreateCaptainAccount } from "./account";

function db() {
  return createFakeDb({
    seed: { captain_accounts: [] },
    relations: {},
    uniques: { captain_accounts: [["email_key", "phone_key"]] },
  }).client;
}

describe("findOrCreateCaptainAccount", () => {
  it("δημιουργεί νέο λογαριασμό την πρώτη φορά", async () => {
    const acc = await findOrCreateCaptainAccount(db(), "Isaak@Example.gr", "6971234567");
    expect(acc.id).toBeTruthy();
    expect(acc.access_token).toBeTruthy();
  });

  it("ΙΔΙΟ email+τηλέφωνο → ΙΔΙΟΣ λογαριασμός (ίδιο token)", async () => {
    const d = db();
    const first = await findOrCreateCaptainAccount(d, "isaak@example.gr", "6971234567");
    const second = await findOrCreateCaptainAccount(d, "ISAAK@EXAMPLE.GR", "+30 697 123 4567");
    expect(second.id).toBe(first.id);
    expect(second.access_token).toBe(first.access_token);
  });

  it("ίδιο email αλλά ΔΙΑΦΟΡΕΤΙΚΟ τηλέφωνο → άλλος λογαριασμός", async () => {
    const d = db();
    const first = await findOrCreateCaptainAccount(d, "isaak@example.gr", "6971234567");
    const second = await findOrCreateCaptainAccount(d, "isaak@example.gr", "6979999999");
    expect(second.id).not.toBe(first.id);
  });

  it("ίδιο τηλέφωνο αλλά ΔΙΑΦΟΡΕΤΙΚΟ email → άλλος λογαριασμός", async () => {
    const d = db();
    const first = await findOrCreateCaptainAccount(d, "a@example.gr", "6971234567");
    const second = await findOrCreateCaptainAccount(d, "b@example.gr", "6971234567");
    expect(second.id).not.toBe(first.id);
  });
});
