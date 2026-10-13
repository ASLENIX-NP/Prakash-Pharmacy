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
    await fetch(
      url,
      options
    );

  let body: any = null;

  try {
    body =
      await response.json();
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
    " Distributor + Barcode + Notes Smoke Test"
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
    "Could not determine smoke-test server port."
  );


  const baseUrl =
    `http://127.0.0.1:${address.port}/api`;


  const stamp =
    Date.now();


  const distributorName =
    `Inventory Smoke Distributor ${stamp}`;


  const brand =
    `Distributor Smoke Medicine ${stamp}`;


  const batch =
    `DIST-${stamp}`;


  const firstBarcode =
    `BARCODE-${stamp}-A`;


  const updatedBarcode =
    `BARCODE-${stamp}-B`;


  const firstNotes =
    `Initial inventory notes ${stamp}`;


  const updatedNotes =
    `Updated inventory notes ${stamp}`;


  let distributorId:
    number | null = null;


  let medicineId:
    number | null = null;


  try {

    // ========================================================
    // 1/8 ADMIN LOGIN
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
      `Admin login failed: HTTP ${login.response.status}`
    );


    const token =
      login.body?.token ??
      login.body?.data?.token;


    assert(
      typeof token === "string" &&
      token.length > 0,
      "Admin login returned no JWT."
    );


    const headers = {
      "Content-Type":
        "application/json",

      Authorization:
        `Bearer ${token}`,
    };


    console.log(
      "PASS 1/8  Admin JWT login"
    );


    // ========================================================
    // 2/8 CREATE TEMPORARY DISTRIBUTOR IN POSTGRESQL
    // ========================================================

    const distributor =
      await prisma.distributor.create({
        data: {
          name:
            distributorName,

          phone:
            "9800000000",

          address:
            "Smoke Test Address",
        },
      });


    distributorId =
      distributor.id;


    assert(
      distributorId > 0,
      "Temporary distributor was not created."
    );


    console.log(
      `PASS 2/8  Temporary distributor created (ID ${distributorId})`
    );


    // ========================================================
    // FIND EXISTING GENERIC / CATEGORY / RACK
    // ========================================================

    const generic =
      await prisma.generic.findFirst({
        orderBy: {
          id:
            "asc",
        },
      });


    const category =
      await prisma.category.findFirst({
        orderBy: {
          id:
            "asc",
        },
      });


    const rack =
      await prisma.rack.findFirst({
        orderBy: {
          id:
            "asc",
        },
      });


    assert(
      generic,
      "No Generic exists in seeded database."
    );


    assert(
      category,
      "No Category exists in seeded database."
    );


    assert(
      rack,
      "No Rack exists in seeded database."
    );


    // ========================================================
    // 3/8 CREATE MEDICINE THROUGH REAL INVENTORY API
    // ========================================================

    const create =
      await requestJson(
        `${baseUrl}/inventory`,
        {
          method:
            "POST",

          headers,

          body:
            JSON.stringify({
              medicineBrand:
                brand,

              batchNumber:
                batch,

              expiryDate:
                "2028-12-31",

              genericId:
                generic.id,

              categoryId:
                category.id,

              rackId:
                rack.id,

              unitPerPack:
                10,

              packInStock:
                15,

              unitInStock:
                4,

              packAlertLevel:
                5,

              costPrice:
                100,

              sellingPrice:
                125,

              hasvat:
                false,

              supplierId:
                String(
                  distributorId
                ),

              barcode:
                firstBarcode,

              notes:
                firstNotes,
            }),
        }
      );


    assert(
      create.response.status === 201,
      `Create medicine failed: HTTP ${create.response.status}: ${JSON.stringify(create.body)}`
    );


    const created =
      create.body?.data ??
      create.body?.medicine ??
      create.body;


    const createdCode =
      String(
        created?.id ??
        created?.medicineCode ??
        ""
      );


    const idMatch =
      createdCode.match(
        /(\d+)$/
      );


    assert(
      idMatch?.[1],
      `Could not determine created medicine ID from '${createdCode}'`
    );


    medicineId =
      Number.parseInt(
        idMatch[1],
        10
      );


    assert(
      created?.supplierName ===
      distributorName,
      `Expected supplierName '${distributorName}', got '${created?.supplierName}'`
    );


    assert(
      created?.barcode ===
      firstBarcode,
      "Create response did not return barcode."
    );


    assert(
      created?.notes ===
      firstNotes,
      "Create response did not return notes."
    );


    console.log(
      `PASS 3/8  Medicine created with distributor + barcode + notes (${createdCode})`
    );


    // ========================================================
    // 4/8 VERIFY POSTGRESQL RELATION DIRECTLY
    // ========================================================

    const dbMedicine =
      await prisma.inventory.findUnique({
        where: {
          id:
            medicineId,
        },

        include: {
          distributor:
            true,
        },
      });


    assert(
      dbMedicine,
      "Created medicine not found in PostgreSQL."
    );


    assert(
      dbMedicine.distributorId ===
      distributorId,
      "Inventory.distributorId was not persisted correctly."
    );


    assert(
      dbMedicine.distributor?.name ===
      distributorName,
      "Inventory -> Distributor relationship is incorrect."
    );


    assert(
      dbMedicine.barcode ===
      firstBarcode,
      "Barcode was not persisted in PostgreSQL."
    );


    assert(
      dbMedicine.notes ===
      firstNotes,
      "Notes were not persisted in PostgreSQL."
    );


    console.log(
      "PASS 4/8  PostgreSQL relation and optional fields persisted"
    );


    // ========================================================
    // 5/8 GET MEDICINE THROUGH API
    // ========================================================

    const getOne =
      await requestJson(
        `${baseUrl}/inventory/${createdCode}`,
        {
          headers,
        }
      );


    assert(
      getOne.response.status === 200,
      `GET medicine failed: HTTP ${getOne.response.status}`
    );


    const fetched =
      getOne.body?.data ??
      getOne.body?.medicine ??
      getOne.body;


    assert(
      fetched?.supplierName ===
      distributorName,
      `GET response supplierName mismatch: '${fetched?.supplierName}'`
    );


    assert(
      fetched?.barcode ===
      firstBarcode,
      "GET response barcode mismatch."
    );


    assert(
      fetched?.notes ===
      firstNotes,
      "GET response notes mismatch."
    );


    console.log(
      "PASS 5/8  GET medicine returns supplier + barcode + notes"
    );


    // ========================================================
    // 6/8 UPDATE BARCODE + NOTES
    // ========================================================

    const update =
      await requestJson(
        `${baseUrl}/inventory/${createdCode}`,
        {
          method:
            "PUT",

          headers,

          body:
            JSON.stringify({
              barcode:
                updatedBarcode,

              notes:
                updatedNotes,

              supplierId:
                String(
                  distributorId
                ),
            }),
        }
      );


    assert(
      update.response.status === 200,
      `Update medicine failed: HTTP ${update.response.status}: ${JSON.stringify(update.body)}`
    );


    const updated =
      update.body?.data ??
      update.body?.medicine ??
      update.body;


    assert(
      updated?.barcode ===
      updatedBarcode,
      "Updated barcode was not returned."
    );


    assert(
      updated?.notes ===
      updatedNotes,
      "Updated notes were not returned."
    );


    assert(
      updated?.supplierName ===
      distributorName,
      "Distributor relation was lost during update."
    );


    console.log(
      "PASS 6/8  Barcode + notes update works"
    );


    // ========================================================
    // 7/8 VERIFY UPDATED VALUES DIRECTLY IN DATABASE
    // ========================================================

    const updatedDb =
      await prisma.inventory.findUnique({
        where: {
          id:
            medicineId,
        },

        include: {
          distributor:
            true,
        },
      });


    assert(
      updatedDb?.barcode ===
      updatedBarcode,
      "Updated barcode not persisted in database."
    );


    assert(
      updatedDb?.notes ===
      updatedNotes,
      "Updated notes not persisted in database."
    );


    assert(
      updatedDb?.distributor?.name ===
      distributorName,
      "Updated database record lost Distributor relation."
    );


    console.log(
      "PASS 7/8  Updated values verified in PostgreSQL"
    );


    // ========================================================
    // 8/8 VERIFY INVENTORY LIST DTO
    // ========================================================

    const list =
      await requestJson(
        `${baseUrl}/inventory?limit=all`,
        {
          headers,
        }
      );


    assert(
      list.response.status === 200,
      `Inventory list failed: HTTP ${list.response.status}`
    );


    const listData =
      Array.isArray(
        list.body?.data
      )
        ? list.body.data
        : (
            list.body?.data?.items ??
            list.body?.items ??
            []
          );


    const listMedicine =
      listData.find(
        (row: any) =>
          String(
            row.id ??
            row.medicineCode
          ) ===
          createdCode
      );


    assert(
      listMedicine,
      "Created medicine was not found in inventory list."
    );


    assert(
      listMedicine.supplierName ===
      distributorName,
      "Inventory list supplierName missing."
    );


    assert(
      listMedicine.barcode ===
      updatedBarcode,
      "Inventory list barcode missing."
    );


    assert(
      listMedicine.notes ===
      updatedNotes,
      "Inventory list notes missing."
    );


    console.log(
      "PASS 8/8  Inventory list DTO includes distributor + barcode + notes"
    );


    console.log("");
    console.log(
      "=============================================="
    );
    console.log(
      " ALL DISTRIBUTOR / BARCODE / NOTES TESTS PASSED"
    );
    console.log(
      "=============================================="
    );

  } finally {

    // ========================================================
    // CLEANUP TEST DATA
    // ========================================================

    if (
      medicineId !== null
    ) {

      await prisma.stockAdjustmentLog.deleteMany({
        where: {
          medicineId,
        },
      });


      await prisma.inventory.deleteMany({
        where: {
          id:
            medicineId,
        },
      });


      console.log("");
      console.log(
        "Temporary medicine removed."
      );
    }


    if (
      distributorId !== null
    ) {

      await prisma.distributor.deleteMany({
        where: {
          id:
            distributorId,
        },
      });


      console.log(
        "Temporary distributor removed."
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
        "DISTRIBUTOR / BARCODE / NOTES SMOKE TEST FAILED:"
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
