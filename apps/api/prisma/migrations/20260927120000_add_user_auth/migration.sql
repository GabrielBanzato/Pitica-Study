-- Adiciona credenciais ao usuário
ALTER TABLE "User" ADD COLUMN "email" TEXT,
ADD COLUMN "password" TEXT;

-- Usuários antigos (sem login) recebem um e-mail interno e um "hash" inválido:
-- ficam preservados no banco, mas nunca conseguem autenticar.
UPDATE "User"
SET "email" = 'legacy-' || "id" || '@pitica.local',
    "password" = '!'
WHERE "email" IS NULL;

ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL,
ALTER COLUMN "password" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
