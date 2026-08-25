import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import type { CategoryRepository } from "../interfaces";

export const postgresCategoryRepository: CategoryRepository = {
  async list(ownerId) {
    const rows = await prisma.category.findMany({
      where: { ownerId },
      include: { _count: { select: { projects: true } } },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      isActive: row.isActive,
      projectCount: row._count.projects,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  },

  async create(ownerId, name) {
    const row = await prisma.category.create({
      data: { ownerId, name },
      include: { _count: { select: { projects: true } } },
    });
    return {
      id: row.id,
      name: row.name,
      isActive: row.isActive,
      projectCount: row._count.projects,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  },

  async update(ownerId, id, patch) {
    const exists = await prisma.category.findFirst({ where: { id, ownerId } });
    if (!exists) return null;
    const row = await prisma.category.update({
      where: { id },
      data: patch,
      include: { _count: { select: { projects: true } } },
    });
    return {
      id: row.id,
      name: row.name,
      isActive: row.isActive,
      projectCount: row._count.projects,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  },

  async delete(ownerId, id) {
    const row = await prisma.category.findFirst({
      where: { id, ownerId },
      include: { _count: { select: { projects: true } } },
    });
    if (!row) return "missing";
    if (row._count.projects > 0) return "in-use";
    try {
      await prisma.category.delete({ where: { id } });
      return "deleted";
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return "in-use";
      }
      throw error;
    }
  },
};
