-- El correlativo (sequenceNumber) solo debe ser único entre despachos EMITIDOS.
-- Los DRAFT se guardan con sequenceNumber=0 (el número real se asigna al postear),
-- por lo que múltiples borradores del mismo tipo en una org chocaban contra el
-- unique plano (P2002). Esto rompía la sincronización offline de la app móvil, que
-- crea las ventas como borrador: la 2da venta no podía subir.
--
-- Se reemplaza el unique plano por uno PARCIAL que excluye los DRAFT.
DROP INDEX "dispatches_organizationId_dispatchType_sequenceNumber_key";

CREATE UNIQUE INDEX "dispatches_organizationId_dispatchType_sequenceNumber_key"
    ON "dispatches" ("organizationId", "dispatchType", "sequenceNumber")
    WHERE "status" <> 'DRAFT';
