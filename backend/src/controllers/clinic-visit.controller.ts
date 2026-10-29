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
) => ({
  id:
    formatOpdNumber(visit.id),

  opdNumber:
    formatOpdNumber(visit.id),

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
      visit.patient.phone ?? "",

    gender:
      visit.patient.gender ?? "",

    ageYears:
      visit.patient.ageYears ?? null,

    address:
      visit.patient.address ?? "",
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
      visit.doctor.speciality ?? "",

    qualification:
      visit.doctor.qualification ?? "",

    nmcNumber:
      visit.doctor.nmcNumber ?? "",

    defaultConsultationFee:
      Number(
        visit.doctor
          .defaultConsultationFee || 0
      ),

    status:
      visit.doctor.status,
  },

  visitDateTime:
    visit.visitDateTime.toISOString(),

  ageAtVisit:
    visit.ageAtVisit ?? null,

  totalCharge:
    Number(
      visit.totalCharge || 0
    ),

  chargeNote:
    visit.chargeNote ?? "",

  createdBy:
    visit.createdBy
      ? {
          id:
            visit.createdBy.id,

          username:
            visit.createdBy.username,

          name:
            `${visit.createdBy.firstName} ${visit.createdBy.lastName}`.trim(),
        }
      : null,

  createdAt:
    visit.createdAt?.toISOString?.() ??
    visit.createdAt,

  updatedAt:
    visit.updatedAt?.toISOString?.() ??
    visit.updatedAt,
});


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


    const totalRevenue =
      visits.reduce(
        (
          sum,
          visit
        ) =>
          sum +
          Number(
            visit.totalCharge || 0
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


    const averageRevenuePerVisit =
      totalVisits > 0
        ? totalRevenue /
          totalVisits
        : 0;


    res.status(200).json({
      success: true,

      summary: {
        totalVisits,

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

      totalCharge,

      chargeNote,
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


    const hasExplicitCharge =
      totalCharge !==
        undefined &&
      totalCharge !==
        null &&
      String(
        totalCharge
      ).trim() !== "";


    const parsedCharge =
      hasExplicitCharge
        ? Number(
            totalCharge
          )
        : Number(
            doctor.defaultConsultationFee ||
              0
          );


    if (
      !Number.isFinite(
        parsedCharge
      ) ||
      parsedCharge < 0
    ) {
      res.status(400).json({
        success: false,
        message:
          "Total charge must be zero or a positive number.",
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

          totalCharge:
            parsedCharge,

          chargeNote:
            String(
              chargeNote ??
                ""
            ).trim() ||
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
        )} recorded successfully.`,

      data:
        formatVisit(
          visit
        ),
    });
  } catch (error) {
    console.error(
      "Error creating OPD visit:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to record OPD visit.",
    });
  }
};
