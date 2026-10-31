import type { Express, RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { noticeDefaults } from "@shared/schema";
import { DEFAULT_NOTICE_MATTER, noticeDefaultsRequestSchema, noticeMatterSchema, type NoticeMatter } from "@shared/notice-matter";

type Dependencies = {
  read: (tenant: string) => Promise<string | undefined>;
  write: (tenant: string, matter: NoticeMatter) => Promise<void>;
  reset: (tenant: string) => Promise<void>;
  canRead: (user: string, tenant: string) => Promise<boolean>;
};
export function createNoticeSettingsHandlers(deps: Dependencies) {
  const authorize = async (req: any, res: any, write: boolean) => {
    const session = req.session;
    if (!session?.userId || !session?.tenantId) { res.status(401).json({ message: "कृपया लॉगिन करा." }); return false; }
    const admin = session.role === "admin" || session.role === "super_admin";
    if (write ? !admin : !admin && !await deps.canRead(session.userId, session.tenantId)) {
      res.status(403).json({ message: write ? "फक्त संस्थेचा अॅडमिन नोटीशीचा डिफॉल्ट बदलू शकतो." : "नोटीस पाहण्याची परवानगी नाही." });
      return false;
    }
    return true;
  };
  const read: RequestHandler = async (req: any, res) => {
    try {
      if (!await authorize(req, res, false)) return;
      const raw = await deps.read(req.session.tenantId);
      const matter = raw ? noticeMatterSchema.parse(JSON.parse(raw)) : { ...DEFAULT_NOTICE_MATTER };
      res.setHeader("Cache-Control", "no-store");
      res.json({ matter, customized: !!raw });
    } catch { res.status(500).json({ message: "नोटीशीचा जतन केलेला मजकूर लोड झाला नाही. पुन्हा प्रयत्न करा." }); }
  };
  const write: RequestHandler = async (req: any, res) => {
    try {
      if (!await authorize(req, res, true)) return;
      const parsed = noticeDefaultsRequestSchema.safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ message: parsed.error.issues[0]?.message || "अवैध मजकूर." }); return; }
      await deps.write(req.session.tenantId, parsed.data.matter);
      res.json({ matter: parsed.data.matter, customized: true });
    } catch { res.status(500).json({ message: "नोटीशीचा मजकूर जतन झाला नाही." }); }
  };
  const reset: RequestHandler = async (req: any, res) => {
    try {
      if (!await authorize(req, res, true)) return;
      await deps.reset(req.session.tenantId);
      res.json({ matter: { ...DEFAULT_NOTICE_MATTER }, customized: false });
    } catch { res.status(500).json({ message: "मूळ नोटीस परत आणता आली नाही." }); }
  };
  return { read, write, reset };
}
export function registerNoticeSettings(app: Express, requireAuth: RequestHandler) {
  const handlers = createNoticeSettingsHandlers({
    read: async tenant => (await db.select({ matter: noticeDefaults.matter }).from(noticeDefaults).where(eq(noticeDefaults.tenantId, tenant)).limit(1))[0]?.matter,
    write: async (tenantId, matter) => {
      await db.insert(noticeDefaults).values({ tenantId, matter: JSON.stringify(matter) })
        .onConflictDoUpdate({ target: noticeDefaults.tenantId, set: { matter: JSON.stringify(matter), updatedAt: new Date() } });
    },
    reset: async tenant => { await db.delete(noticeDefaults).where(eq(noticeDefaults.tenantId, tenant)); },
    canRead: async (user, tenant) => !!(await storage.getUserPermissions(user, tenant))?.canViewNoticeGenerator,
  });
  app.get("/api/notice-settings", requireAuth, handlers.read);
  app.put("/api/notice-settings", requireAuth, handlers.write);
  app.delete("/api/notice-settings", requireAuth, handlers.reset);
}
