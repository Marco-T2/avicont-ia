// Convierte un monto a su literal en español-Bolivia, formato contable.
// Salida: "{LITERAL EN MAYUSCULAS} CC/100 BS"
// Rango soportado: [0, 999_999_999.99]. El 3er decimal se redondea half-up.

const UNITS: Record<number, string> = {
  0: "CERO",
  1: "UNO",
  2: "DOS",
  3: "TRES",
  4: "CUATRO",
  5: "CINCO",
  6: "SEIS",
  7: "SIETE",
  8: "OCHO",
  9: "NUEVE",
  10: "DIEZ",
  11: "ONCE",
  12: "DOCE",
  13: "TRECE",
  14: "CATORCE",
  15: "QUINCE",
  16: "DIECISEIS",
  17: "DIECISIETE",
  18: "DIECIOCHO",
  19: "DIECINUEVE",
  20: "VEINTE",
  21: "VEINTIUNO",
  22: "VEINTIDOS",
  23: "VEINTITRES",
  24: "VEINTICUATRO",
  25: "VEINTICINCO",
  26: "VEINTISEIS",
  27: "VEINTISIETE",
  28: "VEINTIOCHO",
  29: "VEINTINUEVE",
};

const TENS: Record<number, string> = {
  30: "TREINTA",
  40: "CUARENTA",
  50: "CINCUENTA",
  60: "SESENTA",
  70: "SETENTA",
  80: "OCHENTA",
  90: "NOVENTA",
};

const HUNDREDS: Record<number, string> = {
  100: "CIENTO",
  200: "DOSCIENTOS",
  300: "TRESCIENTOS",
  400: "CUATROCIENTOS",
  500: "QUINIENTOS",
  600: "SEISCIENTOS",
  700: "SETECIENTOS",
  800: "OCHOCIENTOS",
  900: "NOVECIENTOS",
};

function under100(n: number): string {
  if (n < 30) return UNITS[n];
  const ten = Math.floor(n / 10) * 10;
  const unit = n % 10;
  if (unit === 0) return TENS[ten];
  return `${TENS[ten]} Y ${UNITS[unit]}`;
}

function under1000(n: number): string {
  if (n < 100) return under100(n);
  if (n === 100) return "CIEN";
  const hundred = Math.floor(n / 100) * 100;
  const rest = n % 100;
  if (rest === 0) return HUNDREDS[hundred];
  return `${HUNDREDS[hundred]} ${under100(rest)}`;
}

function under1_000_000(n: number): string {
  if (n < 1000) return under1000(n);
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const thousandsPart = thousands === 1 ? "MIL" : `${under1000(thousands)} MIL`;
  if (rest === 0) return thousandsPart;
  return `${thousandsPart} ${under1000(rest)}`;
}

function integerToWords(n: number): string {
  if (n === 0) return "CERO";
  if (n < 1_000_000) return under1_000_000(n);
  const millions = Math.floor(n / 1_000_000);
  const rest = n % 1_000_000;
  const millionsPart =
    millions === 1 ? "UN MILLON" : `${under1_000_000(millions)} MILLONES`;
  if (rest === 0) return millionsPart;
  return `${millionsPart} ${under1_000_000(rest)}`;
}

function roundToCents(n: number): { integer: number; cents: number } {
  // Half-up en centavos evitando errores de coma flotante.
  const totalCents = Math.round(n * 100 + Number.EPSILON);
  return {
    integer: Math.floor(totalCents / 100),
    cents: totalCents % 100,
  };
}

export function amountToWordsEs(amount: string | number): string {
  const num = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`amountToWordsEs: invalid amount "${amount}"`);
  }
  const { integer, cents } = roundToCents(num);
  const literal = integerToWords(integer);
  const centsStr = String(cents).padStart(2, "0");
  return `${literal} ${centsStr}/100 BS`;
}
