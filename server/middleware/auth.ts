import type { Request, Response, NextFunction } from "express";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    tenantId?: string;
    role?: string;
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.userId || !req.session?.tenantId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
};