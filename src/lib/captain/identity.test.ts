import { describe, it, expect } from "vitest";
import { emailKey, isValidPhone, phoneKey } from "./identity";

describe("emailKey", () => {
  it("πεζά και χωρίς κενά στην αρχή/τέλος", () => {
    expect(emailKey("  Isaak@Example.GR ")).toBe("isaak@example.gr");
  });
});

describe("phoneKey", () => {
  it("ίδιο κινητό με διαφορετικά προθέματα δίνει το ίδιο κλειδί", () => {
    const k = phoneKey("6971234567");
    expect(phoneKey("+30 697 123 4567")).toBe(k);
    expect(phoneKey("0030 6971234567")).toBe(k);
    expect(phoneKey("0030-697-1234567")).toBe(k);
  });
  it("κρατά μόνο ψηφία", () => {
    expect(phoneKey("(697) 123-4567")).toBe(phoneKey("6971234567"));
  });
  it("λιγότερα από 10 ψηφία μένουν ως έχουν (δεν σπάει)", () => {
    expect(phoneKey("12345")).toBe("12345");
    expect(phoneKey("")).toBe("");
  });
});

describe("isValidPhone", () => {
  it("έγκυρο ελληνικό κινητό, με ή χωρίς πρόθεμα", () => {
    expect(isValidPhone("6971234567")).toBe(true);
    expect(isValidPhone("+306971234567")).toBe(true);
  });
  it("πολύ κοντό δεν είναι έγκυρο", () => {
    expect(isValidPhone("12345")).toBe(false);
    expect(isValidPhone("")).toBe(false);
  });
});
