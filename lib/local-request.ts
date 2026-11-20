// Next may build request.url with its internal hostname. Validate the browser's
// public Host instead, while still restricting both Host and Origin to loopback.
export function isLocalRequest(request: Request) {
  try {
    const internal = new URL(request.url);
    const expected = new URL(
      internal.protocol + '//' + (request.headers.get('host') || internal.host),
    );
    if (
      !['http:', 'https:'].includes(expected.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(expected.hostname)
    )
      return false;
    const origin = request.headers.get('origin');
    return !origin || new URL(origin).origin === expected.origin;
  } catch {
    return false;
  }
}
