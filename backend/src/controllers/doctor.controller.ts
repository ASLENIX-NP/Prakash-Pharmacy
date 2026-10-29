import { Request, Response } from "express";
import { prisma } from "../db.js";

const parseDoctorId = (
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
    .replace(/^DOC-/i, "");

  const parsed = Number(normalized);

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
};

const formatDoctorCode = (id: number): string =>
  `DOC-${String(id).padStart(3, "0")}`;

const formatDoctor = (doctor: any) => ({
  id: formatDoctorCode(doctor.id),
  doctorCode: formatDoctorCode(doctor.id),
  name: doctor.name,
  speciality: doctor.speciality ?? "",
  qualification: doctor.qualification ?? "",
  nmcNumber: doctor.nmcNumber ?? "",
  defaultConsultationFee: Number(
    doctor.defaultConsultationFee || 0
  ),
  status: doctor.status,
  createdAt: doctor.createdAt?.toISOString?.() ?? doctor.createdAt,
  updatedAt: doctor.updatedAt?.toISOString?.() ?? doctor.updatedAt,
});


/* =====================================================
   GET ALL DOCTORS
   Authenticated staff + admin
   ===================================================== */

export const getAllDoctors = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const status =
      typeof req.query.status === "string"
        ? req.query.status.trim().toLowerCase()
        : "";

    const doctors =
      await prisma.doctor.findMany({
        where:
          status === "active" ||
          status === "inactive"
            ? { status }
            : undefined,
        orderBy: [
          { status: "asc" },
          { name: "asc" },
        ],
      });

    res.status(200).json({
      success: true,
      count: doctors.length,
      data: doctors.map(formatDoctor),
    });
  } catch (error) {
    console.error(
      "Error fetching doctors:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to retrieve doctors.",
    });
  }
};


/* =====================================================
   GET ONE DOCTOR
   ===================================================== */

export const getDoctorById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const doctorId =
      parseDoctorId(req.params.id);

    if (!doctorId) {
      res.status(400).json({
        success: false,
        message:
          "Invalid doctor ID. Use DOC-001 or a valid numeric ID.",
      });
      return;
    }

    const doctor =
      await prisma.doctor.findUnique({
        where: { id: doctorId },
      });

    if (!doctor) {
      res.status(404).json({
        success: false,
        message:
          "Doctor not found.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: formatDoctor(doctor),
    });
  } catch (error) {
    console.error(
      "Error fetching doctor:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to retrieve doctor.",
    });
  }
};


/* =====================================================
   CREATE DOCTOR
   Admin only
   ===================================================== */

export const createDoctor = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      name,
      speciality,
      qualification,
      nmcNumber,
      defaultConsultationFee = 0,
    } = req.body;

    const cleanName =
      String(name ?? "").trim();

    if (!cleanName) {
      res.status(400).json({
        success: false,
        message:
          "Doctor name is required.",
      });
      return;
    }

    const cleanNmc =
      String(nmcNumber ?? "").trim();

    if (cleanNmc) {
      const duplicate =
        await prisma.doctor.findUnique({
          where: {
            nmcNumber: cleanNmc,
          },
        });

      if (duplicate) {
        res.status(409).json({
          success: false,
          message:
            `NMC number '${cleanNmc}' is already assigned to another doctor.`,
        });
        return;
      }
    }

    const fee =
      Number(defaultConsultationFee);

    if (
      !Number.isFinite(fee) ||
      fee < 0
    ) {
      res.status(400).json({
        success: false,
        message:
          "Default consultation fee must be zero or a positive number.",
      });
      return;
    }

    const doctor =
      await prisma.doctor.create({
        data: {
          name: cleanName,
          speciality:
            String(
              speciality ?? ""
            ).trim() || null,
          qualification:
            String(
              qualification ?? ""
            ).trim() || null,
          nmcNumber:
            cleanNmc || null,
          defaultConsultationFee: fee,
          status: "active",
        },
      });

    res.status(201).json({
      success: true,
      message:
        `Doctor '${doctor.name}' created successfully.`,
      data: formatDoctor(doctor),
    });
  } catch (error) {
    console.error(
      "Error creating doctor:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to create doctor.",
    });
  }
};


/* =====================================================
   UPDATE DOCTOR
   Admin only
   ===================================================== */

export const updateDoctor = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const doctorId =
      parseDoctorId(req.params.id);

    if (!doctorId) {
      res.status(400).json({
        success: false,
        message:
          "Invalid doctor ID.",
      });
      return;
    }

    const existing =
      await prisma.doctor.findUnique({
        where: { id: doctorId },
      });

    if (!existing) {
      res.status(404).json({
        success: false,
        message:
          "Doctor not found.",
      });
      return;
    }

    const {
      name,
      speciality,
      qualification,
      nmcNumber,
      defaultConsultationFee,
      status,
    } = req.body;

    const updateData: {
      name?: string;
      speciality?: string | null;
      qualification?: string | null;
      nmcNumber?: string | null;
      defaultConsultationFee?: number;
      status?: string;
    } = {};

    if (name !== undefined) {
      const cleanName =
        String(name).trim();

      if (!cleanName) {
        res.status(400).json({
          success: false,
          message:
            "Doctor name cannot be empty.",
        });
        return;
      }

      updateData.name =
        cleanName;
    }

    if (speciality !== undefined) {
      updateData.speciality =
        String(speciality).trim() ||
        null;
    }

    if (
      qualification !== undefined
    ) {
      updateData.qualification =
        String(
          qualification
        ).trim() || null;
    }

    if (nmcNumber !== undefined) {
      const cleanNmc =
        String(nmcNumber).trim();

      if (cleanNmc) {
        const duplicate =
          await prisma.doctor.findFirst({
            where: {
              nmcNumber: cleanNmc,
              NOT: {
                id: doctorId,
              },
            },
          });

        if (duplicate) {
          res.status(409).json({
            success: false,
            message:
              `NMC number '${cleanNmc}' is already assigned to another doctor.`,
          });
          return;
        }
      }

      updateData.nmcNumber =
        cleanNmc || null;
    }

    if (
      defaultConsultationFee !==
      undefined
    ) {
      const fee =
        Number(
          defaultConsultationFee
        );

      if (
        !Number.isFinite(fee) ||
        fee < 0
      ) {
        res.status(400).json({
          success: false,
          message:
            "Default consultation fee must be zero or a positive number.",
        });
        return;
      }

      updateData.defaultConsultationFee =
        fee;
    }

    if (status !== undefined) {
      const cleanStatus =
        String(status)
          .trim()
          .toLowerCase();

      if (
        cleanStatus !== "active" &&
        cleanStatus !== "inactive"
      ) {
        res.status(400).json({
          success: false,
          message:
            "Doctor status must be active or inactive.",
        });
        return;
      }

      updateData.status =
        cleanStatus;
    }

    const updated =
      await prisma.doctor.update({
        where: { id: doctorId },
        data: updateData,
      });

    res.status(200).json({
      success: true,
      message:
        `Doctor '${updated.name}' updated successfully.`,
      data: formatDoctor(updated),
    });
  } catch (error) {
    console.error(
      "Error updating doctor:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to update doctor.",
    });
  }
};


/* =====================================================
   DEACTIVATE DOCTOR
   Admin only
   Historical visits stay intact.
   ===================================================== */

export const deactivateDoctor = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const doctorId =
      parseDoctorId(req.params.id);

    if (!doctorId) {
      res.status(400).json({
        success: false,
        message:
          "Invalid doctor ID.",
      });
      return;
    }

    const existing =
      await prisma.doctor.findUnique({
        where: { id: doctorId },
      });

    if (!existing) {
      res.status(404).json({
        success: false,
        message:
          "Doctor not found.",
      });
      return;
    }

    const updated =
      await prisma.doctor.update({
        where: { id: doctorId },
        data: {
          status: "inactive",
        },
      });

    res.status(200).json({
      success: true,
      message:
        `Doctor '${updated.name}' deactivated successfully.`,
      data: formatDoctor(updated),
    });
  } catch (error) {
    console.error(
      "Error deactivating doctor:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to deactivate doctor.",
    });
  }
};
