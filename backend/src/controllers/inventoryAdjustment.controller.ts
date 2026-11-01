import type { Request, Response } from "express";
import { prisma } from "../db.js";
import { formatInventoryItem } from "./inventory.controller.js";
import { formatMedicineCode } from "../utils/id.helpers.js";


class StockAdjustmentValidationError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400
  ) {
    super(message);
    this.name = "StockAdjustmentValidationError";
  }
}


const ALLOWED_ADJUSTMENT_TYPES =
  new Set([
    "AUDIT",
    "DAMAGE",
    "DISPOSAL",
    "SHRINKAGE",
    "CORRECTION",
    "OTHER",
  ]);


const parseMedicineId = (
  rawId: unknown
): number | null => {

  const value =
    Array.isArray(rawId)
      ? rawId[0]
      : rawId;

  if (typeof value !== "string") {
    return null;
  }

  const match =
    value
      .trim()
      .match(/^(?:MED-)?(\d+)$/i);

  const numericPart =
    match?.[1];

  if (!numericPart) {
    return null;
  }

  const id =
    Number.parseInt(
      numericPart,
      10
    );

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return null;
  }

  return id;
};


const parseOptionalInteger = (
  value: unknown
): number | null | undefined => {

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return undefined;
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number(value);

  if (!Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
};


export const adjustInventoryStock = async (
  req: Request,
  res: Response
): Promise<void> => {

  try {

    const id =
      parseMedicineId(
        req.params.id
      );

    if (!id) {
      res.status(400).json({
        success: false,
        message:
          "Invalid medicine ID.",
      });
      return;
    }


    const existing =
      await prisma.inventory.findUnique({
        where: {
          id,
        },
      });

    if (!existing) {
      res.status(404).json({
        success: false,
        message:
          "Medicine not found.",
      });
      return;
    }


    const adjustmentType =
      String(
        req.body.type ??
        req.body.adjustmentType ??
        "AUDIT"
      )
        .trim()
        .toUpperCase();


    if (
      !ALLOWED_ADJUSTMENT_TYPES.has(
        adjustmentType
      )
    ) {
      res.status(400).json({
        success: false,
        message:
          "Invalid adjustment type. Allowed values: AUDIT, DAMAGE, DISPOSAL, SHRINKAGE, CORRECTION, OTHER.",
      });
      return;
    }


    const reason =
      String(
        req.body.reason ?? ""
      ).trim();

    if (!reason) {
      res.status(400).json({
        success: false,
        message:
          "A reason is required for every stock adjustment.",
      });
      return;
    }


    const newPacksInput =
      parseOptionalInteger(
        req.body.newPacks
      );

    const newLooseInput =
      parseOptionalInteger(
        req.body.newLooseUnits
      );

    const packDelta =
      parseOptionalInteger(
        req.body.packDelta
      );

    const looseDelta =
      parseOptionalInteger(
        req.body.looseUnitDelta
      );


    if (
      newPacksInput === null ||
      newLooseInput === null ||
      packDelta === null ||
      looseDelta === null
    ) {
      res.status(400).json({
        success: false,
        message:
          "Stock values must be whole numbers.",
      });
      return;
    }


    const hasAbsoluteValues =
      newPacksInput !== undefined ||
      newLooseInput !== undefined;

    const hasDeltaValues =
      packDelta !== undefined ||
      looseDelta !== undefined;


    if (
      !hasAbsoluteValues &&
      !hasDeltaValues
    ) {
      res.status(400).json({
        success: false,
        message:
          "Provide newPacks/newLooseUnits or packDelta/looseUnitDelta.",
      });
      return;
    }


    if (
      hasAbsoluteValues &&
      hasDeltaValues
    ) {
      res.status(400).json({
        success: false,
        message:
          "Use either absolute stock values or stock deltas, not both.",
      });
      return;
    }


    const authUser =
      (req as any).user ?? {};


    const recordedBy =
      String(
        authUser.username ??
        authUser.fullName ??
        authUser.userId ??
        authUser.id ??
        "authenticated-user"
      );


    const result =
      await prisma.$transaction(
        async (tx) => {
          // Serialize physical stock edits against the freshest row.
          await tx.$queryRaw`
            SELECT id
              FROM inventory_tbl
             WHERE id = ${id}
             FOR UPDATE
          `;

          const current = await tx.inventory.findUnique({
            where: { id },
          });

          if (!current) {
            throw new StockAdjustmentValidationError(
              "Medicine not found.",
              404
            );
          }

          const previousPacks = current.packInStock;
          const previousLooseUnits = current.unitInStock;

          let newPacks: number;
          let newLooseUnits: number;

          if (hasAbsoluteValues) {
            newPacks = newPacksInput ?? previousPacks;
            newLooseUnits = newLooseInput ?? previousLooseUnits;
          } else {
            newPacks = previousPacks + (packDelta ?? 0);
            newLooseUnits = previousLooseUnits + (looseDelta ?? 0);
          }

          if (newPacks < 0 || newLooseUnits < 0) {
            throw new StockAdjustmentValidationError(
              "Stock cannot become negative."
            );
          }

          const unitsPerPack = Math.max(1, Number(current.unitPerPack || 1));
          if (newLooseUnits >= unitsPerPack) {
            throw new StockAdjustmentValidationError(
              `Loose-unit stock must be less than units per pack (${unitsPerPack}). Convert full loose units into packs.`
            );
          }

          const variancePacks = newPacks - previousPacks;
          const varianceLooseUnits = newLooseUnits - previousLooseUnits;

          const inventory = await tx.inventory.update({
            where: { id },
            data: {
              packInStock: newPacks,
              unitInStock: newLooseUnits,
            },
            include: {
              generic: true,
              category: true,
              rack: true,
            },
          });

          const adjustment = await tx.stockAdjustmentLog.create({
            data: {
              medicineId: id,
              adjustmentType,
              previousPacks,
              newPacks,
              variancePacks,
              previousLooseUnits,
              newLooseUnits,
              varianceLooseUnits,
              reason,
              recordedBy,
            },
          });

          return { inventory, adjustment };
        }
      );

    res.status(200).json({
      success: true,

      message:
        "Stock adjustment recorded successfully.",

      data: {
        inventory:
          formatInventoryItem(
            result.inventory
          ),

        adjustment:
          result.adjustment,
      },
    });

  } catch (error) {

    console.error(
      "Adjust inventory stock error:",
      error
    );

    if (error instanceof StockAdjustmentValidationError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message:
        "Failed to adjust inventory stock.",
    });
  }
};


export const getInventoryAdjustmentLogs = async (
  req: Request,
  res: Response
): Promise<void> => {

  try {

    const id =
      parseMedicineId(
        req.params.id
      );

    if (!id) {
      res.status(400).json({
        success: false,
        message:
          "Invalid medicine ID.",
      });
      return;
    }


    const medicine =
      await prisma.inventory.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
        },
      });


    if (!medicine) {
      res.status(404).json({
        success: false,
        message:
          "Medicine not found.",
      });
      return;
    }


    const logs =
      await prisma.stockAdjustmentLog.findMany({
        where: {
          medicineId:
            id,
        },

        orderBy: {
          createdAt:
            "desc",
        },
      });


    res.status(200).json({
      success: true,
      count:
        logs.length,
      data:
        logs,
    });

  } catch (error) {

    console.error(
      "Get stock adjustment logs error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to retrieve stock adjustment history.",
    });
  }
};

export const getAllStockAdjustmentLogs = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { limit = 100 } = req.query;
    const take = limit === "all" ? undefined : parseInt(String(limit), 10) || 100;

    const logs = await prisma.stockAdjustmentLog.findMany({
      include: {
        medicine: {
          select: {
            id: true,
            medicineBrand: true,
            batchNumber: true,
            unitPerPack: true,
            generic: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: take && !isNaN(take) ? take : undefined,
    });

    const formatted = logs.map((log) => {
      const unitsPerPack = log.medicine?.unitPerPack || 10;
      const prevTotal = log.previousPacks * unitsPerPack + log.previousLooseUnits;
      const newTotal = log.newPacks * unitsPerPack + log.newLooseUnits;
      const netVariance = newTotal - prevTotal;

      return {
        id: `adj-${log.id}`,
        adjustmentId: log.id,
        medicineId: formatMedicineCode(log.medicineId),
        medicineName: log.medicine?.medicineBrand || "Medicine",
        genericName: log.medicine?.generic?.name || "",
        batchNumber: log.medicine?.batchNumber || "",
        type: log.adjustmentType.toLowerCase(),
        previousPacks: log.previousPacks,
        previousLoose: log.previousLooseUnits,
        previousTotalUnits: prevTotal,
        addedPacks: log.variancePacks,
        addedLoose: log.varianceLooseUnits,
        newPacks: log.newPacks,
        newLoose: log.newLooseUnits,
        newTotalUnits: newTotal,
        netVarianceUnits: netVariance,
        reason: log.reason,
        notes: log.reason,
        timestamp: log.createdAt.toISOString(),
        recordedBy: log.recordedBy,
      };
    });

    res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted,
    });
  } catch (error) {
    console.error("Get all stock adjustment logs error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve stock adjustment history.",
    });
  }
};

