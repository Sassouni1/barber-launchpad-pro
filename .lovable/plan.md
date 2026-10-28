# Vlix certification check: backend confirmation and secure install path

## Confirmed (read-only, this turn)
- The backend project reference is **ynooatjtgstgwfssnira**. Three sources match: `supabase/config.toml` (`project_id`), the app's environment project ID, and the Lovable Cloud project info.
- This one backend serves both the preview and the published site (member.thebarberlaunch.com).
- The synced code is at commit `9baf1ae2ad42c2d155da9c4b772dc9695974e37c`.

## Supported secure path (runs in build mode, after approval)
1. **Server-only secret**
   - Tell me the secret's name, for example `VLIX_CERT_CHECK_SECRET`. Never send its value in chat.
   - If Vlix must hold the same value (a shared secret), you create it yourself, for example with a password manager or `openssl rand -hex 32`. You then paste it into Vlix and into Project Settings -> Secrets. I can trigger the secure entry form, but I never see or print the value.
   - If only this app needs the value, I can generate it server-side. Its value is never revealed, so this option only works if Vlix never needs a copy.
   - Only Edge Functions can read it, through `Deno.env.get(...)`. It never goes into client code, `.env` or git.
2. **Reviewed SQL migration**
   - You supply the reviewed SQL, or I add it from the merged GitHub commit.
   - I apply it through the managed migration tool against ynooatjtgstgwfssnira. Anything destructive pauses for your yes or no.
   - Any new public table includes GRANTs, row-level security and policies.
3. **Edge Function**
   - First, I confirm Git HEAD equals your stated commit. If it doesn't match, I stop.
   - I deploy only the named function, with its `_shared` imports, through the managed deploy path. I report the deployment-reported source SHA-256.
   - I verify only with a harmless unauthenticated request that should be rejected. I don't invoke any real action.

## Access and limits
- I have no access gap for these steps: secret entry, migrations and function deploys are available on this project.
- I cannot read secret values back.
- There is no separate dashboard login, and the service-role key and database password aren't available to anyone on Lovable Cloud.
- Direct Supabase CLI deploys are refused with a 403 error, so the managed path is the only supported route.

## Needed from you before build
- The secret name, and whether Vlix shares the value.
- The commit that holds the reviewed migration and function, and the function name.
