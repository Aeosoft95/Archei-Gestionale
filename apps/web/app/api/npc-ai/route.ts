import OpenAI from "openai"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

type Body = {
  name?: string
  role?: string
  look?: string
  personality?: string
  bonds?: string
  goals?: string
  locale?: string
  maxTokens?: number
  mode?: "auto" | "manual"
  tier?: string
  seed?: number
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "OPENAI_API_KEY mancante" }, { status: 500 })
    }

    const body = (await req.json()) as Body
    const mode = body.mode || "manual"

    if (mode === "auto") {
      const prompt = [
        "Genera un PNG per un gioco di ruolo fantasy.",
        "Deve includere: nome, ruolo, aspetto, personalità, legami, obiettivi, segreto, difetto, motivazione.",
        "Non rivelare i segreti nei testi pubblici.",
        `Livello di importanza: ${body.tier || "comune"}.`,
        `Lingua: ${body.locale || "italiano"}.`,
        "Rispondi in JSON."
      ].join(" ")

      const res = await client.responses.create({
        model: "gpt-4o-mini",
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
        max_output_tokens: body.maxTokens || 300,
      })

      const text =
        (res as any).output_text?.trim?.() ?? "NPC non generato."
      return Response.json({ ok: true, mode, npc: JSON.parse(text) })
    }

    // MANUAL
    const system = [
      "Sei un assistente per un gioco di ruolo.",
      "Scrivi una breve descrizione (3–5 frasi) scorrevole e immersiva.",
      "NON includere segreti o difetti nascosti.",
    ].join(" ")

    const user = [
      `Lingua: ${body.locale || "italiano"}`,
      `Nome: ${body.name}`,
      `Ruolo: ${body.role}`,
      `Aspetto: ${body.look}`,
      `Personalità: ${body.personality}`,
      body.bonds ? `Legami: ${body.bonds}` : "",
      body.goals ? `Obiettivi: ${body.goals}` : "",
    ].join("\n")

    const resp = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user", content: [{ type: "input_text", text: user }] },
      ],
      max_output_tokens: body.maxTokens || 220,
    })

    const text =
      (resp as any).output_text?.trim?.() ?? "Descrizione non disponibile."
    return Response.json({ ok: true, mode, description: text })
  } catch (err: any) {
    console.error("npc-ai error:", err)
    return Response.json({ error: err.message || "Errore interno" }, { status: 500 })
  }
}
