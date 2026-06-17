import "server-only";

// Server-side ЭЦП verification via NCANode (v3 REST). Run NCANode (Docker) and
// point NCANODE_URL at it, e.g. http://localhost:14579. We never write Java -
// NCANode wraps the official KalkanCrypt and returns the signer's certificate
// (including ИИН/БИН), validity, and revocation status.
const NCANODE_URL = process.env.NCANODE_URL ?? "http://localhost:14579";

export type CmsVerifyResult = {
  valid: boolean;
  /** ИИН or БИН from the signer certificate subject. */
  signerBin: string | null;
  signerName: string | null;
  raw: unknown;
};

type AnyObj = Record<string, unknown>;

// NCANode versions nest the certificate subject slightly differently; look in
// the common places so this survives minor version drift.
function subjectOf(signer: AnyObj): AnyObj | null {
  const candidates = [
    signer.subject,
    (signer.cert as AnyObj)?.subject,
    (signer.certificate as AnyObj)?.subject,
    ((signer.certificates as AnyObj[])?.[0] as AnyObj)?.subject,
  ];
  return (candidates.find((c) => c && typeof c === "object") as AnyObj) ?? null;
}

export async function verifyCms(
  cmsBase64: string,
  dataBase64: string
): Promise<CmsVerifyResult> {
  // NCANode's /cms/verify wants the RAW base64 of the CMS. NCALayer's `basics`
  // module returns the CMS wrapped in PEM armor:
  //   -----BEGIN CMS-----\n<base64>\n-----END CMS-----
  // The armor dashes are what NCANode's strict decoder rejects with
  // "Illegal base64 character 2d" ('-'). Strip the armor and whitespace so only
  // the base64 body is sent. (The PDF `data` has no armor and is unaffected.)
  const cms = stripPemToBase64(cmsBase64);
  const data = stripPemToBase64(dataBase64);

  const res = await fetch(`${NCANODE_URL.replace(/\/$/, "")}/cms/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cms, data, revocationCheck: ["OCSP"] }),
    cache: "no-store",
  });
  if (!res.ok) {
    // Surface NCANode's own message ({"status":400,"message":"…"}).
    const detail = await res.text().catch(() => "");
    let msg = `${res.status}`;
    try {
      const j = JSON.parse(detail) as { message?: string };
      if (j?.message) msg = `${res.status} - ${j.message}`;
    } catch {
      if (detail) msg = `${res.status} - ${detail.slice(0, 200)}`;
    }
    throw new Error(`NCANode ответил статусом ${msg}`);
  }

  const json = (await res.json()) as AnyObj;
  const signers = ((json.signers ??
    (json.result as AnyObj)?.signers ??
    []) as AnyObj[]);
  const first = signers[0];
  const subject = first ? subjectOf(first) : null;

  const signerBin =
    (subject?.bin as string) || (subject?.iin as string) || null;
  const signerName = (subject?.commonName as string) || null;

  // Top-level `valid` (v3) is authoritative; require at least one signer.
  const valid = json.valid === true && signers.length > 0;

  return { valid, signerBin, signerName, raw: json };
}

// Remove PEM armor (-----BEGIN …----- / -----END …-----) and all whitespace,
// leaving only the strict standard base64 body NCANode's Java decoder accepts.
// A bare base64 string (e.g. the PDF data) passes through with just whitespace
// stripped.
function stripPemToBase64(s: string): string {
  return s
    .replace(/-----(?:BEGIN|END)[^-]*-----/g, "")
    .replace(/\s+/g, "");
}

export function sameBin(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const da = a.replace(/\D/g, "");
  const db = b.replace(/\D/g, "");
  return da.length > 0 && da === db;
}
