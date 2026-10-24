import type { Request, Response, RequestHandler } from "express";
import bcrypt from "bcrypt";

type SessionUser = { id: string; tenantId: string; role: string; isActive: boolean; password: string };
const publicPaths = new Set([
  "/auth/login", "/auth/logout", "/auth/forgot-password",
  "/admin/request-password-reset", "/health", "/ready",
]);

export function activeSessionGuard(
  getUser: (id: string) => Promise<SessionUser | undefined>,
  getCompany: (tenantId: string) => Promise<{ isActive: boolean | null } | undefined>,
): RequestHandler {
  return async (req, res, next) => {
    if (publicPaths.has(req.path)) return next();
    const { userId, tenantId, role, loginDate } = req.session;
    const today = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (!userId || !tenantId || !loginDate || loginDate !== today) {
      res.status(401).json({ message: "Session expired. Please login again." });
      return;
    }
    try {
      const user = await getUser(userId);
      if (!user || !user.isActive || user.tenantId !== tenantId || user.role !== role ||
          (role === "super_admin" && tenantId !== "SUPER_ADMIN")) {
        res.status(401).json({ message: "Session no longer valid. Please login again." });
        return;
      }
      if (role !== "super_admin") {
        const company = await getCompany(tenantId);
        if (!company || company.isActive === false) {
          res.status(403).json({ message: "Tenant inactive" });
          return;
        }
      }
      next();
    } catch {
      res.status(503).json({ message: "Authentication temporarily unavailable" });
    }
  };
}

export async function establishSession(req: Request, user: Pick<SessionUser, "id" | "tenantId" | "role">) {
  await new Promise<void>((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
  req.session.userId = user.id;
  req.session.tenantId = user.tenantId;
  req.session.role = user.role;
  req.session.loginDate = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await new Promise<void>((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
}

export async function endSession(req: Request, res: Response) {
  await new Promise<void>((resolve, reject) => req.session.destroy(err => err ? reject(err) : resolve()));
  res.clearCookie("connect.sid", { path: "/", httpOnly: true, sameSite: "lax" });
}

export function ownPasswordChange(
  getUser: (id: string) => Promise<SessionUser | undefined>,
  updatePassword: (userId: string, tenantId: string, password: string) => Promise<unknown>,
  invalidateSessions: (userId: string, currentSessionId: string) => Promise<unknown>,
): RequestHandler {
  return async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (typeof currentPassword !== "string" || typeof newPassword !== "string" ||
        !currentPassword || newPassword.length < 6 ||
        Buffer.byteLength(newPassword, "utf8") > 72 || Buffer.byteLength(currentPassword, "utf8") > 72) {
      res.status(400).json({ message: "Current password required; new password must be 6–72 UTF-8 bytes" });
      return;
    }
    try {
      const user = req.session.userId ? await getUser(req.session.userId) : undefined;
      if (!user || !user.isActive || user.tenantId !== req.session.tenantId) {
        res.status(401).json({ message: "Not authenticated" });
        return;
      }
      if (!await bcrypt.compare(currentPassword, user.password)) {
        res.status(400).json({ message: "Current password is incorrect" });
        return;
      }
      await updatePassword(user.id, user.tenantId, newPassword);
      await invalidateSessions(user.id, req.sessionID);
      res.json({ message: "Password changed successfully" });
    } catch {
      res.status(500).json({ message: "Failed to change password" });
    }
  };
}
