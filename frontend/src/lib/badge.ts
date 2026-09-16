/**
 * The Kibuli Secondary School badge — shield with the KSS band, crescent and
 * star, open book and ribbon — redrawn as a vector from the school's LPO book
 * so it stays sharp at any size. The ribbon's motto isn't legible in the book,
 * so it is left plain.
 */
export const KSS_BADGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 196">
<defs><mask id="kss-crescent"><rect width="240" height="196" fill="#fff"/><circle cx="119" cy="58" r="10.2" fill="#000"/></mask></defs>
<g fill="none" stroke="#111827" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">
<path d="M40 8 H200 V110 L120 172 L40 110 Z" fill="#fff"/>
<path d="M40 42 H200 M40 80 H200"/>
<path d="M80 92 H160 L188 124 Q154 116 120 128 Q86 116 52 124 Z"/>
<path d="M120 92 V128"/>
<path d="M52 124 Q86 116 120 128 Q154 116 188 124" stroke-width="8"/>
<path d="M26 120 L120 160 L214 114 L231 112 L222 124 L233 135 L222 136 L120 186 L18 142 L7 143 L17 131 L9 121 Z" fill="#fff"/>
</g>
<text x="126" y="35" text-anchor="middle" font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900" font-size="30" letter-spacing="12" fill="#111827">KSS</text>
<circle cx="114" cy="61" r="12" fill="#111827" mask="url(#kss-crescent)"/>
<polygon fill="#111827" points="130,51.7 131.06,54.55 134.09,54.67 131.71,56.56 132.53,59.48 130,57.8 127.47,59.48 128.29,56.56 125.91,54.67 128.94,54.55"/>
</svg>`;

/** As an image source: printed forms carry it inline and it shows without a connection. */
export const KSS_BADGE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(KSS_BADGE_SVG)}`;
