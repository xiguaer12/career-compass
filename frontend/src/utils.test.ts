import { describe, expect, it } from "vitest";
import { parseCsvRows, visibleFavoriteItems } from "./utils";

describe("parseCsvRows", () => {
  it("keeps quoted commas and escaped quotes inside cells", () => {
    expect(parseCsvRows('年份,说明\n2026,"就业,考研"\n2027,"他说 ""继续准备"""')).toEqual([
      ["年份", "说明"],
      ["2026", "就业,考研"],
      ["2027", '他说 "继续准备"']
    ]);
  });
});

describe("visibleFavoriteItems", () => {
  it("filters legacy report favorites from the personal center list", () => {
    const items = [
      { id: 1, itemType: "report", itemId: "10", title: "旧报告", createdAt: "2026-05-01T00:00:00Z" },
      { id: 2, itemType: "content", itemId: "20", title: "资讯", createdAt: "2026-05-01T00:00:00Z" }
    ];

    expect(visibleFavoriteItems(items)).toEqual([items[1]]);
  });
});
