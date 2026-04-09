const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import forge from "npm:node-forge@1.3.1";
import JSZip from "npm:jszip@3.10.1";

// Apple WWDR G4 intermediate certificate (PEM)
const APPLE_WWDR_PEM = `-----BEGIN CERTIFICATE-----
MIIEVTCCAz2gAwIBAgIUE9x3lVJx5T3GMujM5io0pFGiEfowDQYJKoZIhvcNAQEL
BQAwYzEtMCsGA1UEAwwkQXBwbGUgV29ybGR3aWRlIERldmVsb3BlciBSZWxhdGlv
bnMxCzAJBgNVBAsMAlVTMRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJV
UzAeFw0yMjAxMTkxNzI4MzJaFw0yNzAxMTcxNzI4MzFaMGMxLTArBgNVBAMMJEFw
cGxlIFdvcmxkd2lkZSBEZXZlbG9wZXIgUmVsYXRpb25zMQswCQYDVQQLDAJVUzET
MBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwggEiMA0GCSqGSIb3DQEB
AQUAA4IBDwAwggEKAoIBAQC4RKhAoMGFOYONwMB+RgKSC0Ix3jTN7VJnyMVeIwgw
R6Dze4ZXCHXBQ5bLvahBD2y0LRSMz9ZQZG9lISbGbPOmD4j2cYHFbIJCMZ1NQ5x
Y2MXwXAQGLb78kp7MQKZ/S6MXJQFILWF9z6pLhvxCyAxR6q4sd6WNHXLK3+BjMr
1F2jPBVaLTSq1sP1JFKnoD4M4p/FHqaeJLc1e+xRFWJIKdjPGSPMq4YjIHOj3D7e
gcusP3BDf9IahX7yNU2v/2F6k0gyEMW3HGLbCBOBmN0I9AF7vPPxWI+ULTDOfpLN
x9h7qMUjn5oJhEMLiKk5f2X1GGRQoa+jIRGmFGPGiJllAgMBAAGjge0wgeowDwYD
VR0TAQH/BAUwAwEB/zAfBgNVHSMEGDAWgBQJ/sAVkPmvZAqSErkmwQ/OgLYbDzBs
BgNVHSAEZTBjMGEGBmeBDAEEATBXMEoGCCsGAQUFBwICMD4ePABUAGgAaQBzACAA
YwBlAHIAdABpAGYAaQBjAGEAdABlACAAaQBzACAAZgBvAHIAIAB0AGUAcwB0ADAl
MCMGCCsGAQUFBwIBFhdodHRwOi8vd3d3LmFwcGxlLmNvbS8wHQYDVR0OBBYEFGQP
lfVk/j1dJYfU5bfhPXFn0JJHMA4GA1UdDwEB/wQEAwIBhjANBgkqhkiG9w0BAQsF
AAOCAQEACclkBbZ8JpM6FjeLCKs2r9VOsOTZ+JBZAXM4pLRa4kMdOPi8rntRMhQB
L57LMGjk0TUHlFZKEsZcSPJhAtfJmN0JePgvmPG/IP/lPxRCGMk4xp+OH1J+OJq1
EPxr31PVehIKaR8J3SaE3jGsFJrshxDHVRzqr5+bYeE+tkdjPCuH/+NR5j6Z28qX
Y+8y/sO+ec2EzWFNkagXB6o03Ee43ieBWp7bJHKVe5lbfbRbJRGiaUBMECxmIe0F
n6bCkP4z6y0O/Z2JtPMgVJQd9VK9JyxL4J1l0U2r1WCoMnJFmSGELIw5bIBg/Asm
E+0/HuYdMDO/LJxSpZTpH2tHG6hVjA==
-----END CERTIFICATE-----`;

async function sha1Hex(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Generate a simple 1x1 white PNG as fallback icon
function createMinimalPng(): Uint8Array {
  // Minimal valid 1x1 white PNG
  const png = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
    0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, 0x00,
    0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  return png;
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

    // Fetch card data
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

    // Get secrets
    const p12Base64 = Deno.env.get("APPLE_PASS_P12_BASE64");
    const p12Password = Deno.env.get("APPLE_PASS_P12_PASSWORD");
    const teamId = Deno.env.get("APPLE_PASS_TEAM_ID");
    const passTypeId = Deno.env.get("APPLE_PASS_TYPE_ID");

    if (!p12Base64 || !p12Password || !teamId || !passTypeId) {
      return new Response(
        JSON.stringify({ error: "Apple Wallet not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse P12
    const p12Der = forge.util.decode64(p12Base64);
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, p12Password);

    // Extract certificate and private key
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });

    const certBag = (certBags[forge.pki.oids.certBag] || [])[0];
    const keyBag = (keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0];

    if (!certBag?.cert || !keyBag?.key) {
      return new Response(
        JSON.stringify({ error: "Failed to extract certificate/key from P12" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const signerCert = certBag.cert;
    const signerKey = keyBag.key;

    // Parse WWDR cert
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
          {
            key: "name",
            label: "SPECIALIST",
            value: card.business_name,
          },
        ],
        secondaryFields: [
          ...(card.phone
            ? [{ key: "phone", label: "PHONE", value: card.phone }]
            : []),
          ...(card.email
            ? [{ key: "email", label: "EMAIL", value: card.email }]
            : []),
        ],
        backFields: [
          ...(card.booking_url
            ? [
                {
                  key: "booking",
                  label: "Book Free Consultation",
                  value: card.booking_url,
                  attributedValue: `<a href="${card.booking_url}">Book Now</a>`,
                },
              ]
            : []),
          ...(card.gallery_url
            ? [
                {
                  key: "gallery",
                  label: "See Transformations",
                  value: card.gallery_url,
                  attributedValue: `<a href="${card.gallery_url}">View Gallery</a>`,
                },
              ]
            : []),
        ],
      },
      ...(card.booking_url
        ? {
            barcode: {
              message: card.booking_url,
              format: "PKBarcodeFormatQR",
              messageEncoding: "iso-8859-1",
              altText: "Scan to Book",
            },
          }
        : {}),
    };

    // Prepare files for the pass
    const passFiles: Record<string, Uint8Array> = {};

    // pass.json
    const passJsonBytes = new TextEncoder().encode(
      JSON.stringify(passJson, null, 2)
    );
    passFiles["pass.json"] = passJsonBytes;

    // Icon - try to fetch logo, fallback to minimal PNG
    let iconBytes: Uint8Array | null = null;
    if (card.logo_url) {
      iconBytes = await fetchImageAsBytes(card.logo_url);
    }
    if (!iconBytes) {
      iconBytes = createMinimalPng();
    }
    passFiles["icon.png"] = iconBytes;
    passFiles["icon@2x.png"] = iconBytes;

    // Logo for pass display
    if (card.logo_url) {
      const logoBytes = await fetchImageAsBytes(card.logo_url);
      if (logoBytes) {
        passFiles["logo.png"] = logoBytes;
        passFiles["logo@2x.png"] = logoBytes;
      }
    }

    // Thumbnail / strip image
    if (card.hero_image_url) {
      const heroBytes = await fetchImageAsBytes(card.hero_image_url);
      if (heroBytes) {
        passFiles["strip.png"] = heroBytes;
        passFiles["strip@2x.png"] = heroBytes;
      }
    }

    // Build manifest.json (SHA1 of each file)
    const manifest: Record<string, string> = {};
    for (const [name, data] of Object.entries(passFiles)) {
      manifest[name] = await sha1Hex(data);
    }
    const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
    passFiles["manifest.json"] = manifestBytes;

    // Sign manifest with PKCS7
    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(manifestBytes);
    p7.addCertificate(signerCert);
    p7.addCertificate(wwdrCert);
    p7.addSigner({
      key: signerKey,
      certificate: signerCert,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        {
          type: forge.pki.oids.contentType,
          value: forge.pki.oids.data,
        },
        {
          type: forge.pki.oids.messageDigest,
        },
        {
          type: forge.pki.oids.signingTime,
          value: new Date(),
        },
      ],
    });
    p7.sign({ detached: true });

    const signatureDer = forge.asn1.toDer(p7.toAsn1()).getBytes();
    const signatureBytes = new Uint8Array(signatureDer.length);
    for (let i = 0; i < signatureDer.length; i++) {
      signatureBytes[i] = signatureDer.charCodeAt(i);
    }
    passFiles["signature"] = signatureBytes;

    // Create ZIP (.pkpass)
    const zip = new JSZip();
    for (const [name, data] of Object.entries(passFiles)) {
      zip.file(name, data);
    }

    const pkpassBuffer = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
    });

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
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
