/** Normaliza nomes de times/jogadores para casar IDs de provedores diferentes (ESPN x Sportmonks). */
const NOISE = new Set([
  "fc",
  "ec",
  "sc",
  "cr",
  "ca",
  "se",
  "ac",
  "afc",
  "esporte",
  "clube",
  "futebol",
  "de",
  "do",
  "da",
  "regatas",
]);

/** Gentílicos usados por alguns provedores no lugar da sigla do estado. */
const ALIAS: Record<string, string> = {
  mineiro: "mg",
  paranaense: "pr",
  goianiense: "go",
  paulista: "sp",
  gaucho: "rs",
};

export function normName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/athletico/g, "atletico")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !NOISE.has(w))
    .map((w) => ALIAS[w] ?? w)
    .join(" ");
}

export function sameTeam(a: string, b: string): boolean {
  const x = normName(a);
  const y = normName(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}
