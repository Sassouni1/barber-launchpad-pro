const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import forge from "npm:node-forge@1.3.1";
import JSZip from "npm:jszip@3.10.1";

// Apple WWDR G4 intermediate certificate (PEM)
const APPLE_WWDR_PEM = `-----BEGIN CERTIFICATE-----
MIIEVTCCAz2gAwIBAgIUE9x3lVJx5T3GMujM/+Uh88zFztIwDQYJKoZIhvcNAQEL
BQAwYjELMAkGA1UEBhMCVVMxEzARBgNVBAoTCkFwcGxlIEluYy4xJjAkBgNVBAsT
HUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRYwFAYDVQQDEw1BcHBsZSBS
b290IENBMB4XDTIwMTIxNjE5MzYwNFoXDTMwMTIxMDAwMDAwMFowdTFEMEIGA1UE
Aww7QXBwbGUgV29ybGR3aWRlIERldmVsb3BlciBSZWxhdGlvbnMgQ2VydGlmaWNh
dGlvbiBBdXRob3JpdHkxCzAJBgNVBAsMAkc0MRMwEQYDVQQKDApBcHBsZSBJbmMu
MQswCQYDVQQGEwJVUzCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBANAf
eKp6JzKwRl/nF3bYoJ0OKY6tPTKlxGs3yeRBkWq3eXFdDDQEYHX3rkOPR8SGHgjo
v9Y5Ui8eZ/xx8YJtPH4GUnadLLzVQ+mxtLxAOnhRXVGhJeG+bJGdayFZGEHVD41t
QSo5SiHgkJ9OE0/QjJoyuNdqkh4laqQyziIZhQVg3AJK8lrrd3kCfcCXVGySjnYB
5kaP5eYq+6KwrRitbTOFOCOL6oqW7Z+uZk+jDEAnbZXQYojZQykn/e2kv1MukBVl
PNkuYmQzHWxq3Y4hqqRfFcYw7V/mjDaSlLfcOQIA+2SM1AyB8j/VNJeHdSbCb64D
YyEMe9QbsWLFApy9/a8CAwEAAaOB7zCB7DASBgNVHRMBAf8ECDAGAQH/AgEAMB8G
A1UdIwQYMBaAFCvQaUeUdgn+9GuNLkCm90dNfwheMEQGCCsGAQUFBwEBBDgwNjA0
BggrBgEFBQcwAYYoaHR0cDovL29jc3AuYXBwbGUuY29tL29jc3AwMy1hcHBsZXJv
b3RjYTAuBgNVHR8EJzAlMCOgIaAfhh1odHRwOi8vY3JsLmFwcGxlLmNvbS9yb290
LmNybDAdBgNVHQ4EFgQUW9n6HeeaGgujmXYiUIY+kchbd6gwDgYDVR0PAQH/BAQD
AgEGMBAGCiqGSIb3Y2QGAgEEAgUAMA0GCSqGSIb3DQEBCwUAA4IBAQA/Vj2e5bbD
eeZFIGi9v3OLLBKeAuOugCKMBB7DUshwgKj7zqew1UJEggOCTwb8O0kU+9h0UoWv
p50h5wESA5/NQFjQAde/MoMrU1goPO6cn1R2PWQnxn6NHThNLa6B5rmluJyJlPef
x4elUWY0GzlxOSTjh2fvpbFoe4zuPfeutnvi0v/fYcZqdUmVIkSoBPyUuAsuORFJ
EtHlgepZAE9bPFo22noicwkJac3AfOriJP6YRLj477JxPxpd1F1+M02cHSS+APCQ
A1iZQT0xWmJArzmoUUOSqwSonMJNsUvSq3xKX+udO7xPiEAGE/+QF4oIRynoYpgp
pU8RBWk6z/Kf
-----END CERTIFICATE-----`;

async function sha1Hex(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function createMinimalPng(): Uint8Array {
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
    0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, 0x00,
    0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
}

async function fetchImageAsBytes(url: string): Promise<Uint8Array | null> {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) return null;
    return new Uint8Array(await resp.arrayBuffer());
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { short_code } = await req.json();
    if (!short_code) {
      return new Response(JSON.stringify({ error: "short_code required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { data: card, error } = await supabase
      .from("business_cards")
      .select("*")
      .eq("short_code", short_code)
      .maybeSingle();

    if (error || !card) {
      return new Response(JSON.stringify({ error: "Card not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const p12Base64 = Deno.env.get("APPLE_PASS_P12_BASE64");
    const p12Password = Deno.env.get("APPLE_PASS_P12_PASSWORD");
    const teamId = Deno.env.get("APPLE_PASS_TEAM_ID");
    const passTypeId = Deno.env.get("APPLE_PASS_TYPE_ID");

    if (!p12Base64 || !p12Password || !teamId || !passTypeId) {
      return new Response(
        JSON.stringify({ error: "Apple Wallet not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decode P12 using standard base64 decode
    const p12DerBytes = Uint8Array.from(atob(p12Base64), c => c.charCodeAt(0));
    const p12DerString = String.fromCharCode(...p12DerBytes);
    const p12Asn1 = forge.asn1.fromDer(p12DerString);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, p12Password);

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });

    const certBag = (certBags[forge.pki.oids.certBag] || [])[0];
    const keyBag = (keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0];

    if (!certBag?.cert || !keyBag?.key) {
      return new Response(
        JSON.stringify({ error: "Failed to extract certificate/key from P12" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const signerCert = certBag.cert;
    const signerKey = keyBag.key;
    const wwdrCert = forge.pki.certificateFromPem(APPLE_WWDR_PEM);

    // Build pass.json
    const passJson = {
      formatVersion: 1,
      passTypeIdentifier: passTypeId,
      teamIdentifier: teamId,
      serialNumber: card.id,
      organizationName: card.business_name,
      description: `${card.business_name} - Hair Restoration Specialist`,
      logoText: card.business_name,
      foregroundColor: "rgb(255, 255, 255)",
      backgroundColor: "rgb(30, 30, 30)",
      labelColor: "rgb(255, 191, 0)",
      generic: {
        primaryFields: [
          { key: "name", label: "SPECIALIST", value: card.business_name },
        ],
        secondaryFields: [
          ...(card.phone ? [{ key: "phone", label: "PHONE", value: card.phone }] : []),
          ...(card.email ? [{ key: "email", label: "EMAIL", value: card.email }] : []),
        ],
        backFields: [
          { key: "card", label: "My Digital Card", value: `https://barber-launchpad-pro.lovable.app/card/${card.short_code}`, attributedValue: `<a href="https://barber-launchpad-pro.lovable.app/card/${card.short_code}">View & Share My Card</a>` },
          ...(card.booking_url
            ? [{ key: "booking", label: "Book Free Consultation", value: card.booking_url, attributedValue: `<a href="${card.booking_url}">Book Now</a>` }]
            : []),
          ...(card.gallery_url
            ? [{ key: "gallery", label: "See Transformations", value: card.gallery_url, attributedValue: `<a href="${card.gallery_url}">View Gallery</a>` }]
            : []),
        ],
      },
      ...(card.booking_url
        ? { barcode: { message: card.booking_url, format: "PKBarcodeFormatQR", messageEncoding: "iso-8859-1", altText: "Scan to Book" } }
        : {}),
    };

    const passFiles: Record<string, Uint8Array> = {};
    const passJsonBytes = new TextEncoder().encode(JSON.stringify(passJson, null, 2));
    passFiles["pass.json"] = passJsonBytes;

    let iconBytes: Uint8Array | null = null;
    if (card.logo_url) iconBytes = await fetchImageAsBytes(card.logo_url);
    if (!iconBytes) iconBytes = createMinimalPng();
    passFiles["icon.png"] = iconBytes;
    passFiles["icon@2x.png"] = iconBytes;

    if (card.logo_url) {
      const logoBytes = await fetchImageAsBytes(card.logo_url);
      if (logoBytes) {
        passFiles["logo.png"] = logoBytes;
        passFiles["logo@2x.png"] = logoBytes;
      }
    }

    if (card.hero_image_url) {
      const heroBytes = await fetchImageAsBytes(card.hero_image_url);
      if (heroBytes) {
        passFiles["strip.png"] = heroBytes;
        passFiles["strip@2x.png"] = heroBytes;
      }
    }

    // Build manifest
    const manifest: Record<string, string> = {};
    for (const [name, data] of Object.entries(passFiles)) {
      manifest[name] = await sha1Hex(data);
    }
    const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
    passFiles["manifest.json"] = manifestBytes;

    // Sign with PKCS7
    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(manifestBytes);
    p7.addCertificate(signerCert);
    p7.addCertificate(wwdrCert);
    p7.addSigner({
      key: signerKey,
      certificate: signerCert,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
        { type: forge.pki.oids.messageDigest },
        { type: forge.pki.oids.signingTime, value: new Date() },
      ],
    });
    p7.sign({ detached: true });

    const signatureDer = forge.asn1.toDer(p7.toAsn1()).getBytes();
    const signatureBytes = new Uint8Array(signatureDer.length);
    for (let i = 0; i < signatureDer.length; i++) {
      signatureBytes[i] = signatureDer.charCodeAt(i);
    }
    passFiles["signature"] = signatureBytes;

    // Create .pkpass ZIP
    const zip = new JSZip();
    for (const [name, data] of Object.entries(passFiles)) {
      zip.file(name, data);
    }
    const pkpassBuffer = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });

    return new Response(pkpassBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="${card.business_name.replace(/[^a-zA-Z0-9]/g, "-")}.pkpass"`,
      },
    });
  } catch (err) {
    console.error("generate-apple-pass error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to generate pass", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
