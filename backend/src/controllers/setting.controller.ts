import { Request, Response } from "express";
import { prisma } from "../db.js";

export const formatSettingResponse = (s: any) => ({
  storeName: s.storeName || "",
  address: s.address || "",
  phoneNumber: s.phoneNumber || "",
  emailId: s.emailId || "",
  panNumber: s.panNumber || "",
  ddaLicenceNumber: s.ddaLicenceNumber || "",
  vatRegistered: Boolean(s.vatRegistered ?? true),
  storeLogo: s.storeLogo || "",
  pharmacistName: s.pharmacistName || "",
  pharmacistCouncilRegNumber: s.pharmacistCouncilRegNumber || "",
  ddaLicenceExpiryDate: s.ddaLicenceExpiryDate || "",
  currency: s.currency || "NPR",
  fiscalYear: s.fiscalYear || "2081/82",
  invoicePrefix: s.invoicePrefix || "PP-2081/82-",
  nextInvoiceNumber: Number(s.nextInvoiceNumber ?? 101),
  defaultInvoiceSize: (s.defaultInvoiceSize === "Thermal" ? "Thermal" : "A5") as "A5" | "Thermal",
  invoiceDateFormat: (s.invoiceDateFormat === "AD" ? "AD" : "BS") as "BS" | "AD",
  receiptFooterNote: s.receiptFooterNote || "",
  defaultLowStockThreshold: Number(s.defaultLowStockThreshold ?? 15),
  nearExpiryThresholdMonths: Number(s.nearExpiryThresholdMonths ?? 6),
  updatedAt: s.updatedAt ? new Date(s.updatedAt).toISOString() : new Date().toISOString(),
});

const DEFAULT_SETTINGS = {
  storeName: "Prakash Pharmacy",
  address: "Makwanpur, Nepal",
  phoneNumber: "9800000000",
  emailId: "contact@prakashpharmacy.com",
  panNumber: "600123456",
  ddaLicenceNumber: "DDA-MAK-1042",
  vatRegistered: true,
  storeLogo: "",
  pharmacistName: "Prakash Bhatta",
  pharmacistCouncilRegNumber: "NPC-1425",
  ddaLicenceExpiryDate: "",
  currency: "NPR",
  fiscalYear: "2081/82",
  invoicePrefix: "PP-2081/82-",
  nextInvoiceNumber: 101,
  defaultInvoiceSize: "A5",
  invoiceDateFormat: "BS",
  receiptFooterNote: "Thank you for your visit. Medicines once sold cannot be returned without original bill.",
  defaultLowStockThreshold: 15,
  nearExpiryThresholdMonths: 6,
};

export const getSettings = async (_req: Request, res: Response): Promise<void> => {
  try {
    let setting = await prisma.pharmacySetting.findFirst();

    if (!setting) {
      setting = await prisma.pharmacySetting.create({
        data: DEFAULT_SETTINGS,
      });
    }

    res.status(200).json({
      success: true,
      data: formatSettingResponse(setting),
    });
  } catch (error) {
    console.error("Error fetching pharmacy settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load store settings.",
    });
  }
};

export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      storeName,
      address,
      phoneNumber,
      emailId,
      panNumber,
      ddaLicenceNumber,
      vatRegistered,
      storeLogo,
      pharmacistName,
      pharmacistCouncilRegNumber,
      ddaLicenceExpiryDate,
      currency,
      fiscalYear,
      invoicePrefix,
      nextInvoiceNumber,
      defaultInvoiceSize,
      invoiceDateFormat,
      receiptFooterNote,
      defaultLowStockThreshold,
      nearExpiryThresholdMonths,
    } = req.body;

    // Validate input rules
    if (storeName !== undefined && String(storeName).trim().length < 2) {
      res.status(400).json({ success: false, message: "Store name must be at least 2 characters long." });
      return;
    }

    if (emailId !== undefined) {
      const cleanEmail = String(emailId).trim();
      if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        res.status(400).json({ success: false, message: "Please enter a valid email address format (e.g. contact@pharmacy.com)." });
        return;
      }
    }

    if (phoneNumber !== undefined) {
      const cleanPhone = String(phoneNumber).trim().replace(/\D/g, "");
      if (cleanPhone && (cleanPhone.length < 8 || cleanPhone.length > 10)) {
        res.status(400).json({
          success: false,
          message: "Official phone number must be between 8 and 10 digits.",
        });
        return;
      }
    }

    if (panNumber !== undefined) {
      const cleanPan = String(panNumber).trim();
      if (cleanPan && !/^\d{9}$/.test(cleanPan)) {
        res.status(400).json({ success: false, message: "Permanent Account Number (PAN) must be exactly 9 numeric digits." });
        return;
      }
    }

    if (fiscalYear !== undefined) {
      const cleanFiscal = String(fiscalYear).trim();
      if (cleanFiscal && !/^\d{4}\/\d{2}$/.test(cleanFiscal)) {
        res.status(400).json({ success: false, message: "Fiscal Year should follow format YYYY/YY (e.g., 2081/82)." });
        return;
      }
    }

    if (nextInvoiceNumber !== undefined) {
      const parsed = parseInt(String(nextInvoiceNumber), 10);
      if (isNaN(parsed) || parsed < 1) {
        res.status(400).json({ success: false, message: "Next invoice number must be 1 or higher." });
        return;
      }
    }

    let existing = await prisma.pharmacySetting.findFirst();

    const updateData: any = {};
    if (storeName !== undefined) updateData.storeName = String(storeName).trim();
    if (address !== undefined) updateData.address = String(address).trim();
    if (phoneNumber !== undefined) {
      updateData.phoneNumber = String(phoneNumber).trim().replace(/\D/g, "");
    }
    if (emailId !== undefined) updateData.emailId = String(emailId).trim();
    if (panNumber !== undefined) updateData.panNumber = String(panNumber).trim();
    if (ddaLicenceNumber !== undefined) updateData.ddaLicenceNumber = String(ddaLicenceNumber).trim();
    if (vatRegistered !== undefined) updateData.vatRegistered = Boolean(vatRegistered);
    if (storeLogo !== undefined) updateData.storeLogo = typeof storeLogo === "string" ? storeLogo.trim() : null;
    if (pharmacistName !== undefined) updateData.pharmacistName = String(pharmacistName).trim();
    if (pharmacistCouncilRegNumber !== undefined) {
      updateData.pharmacistCouncilRegNumber = String(pharmacistCouncilRegNumber).trim();
    }
    if (ddaLicenceExpiryDate !== undefined) updateData.ddaLicenceExpiryDate = String(ddaLicenceExpiryDate).trim();
    if (currency !== undefined) updateData.currency = String(currency).trim();
    if (fiscalYear !== undefined) updateData.fiscalYear = String(fiscalYear).trim();
    if (invoicePrefix !== undefined) updateData.invoicePrefix = String(invoicePrefix).trim();
    if (nextInvoiceNumber !== undefined) updateData.nextInvoiceNumber = parseInt(String(nextInvoiceNumber), 10);
    if (defaultInvoiceSize !== undefined) {
      updateData.defaultInvoiceSize = String(defaultInvoiceSize).trim() === "Thermal" ? "Thermal" : "A5";
    }
    if (invoiceDateFormat !== undefined) {
      updateData.invoiceDateFormat = String(invoiceDateFormat).trim() === "AD" ? "AD" : "BS";
    }
    if (receiptFooterNote !== undefined) updateData.receiptFooterNote = String(receiptFooterNote).trim();

    if (defaultLowStockThreshold !== undefined) {
      const parsed = parseInt(String(defaultLowStockThreshold), 10);
      if (!isNaN(parsed) && parsed >= 0) {
        updateData.defaultLowStockThreshold = parsed;
      }
    }

    if (nearExpiryThresholdMonths !== undefined) {
      const parsed = parseInt(String(nearExpiryThresholdMonths), 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 36) {
        updateData.nearExpiryThresholdMonths = parsed;
      }
    }

    let saved;
    if (existing) {
      saved = await prisma.pharmacySetting.update({
        where: { id: existing.id },
        data: updateData,
      });
    } else {
      saved = await prisma.pharmacySetting.create({
        data: {
          ...DEFAULT_SETTINGS,
          ...updateData,
        },
      });
    }

    res.status(200).json({
      success: true,
      message: "Pharmacy store settings updated successfully.",
      data: formatSettingResponse(saved),
    });
  } catch (error) {
    console.error("Error updating pharmacy settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update store settings.",
    });
  }
};
