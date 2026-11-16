import type { Express, RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { pledgeFormDefaults } from "@shared/schema";
import { DEFAULT_PLEDGE_MATTER, defaultPledgeMatter, pledgeDefaultsRequestSchema, pledgeMatterSchema, type PledgeFormMatter } from "@shared/pledge-form-editor";
import type { UiLanguage } from "@shared/ui-language";

type Dependencies = {
  read: (tenantId: string, language?: UiLanguage) => Promise<string | undefined>;
  write: (tenantId: string, matter: PledgeFormMatter, language?: UiLanguage) => Promise<void>;
  reset: (tenantId: string, language?: UiLanguage) => Promise<void>;
  canRead: (userId: string, tenantId: string) => Promise<boolean>;
};
export function createPledgeSettingsHandlers(deps: Dependencies) {
  const languageOf = (req: any): UiLanguage => req.query?.language === "en" ? "en" : "mr";
  const authorize = async (req: any, res: any, write: boolean) => {
    if (req.query?.language != null && !["mr", "en"].includes(req.query.language)) {
      res.status(400).json({ message: "Unsupported language" }); return false;
    }
    const session = req.session;
    if (!session?.userId || !session?.tenantId) { res.status(401).json({ message: "कृपया लॉगिन करा." }); return false; }
    const admin = session.role === "admin" || session.role === "super_admin";
    if (write ? !admin : !admin && !await deps.canRead(session.userId, session.tenantId)) {
      res.status(403).json({ message: write ? "फक्त संस्थेचा अॅडमिन डिफॉल्ट मजकूर जतन / बदलू शकतो." : "नोटीस पाहण्याची परवानगी नाही." });
      return false;
    }
    return true;
  };
  const read: RequestHandler = async (req: any, res) => {
    try {
      if (!await authorize(req, res, false)) return;
      const language = languageOf(req);
      const original = defaultPledgeMatter(language);
      const raw = await deps.read(req.session.tenantId, language);
      const matter = raw ? pledgeMatterSchema.parse(JSON.parse(raw)) : original;
      res.setHeader("Cache-Control", "no-store");
      res.json({ matter, customized: !!raw && JSON.stringify(matter) !== JSON.stringify(original) });
    } catch { res.status(500).json({ message: "फॉर्मचा डिफॉल्ट मजकूर लोड झाला नाही. पुन्हा प्रयत्न करा." }); }
  };
  const write: RequestHandler = async (req: any, res) => {
    try {
      if (!await authorize(req, res, true)) return;
      const parsed = pledgeDefaultsRequestSchema.safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ message: parsed.error.issues[0]?.message || "अवैध मजकूर." }); return; }
      await deps.write(req.session.tenantId, parsed.data.matter, languageOf(req));
      res.json({ matter: parsed.data.matter, customized: true });
    } catch { res.status(500).json({ message: "डिफॉल्ट मजकूर जतन झाला नाही." }); }
  };
  const reset: RequestHandler = async (req: any, res) => {
    try {
      if (!await authorize(req, res, true)) return;
      await deps.reset(req.session.tenantId, languageOf(req));
      res.json({ matter: defaultPledgeMatter(languageOf(req)), customized: false });
    } catch { res.status(500).json({ message: "मूळ डिफॉल्ट परत आणता आला नाही." }); }
  };
  return { read, write, reset };
}

export function registerPledgeFormSettings(app: Express, requireAuth: RequestHandler) {
  const handlers = createPledgeSettingsHandlers({
    read: async (tenantId, language) => (await db.select({ matter: language === "en" ? pledgeFormDefaults.matterEn : pledgeFormDefaults.matter }).from(pledgeFormDefaults).where(eq(pledgeFormDefaults.tenantId, tenantId)).limit(1))[0]?.matter ?? undefined,
    write: async (tenantId, matter, language) => {
      const text = JSON.stringify(matter);
      const values = language === "en" ? { matter: JSON.stringify(DEFAULT_PLEDGE_MATTER), matterEn: text } : { matter: text };
      const update = language === "en" ? { matterEn: text } : { matter: text };
      await db.insert(pledgeFormDefaults).values({ tenantId, ...values })
        .onConflictDoUpdate({ target: pledgeFormDefaults.tenantId, set: { ...update, updatedAt: new Date() } });
    },
    reset: async (tenantId, language) => { await db.update(pledgeFormDefaults).set(language === "en" ? { matterEn: null } : { matter: JSON.stringify(DEFAULT_PLEDGE_MATTER) }).where(eq(pledgeFormDefaults.tenantId, tenantId)); },
    canRead: async (userId, tenantId) => !!(await storage.getUserPermissions(userId, tenantId))?.canViewNoticeGenerator,
  });
  app.get("/api/pledge-form-settings", requireAuth, handlers.read);
  app.put("/api/pledge-form-settings", requireAuth, handlers.write);
  app.delete("/api/pledge-form-settings", requireAuth, handlers.reset);
}
