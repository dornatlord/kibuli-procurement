import { Router } from "express";
import { db } from "../db/index.js";
import {
  contracts,
  contractAmendments,
  suppliers,
  procurementRequests,
} from "../db/schema.js";
import { eq, desc, sql } from "drizzle-orm";
import { requirePermission } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

async function nextContractNumber(year: number): Promise<string> {
  const [row] = await db
    .select({
      maxSeq: sql<number>`COALESCE(MAX(CAST(SPLIT_PART(contract_number, '/', 3) AS INTEGER)), 0)`,
    })
    .from(contracts)
    .where(sql`contract_number LIKE ${"CTR/" + year + "/%"}`);
  const next = (row?.maxSeq ?? 0) + 1;
  return `CTR/${year}/${String(next).padStart(4, "0")}`;
}

router.get("/", requirePermission("contracts.view"), async (_req, res) => {
  const rows = await db
    .select({
      id: contracts.id,
      contractNumber: contracts.contractNumber,
      title: contracts.title,
      contractValue: contracts.contractValue,
      status: contracts.status,
      startDate: contracts.startDate,
      endDate: contracts.endDate,
      signedDate: contracts.signedDate,
      supplierName: suppliers.name,
      referenceNumber: procurementRequests.referenceNumber,
    })
    .from(contracts)
    .leftJoin(suppliers, eq(contracts.supplierId, suppliers.id))
    .leftJoin(procurementRequests, eq(contracts.procurementRequestId, procurementRequests.id))
    .orderBy(desc(contracts.createdAt));
  res.json(rows);
});

router.get("/:id", requirePermission("contracts.view"), async (req, res) => {
  const id = Number(req.params.id);
  const [contract] = await db
    .select({
      id: contracts.id,
      contractNumber: contracts.contractNumber,
      title: contracts.title,
      contractValue: contracts.contractValue,
      status: contracts.status,
      startDate: contracts.startDate,
      endDate: contracts.endDate,
      signedDate: contracts.signedDate,
      documentReference: contracts.documentReference,
      supplierId: contracts.supplierId,
      supplierName: suppliers.name,
      procurementRequestId: contracts.procurementRequestId,
      referenceNumber: procurementRequests.referenceNumber,
    })
    .from(contracts)
    .leftJoin(suppliers, eq(contracts.supplierId, suppliers.id))
    .leftJoin(procurementRequests, eq(contracts.procurementRequestId, procurementRequests.id))
    .where(eq(contracts.id, id));

  if (!contract) {
    res.status(404).json({ error: "Contract not found" });
    return;
  }

  const amendments = await db
    .select()
    .from(contractAmendments)
    .where(eq(contractAmendments.contractId, id))
    .orderBy(desc(contractAmendments.amendmentDate));

  const currentValue = amendments[0]?.revisedContractValue ?? contract.contractValue;

  res.json({ ...contract, amendments, currentValue });
});

router.post("/", requirePermission("contracts.manage"), async (req, res) => {
  const {
    supplierId,
    procurementRequestId,
    purchaseOrderId,
    title,
    contractValue,
    startDate,
    endDate,
    signedDate,
    documentReference,
  } = req.body;

  if (!supplierId || !title) {
    res.status(400).json({ error: "Supplier and title are required" });
    return;
  }

  const year = new Date().getFullYear();
  const contractNumber = await nextContractNumber(year);

  const [contract] = await db
    .insert(contracts)
    .values({
      contractNumber,
      supplierId,
      procurementRequestId: procurementRequestId || null,
      purchaseOrderId: purchaseOrderId || null,
      title,
      contractValue: contractValue ? String(contractValue) : null,
      startDate: startDate || null,
      endDate: endDate || null,
      signedDate: signedDate || null,
      documentReference: documentReference || null,
      createdBy: req.session.userId!,
    })
    .returning();

  await logAudit(req.session.userId!, "contract.created", "contract", contract.id, {
    contractNumber,
    supplierId,
  });

  res.status(201).json(contract);
});

router.patch("/:id/status", requirePermission("contracts.manage"), async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;

  if (!["draft", "active", "completed", "terminated"].includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  const [updated] = await db
    .update(contracts)
    .set({ status, updatedAt: new Date() })
    .where(eq(contracts.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Contract not found" });
    return;
  }

  await logAudit(req.session.userId!, "contract.status_changed", "contract", id, { status });
  res.json(updated);
});

router.post("/:id/amendments", requirePermission("contracts.manage"), async (req, res) => {
  const contractId = Number(req.params.id);
  const { amendmentDate, description, valueChange, revisedContractValue } = req.body;

  if (!amendmentDate || !description) {
    res.status(400).json({ error: "Amendment date and description are required" });
    return;
  }

  const [amendment] = await db
    .insert(contractAmendments)
    .values({
      contractId,
      amendmentDate,
      description,
      valueChange: valueChange ? String(valueChange) : null,
      revisedContractValue: revisedContractValue ? String(revisedContractValue) : null,
      createdBy: req.session.userId!,
    })
    .returning();

  await db
    .update(contracts)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(contracts.id, contractId));

  await logAudit(req.session.userId!, "contract.amended", "contract", contractId, {
    description,
  });

  res.status(201).json(amendment);
});

export default router;
