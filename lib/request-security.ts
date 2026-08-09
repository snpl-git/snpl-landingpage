export class RequestBodyError extends Error {
  readonly status: 400 | 413 | 415

  constructor(status: 400 | 413 | 415) {
    super('Invalid request body')
    this.status = status
  }
}

export async function readJsonBody(req: Request, maxBytes: number) {
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new RequestBodyError(415)
  }
  const declared = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(declared) && declared > maxBytes) throw new RequestBodyError(413)
  const bytes = new Uint8Array(await req.arrayBuffer())
  if (bytes.byteLength > maxBytes) throw new RequestBodyError(413)
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch {
    throw new RequestBodyError(400)
  }
}
