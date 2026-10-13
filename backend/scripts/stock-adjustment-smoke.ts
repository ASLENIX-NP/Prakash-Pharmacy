import app from "../src/app.js";
import { prisma } from "../src/db.js";


function assert(
  condition: unknown,
  message: string
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}


async function requestJson(
  url: string,
  options: RequestInit = {}
) {
  const response =
    await fetch(url, options);

  let body: any = null;

  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return {
    response,
    body,
  };
}


async function main() {

  console.log("");
  console.log(
    "=============================================="
  );
  console.log(
    " Stock Adjustment Backend Smoke Test"
  );
  console.log(
    "=============================================="
  );


  const server =
    app.listen(0);


  await new Promise<void>(
    (resolve) => {
      server.on(
        "listening",
        () => resolve()
      );
    }
  );


  const address =
    server.address();

  assert(
    address &&
    typeof address !== "string",
    "Could not determine local test server port."
  );


  const baseUrl =
    `http://127.0.0.1:${address.port}/api`;


  let medicineId:
    number | null = null;

  let medicineCode:
    string | null = null;

  let originalPacks =
    0;

  let originalLoose =
    0;

  const reasonPrefix =
    `STOCK-ADJUSTMENT-SMOKE-${Date.now()}`;


  try {

    // ========================================================
    // 1/6 LOGIN
    // ========================================================

    const login =
      await requestJson(
        `${baseUrl}/auth/login`,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              username:
                "admin",

              password:
                "admin123",
            }),
        }
      );


    assert(
      login.response.status === 200,
      `Login failed. HTTP ${login.response.status}: ${JSON.stringify(login.body)}`
    );


    const token =
      login.body?.token ??
      login.body?.data?.token;


    assert(
      typeof token === "string" &&
      token.length > 0,
      "Login succeeded but no JWT token was returned."
    );


    console.log(
      "PASS 1/6  Admin JWT login"
    );


    const authHeaders = {
      "Content-Type":
        "application/json",

      Authorization:
        `Bearer ${token}`,
    };


    // ========================================================
    // 2/6 LOAD INVENTORY
    // ========================================================

    const inventory =
      await requestJson(
        `${baseUrl}/inventory?limit=all`,
        {
          headers:
            authHeaders,
        }
      );


    assert(
      inventory.response.status === 200,
      `Inventory request failed. HTTP ${inventory.response.status}`
    );


    const possibleData =
      inventory.body?.data;


    const rows =
      Array.isArray(possibleData)
        ? possibleData
        : (
            possibleData?.items ??
            inventory.body?.items ??
            inventory.body?.inventory ??
            []
          );


    assert(
      Array.isArray(rows) &&
      rows.length > 0,
      "Inventory API returned no medicines."
    );


    const medicine =
      rows[0];


    medicineCode =
      String(
        medicine.id ??
        medicine.medicineCode ??
        ""
      );


    const idMatch =
      medicineCode.match(
        /(\d+)$/
      );


    assert(
      idMatch?.[1],
      `Could not parse medicine ID from ${medicineCode}`
    );


    medicineId =
      Number.parseInt(
        idMatch[1],
        10
      );


    originalPacks =
      Number(
        medicine.packInStock ??
        medicine.stockPacks ??
        0
      );


    originalLoose =
      Number(
        medicine.unitInStock ??
        medicine.stockLooseUnits ??
        0
      );


    console.log(
      `PASS 2/6  Inventory loaded (${medicineCode})`
    );


    // ========================================================
    // 3/6 ABSOLUTE PHYSICAL AUDIT
    // ========================================================

    const targetPacks =
      originalPacks + 2;

    const targetLoose =
      originalLoose + 1;


    const adjustment =
      await requestJson(
        `${baseUrl}/inventory/${medicineCode}/adjust`,
        {
          method:
            "POST",

          headers:
            authHeaders,

          body:
            JSON.stringify({
              type:
                "AUDIT",

              newPacks:
                targetPacks,

              newLooseUnits:
                targetLoose,

              reason:
                `${reasonPrefix}-AUDIT`,
            }),
        }
      );


    assert(
      adjustment.response.status === 200,
      `Adjustment failed. HTTP ${adjustment.response.status}: ${JSON.stringify(adjustment.body)}`
    );


    const adjustedInventory =
      adjustment.body?.data?.inventory;


    const adjustedPacks =
      Number(
        adjustedInventory?.packInStock ??
        adjustedInventory?.stockPacks
      );


    const adjustedLoose =
      Number(
        adjustedInventory?.unitInStock ??
        adjustedInventory?.stockLooseUnits
      );


    assert(
      adjustedPacks === targetPacks,
      `Expected ${targetPacks} packs, got ${adjustedPacks}`
    );


    assert(
      adjustedLoose === targetLoose,
      `Expected ${targetLoose} loose units, got ${adjustedLoose}`
    );


    const createdLog =
      adjustment.body?.data?.adjustment;


    assert(
      createdLog,
      "Stock changed but no adjustment log was returned."
    );


    assert(
      Number(createdLog.variancePacks) === 2,
      `Expected pack variance 2, got ${createdLog.variancePacks}`
    );


    assert(
      Number(createdLog.varianceLooseUnits) === 1,
      `Expected loose-unit variance 1, got ${createdLog.varianceLooseUnits}`
    );


    console.log(
      "PASS 3/6  Physical audit changed stock and created log"
    );


    // ========================================================
    // 4/6 VERIFY DATABASE LOG
    // ========================================================

    const dbLog =
      await prisma.stockAdjustmentLog.findFirst({
        where: {
          medicineId,

          reason:
            `${reasonPrefix}-AUDIT`,
        },
      });


    assert(
      dbLog,
      "Adjustment log was not persisted in PostgreSQL."
    );


    assert(
      dbLog.previousPacks === originalPacks,
      "Database log contains incorrect previous pack count."
    );


    assert(
      dbLog.newPacks === targetPacks,
      "Database log contains incorrect new pack count."
    );


    assert(
      dbLog.adjustmentType === "AUDIT",
      `Expected AUDIT type, got ${dbLog.adjustmentType}`
    );


    assert(
      dbLog.recordedBy.length > 0,
      "recordedBy was not captured."
    );


    console.log(
      "PASS 4/6  Adjustment persisted in PostgreSQL"
    );


    // ========================================================
    // 5/6 HISTORY ENDPOINT
    // ========================================================

    const history =
      await requestJson(
        `${baseUrl}/inventory/${medicineCode}/adjustments`,
        {
          headers:
            authHeaders,
        }
      );


    assert(
      history.response.status === 200,
      `History endpoint failed. HTTP ${history.response.status}`
    );


    const logs =
      history.body?.data;


    assert(
      Array.isArray(logs),
      "Adjustment history data is not an array."
    );


    assert(
      logs.some(
        (log: any) =>
          log.reason ===
          `${reasonPrefix}-AUDIT`
      ),
      "The audit entry was not returned by adjustment history."
    );


    console.log(
      "PASS 5/6  Adjustment history endpoint"
    );


    // ========================================================
    // 6/6 DELTA ADJUSTMENT
    // ========================================================

    const delta =
      await requestJson(
        `${baseUrl}/inventory/${medicineCode}/adjust`,
        {
          method:
            "POST",

          headers:
            authHeaders,

          body:
            JSON.stringify({
              type:
                "DAMAGE",

              packDelta:
                -1,

              looseUnitDelta:
                0,

              reason:
                `${reasonPrefix}-DAMAGE`,
            }),
        }
      );


    assert(
      delta.response.status === 200,
      `Delta adjustment failed. HTTP ${delta.response.status}: ${JSON.stringify(delta.body)}`
    );


    const afterDamage =
      delta.body?.data?.inventory;


    const packsAfterDamage =
      Number(
        afterDamage?.packInStock ??
        afterDamage?.stockPacks
      );


    assert(
      packsAfterDamage ===
      targetPacks - 1,
      `Expected ${targetPacks - 1} packs after damage adjustment, got ${packsAfterDamage}`
    );


    const damageLog =
      delta.body?.data?.adjustment;


    assert(
      Number(
        damageLog?.variancePacks
      ) === -1,
      "Damage adjustment did not record -1 pack variance."
    );


    console.log(
      "PASS 6/6  Damage/delta adjustment"
    );


    console.log("");
    console.log(
      "=============================================="
    );
    console.log(
      " ALL STOCK ADJUSTMENT TESTS PASSED"
    );
    console.log(
      "=============================================="
    );

  } finally {

    // ========================================================
    // RESTORE ORIGINAL DATABASE STATE
    // ========================================================

    if (
      medicineId !== null
    ) {

      await prisma.inventory.update({
        where: {
          id:
            medicineId,
        },

        data: {
          packInStock:
            originalPacks,

          unitInStock:
            originalLoose,
        },
      });


      await prisma.stockAdjustmentLog.deleteMany({
        where: {
          medicineId,

          reason: {
            startsWith:
              reasonPrefix,
          },
        },
      });


      console.log("");
      console.log(
        "Smoke-test stock restored."
      );

      console.log(
        "Smoke-test adjustment logs removed."
      );
    }


    await new Promise<void>(
      (resolve) => {
        server.close(
          () => resolve()
        );
      }
    );
  }
}


main()
  .catch(
    (error) => {

      console.error("");
      console.error(
        "STOCK ADJUSTMENT SMOKE TEST FAILED:"
      );

      console.error(
        error
      );

      process.exitCode =
        1;
    }
  )
  .finally(
    async () => {
      await prisma.$disconnect();
    }
  );
