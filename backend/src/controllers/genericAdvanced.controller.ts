import { Request, Response } from "express";
import { prisma } from "../db.js";
import {
  formatGenericCode,
  parseIdParam,
} from "../utils/id.helpers.js";
import {
  formatInventoryItem,
} from "./inventory.controller.js";

const buildGenericCatalogItem = (
  generic: any
) => {
  const medicines =
    generic.inventories.map(
      formatInventoryItem
    );

  const distinctBrands = new Set(
    generic.inventories.map(
      (item: any) =>
        item.medicineBrand
          .trim()
          .toLowerCase()
    )
  );

  const totalPacks =
    generic.inventories.reduce(
      (sum: number, item: any) =>
        sum + item.packInStock,
      0
    );

  const totalLooseUnits =
    generic.inventories.reduce(
      (sum: number, item: any) =>
        sum + item.unitInStock,
      0
    );

  const totalUnitsAvailable =
    generic.inventories.reduce(
      (sum: number, item: any) =>
        sum +
        item.packInStock *
          item.unitPerPack +
        item.unitInStock,
      0
    );

  const lowStockCount =
    generic.inventories.filter(
      (item: any) =>
        item.packInStock <=
        item.packAlertLevel
    ).length;

  const vat13Count =
    generic.inventories.filter(
      (item: any) => item.hasvat
    ).length;

  const vatFreeCount =
    generic.inventories.length -
    vat13Count;

  return {
    id: formatGenericCode(generic.id),
    genericCode:
      formatGenericCode(generic.id),

    name: generic.name,

    itemCount:
      generic.inventories.length,

    brandCount:
      distinctBrands.size,

    totalPacks,
    totalLooseUnits,
    totalUnitsAvailable,

    lowStockCount,

    vat13Count,
    vatFreeCount,

    medicines,
  };
};


// ============================================================
// GET GROUPED GENERIC CATALOG
//
// GET /api/generics/catalog
// GET /api/generics/catalog?search=paracetamol
// ============================================================

export const getGenericCatalog = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    const generics =
      await prisma.generic.findMany({
        where: search
          ? {
              OR: [
                {
                  name: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  inventories: {
                    some: {
                      medicineBrand: {
                        contains: search,
                        mode: "insensitive",
                      },
                    },
                  },
                },
              ],
            }
          : undefined,

        orderBy: {
          name: "asc",
        },

        include: {
          inventories: {
            include: {
              generic: true,
              category: true,
              rack: true,
            },
            orderBy: {
              medicineBrand: "asc",
            },
          },
        },
      });

    const data =
      generics.map(
        buildGenericCatalogItem
      );

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error(
      "Error fetching generic catalog:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to retrieve grouped generic catalog.",
    });
  }
};


// ============================================================
// GET ONE GENERIC WITH ALL BRANDS/BATCHES
//
// GET /api/generics/GEN-001/details
// ============================================================

export const getGenericDetails = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const genericId =
      parseIdParam(req.params.id);

    if (!genericId) {
      res.status(400).json({
        success: false,
        message:
          "Invalid generic ID. Use GEN-001 or a numeric ID.",
      });
      return;
    }

    const generic =
      await prisma.generic.findUnique({
        where: {
          id: genericId,
        },
        include: {
          inventories: {
            include: {
              generic: true,
              category: true,
              rack: true,
            },
            orderBy: {
              medicineBrand: "asc",
            },
          },
        },
      });

    if (!generic) {
      res.status(404).json({
        success: false,
        message:
          `Generic '${req.params.id}' not found.`,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data:
        buildGenericCatalogItem(
          generic
        ),
    });
  } catch (error) {
    console.error(
      "Error fetching generic details:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to retrieve generic details.",
    });
  }
};
