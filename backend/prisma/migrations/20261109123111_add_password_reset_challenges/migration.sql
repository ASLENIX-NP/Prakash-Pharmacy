CREATE TABLE "password_reset_challenges_tbl" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_challenges_tbl_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_challenges_tbl_user_id_key"
ON "password_reset_challenges_tbl"("user_id");

CREATE INDEX "password_reset_challenges_tbl_expires_at_idx"
ON "password_reset_challenges_tbl"("expires_at");

ALTER TABLE "password_reset_challenges_tbl"
ADD CONSTRAINT "password_reset_challenges_tbl_user_id_fkey"
FOREIGN KEY ("user_id")
REFERENCES "user_tbl"("id")
ON DELETE CASCADE ON UPDATE CASCADE;