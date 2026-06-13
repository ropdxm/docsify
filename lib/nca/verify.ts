import "server-only";

// Server-side ЭЦП verification via NCANode (v3 REST). Run NCANode (Docker) and
// point NCANODE_URL at it, e.g. http://localhost:14579. We never write Java —
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
  // NCANode's Java base64 decoder is strict — strip any PEM-style line breaks
  // or whitespace NCALayer may have wrapped the signature with.
  const cms = cmsBase64.replace(/\s+/g, "");
  const data = dataBase64.replace(/\s+/g, "");

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
      if (j?.message) msg = `${res.status} — ${j.message}`;
    } catch {
      if (detail) msg = `${res.status} — ${detail.slice(0, 200)}`;
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

export function sameBin(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const da = a.replace(/\D/g, "");
  const db = b.replace(/\D/g, "");
  return da.length > 0 && da === db;
}
