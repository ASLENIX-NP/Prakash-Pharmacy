import { Request, Response } from "express";
import { prisma } from "../db.js";
import { formatCategoryCode, parseIdParam } from "../utils/id.helpers.js";

// ==========================================
// 1. GET ALL CATEGORIES
// ==========================================
export const getAllCategories = async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { inventories: true },
        },
      },
    });

    const formatted = categories.map((cat) => {
      const categoryCode = formatCategoryCode(cat.id);
      return {
        id: categoryCode, // e.g. "CAT-001"
        categoryCode,
        name: cat.name,
        itemCount: cat._count.inventories,
      };
    });

    res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve medicine categories",
    });
  }
};

// ==========================================
// 2. CREATE CATEGORY (Admin only)
// ==========================================
export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({
        success: false,
        message: "Category name is required (e.g. 'Tablet', 'Syrup')",
      });
      return;
    }

    const trimmedName = name.trim();

    const existing = await prisma.category.findFirst({
      where: {
        name: {
          equals: trimmedName,
          mode: "insensitive",
        },
      },
    });

    if (existing) {
      res.status(409).json({
        success: false,
        message: `Category '${trimmedName}' already exists`,
      });
      return;
    }

    const newCategory = await prisma.category.create({
      data: { name: trimmedName },
    });

    const categoryCode = formatCategoryCode(newCategory.id);

    res.status(201).json({
      success: true,
      message: `Category '${newCategory.name}' created successfully`,
      data: {
        id: categoryCode,
        categoryCode,
        name: newCategory.name,
        itemCount: 0,
      },
    });
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create category",
    });
  }
};

// ==========================================
// 3. UPDATE CATEGORY (Admin only)
// ==========================================
export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const categoryId = parseIdParam(req.params.id);
    if (!categoryId) {
      res.status(400).json({
        success: false,
        message: "Invalid category ID or code. Format should be 'CAT-001' or a valid number.",
      });
      return;
    }

    const { name } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({
        success: false,
        message: "Category name is required",
      });
      return;
    }

    const trimmedName = name.trim();

    const existing = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: `Category with ID '${req.params.id}' not found`,
      });
      return;
    }

    const duplicate = await prisma.category.findFirst({
      where: {
        name: {
          equals: trimmedName,
          mode: "insensitive",
        },
        NOT: { id: categoryId },
      },
    });

    if (duplicate) {
      res.status(409).json({
        success: false,
        message: `Category '${trimmedName}' already exists`,
      });
      return;
    }

    const updated = await prisma.category.update({
      where: { id: categoryId },
      data: { name: trimmedName },
      include: {
        _count: { select: { inventories: true } },
      },
    });

    const categoryCode = formatCategoryCode(updated.id);

    res.status(200).json({
      success: true,
      message: `Category '${updated.name}' updated successfully`,
      data: {
        id: categoryCode,
        categoryCode,
        name: updated.name,
        itemCount: updated._count.inventories,
      },
    });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update category",
    });
  }
};

// ==========================================
// 4. DELETE CATEGORY (Admin only)
// ==========================================
export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const categoryId = parseIdParam(req.params.id);
    if (!categoryId) {
      res.status(400).json({
        success: false,
        message: "Invalid category ID or code. Format should be 'CAT-001' or a valid number.",
      });
      return;
    }

    const existing = await prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        _count: { select: { inventories: true } },
      },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: `Category with ID '${req.params.id}' not found`,
      });
      return;
    }

    if (existing._count.inventories > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete category '${existing.name}' because ${existing._count.inventories} medicine(s) are assigned to it. Reassign or delete those medicines first.`,
      });
      return;
    }

    await prisma.category.delete({
      where: { id: categoryId },
    });

    res.status(200).json({
      success: true,
      message: `Category '${existing.name}' (${formatCategoryCode(existing.id)}) deleted successfully`,
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete category",
    });
  }
};
