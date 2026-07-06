import { mapSalaryToRangeId } from "@/lib/salary.utils";

describe("mapSalaryToRangeId", () => {
  it("returns undefined when no salary is given", () => {
    expect(mapSalaryToRangeId(null, null)).toBeUndefined();
    expect(mapSalaryToRangeId(undefined, undefined)).toBeUndefined();
    expect(mapSalaryToRangeId(0, 0)).toBeUndefined();
  });

  it("maps a low salary to the first range", () => {
    expect(mapSalaryToRangeId(5000, null)).toBe("1");
  });

  it("uses the midpoint of min and max", () => {
    // midpoint of 60k-80k is 70k -> "60,000 - 70,000"
    expect(mapSalaryToRangeId(60000, 80000)).toBe("7");
  });

  it("maps a single bound when only one is given", () => {
    expect(mapSalaryToRangeId(null, 95000)).toBe("10");
    expect(mapSalaryToRangeId(45000, null)).toBe("5");
  });

  it("maps amounts in the gap between defined buckets to the next bucket", () => {
    // 115k falls between "100,000 - 110,000" and "120,000 - 130,000"
    expect(mapSalaryToRangeId(115000, null)).toBe("12");
  });

  it("maps very high salaries to the open-ended top range", () => {
    expect(mapSalaryToRangeId(180000, 220000)).toBe("14");
    expect(mapSalaryToRangeId(145000, null)).toBe("14");
  });
});
