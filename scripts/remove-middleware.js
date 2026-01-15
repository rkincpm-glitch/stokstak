const fs = require('fs');

// Remove legacy middleware file if present.
// This avoids Next.js build failure when proxy.ts is also present.

const targets = ['middleware.ts', 'middleware.js'];

for (const t of targets) {
  try {
    if (fs.existsSync(t)) {
      fs.unlinkSync(t);
      console.log(`[prebuild] Removed ${t}`);
    }
  } catch (e) {
    console.warn(`[prebuild] Could not remove ${t}: ${e && e.message ? e.message : e}`);
  }
}
