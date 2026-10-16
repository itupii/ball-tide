import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const Body = z.object({
  mode: z.enum(["ticket", "match"]).default("ticket"),
  selections: z
    .array(
      z.object({
        match: z.string().max(200),
        market: z.string().max(80),
        pick: z.string().max(120),
        odds: z.number().min(1).max(1000),
        modelPct: z.number().nullable().optional(),
        date: z.string().max(40).optional(),
      }),
    )
    .max(20)
    .default([]),
  stake: z.number().min(0).max(1_000_000).default(0),
  context: z.string().max(16000).optional(),
});

const MATCH_SYSTEM = `Você é um analista quantitativo de futebol. Responda SEMPRE em português do Brasil, em Markdown, de forma direta e com números.
Analise a partida a partir das estatísticas recebidas (forma, médias, mandante/visitante, padrões, confronto direto, modelo Poisson, odds e dados ao vivo se houver).
Seções curtas:
## Leitura geral (quem chega melhor e por quê)
## Pontos fortes e fracos de cada equipe
## Mercados com valor (compare probabilidade do modelo x odd; liste 3 a 5 palpites com confiança baixa/média/alta)
## Brechas e padrões (tendências fortes, discrepâncias entre forma e odd)
## Riscos e alertas
Lembre que é uma simulação e não há garantia de resultado.`;

const SYSTEM = `Você é um analista quantitativo de futebol e apostas esportivas. Responda SEMPRE em português do Brasil.
Analise o bilhete recebido usando as probabilidades do modelo (Poisson baseado na forma recente), as odds e o contexto estatístico.
Estruture a resposta em Markdown com estas seções curtas:
## Veredito (uma linha: Bom valor / Neutro / Arriscado, com nota de 0 a 10)
## Seleção por seleção (probabilidade implícita da odd vs probabilidade do modelo, valor esperado, risco)
## Brechas e padrões encontrados (onde a odd parece mal precificada, tendências fortes)
## Sugestões para melhorar o bilhete (trocar, remover ou adicionar mercados, como Dupla Chance, Over/Under, Ambas Marcam)
## Gestão de banca (stake sugerida em % e alerta de risco)
Seja direto e use números. Lembre que é uma simulação e não há garantia de resultado.`;

export const Route = createFileRoute("/api/ai-ticket")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        const url = process.env["SUPABASE_URL"];
        const pub = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!token || !url || !pub) return new Response("Entre na sua conta para usar a análise com IA.", { status: 401 });
        const sb = createClient(url, pub, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (pub.startsWith("sb_") && h.get("Authorization") === `Bearer ${pub}`) h.delete("Authorization");
              h.set("apikey", pub);
              return fetch(input, { ...init, headers: h });
            },
          },
        });
        const { data: claims, error } = await sb.auth.getClaims(token);
        if (error || !claims?.claims?.sub) return new Response("Sessão inválida. Entre novamente.", { status: 401 });

        let body: z.infer<typeof Body>;
        try {
          body = Body.parse(await request.json());
        } catch {
          return new Response("Bilhete inválido.", { status: 400 });
        }
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("IA não configurada.", { status: 500 });

        const total = body.selections.reduce((a, s) => a * s.odds, 1);
        const lines = body.selections
          .map(
            (s, i) =>
              `${i + 1}. ${s.match} | Mercado: ${s.market} | Palpite: ${s.pick} | Odd: ${s.odds.toFixed(2)} (implícita ${(100 / s.odds).toFixed(1)}%) | Modelo: ${s.modelPct != null ? s.modelPct + "%" : "n/d"}`,
          )
          .join("\n");
        const userMsg = `Bilhete (${body.selections.length} seleções), odd total ${total.toFixed(2)}, stake R$ ${body.stake}.\n${lines}\n\nContexto estatístico adicional:\n${body.context ?? "(nenhum)"}`;

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
          method: "POST",
          signal: request.signal,
          headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
          body: JSON.stringify({
            model: "openai/gpt-6-astra",
            instructions: SYSTEM,
            input: [{ role: "user", content: userMsg }],
            stream: true,
            store: false,
            reasoning: { effort: "low", summary: "auto" },
            include: ["reasoning.encrypted_content"],
          }),
        });
        if (!upstream.ok || !upstream.body) {
          const t = await upstream.text();
          console.error(`AI gateway [${upstream.status}]: ${t}`);
          const msg =
            upstream.status === 402
              ? "Créditos de IA esgotados. Adicione créditos em Configurações → Planos e créditos."
              : upstream.status === 429
                ? "Muitas análises seguidas. Aguarde alguns segundos."
                : "A análise com IA falhou. Tente novamente.";
          return new Response(msg, { status: upstream.status });
        }

        const reader = upstream.body.getReader();
        const dec = new TextDecoder();
        const enc = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            let buf = "";
            try {
              for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += dec.decode(value, { stream: true });
                const parts = buf.split("\n");
                buf = parts.pop() ?? "";
                for (const line of parts) {
                  if (!line.startsWith("data:")) continue;
                  const payload = line.slice(5).trim();
                  if (!payload || payload === "[DONE]") continue;
                  try {
                    const ev = JSON.parse(payload);
                    if (ev.type === "response.output_text.delta" && ev.delta) controller.enqueue(enc.encode(ev.delta));
                    if (ev.type === "error" || ev.type === "response.failed")
                      controller.enqueue(enc.encode("\n\n_A análise foi interrompida._"));
                  } catch {
                    /* partial */
                  }
                }
              }
            } catch (e) {
              console.error(e);
            } finally {
              controller.close();
            }
          },
          cancel() {
            reader.cancel().catch(() => {});
          },
        });
        return new Response(stream, {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
