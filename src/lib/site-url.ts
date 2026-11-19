/** Use the configured public origin for links sent outside this request. */
export function siteOrigin(request: Request): string {
  const url = new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid site URL configuration');
  return url.origin;
}
