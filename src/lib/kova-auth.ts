export function verifyKovaApiKey(request: Request): boolean {
  const apiKey = request.headers.get("x-api-key");
  return !!apiKey && apiKey === process.env.KOVA_API_KEY;
}
