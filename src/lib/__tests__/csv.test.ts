// @vitest-environment node
import { describe, expect, it } from "vitest";
import { csvCell, csvLine } from "@/lib/csv";

describe("csvCell", () => {
  it("quotes every cell and doubles inner quotes", () => {
    expect(csvCell("Boucherie Tarik")).toBe('"Boucherie Tarik"');
    expect(csvCell('Le "bon" boucher')).toBe('"Le ""bon"" boucher"');
    expect(csvCell("a;b")).toBe('"a;b"');
  });

  it("writes an empty cell for null and undefined", () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });

  it.each([
    ['=HYPERLINK("http://x","clic")', '"\'=HYPERLINK(""http://x"",""clic"")"'],
    ["+33 6 11 22 33 44", "\"'+33 6 11 22 33 44\""],
    ["-2+3", "\"'-2+3\""],
    ["@SUM(A1:A2)", "\"'@SUM(A1:A2)\""],
    ["\t=1+1", "\"'\t=1+1\""],
    ["\r=1+1", "\"'\r=1+1\""],
  ])("keeps %j as text with a leading apostrophe", (value, expected) => {
    expect(csvCell(value)).toBe(expected);
  });

  it.each(["-5,00", "+12.5", "42", 3.5, -7])("leaves the plain number %j as it is", (value) => {
    expect(csvCell(value)).toBe(`"${value}"`);
  });

  it("does not touch a formula sign that is not the first character", () => {
    expect(csvCell("Martin =1+1")).toBe('"Martin =1+1"');
  });
});

describe("csvLine", () => {
  it("joins the cells with a semicolon by default", () => {
    expect(csvLine(["KG26-000001", "=1+1", null, 12])).toBe('"KG26-000001";"\'=1+1";"";"12"');
  });

  it("accepts another separator", () => {
    expect(csvLine(["a", "b"], ",")).toBe('"a","b"');
  });
});
