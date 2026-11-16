import type { Express, RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { noticeDefaults } from "@shared/schema";
import { DEFAULT_NOTICE_MATTER, defaultNoticeMatter, noticeDefaultsRequestSchema, noticeMatterSchema, type NoticeMatter } from "@shared/notice-matter";
import type { UiLanguage } from "@shared/ui-language";

type Dependencies = {
  read: (tenant: string, language?: UiLanguage) => Promise<string | undefined>;
  write: (tenant: string, matter: NoticeMatter, language?: UiLanguage) => Promise<void>;
  reset: (tenant: string, language?: UiLanguage) => Promise<void>;
  canRead: (user: string, tenant: string) => Promise<boolean>;
};
export function createNoticeSettingsHandlers(deps: Dependencies) {
  const languageOf = (req: any): UiLanguage => req.query?.language === "en" ? "en" : "mr";
  const authorize = async (req: any, res: any, write: boolean) => {
    if (req.query?.language != null && !["mr", "en"].includes(req.query.language)) {
      res.status(400).json({ message: "Unsupported language" }); return false;
    }
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
      const language = languageOf(req);
      const original = defaultNoticeMatter(language);
      const raw = await deps.read(req.session.tenantId, language);
      const matter = raw ? noticeMatterSchema.parse(JSON.parse(raw)) : original;
      res.setHeader("Cache-Control", "no-store");
      res.json({ matter, customized: !!raw && JSON.stringify(matter) !== JSON.stringify(original) });
    } catch { res.status(500).json({ message: "नोटीशीचा जतन केलेला मजकूर लोड झाला नाही. पुन्हा प्रयत्न करा." }); }
  };
  const write: RequestHandler = async (req: any, res) => {
    try {
      if (!await authorize(req, res, true)) return;
      const parsed = noticeDefaultsRequestSchema.safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ message: parsed.error.issues[0]?.message || "अवैध मजकूर." }); return; }
      await deps.write(req.session.tenantId, parsed.data.matter, languageOf(req));
      res.json({ matter: parsed.data.matter, customized: true });
    } catch { res.status(500).json({ message: "नोटीशीचा मजकूर जतन झाला नाही." }); }
  };
  const reset: RequestHandler = async (req: any, res) => {
    try {
      if (!await authorize(req, res, true)) return;
      await deps.reset(req.session.tenantId, languageOf(req));
      res.json({ matter: defaultNoticeMatter(languageOf(req)), customized: false });
    } catch { res.status(500).json({ message: "मूळ नोटीस परत आणता आली नाही." }); }
  };
  return { read, write, reset };
}
export function registerNoticeSettings(app: Express, requireAuth: RequestHandler) {
  const handlers = createNoticeSettingsHandlers({
    read: async (tenant, language) => (await db.select({ matter: language === "en" ? noticeDefaults.matterEn : noticeDefaults.matter }).from(noticeDefaults).where(eq(noticeDefaults.tenantId, tenant)).limit(1))[0]?.matter ?? undefined,
    write: async (tenantId, matter, language) => {
      const text = JSON.stringify(matter);
      const values = language === "en" ? { matter: JSON.stringify(DEFAULT_NOTICE_MATTER), matterEn: text } : { matter: text };
      const update = language === "en" ? { matterEn: text } : { matter: text };
      await db.insert(noticeDefaults).values({ tenantId, ...values })
        .onConflictDoUpdate({ target: noticeDefaults.tenantId, set: { ...update, updatedAt: new Date() } });
    },
    reset: async (tenant, language) => { await db.update(noticeDefaults).set(language === "en" ? { matterEn: null } : { matter: JSON.stringify(DEFAULT_NOTICE_MATTER) }).where(eq(noticeDefaults.tenantId, tenant)); },
    canRead: async (user, tenant) => !!(await storage.getUserPermissions(user, tenant))?.canViewNoticeGenerator,
  });
  app.get("/api/notice-settings", requireAuth, handlers.read);
  app.put("/api/notice-settings", requireAuth, handlers.write);
  app.delete("/api/notice-settings", requireAuth, handlers.reset);
}
