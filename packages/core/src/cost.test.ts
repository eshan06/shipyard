import { describe, expect, it } from "vitest";
import {
  DEFAULT_COST_RATES,
  computeCostBreakdown,
  estimateUsd,
  loadCostRates,
  roundUsd,
  type UsageSample,
} from "./cost.js";

describe("cost", () => {
  describe("roundUsd", () => {
    it("rounds to 4 decimal places", () => {
      expect(roundUsd(0.123456)).toBe(0.1235);
      expect(roundUsd(0.12344)).toBe(0.1234);
    });

    it("handles half-way values away from zero", () => {
      expect(roundUsd(1.00005)).toBe(1.0001);
    });

    it("throws on non-finite values", () => {
      expect(() => roundUsd(Number.NaN)).toThrow();
      expect(() => roundUsd(Number.POSITIVE_INFINITY)).toThrow();
    });
  });

  describe("estimateUsd", () => {
    it("computes the documented example with default rates", () => {
      // 3600 cpuSeconds = 1 CPU-hour @ 0.04 = 0.04
      // 2 GB-hr mem @ 0.005 = 0.01
      // 10 GB-hr storage @ 0.0002 = 0.002
      // 1 GB egress @ 0.09 = 0.09
      const sample: UsageSample = {
        cpuSeconds: 3600,
        memoryGbHours: 2,
        storageGbHours: 10,
        egressGb: 1,
      };
      expect(estimateUsd(sample)).toBe(0.142);
    });

    it("returns 0 for empty usage", () => {
      expect(
        estimateUsd({ cpuSeconds: 0, memoryGbHours: 0, storageGbHours: 0, egressGb: 0 }),
      ).toBe(0);
      expect(estimateUsd([])).toBe(0);
    });

    it("sums an array of samples and rounds only the total", () => {
      const samples: UsageSample[] = Array.from({ length: 3 }, () => ({
        cpuSeconds: 1200, // 1/3 CPU-hour each -> 1 CPU-hour total
        memoryGbHours: 0,
        storageGbHours: 0,
        egressGb: 0,
      }));
      // 1 CPU-hour @ 0.04
      expect(estimateUsd(samples)).toBe(0.04);
    });

    it("respects a custom rate config", () => {
      const sample: UsageSample = {
        cpuSeconds: 3600,
        memoryGbHours: 0,
        storageGbHours: 0,
        egressGb: 0,
      };
      expect(estimateUsd(sample, { ...DEFAULT_COST_RATES, perVcpuHour: 1 })).toBe(1);
    });
  });

  describe("computeCostBreakdown", () => {
    it("attributes cost per resource", () => {
      const breakdown = computeCostBreakdown({
        cpuSeconds: 3600,
        memoryGbHours: 2,
        storageGbHours: 10,
        egressGb: 1,
      });
      expect(breakdown.cpuUsd).toBeCloseTo(0.04, 10);
      expect(breakdown.memoryUsd).toBeCloseTo(0.01, 10);
      expect(breakdown.storageUsd).toBeCloseTo(0.002, 10);
      expect(breakdown.egressUsd).toBeCloseTo(0.09, 10);
      expect(breakdown.totalUsd).toBe(0.142);
    });
  });

  describe("loadCostRates", () => {
    it("reads rates from env", () => {
      const rates = loadCostRates({
        COST_PER_VCPU_HOUR: "0.10",
        COST_PER_GB_MEM_HOUR: "0.02",
        COST_PER_GB_STORAGE_HOUR: "0.001",
        COST_PER_GB_EGRESS: "0.12",
      } as NodeJS.ProcessEnv);
      expect(rates).toEqual({
        perVcpuHour: 0.1,
        perGbMemoryHour: 0.02,
        perGbStorageHour: 0.001,
        perGbEgress: 0.12,
      });
    });

    it("falls back to documented defaults for missing/invalid values", () => {
      const rates = loadCostRates({
        COST_PER_VCPU_HOUR: "",
        COST_PER_GB_MEM_HOUR: "not-a-number",
        COST_PER_GB_STORAGE_HOUR: "-5",
      } as NodeJS.ProcessEnv);
      expect(rates).toEqual(DEFAULT_COST_RATES);
    });

    it("default rates match .env.example", () => {
      expect(DEFAULT_COST_RATES).toEqual({
        perVcpuHour: 0.04,
        perGbMemoryHour: 0.005,
        perGbStorageHour: 0.0002,
        perGbEgress: 0.09,
      });
    });
  });
});
