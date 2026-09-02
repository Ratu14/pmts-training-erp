declare namespace Cloudflare {
  interface Env {
    ADMIN_PASSWORD?: string;
    ADMIN_SESSION_SECRET?: string;
    DB: D1Database;
  }
}
