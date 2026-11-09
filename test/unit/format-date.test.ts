import { describe, expect, it } from "vitest";
import { formatDate, ValidationError } from "../../src/index.js";

const CREATED = "2011-01-07T03:41:16Z";

describe("formatDate", () => {
  it.each([
    ["dd/MM/yyyy", "07/01/2011"],
    ["yyyy-MM-dd", "2011-01-07"],
    ["dd/MM/yyyy - hh:mm", "07/01/2011 - 03:41 AM"],
    ["dd/MM/yyyy - HH:mm", "07/01/2011 - 03:41"],
    ["hh:mm:ss", "03:41:16 AM"],
    ["hh:mm a", "03:41 AM"],
    ["a hh:mm", "AM 03:41"],
    ["dd/MM 'at' hh:mm", "07/01 at 03:41 AM"],
    ["'hh'", "hh"],
    ["dd.MM.yyyy", "07.01.2011"],
  ])("%s → %s", (pattern, expected) => {
    expect(formatDate(CREATED, pattern)).toBe(expected);
  });

  it.each([
    ["2026-11-08T00:05:00Z", "12:05 AM"],
    ["2026-11-08T11:59:00Z", "11:59 AM"],
    ["2026-11-08T12:00:00Z", "12:00 PM"],
    ["2026-11-08T13:05:00Z", "01:05 PM"],
    ["2026-11-08T23:59:00Z", "11:59 PM"],
  ])("%s in 12 hours is %s", (date, expected) => {
    expect(formatDate(date, "hh:mm")).toBe(expected);
  });

  it.each([
    ["2026-11-08T00:05:00Z", "00:05"],
    ["2026-11-08T13:05:00Z", "13:05"],
  ])("%s in 24 hours is %s, without AM/PM", (date, expected) => {
    expect(formatDate(date, "HH:mm")).toBe(expected);
  });

  it("uses UTC by default and the time zone when asked", () => {
    expect(formatDate(CREATED, "HH:mm")).toBe("03:41");
    expect(formatDate(CREATED, "HH:mm", { timeZone: "Asia/Tokyo" })).toBe("12:41");
  });

  it("the time zone can change the day", () => {
    expect(
      formatDate("2026-01-01T01:00:00Z", "dd/MM/yyyy hh:mm", { timeZone: "America/Sao_Paulo" }),
    ).toBe("31/12/2025 10:00 PM");
  });

  it("follows daylight saving", () => {
    const timeZone = "America/New_York";
    expect(formatDate("2026-07-01T12:00:00Z", "HH:mm", { timeZone })).toBe("08:00");
    expect(formatDate("2026-01-01T12:00:00Z", "HH:mm", { timeZone })).toBe("07:00");
  });

  it("reads offsets and Date objects", () => {
    expect(formatDate("2026-11-09T06:00:00-03:00", "HH:mm")).toBe("09:00");
    expect(formatDate(new Date(Date.UTC(2026, 10, 9, 9)), "dd/MM HH:mm")).toBe("09/11 09:00");
  });

  it("a date without a time never changes day", () => {
    expect(formatDate("2018-01-16", "dd/MM/yyyy")).toBe("16/01/2018");
    expect(formatDate("2018-01-16", "dd/MM/yyyy", { timeZone: "Pacific/Pago_Pago" })).toBe(
      "16/01/2018",
    );
  });

  it.each(["hh:mm", "HH", "mm", "ss", "dd a"])("a date without a time refuses %s", (pattern) => {
    expect(() => formatDate("2018-01-16", pattern)).toThrow(ValidationError);
  });

  it.each([
    "",
    "not a date",
    "2026-13-01",
    "2026-02-30",
    "2026-02-30T00:00:00Z",
    "2026-11-08T25:00:00Z",
    "2026-11-08 10:00:00",
    "2026-11-08T10:00:00",
    undefined,
    null,
    1731000000,
    new Date(Number.NaN),
  ])("refuses the date %j", (date) => {
    expect(() => formatDate(date as string, "dd/MM/yyyy")).toThrow(ValidationError);
  });

  it.each(["", "DD/MM/YYYY", "dd/MM/yy", "at dd", "dd'", undefined, 7])(
    "refuses the pattern %j",
    (pattern) => {
      expect(() => formatDate(CREATED, pattern as string)).toThrow(ValidationError);
    },
  );

  it.each(["Mars/Olympus", "", 7])("refuses the time zone %j", (timeZone) => {
    expect(() => formatDate(CREATED, "dd/MM/yyyy", { timeZone: timeZone as string })).toThrow(
      ValidationError,
    );
  });
});
