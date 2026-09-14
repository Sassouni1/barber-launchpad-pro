// Secure server-side storage for the affiliate Stripe webhook signing secret.
// Mirrors the managed-ads vault helper. The value is never logged or returned.
import postgres from "npm:postgres@3.4.4";

export const AFFILIATE_WEBHOOK_SECRET_NAME = "AFFILIATE_STRIPE_WEBHOOK_SECRET";
/** Connected-account (Connect) deliveries are signed with their own secret. */
export const AFFILIATE_CONNECT_WEBHOOK_SECRET_NAME = "AFFILIATE_STRIPE_CONNECT_WEBHOOK_SECRET";
/** Isolated test-mode endpoint, used only for QA verification. */
export const AFFILIATE_TEST_WEBHOOK_SECRET_NAME = "AFFILIATE_STRIPE_TEST_WEBHOOK_SECRET";

export class VaultUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultUnavailableError";
  }
}

function connect() {
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) throw new VaultUnavailableError("Secure storage is unavailable: database connection is not configured.");
  return postgres(dbUrl, { prepare: false, max: 1, idle_timeout: 5 });
}

export async function readAffiliateWebhookSecret(
  name: string = AFFILIATE_WEBHOOK_SECRET_NAME,
): Promise<string | null> {
  const sql = connect();
  try {
    const rows = await sql`
      select decrypted_secret from vault.decrypted_secrets
      where name = ${name}
      limit 1
    `;
    const value = rows[0]?.decrypted_secret as string | undefined;
    return value && value.length > 0 ? value : null;
  } catch (error) {
    throw new VaultUnavailableError(
      `Secure storage is unavailable: ${error instanceof Error ? error.message : "vault read failed"}`,
    );
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

export async function writeAffiliateWebhookSecret(
  secret: string,
  name: string = AFFILIATE_WEBHOOK_SECRET_NAME,
): Promise<void> {
  const sql = connect();
  try {
    const existing = await sql`
      select id from vault.secrets where name = ${name} limit 1
    `;
    if (existing.length > 0) {
      await sql`select vault.update_secret(${existing[0].id}::uuid, ${secret})`;
    } else {
      await sql`select vault.create_secret(${secret}, ${name}, 'Stripe signing secret for the Barber Launch affiliate webhook')`;
    }
  } catch (error) {
    throw new VaultUnavailableError(
      `Secure storage is unavailable: ${error instanceof Error ? error.message : "vault write failed"}`,
    );
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}
