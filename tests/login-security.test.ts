import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import { installSecurity, sessionOptions, bootstrapAdminPassword, safeErrorHandler } from "../server/security";
import { activeSessionGuard, establishSession, endSession, ownPasswordChange } from "../server/session-security";
import { tenantReferenceGuard, loanOwnershipGuard } from "../server/tenant-security";

// Isolated HTTP contract fixture. No real database, credentials or running app.
const passwordHash = await bcrypt.hash("fixture-old-password", 4);
const makeUsers = () => new Map([
  ["a", { id: "a", tenantId: "TENANT_A", role: "admin", isActive: true, password: passwordHash }],
  ["b", { id: "b", tenantId: "TENANT_B", role: "admin", isActive: true, password: passwordHash }],
  ["root", { id: "root", tenantId: "SUPER_ADMIN", role: "super_admin", isActive: true, password: passwordHash }],
]);

async function fixture() {
  const users = makeUsers();
  const changes: string[] = [];
  const resources = new Map([["a-loan", "TENANT_A"], ["b-loan", "TENANT_B"],
    ["a-group", "TENANT_A"], ["b-group", "TENANT_B"], ["a-party", "TENANT_A"], ["b-party", "TENANT_B"]]);
  const app = express();
  const env = { NODE_ENV: "test", SESSION_SECRET: "synthetic-test-only-session-signing-secret" };
  installSecurity(app, env);
  app.use(express.json());
  app.use(session(sessionOptions(env)));
  app.get("/fixture/anonymous", (req, res) => { (req.session as any).marker = true; res.json({ ok: true }); });
  app.post("/fixture/alter-session", (req, res) => { Object.assign(req.session, req.body); res.sendStatus(204); });
  app.use("/api", activeSessionGuard(async id => users.get(id), async () => ({ isActive: true })));
  app.use("/api", tenantReferenceGuard(async (_type, id, tenantId) => resources.get(id) === tenantId));
  app.post("/api/auth/login", async (req, res) => {
    const user = users.get(req.body.user);
    if (!user) return res.sendStatus(401);
    await establishSession(req, user);
    res.json({ ok: true });
  });
  app.post("/api/auth/logout", async (req, res) => { await endSession(req, res); res.json({ ok: true }); });
  const changePassword = ownPasswordChange(async id => users.get(id),
    async id => { changes.push(id); }, async () => {});
  app.put("/api/auth/change-password", changePassword);
  app.patch("/api/auth/change-password", changePassword);
  app.get("/api/loans", (req, res) => res.json([...resources].filter(([id, tenant]) =>
    id.endsWith("-loan") && tenant === req.session.tenantId).map(([id]) => id)));
  for (const path of ["loans", "loan-closures", "cash-transactions", "borrowers", "groups", "parties"]) {
    app.post(`/api/${path}`, (_req, res) => res.sendStatus(201));
  }
  app.post("/api/loans/:loanId/photos",
    loanOwnershipGuard(async (id, tenantId) => resources.get(id) === tenantId),
    (_req, res) => res.sendStatus(201));
  app.get("/api/reports", (req, res) => res.json({ tenantId: req.session.tenantId }));
  app.delete("/api/super-admin/users/a", (req, res) =>
    res.sendStatus(req.session.role === "super_admin" ? 204 : 403));
  app.get("/api/throw", (_req, _res, next) => next(new Error("database credentials must never be returned")));
  app.use(safeErrorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address() as { port: number };
  const url = `http://127.0.0.1:${address.port}`;
  const request = (path: string, options: { method?: string; body?: unknown; cookie?: string; headers?: Record<string, string> } = {}) =>
    fetch(url + path, {
      method: options.method || "GET",
      headers: { ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(options.cookie ? { Cookie: options.cookie } : {}), ...options.headers },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  const login = async (user = "a") => {
    const response = await request("/api/auth/login", { method: "POST", body: { user } });
    assert.equal(response.status, 200);
    return response.headers.get("set-cookie")!.split(";")[0];
  };
  return { users, changes, request, login, url, close: () => new Promise<void>(resolve => {
    server.close(() => resolve()); server.closeAllConnections();
  }) };
}

test("production session config requires an explicit secret; no insecure cookie fallback", () => {
  assert.throws(() => sessionOptions({ NODE_ENV: "production" }), /SESSION_SECRET/);
  const options = sessionOptions({ NODE_ENV: "production", SESSION_SECRET: "synthetic-test-secret" });
  assert.equal(options.cookie?.secure, true);
  assert.equal(options.cookie?.httpOnly, true);
  assert.equal(options.cookie?.sameSite, "lax");
  assert.equal(options.resave, false);
  assert.equal(options.saveUninitialized, false);
});

test("missing administrator cannot be bootstrapped with a known default", () => {
  assert.throws(() => bootstrapAdminPassword({}), /BOOTSTRAP_ADMIN_PASSWORD/);
  assert.throws(() => bootstrapAdminPassword({ BOOTSTRAP_ADMIN_PASSWORD: "short" }));
  assert.equal(bootstrapAdminPassword({ BOOTSTRAP_ADMIN_PASSWORD: "synthetic-long-bootstrap-password" }),
    "synthetic-long-bootstrap-password");
});

test("Railway-style forwarded HTTPS produces Secure cookies and production headers", async () => {
  const app = express();
  const env = { NODE_ENV: "production", SESSION_SECRET: "synthetic-proxy-test-secret" };
  installSecurity(app, env);
  app.use(session(sessionOptions(env)));
  app.post("/api/auth/login", async (req, res) => {
    await establishSession(req, { id: "test", tenantId: "TEST", role: "admin" });
    res.json({ ok: true });
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  try {
    const port = (server.address() as { port: number }).port;
    const response = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: "POST", headers: { "X-Forwarded-Proto": "https", "Content-Type": "application/json" }, body: "{}",
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("set-cookie")!, /;\s*Secure/);
    assert.match(response.headers.get("set-cookie")!, /HttpOnly/);
    assert.match(response.headers.get("strict-transport-security")!, /max-age=31536000/);
    assert.equal(response.headers.get("x-frame-options"), "DENY");
  } finally {
    await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); });
  }
});

test("anonymous API reads do not create sessions, protected routes reject anonymous requests", async () => {
  const f = await fixture();
  try {
    for (const path of ["/api/loans", "/api/reports", "/api/super-admin/users/a"]) {
      const r = await f.request(path);
      assert.equal(r.status, 401);
      assert.equal(r.headers.get("set-cookie"), null);
    }
  } finally { await f.close(); }
});

test("login regenerates the session ID, logout invalidates it and clears its cookie", async () => {
  const f = await fixture();
  try {
    const anonymous = await f.request("/fixture/anonymous");
    const oldCookie = anonymous.headers.get("set-cookie")!.split(";")[0];
    const r = await f.request("/api/auth/login", { method: "POST", body: { user: "a" }, cookie: oldCookie });
    const cookie = r.headers.get("set-cookie")!.split(";")[0];
    assert.notEqual(cookie, oldCookie);
    assert.match(r.headers.get("set-cookie")!, /HttpOnly/);
    assert.equal((await f.request("/api/loans", { cookie: oldCookie })).status, 401);
    assert.equal((await f.request("/api/loans", { cookie })).status, 200);
    const logout = await f.request("/api/auth/logout", { method: "POST", body: {}, cookie });
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get("set-cookie")!, /Expires=Thu, 01 Jan 1970/);
    assert.equal((await f.request("/api/loans", { cookie })).status, 401);
  } finally { await f.close(); }
});

test("same-origin writes work; lookalike, other Railway/Replit origins and cross-site forms fail", async () => {
  const f = await fixture();
  try {
    const cookie = await f.login();
    for (const origin of ["https://evil.railway.app", "https://evil.replit.dev", "https://localhost.evil.example", "null"]) {
      const r = await f.request("/api/loans", { method: "POST", body: {}, cookie, headers: { Origin: origin } });
      assert.equal(r.status, 403);
      assert.equal(r.headers.get("access-control-allow-origin"), null);
    }
    const allowed = await f.request("/api/loans", {
      method: "POST", body: {}, cookie, headers: { Origin: f.url },
    });
    assert.equal(allowed.status, 201);
    assert.equal(allowed.headers.get("access-control-allow-origin"), f.url);
    assert.equal((await f.request("/api/loans", {
      method: "POST", cookie, headers: { "Content-Type": "text/plain", "Sec-Fetch-Site": "cross-site" },
    })).status, 403);
    assert.equal((await f.request("/api/loans", { method: "OPTIONS", headers: { Origin: "https://evil.railway.app" } })).status, 403);
  } finally { await f.close(); }
});

test("emergency HTTP recovery is unavailable even if emergency mode is configured", async () => {
  const f = await fixture();
  try {
    for (const path of ["/emergency/reset-admin", "/emergency/list-admins"]) {
      assert.equal((await f.request(path, { method: "POST", body: {} })).status, 404);
      assert.equal((await f.request(path)).status, 404);
    }
  } finally { await f.close(); }
});

test("invalid/revoked user, changed role, forged tenant and expired day cannot use a saved session", async () => {
  const f = await fixture();
  try {
    const cookie = await f.login();
    f.users.get("a")!.isActive = false;
    assert.equal((await f.request("/api/reports", { cookie })).status, 401);
    f.users.get("a")!.isActive = true;
    for (const patch of [{ tenantId: "TENANT_B" }, { tenantId: "TENANT_A", role: "super_admin" },
      { role: "admin", loginDate: "2000-01-01" }]) {
      await f.request("/fixture/alter-session", { method: "POST", body: patch, cookie });
      assert.equal((await f.request("/api/reports", { cookie })).status, 401);
    }
  } finally { await f.close(); }
});

test("tenant A/B reads, report context and role-specific actions stay isolated", async () => {
  const f = await fixture();
  try {
    const a = await f.login("a"), b = await f.login("b"), root = await f.login("root");
    assert.deepEqual(await (await f.request("/api/loans", { cookie: a })).json(), ["a-loan"]);
    assert.deepEqual(await (await f.request("/api/loans", { cookie: b })).json(), ["b-loan"]);
    assert.deepEqual(await (await f.request("/api/reports", { cookie: a })).json(), { tenantId: "TENANT_A" });
    assert.equal((await f.request("/api/super-admin/users/a", { method: "DELETE", body: {}, cookie: a })).status, 403);
    assert.equal((await f.request("/api/super-admin/users/a", { method: "DELETE", body: {}, cookie: root })).status, 204);
    assert.equal((await f.request("/api/loans/b-loan/photos", { method: "POST", body: {}, cookie: a })).status, 404);
    assert.equal((await f.request("/api/loans/a-loan/photos", { method: "POST", body: {}, cookie: a })).status, 201);
  } finally { await f.close(); }
});

test("financial writes reject foreign loan/group/party references and tenant reassignment", async () => {
  const f = await fixture();
  try {
    const cookie = await f.login();
    for (const path of ["loans", "loan-closures", "cash-transactions", "borrowers", "groups", "parties"]) {
      assert.equal((await f.request(`/api/${path}`, { method: "POST", cookie, body: { tenantId: "TENANT_B" } })).status, 403);
      for (const body of [{ loanId: "b-loan" }, { groupId: "b-group" }, { partyId: "b-party" }]) {
        assert.equal((await f.request(`/api/${path}`, { method: "POST", cookie, body })).status, 400);
      }
      assert.equal((await f.request(`/api/${path}`, { method: "POST", cookie, body: { groupId: "a-group" } })).status, 201);
    }
  } finally { await f.close(); }
});

test("both self-password-change methods require the current password and bounded new password", async () => {
  const f = await fixture();
  try {
    const cookie = await f.login();
    for (const method of ["PUT", "PATCH"]) {
      for (const body of [{ newPassword: "fixture-new-password" },
        { currentPassword: "wrong", newPassword: "fixture-new-password" },
        { currentPassword: "fixture-old-password", newPassword: "x".repeat(73) }]) {
        assert.equal((await f.request("/api/auth/change-password", { method, cookie, body })).status, 400);
      }
      assert.equal((await f.request("/api/auth/change-password", {
        method, cookie, body: { currentPassword: "fixture-old-password", newPassword: "fixture-new-password" },
      })).status, 200);
    }
    assert.equal(f.changes.length, 2);
  } finally { await f.close(); }
});

test("login attempts are throttled; error output is generic and API responses are not cached", async () => {
  const f = await fixture();
  try {
    const cookie = await f.login();
    const error = await f.request("/api/throw", { cookie });
    assert.equal(error.status, 500);
    assert.deepEqual(await error.json(), { message: "Internal Server Error" });
    assert.equal(error.headers.get("cache-control"), "no-store");
    assert.equal(error.headers.get("x-content-type-options"), "nosniff");
    let limited: Response | undefined;
    for (let i = 0; i < 30; i++) limited = await f.request("/api/auth/login", { method: "POST", body: { user: "invalid" } });
    assert.equal(limited!.status, 429);
    assert.ok(limited!.headers.get("retry-after"));
  } finally { await f.close(); }
});
