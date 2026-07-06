import {
  resolveJobTitle,
  resolveLocation,
  resolveCompany,
} from "@/lib/entity-resolution";
import { PrismaClient } from "@prisma/client";

// Mock the Prisma Client
vi.mock("@prisma/client", () => {
  const mPrismaClient = {
    jobTitle: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    location: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    company: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  };
  return {
    PrismaClient: vi.fn(function () {
      return mPrismaClient;
    }),
  };
});

const prisma = new PrismaClient();
const userId = "user-1";

describe("entity-resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("resolveJobTitle", () => {
    it("auto-selects a close fuzzy match instead of creating", async () => {
      const existing = { id: "t1", label: "Software Engineer", value: "software-engineer" };
      (prisma.jobTitle.findMany as any).mockResolvedValueOnce([existing]);

      const result = await resolveJobTitle("softwar engineer", userId);

      expect(result).toEqual(existing);
      expect(prisma.jobTitle.create).not.toHaveBeenCalled();
    });

    it("creates a new title when nothing matches closely enough", async () => {
      const existing = { id: "t1", label: "Data Analyst", value: "data-analyst" };
      const created = { id: "t2", label: "Backend Engineer", value: "backend-engineer" };
      (prisma.jobTitle.findMany as any).mockResolvedValueOnce([existing]);
      (prisma.jobTitle.create as any).mockResolvedValueOnce(created);

      const result = await resolveJobTitle("Backend Engineer", userId);

      expect(result).toEqual(created);
      expect(prisma.jobTitle.create).toHaveBeenCalledWith({
        data: {
          label: "Backend Engineer",
          value: "backend-engineer",
          createdBy: userId,
        },
      });
    });
  });

  describe("resolveLocation", () => {
    it("returns null for an empty location", async () => {
      const result = await resolveLocation("", userId);
      expect(result).toBeNull();
      expect(prisma.location.findMany).not.toHaveBeenCalled();
    });

    it("matches an existing location despite diacritics/casing differences", async () => {
      const existing = { id: "l1", label: "Köln, Germany", value: "koln-germany" };
      (prisma.location.findMany as any).mockResolvedValueOnce([existing]);

      const result = await resolveLocation("koeln, germany", userId);

      expect(result).toEqual(existing);
      expect(prisma.location.create).not.toHaveBeenCalled();
    });

    it("creates a new location when nothing matches", async () => {
      const created = { id: "l2", label: "Hamburg", value: "hamburg" };
      (prisma.location.findMany as any).mockResolvedValueOnce([]);
      (prisma.location.create as any).mockResolvedValueOnce(created);

      const result = await resolveLocation("Hamburg", userId);

      expect(result).toEqual(created);
    });
  });

  describe("resolveCompany", () => {
    it("auto-selects an existing company on a near-exact match", async () => {
      const existing = { id: "c1", label: "Klöckner i", value: "klockner-i" };
      (prisma.company.findMany as any).mockResolvedValueOnce([existing]);

      const result = await resolveCompany("kloeckner.i", userId);

      expect(result).toEqual(existing);
      expect(prisma.company.create).not.toHaveBeenCalled();
    });

    it("creates a new company when nothing matches", async () => {
      (prisma.company.findMany as any).mockResolvedValueOnce([]);
      const created = { id: "c2", label: "Initech", value: "initech" };
      (prisma.company.create as any).mockResolvedValueOnce(created);

      const result = await resolveCompany("Initech", userId);

      expect(result).toEqual(created);
      expect(prisma.company.create).toHaveBeenCalledWith({
        data: {
          label: "Initech",
          value: "initech",
          createdBy: userId,
        },
      });
    });
  });
});
