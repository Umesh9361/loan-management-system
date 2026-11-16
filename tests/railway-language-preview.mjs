// Serves the REAL Railway-built bundle against synthetic APIs only.
// This is never registered in the application server or a deployment workflow.
import express from "express";
const app = express();
app.use(express.json());
let preferredLanguage = null;
const user = () => ({ id: "language-test-user", username: "fixture", tenantId: "language-test", role: "admin", preferredLanguage });
const signedIn = req => (req.headers.cookie || "").includes("railway_language_test=1");
app.post("/api/auth/login", (req, res) => {
  if (!["mr", "en"].includes(req.body.language)) return res.status(400).json({ message: "Explicit language was not sent" });
  preferredLanguage = req.body.language;
  res.setHeader("Set-Cookie", "railway_language_test=1; Path=/; HttpOnly; SameSite=Lax");
  res.json({ user: user() });
});
app.get("/api/auth/me", (req, res) => signedIn(req) ? res.json(user()) : res.status(401).json({ message: "Unauthorized" }));
app.post("/api/auth/logout", (_req, res) => {
  res.setHeader("Set-Cookie", "railway_language_test=; Path=/; Max-Age=0");
  res.json({ success: true });
});
app.get("/api/company", (_req, res) => res.json({
  tenantId: "language-test", name: "नमुना फायनान्स", address: "नमुना गाव",
  bottomNavEnabled: true, mobileShortcutBarEnabled: true, isActive: true,
}));
app.get("/api/groups", (_req, res) => res.json([{ id: "group-test", name: "नमुना गट" }]));
app.get("/api/loans", (_req, res) => res.json([{
  id: "loan-test", tenantId: "language-test", borrowerName: "राम पाटील",
  borrowerAddress: "नमुना गाव", borrowerMobile: "", accountNumber: "621",
  groupId: "group-test", loanDate: "2026-04-15", principalAmount: "10000",
  interestRate: "2", interestRateType: "monthly", weight: "20", purity: "80",
  metalType: "gold", collateralDetails: "ठुशी", goldItem: "ठुशी", loanType: "तारण", status: "active",
}]));
app.get("/api/dashboard/period-stats", (_req, res) => res.json({
  current: {disbursements:14,disbursementAmount:4500000,closures:24,closureAmount:5090000,transactions:38,cashIn:9590000,cashOut:9010000,cashNet:580000,cashNetAmount:580000},
  previous: {disbursements:46,disbursementAmount:6000000,closures:53,closureAmount:7000000,transactions:99,cashIn:13000000,cashOut:12600000,cashNet:400000,cashNetAmount:400000},
}));
app.get("/api/dashboard/monthly-progress", (_req, res) => res.json({ monthlyData:[
  {month:"सप्टेंबर 2026",disbursements:46,closures:53,net:-7,disbursementAmount:4500000,closureAmount:5090000},
  {month:"ऑक्टोबर 2026",disbursements:14,closures:24,net:-10,disbursementAmount:4500000,closureAmount:5090000},
]}));
app.get("/api/*", (_req, res) => res.json([]));
app.post("/api/*", (_req, res) => res.json({ success: true }));
app.use(express.static("dist/public", { index: false }));
app.get("*", (_req, res) => res.sendFile("dist/public/index.html", { root: process.cwd() }));
app.listen(5003, "127.0.0.1", () => console.log("Real production bundle, synthetic auth/data: 5003"));
