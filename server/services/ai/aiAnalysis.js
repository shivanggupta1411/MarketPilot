const axios = require("axios");
const { GoogleGenAI } = require("@google/genai");

/*
====================================================
CONFIG
====================================================
*/

// Fastest/reliable provider first based on your current testing
const OPENROUTER_MODEL = "openrouter/free";
const GROQ_MODEL = "openai/gpt-oss-120b";

// Gemini is now a fallback instead of making us wait
// through multiple Gemini models.
const GEMINI_MODEL = "gemini-3.8-flash";

// Hard timeout for each provider.
// If a provider doesn't answer in this time,
// we immediately move to the next one.
const PROVIDER_TIMEOUT = 12000;

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});


/*
====================================================
PROMPT
====================================================
*/

function buildPrompt(productIdea, report) {
    const evidence = report.evidence || [];

    const evidenceText = evidence
        .map(item => `
Evidence ID: ${item.id}
Type: ${item.type}
Source: ${item.source}
Title: ${item.title}
Signal Strength: ${item.signalStrength}
Snippet: ${item.snippet}
URL: ${item.url}
`)
        .join("\n");

    return `
You are the market intelligence analyst inside MarketPilot.

Product idea:
${productIdea}

Evidence overview:
- Total evidence items: ${report.overview?.totalEvidence || 0}
- Sources analyzed: ${report.overview?.sourcesAnalyzed || 0}
- Source diversity: ${report.overview?.sourceDiversity || 0} unique domains
- Confidence: ${report.overview?.confidence || 0}%

You have been given web-search evidence collected by SerpApi.

Analyze ONLY the evidence provided.

Do not invent:
- companies
- prices
- statistics
- customer problems
- market trends
- market sizes
- competitors

Create a concise founder-focused market analysis containing:

1. Executive Summary
2. Competitor Landscape
3. Pricing Insights
4. Customer Pain Points
5. Market Signals
6. Market Opportunities
7. Risks / Uncertainties
8. Recommended Positioning
9. Key Evidence

IMPORTANT:
- Every factual claim should reference one or more Evidence IDs.
- Clearly distinguish evidence from inference.
- Consider source diversity when judging how strong a finding is.
- Do not treat repeated results from the same domain as independent confirmation.
- If evidence is insufficient for a conclusion, say so.
- Do not present speculation as fact.
- Keep the analysis practical for a startup founder.

Return ONLY valid JSON:

{
  "executiveSummary": "",
  "competitorLandscape": [],
  "pricingInsights": [],
  "customerPainPoints": [],
  "marketSignals": [],
  "marketOpportunities": [],
  "risks": [],
  "recommendedPositioning": [],
  "keyEvidence": []
}

Each array item should be a short, useful statement.

Include Evidence IDs such as "E4" or ["E4", "E12"] where relevant.

WEB EVIDENCE:
${evidenceText}
`;
}


/*
====================================================
JSON PARSER
====================================================
*/

function parseJSON(text) {
    if (!text) {
        throw new Error("AI returned empty response");
    }

    try {
        return JSON.parse(text);
    } catch {
        const cleaned = text
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        try {
            return JSON.parse(cleaned);
        } catch {
            throw new Error("AI returned invalid JSON");
        }
    }
}


/*
====================================================
VALIDATION
====================================================
*/

function validateAIResult(result) {
    if (!result || typeof result !== "object") {
        throw new Error("AI response is not an object");
    }

    const requiredFields = [
        "executiveSummary",
        "competitorLandscape",
        "pricingInsights",
        "customerPainPoints",
        "marketSignals",
        "marketOpportunities",
        "risks",
        "recommendedPositioning",
        "keyEvidence"
    ];

    for (const field of requiredFields) {
        if (!(field in result)) {
            throw new Error(
                `AI response missing field: ${field}`
            );
        }
    }

    return result;
}


/*
====================================================
GEMINI
====================================================
*/

async function callGemini(prompt) {
    console.log(
        `[AI] Trying Gemini: ${GEMINI_MODEL}`
    );

    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            reject(
                new Error(
                    `Gemini timeout after ${PROVIDER_TIMEOUT}ms`
                )
            );
        }, PROVIDER_TIMEOUT);
    });

    const requestPromise = ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            temperature: 0.2
        }
    });

    const response = await Promise.race([
        requestPromise,
        timeoutPromise
    ]);

    return validateAIResult(
        parseJSON(response.text)
    );
}


/*
====================================================
OPENROUTER
====================================================
*/

async function callOpenRouter(prompt) {
    console.log(
        `[AI] Trying OpenRouter: ${OPENROUTER_MODEL}`
    );

    const response = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
            model: OPENROUTER_MODEL,

            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],

            temperature: 0.2,

            response_format: {
                type: "json_object"
            }
        },
        {
            timeout: PROVIDER_TIMEOUT,

            headers: {
                Authorization:
                    `Bearer ${process.env.OPENROUTER_API_KEY}`,

                "Content-Type":
                    "application/json",

                "HTTP-Referer":
                    "http://localhost:5000",

                "X-Title":
                    "MarketPilot"
            }
        }
    );

    const content =
        response.data?.choices?.[0]?.message?.content;

    return validateAIResult(
        parseJSON(content)
    );
}


/*
====================================================
GROQ
====================================================
*/

async function callGroq(prompt) {
    console.log(
        `[AI] Trying Groq: ${GROQ_MODEL}`
    );

    const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
            model: GROQ_MODEL,

            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],

            temperature: 0.2,

            response_format: {
                type: "json_object"
            }
        },
        {
            timeout: PROVIDER_TIMEOUT,

            headers: {
                Authorization:
                    `Bearer ${process.env.GROQ_API_KEY}`,

                "Content-Type":
                    "application/json"
            }
        }
    );

    const content =
        response.data?.choices?.[0]?.message?.content;

    return validateAIResult(
        parseJSON(content)
    );
}


/*
====================================================
DETERMINISTIC FALLBACK
====================================================
*/

function deterministicFallback(productIdea, report) {

    const getTitles = (section) => {

        if (
            !section ||
            !Array.isArray(section.evidence)
        ) {
            return [];
        }

        return section.evidence
            .slice(0, 5)
            .map(item => {

                const evidenceId = item.id
                    ? ` [${item.id}]`
                    : "";

                return `${item.title}${evidenceId}`;
            });
    };


    const getEvidenceStatements = (section) => {

        if (
            !section ||
            !Array.isArray(section.evidence)
        ) {
            return [];
        }

        return section.evidence
            .slice(0, 5)
            .map(item => {

                const evidenceId = item.id
                    ? ` [${item.id}]`
                    : "";

                return `${item.snippet}${evidenceId}`;
            });
    };


    const competitors =
        getTitles(report.competitor);


    const pricing =
        getEvidenceStatements(report.pricing);


    const pain =
        getEvidenceStatements(report.customerPain);


    const signals =
        getEvidenceStatements(report.marketSignals);


    const opportunities =
        getEvidenceStatements(report.opportunity);


    return {

        model:
            "deterministic-evidence-engine",

        fallbackUsed:
            true,

        executiveSummary:
            `MarketPilot collected ${
                report.overview?.totalEvidence || 0
            } pieces of web evidence for "${productIdea}". ` +
            `The following analysis is generated directly ` +
            `from the collected evidence because AI providers ` +
            `were unavailable.`,

        competitorLandscape:
            competitors.length
                ? competitors
                : [
                    "No strong competitor evidence identified."
                ],

        pricingInsights:
            pricing.length
                ? pricing
                : [
                    "Insufficient pricing evidence."
                ],

        customerPainPoints:
            pain.length
                ? pain
                : [
                    "Insufficient customer-pain evidence."
                ],

        marketSignals:
            signals.length
                ? signals
                : [
                    "Insufficient market-signal evidence."
                ],

        marketOpportunities:
            opportunities.length
                ? opportunities
                : [
                    "Insufficient opportunity evidence."
                ],

        risks: [
            "AI reasoning services were unavailable.",
            "Evidence coverage may be incomplete.",
            "Search snippets should be verified before making major business decisions."
        ],

        recommendedPositioning: [
            "Use the strongest customer-pain evidence to define the initial problem.",
            "Compare competitor positioning before selecting a differentiated value proposition.",
            "Validate pricing assumptions against the cited source evidence.",
            "Prioritize opportunities supported by multiple independent sources."
        ],

        keyEvidence:
            report.evidence
                ? report.evidence
                    .slice()
                    .sort(
                        (a, b) =>
                            b.signalStrength -
                            a.signalStrength
                    )
                    .slice(0, 10)
                    .map(item => ({
                        id: item.id,
                        title: item.title,
                        type: item.type,
                        source: item.source,
                        signalStrength:
                            item.signalStrength,
                        url: item.url
                    }))
                : []
    };
}


/*
====================================================
MAIN AI PIPELINE
====================================================
*/

async function analyzeMarket(productIdea, report) {

    const prompt =
        buildPrompt(productIdea, report);


    console.log("\n========================================");
    console.log("MARKETPILOT AI ANALYSIS");
    console.log("========================================");


    /*
    ----------------------------------------
    PROVIDER 1: OPENROUTER
    ----------------------------------------
    */

    if (process.env.OPENROUTER_API_KEY) {

        const start = Date.now();

        try {

            const result =
                await callOpenRouter(prompt);

            const duration =
                Date.now() - start;

            console.log(
                `[AI] ✓ OpenRouter succeeded in ${duration}ms`
            );

            console.log(
                `[AI] Provider used: ${OPENROUTER_MODEL}`
            );

            console.log(
                "========================================\n"
            );

            return {
                model: OPENROUTER_MODEL,
                fallbackUsed: false,
                ...result
            };

        } catch (error) {

            const duration =
                Date.now() - start;

            console.error(
                `[AI] ✗ OpenRouter failed after ${duration}ms`
            );

            console.error(
                "[AI] Error:",
                error.response?.data ||
                error.message
            );
        }
    } else {

        console.log(
            "[AI] OpenRouter skipped: API key missing"
        );
    }


    /*
    ----------------------------------------
    PROVIDER 2: GROQ
    ----------------------------------------
    */

    if (process.env.GROQ_API_KEY) {

        const start = Date.now();

        try {

            const result =
                await callGroq(prompt);

            const duration =
                Date.now() - start;

            console.log(
                `[AI] ✓ Groq succeeded in ${duration}ms`
            );

            console.log(
                `[AI] Provider used: ${GROQ_MODEL}`
            );

            console.log(
                "========================================\n"
            );

            return {
                model: GROQ_MODEL,
                fallbackUsed: true,
                ...result
            };

        } catch (error) {

            const duration =
                Date.now() - start;

            console.error(
                `[AI] ✗ Groq failed after ${duration}ms`
            );

            console.error(
                "[AI] Error:",
                error.response?.data ||
                error.message
            );
        }

    } else {

        console.log(
            "[AI] Groq skipped: API key missing"
        );
    }


    /*
    ----------------------------------------
    PROVIDER 3: GEMINI
    ----------------------------------------
    */

    if (process.env.GEMINI_API_KEY) {

        const start = Date.now();

        try {

            const result =
                await callGemini(prompt);

            const duration =
                Date.now() - start;

            console.log(
                `[AI] ✓ Gemini succeeded in ${duration}ms`
            );

            console.log(
                `[AI] Provider used: ${GEMINI_MODEL}`
            );

            console.log(
                "========================================\n"
            );

            return {
                model: GEMINI_MODEL,
                fallbackUsed: true,
                ...result
            };

        } catch (error) {

            const duration =
                Date.now() - start;

            console.error(
                `[AI] ✗ Gemini failed after ${duration}ms`
            );

            console.error(
                "[AI] Error:",
                error.message
            );
        }

    } else {

        console.log(
            "[AI] Gemini skipped: API key missing"
        );
    }


    /*
    ----------------------------------------
    FINAL FALLBACK
    ----------------------------------------
    */

    console.log(
        "[AI] All AI providers failed."
    );

    console.log(
        "[AI] Using deterministic evidence engine."
    );

    console.log(
        "[AI] Provider used: deterministic-evidence-engine"
    );

    console.log(
        "========================================\n"
    );


    return deterministicFallback(
        productIdea,
        report
    );
}


module.exports = {
    analyzeMarket
};