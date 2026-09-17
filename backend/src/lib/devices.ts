/** "Edge on Windows", from the user agent a browser sent when it signed in. */
export function describeDevice(userAgent?: string | null): string {
  if (!userAgent) return "Unknown device";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\/|Opera/.test(userAgent)
    ? "Opera"
    : /Firefox\//.test(userAgent)
    ? "Firefox"
    : /Chrome\//.test(userAgent)
    ? "Chrome"
    : /Safari\//.test(userAgent)
    ? "Safari"
    : "A browser";
  const system = /Windows NT/.test(userAgent)
    ? "Windows"
    : /Android/.test(userAgent)
    ? "Android"
    : /iPhone|iPad|iPod/.test(userAgent)
    ? "iOS"
    : /Mac OS X|Macintosh/.test(userAgent)
    ? "macOS"
    : /CrOS/.test(userAgent)
    ? "ChromeOS"
    : /Linux/.test(userAgent)
    ? "Linux"
    : "an unknown system";
  return `${browser} on ${system}`;
}
