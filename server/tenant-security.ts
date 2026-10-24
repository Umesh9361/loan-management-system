import type { RequestHandler } from "express";

const referenceFields: Record<string, string> = {
  loanId: "loan", groupId: "group", borrowerId: "borrower",
  partyId: "party", fromPartyId: "party", toPartyId: "party",
};
const financialPaths = new Set([
  "loans", "loan-closures", "cash-transactions", "cash-transactions-with-journal", "borrowers",
  "groups", "parties", "transactions",
]);

export function tenantReferenceGuard(
  belongsToTenant: (type: string, id: string, tenantId: string) => Promise<boolean>,
): RequestHandler {
  return async (req, res, next) => {
    if (!["POST", "PUT", "PATCH"].includes(req.method) ||
        !financialPaths.has(req.path.split("/")[1])) return next();
    const tenantId = req.session.tenantId;
    if (!tenantId) { res.sendStatus(401); return; }
    if (req.body?.tenantId !== undefined && req.body.tenantId !== tenantId) {
      res.status(403).json({ message: "Tenant cannot be changed" }); return;
    }
    try {
      for (const [field, type] of Object.entries(referenceFields)) {
        const value = req.body?.[field];
        if (value === undefined || value === null || value === "") continue;
        if (typeof value !== "string" || !await belongsToTenant(type, value, tenantId)) {
          res.status(400).json({ message: `Invalid ${field}` }); return;
        }
      }
      next();
    } catch {
      res.status(503).json({ message: "Unable to validate references" });
    }
  };
}

export function loanOwnershipGuard(
  getLoan: (id: string, tenantId: string) => Promise<unknown>,
): RequestHandler {
  return async (req, res, next) => {
    const tenantId = req.session?.tenantId;
    if (!tenantId || !req.session?.userId) { res.sendStatus(401); return; }
    try {
      if (!await getLoan(req.params.loanId, tenantId)) { res.sendStatus(404); return; }
      next();
    } catch {
      res.sendStatus(503);
    }
  };
}
