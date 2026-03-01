import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeDatabase } from "./init-db";
import { LoginHealthMonitor } from "./login-health-monitor";
import { repairMissingCashEntries } from "./real-time-sync-engine";
import { db } from "./db";
import { notificationWarnings } from "@shared/schema";
import { lt } from "drizzle-orm";

async function cleanupOldNotifications() {
  try {
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    const result = await db.delete(notificationWarnings)
      .where(lt(notificationWarnings.createdAt, fifteenDaysAgo));
    const deletedCount = result.rowCount || 0;
    if (deletedCount > 0) {
      console.log(`Auto-cleanup: ${deletedCount} old notification warnings (15+ days) deleted`);
    }
  } catch (error) {
    console.error("Auto-cleanup notification warnings error:", error);
  }
}

const app = express();

// Enhanced CORS configuration for all environments
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // More comprehensive origin checking for Replit environments
  const allowedOrigins = [
    'localhost',
    '127.0.0.1',
    '.replit.app',
    '.replit.dev',
    '.replit.co',
    '.repl.co',
    '.replitapp.com',
    '.railway.app',
    '.up.railway.app'
  ];
  
  const isAllowedOrigin = !origin || allowedOrigins.some(allowed => 
    origin.includes(allowed) || origin === `http://localhost:5000` || origin === `https://localhost:5000`
  );
  
  if (isAllowedOrigin) {
    res.header("Access-Control-Allow-Origin", origin || "*");
    res.header("Access-Control-Allow-Credentials", "true");
  }
  
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie, X-Requested-With");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  res.header("Access-Control-Expose-Headers", "Set-Cookie");
  
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Add global error handlers for uncaught exceptions and WebSocket errors
    process.on('uncaughtException', (error) => {
      console.warn('Uncaught exception (non-fatal):', error.message);
      // Don't exit - let the application continue for WebSocket issues
      if (!error.message.includes('WebSocket') && !error.message.includes('ErrorEvent')) {
        console.error('Critical uncaught exception:', error);
        process.exit(1);
      }
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.warn('Unhandled rejection (non-fatal):', reason);
      // Don't exit for WebSocket connection rejections
      if (reason && typeof reason === 'object' && 'message' in reason) {
        const message = (reason as Error).message;
        if (!message.includes('WebSocket') && !message.includes('ErrorEvent')) {
          console.error('Critical unhandled rejection:', reason);
          process.exit(1);
        }
      }
    });

    // Initialize database with default data and startup timeout
    console.log("Starting application initialization...");
    
    const initializationTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Application startup timeout after 30 seconds")), 30000);
    });
    
    await Promise.race([
      initializeDatabase(),
      initializationTimeout
    ]);
    
    console.log("Database initialized successfully");
    
    // Run login health check after database initialization
    await LoginHealthMonitor.autoRepairCredentials();
    
    await repairMissingCashEntries();
    
    await cleanupOldNotifications();
    setInterval(cleanupOldNotifications, 24 * 60 * 60 * 1000);
    
    const server = await registerRoutes(app);
    console.log("Routes registered successfully");

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    app.use((req, res, next) => {
      if (req.accepts('html') && !req.path.startsWith('/api') && !req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
      next();
    });
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  const host = '0.0.0.0';
  
    server.listen(port, host, () => {
      log(`serving on ${host}:${port}`);
      log(`Server accessible via:`);
      log(`- Direct: http://localhost:${port}`);
      
      // Use the correct Replit domain from environment
      if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
        const replitDomain = `https://${process.env.REPL_SLUG}--${process.env.REPL_OWNER}.replit.app`;
        log(`- Replit App: ${replitDomain}`);
      } else if (process.env.REPLIT_DOMAINS) {
        // Fallback to old format
        const domains = process.env.REPLIT_DOMAINS.split(',');
        log(`- Replit Dev: https://${domains[0]}`);
      }
      
      console.log("Application started successfully and ready to accept connections");
    });
    
  } catch (error) {
    console.error("Critical error during application startup:", error);
    console.error("Application failed to start. Exiting...");
    process.exit(1);
  }
  
  // Graceful shutdown handling
  const gracefulShutdown = (signal: string) => {
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
    process.exit(0);
  };
  
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
})();

// Export for Vercel
export default app;
