-- Remove duplicate accruals for same deposit/day
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "depositId", "date"
      ORDER BY "createdAt" ASC
    ) AS rn
  FROM "Accrual"
)
DELETE FROM "Accrual"
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Enforce one accrual per deposit per day
CREATE UNIQUE INDEX IF NOT EXISTS "Accrual_depositId_date_key"
ON "Accrual" ("depositId", "date");
