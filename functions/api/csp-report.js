// POST /api/csp-report: browsers send what the Content-Security-Policy (see /_headers) blocked, or would block in report-only mode.
// Each report is written to the Worker log as one short line; nothing is stored. Bodies over 16 KB are ignored.
const MAX = 16384;
const short = (v) => String(v ?? '').slice(0, 300);

// Both report formats: report-uri sends { "csp-report": {...} }, report-to sends [{ type, body: {...} }]
export function summarize(data) {
  const list = Array.isArray(data) ? data.filter(r => r && r.type === 'csp-violation').map(r => r.body) : [data && data['csp-report']];
  return list.filter(b => b && typeof b === 'object').map(b => ({
    page: short(b.documentURL ?? b['document-uri']),
    directive: short(b.effectiveDirective ?? b['effective-directive'] ?? b['violated-directive']),
    blocked: short(b.blockedURL ?? b['blocked-uri']),
    where: b.sourceFile || b['source-file'] ? `${short(b.sourceFile ?? b['source-file'])}:${+(b.lineNumber ?? b['line-number']) || 0}` : '',
  }));
}

export async function onRequestPost({ request }) {
  if (+(request.headers.get('content-length') || 0) > MAX) return new Response(null, { status: 413 });
  const text = await request.text();
  if (text.length > MAX) return new Response(null, { status: 413 });
  let data = null;
  try { data = JSON.parse(text); } catch (e) { return new Response(null, { status: 400 }); }
  for (const r of summarize(data).slice(0, 20)) console.log('csp', JSON.stringify(r));
  return new Response(null, { status: 204 });
}
