/**
 * The Kibuli Secondary School badge — shield with the KSS band, crescent and
 * star, open book, and the "SEEK KNOWLEDGE" ribbon — drawn as a vector from
 * the school's own copy, so it stays sharp at any size and on every printout.
 */
export const KSS_BADGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220">
<defs><mask id="kss-crescent"><rect width="200" height="220" fill="#fff"/><circle cx="99.6" cy="63.5" r="10.6" fill="#000"/></mask></defs>
<g fill="#fff" stroke="#111" stroke-width="3.2" stroke-linejoin="round">
<path d="M4 127h13v37H4zM183 127h13v37h-13z"/>
<path d="M17 128.8 100 181.5 183 128.8V164l-83 51-83-51z"/>
<path d="M18 6h164v119.4L100 177.5 18 125.4z"/>
<path d="M68 96q16-4 32 2.5V135q-30-14-60-3z"/>
<path d="M132 96q-16-4-32 2.5V135q30-14 60-3z"/>
</g>
<path fill="none" stroke="#111" stroke-width="2.6" stroke-linecap="round" d="M5 136h6M5 145.5h6M5 155h6M189 136h6M189 145.5h6M189 155h6"/>
<path fill="#111" d="M18 40.2h164v5H18zM18 82.5h164v5H18z"/>
<path fill="#111" d="M40 132q30-11 60 3v3.5q-30-12.5-60-3.9zM160 132q-30-11-60 3v3.5q30-12.5 60-3.9z"/>
<path stroke="#111" stroke-width="3.2" d="M100 98.5v39"/>
<circle cx="96" cy="66.5" r="11.9" fill="#111" mask="url(#kss-crescent)"/>
<polygon fill="#111" points="105.2,54.2 106.76,58.66 111.48,58.76 107.72,61.62 109.08,66.14 105.2,63.45 101.32,66.14 102.68,61.62 98.92,58.76 103.64,58.66"/>
<g fill="#111" font-family="'Arial Black', Arial, Helvetica, sans-serif" font-weight="900" font-size="32" text-anchor="middle">
<text x="48" y="37.3">K</text><text x="100" y="37.3">S</text><text x="152" y="37.3">S</text>
</g>
<g fill="#111" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="11.5" text-anchor="middle">
<text x="49" y="166.4" dy="4.1" transform="rotate(32 49 166.4)">SEEK</text>
<text x="135" y="176.4" dy="4.1" transform="rotate(-32 135 176.4)">KNOWLEDGE</text>
</g>
</svg>`;

/** As an image source: printed forms carry it inline and it shows without a connection. */
export const KSS_BADGE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(KSS_BADGE_SVG)}`;
