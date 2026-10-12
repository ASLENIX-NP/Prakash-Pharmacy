import { Request, Response } from "express";
import { prisma } from "../db.js";
import { formatGenericCode, parseIdParam } from "../utils/id.helpers.js";

// ==========================================
// 1. GET ALL GENERICS (Supports ?search=)
// ==========================================
export const getAllGenerics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search } = req.query;

    const whereClause: { name?: { contains: string; mode: "insensitive" } } = {};
    if (search && typeof search === "string" && search.trim()) {
      whereClause.name = {
        contains: search.trim(),
        mode: "insensitive",
      };
    }

    const generics = await prisma.generic.findMany({
      where: whereClause,
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { inventories: true },
        },
      },
      take: 100,
    });

    const formatted = generics.map((g) => {
      const genericCode = formatGenericCode(g.id);
      return {
        id: genericCode, // e.g. "GEN-001"
        genericCode,
        name: g.name,
        itemCount: g._count.inventories,
      };
    });

    res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted,
    });
  } catch (error) {
    console.error("Error fetching generics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve generic compositions",
    });
  }
};

// ==========================================
// 2. CREATE GENERIC
// ==========================================
export const createGeneric = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({
        success: false,
        message: "Generic name is required (e.g. 'Paracetamol 500mg', 'Amoxicillin + Clavulanic Acid')",
      });
      return;
    }

    const trimmedName = name.trim();

    const existing = await prisma.generic.findUnique({
      where: { name: trimmedName },
    });

    if (existing) {
      res.status(409).json({
        success: false,
        message: `Generic composition '${trimmedName}' already exists`,
      });
      return;
    }

    const newGeneric = await prisma.generic.create({
      data: { name: trimmedName },
    });

    const genericCode = formatGenericCode(newGeneric.id);

    res.status(201).json({
      success: true,
      message: `Generic '${newGeneric.name}' created successfully`,
      data: {
        id: genericCode,
        genericCode,
        name: newGeneric.name,
        itemCount: 0,
      },
    });
  } catch (error) {
    console.error("Error creating generic:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create generic",
    });
  }
};

// ==========================================
// 3. UPDATE GENERIC (Admin only)
// ==========================================
export const updateGeneric = async (req: Request, res: Response): Promise<void> => {
  try {
    const genericId = parseIdParam(req.params.id);
    if (!genericId) {
      res.status(400).json({
        success: false,
        message: "Invalid generic ID or code. Format should be 'GEN-001' or a valid number.",
      });
      return;
    }

    const { name } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({
        success: false,
        message: "Generic name is required",
      });
      return;
    }

    const trimmedName = name.trim();

    const existing = await prisma.generic.findUnique({
      where: { id: genericId },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: `Generic with ID '${req.params.id}' not found`,
      });
      return;
    }

    const duplicate = await prisma.generic.findFirst({
      where: {
        name: trimmedName,
        NOT: { id: genericId },
      },
    });

    if (duplicate) {
      res.status(409).json({
        success: false,
        message: `Generic composition '${trimmedName}' already exists`,
      });
      return;
    }

    const updated = await prisma.generic.update({
      where: { id: genericId },
      data: { name: trimmedName },
      include: {
        _count: { select: { inventories: true } },
      },
    });

    const genericCode = formatGenericCode(updated.id);

    res.status(200).json({
      success: true,
      message: `Generic '${updated.name}' updated successfully`,
      data: {
        id: genericCode,
        genericCode,
        name: updated.name,
        itemCount: updated._count.inventories,
      },
    });
  } catch (error) {
    console.error("Error updating generic:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update generic",
    });
  }
};

// ==========================================
// 4. DELETE GENERIC (Admin only)
// ==========================================
export const deleteGeneric = async (req: Request, res: Response): Promise<void> => {
  try {
    const genericId = parseIdParam(req.params.id);
    if (!genericId) {
      res.status(400).json({
        success: false,
        message: "Invalid generic ID or code. Format should be 'GEN-001' or a valid number.",
      });
      return;
    }

    const existing = await prisma.generic.findUnique({
      where: { id: genericId },
      include: {
        _count: { select: { inventories: true } },
      },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: `Generic with ID '${req.params.id}' not found`,
      });
      return;
    }

    if (existing._count.inventories > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete generic '${existing.name}' because ${existing._count.inventories} medicine(s) use this composition. Reassign or delete those medicines first.`,
      });
      return;
    }

    await prisma.generic.delete({
      where: { id: genericId },
    });

    res.status(200).json({
      success: true,
      message: `Generic '${existing.name}' (${formatGenericCode(existing.id)}) deleted successfully`,
    });
  } catch (error) {
    console.error("Error deleting generic:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete generic",
    });
  }
};
