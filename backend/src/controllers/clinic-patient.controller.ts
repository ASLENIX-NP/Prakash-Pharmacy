import { Request, Response } from "express";
import { prisma } from "../db.js";


/* =====================================================
   Helpers
   ===================================================== */

const parsePatientId = (
  value: string | string[] | undefined
): number | null => {
  if (!value) return null;

  const rawValue =
    Array.isArray(value)
      ? value[0]
      : value;

  if (!rawValue) {
    return null;
  }

  const normalized = rawValue
    .trim()
    .replace(/^CL-/i, "");

  const parsed = Number(normalized);

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
};


const formatClinicNumber = (
  id: number
): string =>
  `CL-${String(id).padStart(6, "0")}`;


const formatDoctorCode = (
  id: number
): string =>
  `DOC-${String(id).padStart(3, "0")}`;


const formatOpdNumber = (
  id: number
): string =>
  `OPD-${String(id).padStart(6, "0")}`;


const formatPatientHistoryVisit = (
  visit: any
) => {
  const totalCharge =
    Number(
      visit.totalCharge || 0
    );

  const additionalCharge =
    Number(
      visit.additionalCharge || 0
    );

  let consultationFee =
    Number(
      visit.consultationFee || 0
    );


  /*
   * Compatibility for historical OPDs created before
   * consultationFee/additionalCharge were introduced.
   */
  if (
    consultationFee === 0 &&
    additionalCharge === 0 &&
    totalCharge > 0 &&
    String(
      visit.status || ""
    ).toLowerCase() ===
      "completed"
  ) {
    consultationFee =
      totalCharge;
  }


  const additionalChargeNote =
    visit.additionalChargeNote ??
    visit.chargeNote ??
    null;


  return {
    id:
      formatOpdNumber(
        visit.id
      ),

    opdNumber:
      formatOpdNumber(
        visit.id
      ),

    doctor: {
      id:
        formatDoctorCode(
          visit.doctor.id
        ),

      doctorCode:
        formatDoctorCode(
          visit.doctor.id
        ),

      name:
        visit.doctor.name,

      speciality:
        visit.doctor.speciality ??
        null,

      qualification:
        visit.doctor.qualification ??
        null,

      nmcNumber:
        visit.doctor.nmcNumber ??
        null,
    },

    visitDateTime:
      new Date(
        visit.visitDateTime
      ).toISOString(),

    ageAtVisit:
      visit.ageAtVisit,

    consultationFee,

    additionalCharge,

    additionalChargeNote,

    totalCharge,

    /*
     * Compatibility alias used by older frontend code.
     */
    chargeNote:
      additionalChargeNote,

    status:
      String(
        visit.status ||
          "completed"
      ).toLowerCase(),

    completedAt:
      visit.completedAt
        ? new Date(
            visit.completedAt
          ).toISOString()
        : null,

    cancelledAt:
      visit.cancelledAt
        ? new Date(
            visit.cancelledAt
          ).toISOString()
        : null,

    cancelReason:
      visit.cancelReason ??
      null,

    voidedAt:
      visit.voidedAt
        ? new Date(
            visit.voidedAt
          ).toISOString()
        : null,

    voidReason:
      visit.voidReason ??
      null,

    createdBy:
      visit.createdBy
        ? {
            id:
              visit.createdBy.id,

            username:
              visit.createdBy.username,

            name:
              [
                visit.createdBy.firstName,
                visit.createdBy.lastName,
              ]
                .filter(Boolean)
                .join(" ")
                .trim() ||
              visit.createdBy.username,
          }
        : null,

    createdAt:
      visit.createdAt
        ? new Date(
            visit.createdAt
          ).toISOString()
        : undefined,

    updatedAt:
      visit.updatedAt
        ? new Date(
            visit.updatedAt
          ).toISOString()
        : undefined,
  };
};


const normalizeOptionalString = (
  value: unknown
): string | null => {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const cleaned =
    String(value).trim();

  return cleaned || null;
};


const formatPatient = (
  patient: any
) => ({
  id: formatClinicNumber(patient.id),

  clinicNumber:
    formatClinicNumber(patient.id),

  name:
    patient.name,

  phone:
    patient.phone ?? "",

  gender:
    patient.gender ?? "",

  ageYears:
    patient.ageYears ?? null,

  ageMonths:
    patient.ageMonths ?? null,

  ageUnit:
    patient.ageUnit ?? "years",

  address:
    patient.address ?? "",

  createdAt:
    patient.createdAt?.toISOString?.() ??
    patient.createdAt,

  updatedAt:
    patient.updatedAt?.toISOString?.() ??
    patient.updatedAt,
});


/* =====================================================
   GET ALL / SEARCH PATIENTS
   Staff + Admin
   Examples:
   /api/clinic-patients
   /api/clinic-patients?search=Ram
   /api/clinic-patients?search=9812345678
   /api/clinic-patients?search=CL-000001
   ===================================================== */

export const getClinicPatients = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    let where: any = undefined;

    if (search) {
      const possiblePatientId =
        parsePatientId(search);

      const looksLikeClinicNumber =
        /^CL-\d+$/i.test(search);

      if (
        looksLikeClinicNumber &&
        possiblePatientId
      ) {
        where = {
          id: possiblePatientId,
        };
      } else {
        where = {
          OR: [
            {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              phone: {
                contains: search,
              },
            },
          ],
        };
      }
    }

    const patients =
      await prisma.clinicPatient.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        take: 100,
      });

    res.status(200).json({
      success: true,
      count: patients.length,
      data: patients.map(formatPatient),
    });
  } catch (error) {
    console.error(
      "Error fetching clinic patients:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to retrieve clinic patients.",
    });
  }
};


/* =====================================================
   GET ONE PATIENT + VISIT HISTORY
   Staff + Admin
   ===================================================== */

export const getClinicPatientById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const patientId =
      parsePatientId(req.params.id);

    if (!patientId) {
      res.status(400).json({
        success: false,
        message:
          "Invalid clinic patient ID. Use CL-000001 or a valid numeric ID.",
      });
      return;
    }

    const patient =
      await prisma.clinicPatient.findUnique({
        where: {
          id: patientId,
        },

        include: {
          visits: {
            orderBy: {
              visitDateTime: "desc",
            },

            include: {
              doctor: true,

              createdBy: {
                select: {
                  id: true,
                  username: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      });

    if (!patient) {
      res.status(404).json({
        success: false,
        message:
          "Clinic patient not found.",
      });
      return;
    }

    const formattedVisits =
      patient.visits.map(
        formatPatientHistoryVisit
      );


    res.status(200).json({
      success: true,

      data: {
        ...formatPatient(patient),

        visitCount:
          formattedVisits.length,

        visits:
          formattedVisits,
      },
    });
  } catch (error) {
    console.error(
      "Error fetching clinic patient:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to retrieve clinic patient.",
    });
  }
};


/* =====================================================
   CREATE PATIENT
   Staff + Admin
   ===================================================== */

export const createClinicPatient = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      name,
      phone,
      gender,
      ageYears,
      ageMonths,
      ageUnit,
      address,
    } = req.body;

    const cleanName =
      String(name ?? "").trim();

    if (!cleanName) {
      res.status(400).json({
        success: false,
        message:
          "Patient name is required.",
      });
      return;
    }

    let parsedAge: number | null =
      null;

    if (
      ageYears !== undefined &&
      ageYears !== null &&
      String(ageYears).trim() !== ""
    ) {
      parsedAge =
        Number(ageYears);

      if (
        !Number.isInteger(parsedAge) ||
        parsedAge < 0 ||
        parsedAge > 130
      ) {
        res.status(400).json({
          success: false,
          message:
            "Patient age must be a whole number between 0 and 130.",
        });
        return;
      }
    }

    let parsedMonths: number | null = null;
    if (ageMonths !== undefined && ageMonths !== null && String(ageMonths).trim() !== "") {
      const m = Number(ageMonths);
      if (Number.isInteger(m) && m >= 0 && m <= 120) {
        parsedMonths = m;
      }
    }

    const cleanUnit = ageUnit === "months" || ageUnit === "days" ? ageUnit : "years";

    const patient =
      await prisma.clinicPatient.create({
        data: {
          name:
            cleanName,

          phone:
            normalizeOptionalString(
              phone
            ),

          gender:
            normalizeOptionalString(
              gender
            ),

          ageYears:
            parsedAge,

          ageMonths:
            parsedMonths,

          ageUnit:
            cleanUnit,

          address:
            normalizeOptionalString(
              address
            ),
        },
      });

    res.status(201).json({
      success: true,

      message:
        `Patient '${patient.name}' registered successfully.`,

      data:
        formatPatient(patient),
    });
  } catch (error) {
    console.error(
      "Error creating clinic patient:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to register clinic patient.",
    });
  }
};


/* =====================================================
   UPDATE PATIENT
   Staff + Admin
   ===================================================== */

export const updateClinicPatient = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const patientId =
      parsePatientId(req.params.id);

    if (!patientId) {
      res.status(400).json({
        success: false,
        message:
          "Invalid clinic patient ID.",
      });
      return;
    }

    const existing =
      await prisma.clinicPatient.findUnique({
        where: {
          id: patientId,
        },
      });

    if (!existing) {
      res.status(404).json({
        success: false,
        message:
          "Clinic patient not found.",
      });
      return;
    }

    const {
      name,
      phone,
      gender,
      ageYears,
      ageMonths,
      ageUnit,
      address,
    } = req.body;

    const updateData: {
      name?: string;
      phone?: string | null;
      gender?: string | null;
      ageYears?: number | null;
      ageMonths?: number | null;
      ageUnit?: string | null;
      address?: string | null;
    } = {};

    if (name !== undefined) {
      const cleanName =
        String(name).trim();

      if (!cleanName) {
        res.status(400).json({
          success: false,
          message:
            "Patient name cannot be empty.",
        });
        return;
      }

      updateData.name =
        cleanName;
    }

    if (phone !== undefined) {
      updateData.phone =
        normalizeOptionalString(
          phone
        );
    }

    if (gender !== undefined) {
      updateData.gender =
        normalizeOptionalString(
          gender
        );
    }

    if (address !== undefined) {
      updateData.address =
        normalizeOptionalString(
          address
        );
    }

    if (ageYears !== undefined) {
      if (
        ageYears === null ||
        String(ageYears).trim() === ""
      ) {
        updateData.ageYears =
          null;
      } else {
        const parsedAge =
          Number(ageYears);

        if (
          !Number.isInteger(parsedAge) ||
          parsedAge < 0 ||
          parsedAge > 130
        ) {
          res.status(400).json({
            success: false,
            message:
              "Patient age must be a whole number between 0 and 130.",
          });
          return;
        }

        updateData.ageYears =
          parsedAge;
      }
    }

    if (ageMonths !== undefined) {
      if (ageMonths === null || String(ageMonths).trim() === "") {
        updateData.ageMonths = null;
      } else {
        const m = Number(ageMonths);
        if (Number.isInteger(m) && m >= 0 && m <= 120) {
          updateData.ageMonths = m;
        }
      }
    }

    if (ageUnit !== undefined) {
      updateData.ageUnit = ageUnit === "months" || ageUnit === "days" ? ageUnit : "years";
    }

    const updated =
      await prisma.clinicPatient.update({
        where: {
          id: patientId,
        },

        data:
          updateData,
      });

    res.status(200).json({
      success: true,

      message:
        `Patient '${updated.name}' updated successfully.`,

      data:
        formatPatient(updated),
    });
  } catch (error) {
    console.error(
      "Error updating clinic patient:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to update clinic patient.",
    });
  }
};
