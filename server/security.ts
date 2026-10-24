import type { Express, RequestHandler, ErrorRequestHandler } from "express";
import type { SessionOptions } from "express-session";
import { randomBytes } from "node:crypto";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

const developmentSecret = randomBytes(32).toString("hex");

export function sessionOptions(env: NodeJS.ProcessEnv = process.env): SessionOptions {
  if (!env.SESSION_SECRET?.trim() && env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be configured before production startup");
  }
  return {
    secret: env.SESSION_SECRET || developmentSecret,
    resave: false,
    saveUninitialized: false,
    name: "connect.sid",
    rolling: true,
    cookie: {
      secure: env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60 * 1000,
    },
  };
}

// Only used when creating a missing account; never resets an existing password.
export function bootstrapAdminPassword(env: NodeJS.ProcessEnv = process.env): string {
  const password = env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!password || password.length < 16) {
    throw new Error("A missing administrator requires an explicit BOOTSTRAP_ADMIN_PASSWORD (16+ characters)");
  }
  return password;
}

export function originProtection(env: NodeJS.ProcessEnv = process.env): RequestHandler {
  const configured = new Set<string>();
  for (const origin of (env.APP_ORIGINS || "").split(",").filter(Boolean)) {
    const parsed = new URL(origin.trim());
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.origin !== origin.trim()) {
      throw new Error("APP_ORIGINS must contain exact http(s) origins without paths");
    }
    configured.add(parsed.origin);
  }
  if (env.NODE_ENV !== "production") {
    for (const host of [env.REPLIT_DEV_DOMAIN, ...(env.REPLIT_DOMAINS || "").split(",")]) {
      if (host?.trim()) configured.add(`https://${host.trim()}`);
    }
  }
  return (req, res, next) => {
    const origin = req.get("Origin");
    const sameOrigin = `${req.protocol}://${req.get("host")}`;
    const allowed = origin !== undefined && (origin === sameOrigin || configured.has(origin));
    res.vary("Origin");
    if (origin && !allowed) {
      res.status(403).json({ message: "Request origin not allowed" });
      return;
    }
    if (allowed) {
      res.setHeader("Access-Control-Allow-Origin", origin!);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Requested-With");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS");
    }
    if (req.method === "OPTIONS") {
      res.sendStatus(allowed ? 204 : 403);
      return;
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      // Browsers send Origin on cross-origin writes. Also reject cross-site or
      // simple-form writes without Origin; JSON API clients remain supported.
      if (!origin && (req.get("Sec-Fetch-Site") === "cross-site" ||
          (!req.is("application/json") && req.get("Sec-Fetch-Site") !== "same-origin"))) {
        res.status(403).json({ message: "Untrusted write request" });
        return;
      }
    }
    next();
  };
}

export function installSecurity(app: Express, env: NodeJS.ProcessEnv = process.env) {
  // Exactly one hosting reverse proxy, not unrestricted proxy trust.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(helmet({
    // Report/print templates currently use inline scripts. Enforce CSP only
    // after migrating those templates, rather than breaking financial prints.
    contentSecurityPolicy: false,
    strictTransportSecurity: env.NODE_ENV === "production"
      ? { maxAge: 31536000, includeSubDomains: false } : false,
    xFrameOptions: env.NODE_ENV === "production" ? { action: "deny" } : false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  }));
  app.use("/api", originProtection(env));
  // No environment flag may enable unauthenticated HTTP recovery.
  app.use("/emergency", (_req, res) => { res.sendStatus(404); });
  const limiter = (limit: number, windowMs: number) => rateLimit({
    windowMs, limit, standardHeaders: "draft-8", legacyHeaders: false,
    message: { message: "खूप प्रयत्न झाले. कृपया काही वेळाने पुन्हा प्रयत्न करा." },
  });
  app.use("/api/auth/login", limiter(30, 15 * 60 * 1000));
  app.use(["/api/auth/forgot-password", "/api/admin/request-password-reset"], limiter(5, 15 * 60 * 1000));
  app.use("/api/auth/change-password", limiter(10, 15 * 60 * 1000));
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    const sendJson = res.json.bind(res);
    res.json = (body: unknown) => sendJson(res.statusCode >= 500
      ? { message: "Internal Server Error" } : body);
    next();
  });
}

export const safeErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) return next(err);
  const candidate = Number(err.status || err.statusCode || 500);
  const status = candidate >= 400 && candidate <= 599 ? candidate : 500;
  // Never send SQL, filesystem paths or credential-bearing error details.
  res.status(status).json({ message: status >= 500 ? "Internal Server Error" : "Request could not be processed" });
};
