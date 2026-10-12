import { Request, Response } from "express";
import { prisma } from "../db.js";
import {
  formatRackCode,
  formatMedicineCode,
  parseIdParam,
} from "../utils/id.helpers.js";

// ==========================================
// 1. GET ALL RACKS (with medicine count)
// ==========================================
export const getAllRacks = async (_req: Request, res: Response): Promise<void> => {
  try {
    const racks = await prisma.rack.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { inventories: true },
        },
      },
    });

    const formatted = racks.map((rack) => {
      const rackCode = formatRackCode(rack.id);
      return {
        id: rackCode, // e.g. "RCK-001"
        rackCode,
        name: rack.name,
        description: rack.description ?? "",
        itemCount: rack._count.inventories,
      };
    });

    res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted,
    });
  } catch (error) {
    console.error("Error fetching racks:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve racks from database",
    });
  }
};

// ==========================================
// 2. GET RACK BY ID (with medicines)
// ==========================================
export const getRackById = async (req: Request, res: Response): Promise<void> => {
  try {
    const rackId = parseIdParam(req.params.id);
    if (!rackId) {
      res.status(400).json({
        success: false,
        message: "Invalid rack ID or code. Format should be 'RCK-001' or a valid number.",
      });
      return;
    }

    const rack = await prisma.rack.findUnique({
      where: { id: rackId },
      include: {
        inventories: {
          include: {
            generic: true,
            category: true,
          },
          orderBy: { medicineBrand: "asc" },
        },
      },
    });

    if (!rack) {
      res.status(404).json({
        success: false,
        message: `Rack with ID '${req.params.id}' not found`,
      });
      return;
    }

    const rackCode = formatRackCode(rack.id);

    res.status(200).json({
      success: true,
      data: {
        id: rackCode,
        rackCode,
        name: rack.name,
        description: rack.description ?? "",
        itemCount: rack.inventories.length,
        medicines: rack.inventories.map((inv) => {
          const medCode = formatMedicineCode(inv.id);
          return {
            id: medCode,
            medicineCode: medCode,
            brandName: inv.medicineBrand,
            genericName: inv.generic.name,
            categoryName: inv.category.name,
            batchNumber: inv.batchNumber,
            expiryDate: inv.expiryDate,
            packInStock: inv.packInStock,
            unitInStock: inv.unitInStock,
            sellingPrice: Number(inv.sellingPrice),
          };
        }),
      },
    });
  } catch (error) {
    console.error("Error fetching rack by ID:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve rack details",
    });
  }
};

// ==========================================
// 3. CREATE RACK (Admin only)
// ==========================================
export const createRack = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({
        success: false,
        message: "Rack name is required (e.g. 'Rack A-1', 'Cold Storage')",
      });
      return;
    }

    const trimmedName = name.trim();

    // Check unique name
    const existing = await prisma.rack.findUnique({
      where: { name: trimmedName },
    });

    if (existing) {
      res.status(409).json({
        success: false,
        message: `Rack with name '${trimmedName}' already exists`,
      });
      return;
    }

    const newRack = await prisma.rack.create({
      data: {
        name: trimmedName,
        description: description ? String(description).trim() : null,
      },
    });

    const rackCode = formatRackCode(newRack.id);

    res.status(201).json({
      success: true,
      message: `Rack '${newRack.name}' created successfully`,
      data: {
        id: rackCode,
        rackCode,
        name: newRack.name,
        description: newRack.description ?? "",
        itemCount: 0,
      },
    });
  } catch (error) {
    console.error("Error creating rack:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create rack",
    });
  }
};

// ==========================================
// 4. UPDATE RACK (Admin only)
// ==========================================
export const updateRack = async (req: Request, res: Response): Promise<void> => {
  try {
    const rackId = parseIdParam(req.params.id);
    if (!rackId) {
      res.status(400).json({
        success: false,
        message: "Invalid rack ID or code. Format should be 'RCK-001' or a valid number.",
      });
      return;
    }

    const { name, description } = req.body;

    const existing = await prisma.rack.findUnique({
      where: { id: rackId },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: `Rack with ID '${req.params.id}' not found`,
      });
      return;
    }

    const updateData: { name?: string; description?: string | null } = {};

    if (name !== undefined) {
      const trimmedName = String(name).trim();
      if (!trimmedName) {
        res.status(400).json({
          success: false,
          message: "Rack name cannot be empty",
        });
        return;
      }

      // Check if another rack already uses this name
      const duplicate = await prisma.rack.findFirst({
        where: {
          name: trimmedName,
          NOT: { id: rackId },
        },
      });

      if (duplicate) {
        res.status(409).json({
          success: false,
          message: `Another rack with name '${trimmedName}' already exists`,
        });
        return;
      }

      updateData.name = trimmedName;
    }

    if (description !== undefined) {
      updateData.description = description ? String(description).trim() : null;
    }

    const updated = await prisma.rack.update({
      where: { id: rackId },
      data: updateData,
      include: {
        _count: {
          select: { inventories: true },
        },
      },
    });

    const rackCode = formatRackCode(updated.id);

    res.status(200).json({
      success: true,
      message: `Rack '${updated.name}' updated successfully`,
      data: {
        id: rackCode,
        rackCode,
        name: updated.name,
        description: updated.description ?? "",
        itemCount: updated._count.inventories,
      },
    });
  } catch (error) {
    console.error("Error updating rack:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update rack",
    });
  }
};

// ==========================================
// 5. DELETE RACK (Admin only)
// ==========================================
export const deleteRack = async (req: Request, res: Response): Promise<void> => {
  try {
    const rackId = parseIdParam(req.params.id);
    if (!rackId) {
      res.status(400).json({
        success: false,
        message: "Invalid rack ID or code. Format should be 'RCK-001' or a valid number.",
      });
      return;
    }

    const existing = await prisma.rack.findUnique({
      where: { id: rackId },
      include: {
        _count: { select: { inventories: true } },
      },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: `Rack with ID '${req.params.id}' not found`,
      });
      return;
    }

    await prisma.rack.delete({
      where: { id: rackId },
    });

    res.status(200).json({
      success: true,
      message: `Rack '${existing.name}' (${formatRackCode(existing.id)}) deleted successfully. Any associated medicines have had their rack set to unassigned.`,
    });
  } catch (error) {
    console.error("Error deleting rack:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete rack",
    });
  }
};
