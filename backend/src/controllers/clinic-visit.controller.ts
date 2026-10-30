import { Request, Response } from "express";
import { prisma } from "../db.js";


/* =====================================================
   Helpers
   ===================================================== */

type RequestWithUser = Request & {
  user?: {
    id: string;
    username?: string;
    role?: string;
  };
};


const firstQueryValue = (
  value: unknown
): string => {
  if (Array.isArray(value)) {
    return value.length > 0
      ? String(value[0] ?? "").trim()
      : "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return "";
};


const parseCodeId = (
  value: unknown,
  prefix: string
): number | null => {
  const raw =
    Array.isArray(value)
      ? value[0]
      : value;

  if (
    raw === undefined ||
    raw === null
  ) {
    return null;
  }

  const clean = String(raw)
    .trim()
    .replace(
      new RegExp(`^${prefix}`, "i"),
      ""
    );

  const parsed = Number(clean);

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
};


const formatDoctorCode = (
  id: number
): string =>
  `DOC-${String(id).padStart(3, "0")}`;


const formatClinicNumber = (
  id: number
): string =>
  `CL-${String(id).padStart(6, "0")}`;


const formatOpdNumber = (
  id: number
): string =>
  `OPD-${String(id).padStart(6, "0")}`;


const parseDateBoundary = (
  value: string,
  endOfDay = false
): Date | null => {
  if (!value) {
    return null;
  }

  let date: Date;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date = new Date(
      `${value}T${
        endOfDay
          ? "23:59:59.999"
          : "00:00:00.000"
      }`
    );
  } else {
    date = new Date(value);
  }

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
};


const formatVisit = (
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
   * Compatibility for visits recorded before
   * consultationFee existed.
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

    patient: {
      id:
        formatClinicNumber(
          visit.patient.id
        ),

      clinicNumber:
        formatClinicNumber(
          visit.patient.id
        ),

      name:
        visit.patient.name,

      phone:
        visit.patient.phone,

      gender:
        visit.patient.gender,

      ageYears:
        visit.patient.ageYears,

      address:
        visit.patient.address,
    },

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
        visit.doctor.speciality,

      qualification:
        visit.doctor.qualification,

      nmcNumber:
        visit.doctor.nmcNumber,

      defaultConsultationFee:
        Number(
          visit.doctor
            .defaultConsultationFee ||
            0
        ),

      status:
        visit.doctor.status,
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
     * Temporary compatibility alias for
     * the existing frontend.
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
                visit.createdBy
                  .firstName,

                visit.createdBy
                  .lastName,
              ]
                .filter(Boolean)
                .join(" ")
                .trim() ||
              visit.createdBy
                .username,
          }
        : null,

    createdAt:
      new Date(
        visit.createdAt
      ).toISOString(),

    updatedAt:
      new Date(
        visit.updatedAt
      ).toISOString(),
  };
};


const visitInclude = {
  patient: true,
  doctor: true,
  createdBy: {
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
    },
  },
};


const buildVisitWhere = (
  req: Request
): {
  where?: any;
  error?: string;
} => {
  const where: any = {};

  const doctorRaw =
    firstQueryValue(
      req.query.doctorId
    );

  const patientRaw =
    firstQueryValue(
      req.query.patientId
    );

  const fromRaw =
    firstQueryValue(
      req.query.from
    );

  const toRaw =
    firstQueryValue(
      req.query.to
    );

  const search =
    firstQueryValue(
      req.query.search
    );


  if (doctorRaw) {
    const doctorId =
      parseCodeId(
        doctorRaw,
        "DOC-"
      );

    if (!doctorId) {
      return {
        error:
          "Invalid doctor filter.",
      };
    }

    where.doctorId =
      doctorId;
  }


  if (patientRaw) {
    const patientId =
      parseCodeId(
        patientRaw,
        "CL-"
      );

    if (!patientId) {
      return {
        error:
          "Invalid patient filter.",
      };
    }

    where.patientId =
      patientId;
  }


  if (
    fromRaw ||
    toRaw
  ) {
    where.visitDateTime = {};

    if (fromRaw) {
      const from =
        parseDateBoundary(
          fromRaw,
          false
        );

      if (!from) {
        return {
          error:
            "Invalid 'from' date.",
        };
      }

      where.visitDateTime.gte =
        from;
    }

    if (toRaw) {
      const to =
        parseDateBoundary(
          toRaw,
          true
        );

      if (!to) {
        return {
          error:
            "Invalid 'to' date.",
        };
      }

      where.visitDateTime.lte =
        to;
    }

    if (
      where.visitDateTime.gte &&
      where.visitDateTime.lte &&
      where.visitDateTime.gte >
        where.visitDateTime.lte
    ) {
      return {
        error:
          "'From' date cannot be after 'To' date.",
      };
    }
  }


  if (search) {
    const possibleOpdId =
      /^OPD-\d+$/i.test(search)
        ? parseCodeId(
            search,
            "OPD-"
          )
        : null;

    const possibleClinicId =
      /^CL-\d+$/i.test(search)
        ? parseCodeId(
            search,
            "CL-"
          )
        : null;

    const possibleDoctorId =
      /^DOC-\d+$/i.test(search)
        ? parseCodeId(
            search,
            "DOC-"
          )
        : null;

    where.OR = [
      ...(possibleOpdId
        ? [
            {
              id:
                possibleOpdId,
            },
          ]
        : []),

      ...(possibleClinicId
        ? [
            {
              patientId:
                possibleClinicId,
            },
          ]
        : []),

      ...(possibleDoctorId
        ? [
            {
              doctorId:
                possibleDoctorId,
            },
          ]
        : []),

      {
        patient: {
          name: {
            contains:
              search,

            mode:
              "insensitive",
          },
        },
      },

      {
        patient: {
          phone: {
            contains:
              search,
          },
        },
      },

      {
        doctor: {
          name: {
            contains:
              search,

            mode:
              "insensitive",
          },
        },
      },
    ];
  }


  const status =
    firstQueryValue(
      req.query.status
    ).toLowerCase();

  if (status) {
    const allowedStatuses =
      new Set([
        "open",
        "completed",
        "cancelled",
        "voided",
      ]);

    if (
      !allowedStatuses.has(
        status
      )
    ) {
      return {
        error:
          'Status must be "open", "completed", "cancelled", or "voided".',
      };
    }

    where.status =
      status;
  }


  return {
    where,
  };
};


/* =====================================================
   GET VISIT RECORDS
   Staff + Admin

   Filters:
   doctorId
   patientId
   from
   to
   search
   ===================================================== */

export const getClinicVisits = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const filter =
      buildVisitWhere(req);

    if (filter.error) {
      res.status(400).json({
        success: false,
        message:
          filter.error,
      });

      return;
    }

    const visits =
      await prisma.clinicVisit.findMany({
        where:
          filter.where,

        include:
          visitInclude,

        orderBy: {
          visitDateTime:
            "desc",
        },
      });

    res.status(200).json({
      success: true,

      count:
        visits.length,

      data:
        visits.map(
          formatVisit
        ),
    });
  } catch (error) {
    console.error(
      "Error fetching clinic visits:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to retrieve OPD visits.",
    });
  }
};


/* =====================================================
   ADMIN REVENUE / OPD REPORT
   Same filters as visit list.
   ===================================================== */

export const getClinicVisitReport = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const filter =
      buildVisitWhere(req);

    if (filter.error) {
      res.status(400).json({
        success: false,
        message:
          filter.error,
      });

      return;
    }


    const visits =
      await prisma.clinicVisit.findMany({
        where:
          filter.where,

        include:
          visitInclude,

        orderBy: {
          visitDateTime:
            "desc",
        },
      });


    const completedVisits =
      visits.filter(
        (visit) =>
          String(
            visit.status
          ).toLowerCase() ===
          "completed"
      );


    const openVisits =
      visits.filter(
        (visit) =>
          String(
            visit.status
          ).toLowerCase() ===
          "open"
      );


    const totalRevenue =
      completedVisits.reduce(
        (
          sum,
          visit
        ) =>
          sum +
          Number(
            visit.totalCharge ||
              0
          ),
        0
      );


    const uniquePatients =
      new Set(
        visits.map(
          (visit) =>
            visit.patientId
        )
      ).size;


    const totalVisits =
      visits.length;


    const completedVisitCount =
      completedVisits.length;


    const openVisitCount =
      openVisits.length;


    const averageRevenuePerVisit =
      completedVisitCount > 0
        ? totalRevenue /
          completedVisitCount
        : 0;


    res.status(200).json({
      success: true,

      summary: {
        totalVisits,

        openVisits:
          openVisitCount,

        completedVisits:
          completedVisitCount,

        uniquePatients,

        totalRevenue:
          Number(
            totalRevenue.toFixed(2)
          ),

        averageRevenuePerVisit:
          Number(
            averageRevenuePerVisit.toFixed(
              2
            )
          ),
      },

      count:
        totalVisits,

      data:
        visits.map(
          formatVisit
        ),
    });
  } catch (error) {
    console.error(
      "Error generating clinic report:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to generate clinic report.",
    });
  }
};


/* =====================================================
   GET ONE OPD VISIT
   Staff + Admin
   ===================================================== */

export const completeClinicVisit = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const visitId =
      parseCodeId(
        req.params.id,
        "OPD-"
      );

    if (!visitId) {
      res.status(400).json({
        success: false,
        message:
          "A valid OPD No. is required.",
      });

      return;
    }


    const existingVisit =
      await prisma.clinicVisit.findUnique({
        where: {
          id:
            visitId,
        },

        include:
          visitInclude,
      });


    if (!existingVisit) {
      res.status(404).json({
        success: false,
        message:
          "OPD visit not found.",
      });

      return;
    }


    const currentStatus =
      String(
        existingVisit.status ||
          ""
      ).toLowerCase();

    /*
     * A visit may transition to COMPLETED only
     * from OPEN.
     *
     * This prevents cancelled or voided OPDs from
     * being resurrected into finalized revenue.
     */
    if (
      currentStatus !==
      "open"
    ) {
      const lifecycleMessage =
        currentStatus ===
        "completed"
          ? "has already been completed"
          : currentStatus ===
            "cancelled"
            ? "has been cancelled and cannot be completed"
            : currentStatus ===
              "voided"
              ? "has been voided and cannot be completed"
              : `has status "${currentStatus || "unknown"}" and cannot be completed`;

      res.status(409).json({
        success: false,

        message:
          `${formatOpdNumber(
            visitId
          )} ${lifecycleMessage}.`,
      });

      return;
    }


    const {
      consultationFee,

      additionalCharge,

      additionalChargeNote,
    } = req.body;


    const parsedConsultationFee =
      consultationFee !==
        undefined &&
      consultationFee !==
        null &&
      String(
        consultationFee
      ).trim() !== ""
        ? Number(
            consultationFee
          )
        : Number(
            existingVisit
              .consultationFee ||
              0
          );


    const parsedAdditionalCharge =
      additionalCharge !==
        undefined &&
      additionalCharge !==
        null &&
      String(
        additionalCharge
      ).trim() !== ""
        ? Number(
            additionalCharge
          )
        : 0;


    if (
      !Number.isFinite(
        parsedConsultationFee
      ) ||
      parsedConsultationFee < 0
    ) {
      res.status(400).json({
        success: false,
        message:
          "Consultation fee must be zero or a positive number.",
      });

      return;
    }


    if (
      !Number.isFinite(
        parsedAdditionalCharge
      ) ||
      parsedAdditionalCharge < 0
    ) {
      res.status(400).json({
        success: false,
        message:
          "Additional charge must be zero or a positive number.",
      });

      return;
    }


    const note =
      String(
        additionalChargeNote ??
          ""
      ).trim() ||
      null;


    const totalCharge =
      Number(
        (
          parsedConsultationFee +
          parsedAdditionalCharge
        ).toFixed(2)
      );


    // Compare-and-set the lifecycle state in the database. Two concurrent
    // requests may both have observed OPEN above, but only one is allowed to
    // transition the row.
    const completion =
      await prisma.clinicVisit.updateMany({
        where: {
          id: visitId,
          status: "open",
        },

        data: {
          consultationFee:
            parsedConsultationFee,

          additionalCharge:
            parsedAdditionalCharge,

          additionalChargeNote:
            note,

          totalCharge,

          /*
           * Temporary compatibility with the
           * original Clinic UI.
           */
          chargeNote:
            note,

          status:
            "completed",

          completedAt:
            new Date(),
        },
      });

    if (completion.count !== 1) {
      res.status(409).json({
        success: false,
        message:
          `${formatOpdNumber(visitId)} changed state while this request was being processed and cannot be completed.`,
      });
      return;
    }

    const visit =
      await prisma.clinicVisit.findUnique({
        where: { id: visitId },
        include: visitInclude,
      });

    if (!visit) {
      res.status(409).json({
        success: false,
        message: "OPD visit changed unexpectedly after completion.",
      });
      return;
    }


    res.status(200).json({
      success: true,

      message:
        `${formatOpdNumber(
          visit.id
        )} completed successfully.`,

      data:
        formatVisit(
          visit
        ),
    });
  } catch (error) {
    console.error(
      "Error completing OPD visit:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to complete OPD visit.",
    });
  }
};


export const getClinicVisitById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const visitId =
      parseCodeId(
        req.params.id,
        "OPD-"
      );

    if (!visitId) {
      res.status(400).json({
        success: false,
        message:
          "Invalid OPD number. Use OPD-000001 or a valid numeric ID.",
      });

      return;
    }


    const visit =
      await prisma.clinicVisit.findUnique({
        where: {
          id:
            visitId,
        },

        include:
          visitInclude,
      });


    if (!visit) {
      res.status(404).json({
        success: false,
        message:
          "OPD visit not found.",
      });

      return;
    }


    res.status(200).json({
      success: true,
      data:
        formatVisit(
          visit
        ),
    });
  } catch (error) {
    console.error(
      "Error fetching OPD visit:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to retrieve OPD visit.",
    });
  }
};


/* =====================================================
   CREATE OPD VISIT
   Staff + Admin

   totalCharge:
   One final charge field.
   Can represent consultation only OR
   consultation + procedure/etc.

   chargeNote:
   Optional explanation.
   ===================================================== */

export const createClinicVisit = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authenticatedRequest =
      req as RequestWithUser;

    const createdById =
      authenticatedRequest
        .user?.id;

    if (!createdById) {
      res.status(401).json({
        success: false,
        message:
          "Authenticated user information is missing.",
      });

      return;
    }


    const {
      patientId:
        patientRaw,

      doctorId:
        doctorRaw,

      visitDateTime,

      ageAtVisit,

      consultationFee,

      /*
       * Accepted temporarily so the existing
       * frontend keeps working until its next patch.
       */
      totalCharge:
        legacyTotalCharge,
    } = req.body;


    const patientId =
      parseCodeId(
        patientRaw,
        "CL-"
      );

    if (!patientId) {
      res.status(400).json({
        success: false,
        message:
          "A valid patient Clinic No. is required.",
      });

      return;
    }


    const doctorId =
      parseCodeId(
        doctorRaw,
        "DOC-"
      );

    if (!doctorId) {
      res.status(400).json({
        success: false,
        message:
          "A valid doctor is required.",
      });

      return;
    }


    const [
      patient,
      doctor,
    ] =
      await Promise.all([
        prisma.clinicPatient.findUnique({
          where: {
            id:
              patientId,
          },
        }),

        prisma.doctor.findUnique({
          where: {
            id:
              doctorId,
          },
        }),
      ]);


    if (!patient) {
      res.status(404).json({
        success: false,
        message:
          "Clinic patient not found.",
      });

      return;
    }


    if (!doctor) {
      res.status(404).json({
        success: false,
        message:
          "Doctor not found.",
      });

      return;
    }


    if (
      doctor.status !==
      "active"
    ) {
      res.status(400).json({
        success: false,
        message:
          "This doctor is inactive and cannot receive a new OPD visit.",
      });

      return;
    }


    let parsedVisitDate =
      new Date();

    if (
      visitDateTime !==
        undefined &&
      visitDateTime !==
        null &&
      String(
        visitDateTime
      ).trim() !== ""
    ) {
      parsedVisitDate =
        new Date(
          String(
            visitDateTime
          )
        );

      if (
        Number.isNaN(
          parsedVisitDate.getTime()
        )
      ) {
        res.status(400).json({
          success: false,
          message:
            "Invalid visit date/time.",
        });

        return;
      }
    }


    let parsedAge:
      | number
      | null =
      patient.ageYears;

    if (
      ageAtVisit !==
        undefined &&
      ageAtVisit !==
        null &&
      String(
        ageAtVisit
      ).trim() !== ""
    ) {
      parsedAge =
        Number(
          ageAtVisit
        );

      if (
        !Number.isInteger(
          parsedAge
        ) ||
        parsedAge < 0 ||
        parsedAge > 130
      ) {
        res.status(400).json({
          success: false,
          message:
            "Age at visit must be a whole number between 0 and 130.",
        });

        return;
      }
    }


    const explicitConsultationFee =
      consultationFee !==
        undefined &&
      consultationFee !==
        null &&
      String(
        consultationFee
      ).trim() !== "";


    const legacyExplicitFee =
      legacyTotalCharge !==
        undefined &&
      legacyTotalCharge !==
        null &&
      String(
        legacyTotalCharge
      ).trim() !== "";


    const parsedConsultationFee =
      explicitConsultationFee
        ? Number(
            consultationFee
          )
        : legacyExplicitFee
          ? Number(
              legacyTotalCharge
            )
          : Number(
              doctor
                .defaultConsultationFee ||
                0
            );


    if (
      !Number.isFinite(
        parsedConsultationFee
      ) ||
      parsedConsultationFee < 0
    ) {
      res.status(400).json({
        success: false,
        message:
          "Consultation fee must be zero or a positive number.",
      });

      return;
    }


    const visit =
      await prisma.clinicVisit.create({
        data: {
          patientId,

          doctorId,

          createdById,

          visitDateTime:
            parsedVisitDate,

          ageAtVisit:
            parsedAge,

          consultationFee:
            parsedConsultationFee,

          additionalCharge:
            0,

          additionalChargeNote:
            null,

          totalCharge:
            parsedConsultationFee,

          chargeNote:
            null,

          status:
            "open",

          completedAt:
            null,
        },

        include:
          visitInclude,
      });


    res.status(201).json({
      success: true,

      message:
        `${formatOpdNumber(
          visit.id
        )} registered successfully and is ready for consultation.`,

      data:
        formatVisit(
          visit
        ),
    });
  } catch (error) {
    console.error(
      "Error registering OPD visit:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to register OPD visit.",
    });
  }
};

/* =====================================================
   DELETE / CANCEL OPD VISIT
   Admin only
   ===================================================== */
export const deleteClinicVisit = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const visitId =
      parseCodeId(
        req.params.id,
        "OPD-"
      );

    if (!visitId) {
      res.status(400).json({
        success: false,
        message:
          "Invalid OPD ticket number. Use format OPD-000001 or numeric ID.",
      });

      return;
    }


    const existingVisit =
      await prisma.clinicVisit.findUnique({
        where: {
          id:
            visitId,
        },

        include:
          visitInclude,
      });


    if (!existingVisit) {
      res.status(404).json({
        success: false,
        message:
          "OPD visit not found.",
      });

      return;
    }


    const currentStatus =
      String(
        existingVisit.status ||
          ""
      ).toLowerCase();


    if (
      currentStatus ===
      "completed"
    ) {
      res.status(409).json({
        success: false,

        message:
          `${formatOpdNumber(
            visitId
          )} is already completed. Completed OPDs cannot be cancelled or deleted. Use Void with a reason so the historical consultation is preserved.`,
      });

      return;
    }


    if (
      currentStatus !==
      "open"
    ) {
      res.status(409).json({
        success: false,

        message:
          `${formatOpdNumber(
            visitId
          )} is already ${currentStatus || "closed"} and cannot be cancelled again.`,
      });

      return;
    }


    const reason =
      String(
        req.body?.reason ||
          ""
      ).trim();


    const cancellation =
      await prisma.clinicVisit.updateMany({
        where: {
          id: visitId,
          status: "open",
        },

        data: {
          status:
            "cancelled",

          cancelledAt:
            new Date(),

          cancelReason:
            reason ||
            "Cancelled by administrator",
        },
      });

    if (cancellation.count !== 1) {
      res.status(409).json({
        success: false,
        message:
          `${formatOpdNumber(visitId)} changed state while this request was being processed and cannot be cancelled.`,
      });
      return;
    }

    const visit =
      await prisma.clinicVisit.findUnique({
        where: { id: visitId },
        include: visitInclude,
      });

    if (!visit) {
      res.status(409).json({
        success: false,
        message: "OPD visit changed unexpectedly after cancellation.",
      });
      return;
    }


    res.status(200).json({
      success: true,

      message:
        `${formatOpdNumber(
          visit.id
        )} for ${visit.patient.name} has been cancelled. The OPD history has been preserved.`,

      data:
        formatVisit(
          visit
        ),
    });
  } catch (error) {
    console.error(
      "Error cancelling OPD visit:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to cancel OPD visit.",
    });
  }
};


export const voidClinicVisit = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const visitId =
      parseCodeId(
        req.params.id,
        "OPD-"
      );

    if (!visitId) {
      res.status(400).json({
        success: false,
        message:
          "Invalid OPD ticket number.",
      });

      return;
    }


    const reason =
      String(
        req.body?.reason ||
          ""
      ).trim();


    if (
      reason.length < 3
    ) {
      res.status(400).json({
        success: false,

        message:
          "A reason is required to void a completed OPD.",
      });

      return;
    }


    const existingVisit =
      await prisma.clinicVisit.findUnique({
        where: {
          id:
            visitId,
        },

        include:
          visitInclude,
      });


    if (!existingVisit) {
      res.status(404).json({
        success: false,
        message:
          "OPD visit not found.",
      });

      return;
    }


    const currentStatus =
      String(
        existingVisit.status ||
          ""
      ).toLowerCase();


    if (
      currentStatus ===
      "open"
    ) {
      res.status(409).json({
        success: false,

        message:
          `${formatOpdNumber(
            visitId
          )} is still OPEN. Cancel the open OPD instead of voiding it.`,
      });

      return;
    }


    if (
      currentStatus !==
      "completed"
    ) {
      res.status(409).json({
        success: false,

        message:
          `${formatOpdNumber(
            visitId
          )} is already ${currentStatus || "closed"} and cannot be voided.`,
      });

      return;
    }


    /*
     * Preserve consultationFee, additionalCharge,
     * totalCharge and completedAt.
     *
     * Only lifecycle status changes. Reports already
     * count COMPLETED visits as finalized revenue, so
     * changing status to VOIDED removes this OPD from
     * finalized clinic revenue without deleting history.
     */
    const voidResult =
      await prisma.clinicVisit.updateMany({
        where: {
          id: visitId,
          status: "completed",
        },

        data: {
          status:
            "voided",

          voidedAt:
            new Date(),

          voidReason:
            reason,
        },
      });

    if (voidResult.count !== 1) {
      res.status(409).json({
        success: false,
        message:
          `${formatOpdNumber(visitId)} changed state while this request was being processed and cannot be voided.`,
      });
      return;
    }

    const visit =
      await prisma.clinicVisit.findUnique({
        where: { id: visitId },
        include: visitInclude,
      });

    if (!visit) {
      res.status(409).json({
        success: false,
        message: "OPD visit changed unexpectedly after voiding.",
      });
      return;
    }


    res.status(200).json({
      success: true,

      message:
        `${formatOpdNumber(
          visit.id
        )} has been voided. Historical consultation and charge information were preserved.`,

      data:
        formatVisit(
          visit
        ),
    });
  } catch (error) {
    console.error(
      "Error voiding OPD visit:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to void OPD visit.",
    });
  }
};

