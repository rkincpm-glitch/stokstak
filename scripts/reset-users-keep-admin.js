/*
  One-time reset utility.

  Deletes ALL non-admin users from Supabase Auth and cleans related public tables,
  while keeping a single admin user.

  Usage (Windows CMD):
    set NEXT_PUBLIC_SUPABASE_URL=...
    set SUPABASE_SERVICE_ROLE_KEY=...
    set ADMIN_EMAIL=admin@yourdomain.com
    node scripts/reset-users-keep-admin.js

  IMPORTANT: This is destructive. Review before running.
*/

const { createClient } = require("@supabase/supabase-js");

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();

  if (!url || !key || !adminEmail) {
    console.error("Missing env vars. Require NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL");
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Find admin user by email
  const { data: usersResp, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw listErr;

  const users = usersResp.users || [];
  const adminUser = users.find((u) => (u.email || "").toLowerCase() === adminEmail);
  if (!adminUser) {
    throw new Error(`Admin user not found for ADMIN_EMAIL=${adminEmail}`);
  }

  const keepId = adminUser.id;

  // Delete public-table references first (company_users, profiles, etc.) for non-admin users
  // IMPORTANT: adjust/extend if you add more user-owned tables.
  const nonAdminIds = users.map((u) => u.id).filter((id) => id !== keepId);

  if (nonAdminIds.length) {
    await supabase.from("company_users").delete().in("user_id", nonAdminIds);
    await supabase.from("profiles").delete().in("id", nonAdminIds);
  }

  // Ensure admin profile is admin
  await supabase.from("profiles").upsert(
    { id: keepId, role: "admin", display_name: adminEmail, is_active: true },
    { onConflict: "id" }
  );

  // Delete auth users (non-admin)
  for (const u of users) {
    if (u.id === keepId) continue;
    await supabase.auth.admin.deleteUser(u.id);
  }

  console.log(`Done. Kept admin user: ${adminEmail} (${keepId}). Deleted: ${nonAdminIds.length} users.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
