import postgres from "npm:postgres@3.4.4";

export const MANAGED_ADS_WEBHOOK_SECRET_NAME = "STRIPE_MANAGED_ADS_WEBHOOK_SECRET";

export class VaultUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultUnavailableError";
  }
}

function connect() {
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) throw new VaultUnavailableError("Managed ads secure storage is unavailable: database connection is not configured.");
  return postgres(dbUrl, { prepare: false, max: 1, idle_timeout: 5 });
}

/** Returns the decrypted managed-ads webhook signing secret, or null when it is not stored yet. */
export async function readManagedAdsWebhookSecret(): Promise<string | null> {
  const sql = connect();
  try {
    const rows = await sql`
      select decrypted_secret from vault.decrypted_secrets
      where name = ${MANAGED_ADS_WEBHOOK_SECRET_NAME}
      limit 1
    `;
    const value = rows[0]?.decrypted_secret as string | undefined;
    return value && value.length > 0 ? value : null;
  } catch (error) {
    throw new VaultUnavailableError(
      `Managed ads secure storage is unavailable: ${error instanceof Error ? error.message : "vault read failed"}`,
    );
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

/** Creates or updates the managed-ads webhook signing secret in Vault. Never logs the value. */
export async function writeManagedAdsWebhookSecret(secret: string): Promise<void> {
  const sql = connect();
  try {
    const existing = await sql`
      select id from vault.secrets where name = ${MANAGED_ADS_WEBHOOK_SECRET_NAME} limit 1
    `;
    if (existing.length > 0) {
      await sql`select vault.update_secret(${existing[0].id}::uuid, ${secret})`;
    } else {
      await sql`select vault.create_secret(${secret}, ${MANAGED_ADS_WEBHOOK_SECRET_NAME}, 'Stripe signing secret for the Barber Launch managed-ads webhook')`;
    }
  } catch (error) {
    throw new VaultUnavailableError(
      `Managed ads secure storage is unavailable: ${error instanceof Error ? error.message : "vault write failed"}`,
    );
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}
