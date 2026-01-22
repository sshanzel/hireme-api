/**
 * Bullet-like characters to normalize to the standard bullet `•`
 */
const bulletCharacters = [
  '●', // Black Circle (U+25CF)
  '○', // White Circle (U+25CB)
  '■', // Black Square (U+25A0)
  '□', // White Square (U+25A1)
  '▪', // Black Small Square (U+25AA)
  '▫', // White Small Square (U+25AB)
  '►', // Black Right-Pointing Pointer (U+25BA)
  '▸', // Black Right-Pointing Small Triangle (U+25B8)
  '▹', // White Right-Pointing Small Triangle (U+25B9)
  '‣', // Triangular Bullet (U+2023)
  '◦', // White Bullet (U+25E6)
  '◉', // Fisheye (U+25C9)
  '◎', // Bullseye (U+25CE)
  '⁃', // Hyphen Bullet (U+2043)
  '⦿', // Circled Bullet (U+29BF)
  '⚫', // Medium Black Circle (U+26AB)
  '⚪', // Medium White Circle (U+26AA)
];

/**
 * Normalizes various bullet characters to the standard bullet `•` (U+2022)
 */
export function sanitizeBullets(text: string): string {
  const pattern = new RegExp(`[${bulletCharacters.join('')}]`, 'g');
  return text.replace(pattern, '');
}
