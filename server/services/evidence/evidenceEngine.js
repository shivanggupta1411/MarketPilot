function normalizeUrl(url) {
    if (!url) return "";

    try {
        const parsed = new URL(url);
        parsed.hash = "";
        parsed.search = "";
        return parsed.toString().replace(/\/$/, "");
    } catch {
        return url;
    }
}

function cleanText(text) {
    if (!text) return "";

    return text
        .replace(/\s+/g, " ")
        .replace(/\.\.\./g, "")
        .trim();
}

function detectEvidenceType(category, text) {
    const value = text.toLowerCase();

    // Category gets priority over keyword matching
    if (category === "competitors") {
        return "competitor";
    }

    if (category === "pricing") {
        return "pricing";
    }

    if (category === "customerPain") {
        return "customer_pain";
    }

    if (category === "marketSignals") {
        return "market_signal";
    }

    if (category === "opportunities") {
        return "opportunity";
    }

    // Fallback keyword detection
    if (
        value.includes("price") ||
        value.includes("$") ||
        value.includes("₹")
    ) {
        return "pricing";
    }

    if (
        value.includes("problem") ||
        value.includes("complaint") ||
        value.includes("pain") ||
        value.includes("issue")
    ) {
        return "customer_pain";
    }

    if (value.includes("trend")) {
        return "market_signal";
    }

    if (
        value.includes("opportunity") ||
        value.includes("gap") ||
        value.includes("underserved")
    ) {
        return "opportunity";
    }

    return "general";
}

function calculateSignalStrength(item, duplicateCount) {
    let score = 40;

    // Stronger snippet = more usable evidence
    if (item.snippet.length > 100) {
        score += 10;
    }

    // Search result has an identifiable source
    if (item.source) {
        score += 5;
    }

    // Repeated appearance across searches
    if (duplicateCount > 1) {
        score += Math.min(duplicateCount * 5, 20);
    }

    // Customer pain is especially useful for founder decisions
    if (item.category === "customerPain") {
        score += 5;
    }

    // Give established source types a modest boost
    const source = (item.source || "").toLowerCase();

    if (
        source.includes("reuters") ||
        source.includes("forbes") ||
        source.includes("techcrunch") ||
        source.includes("mckinsey") ||
        source.includes("statista")
    ) {
        score += 10;
    }

    return Math.min(score, 100);
}

function calculateSourceDiversity(evidence) {
    const domains = new Set();

    for (const item of evidence) {
        if (!item.url) continue;

        try {
            const hostname = new URL(item.url).hostname
                .replace(/^www\./, "");

            domains.add(hostname);
        } catch {
            continue;
        }
    }

    return domains.size;
}

function calculateConfidence(evidence, sourceDiversity) {
    if (!evidence.length) {
        return 0;
    }

    const averageSignal =
        evidence.reduce(
            (sum, item) => sum + item.signalStrength,
            0
        ) / evidence.length;

    const diversityScore =
        Math.min(sourceDiversity / 10, 1) * 100;

    return Math.round(
        averageSignal * 0.7 +
        diversityScore * 0.3
    );
}

function buildEvidence(rawResults) {
    const evidence = [];
    const seen = new Map();

    for (const [category, results] of Object.entries(rawResults)) {
        if (!Array.isArray(results)) continue;

        for (const result of results) {
            const url = normalizeUrl(result.link);
            const title = cleanText(result.title);
            const snippet = cleanText(result.snippet);

            const uniqueKey = url || title.toLowerCase();

            if (!uniqueKey) continue;

            const existing = seen.get(uniqueKey);

            if (existing) {
                existing.duplicateCount++;
                continue;
            }

            const evidenceItem = {
                id: `E${evidence.length + 1}`,
                category,
                type: detectEvidenceType(
                    category,
                    `${title} ${snippet}`
                ),
                title,
                source: result.source || "",
                url,
                snippet,
                position: result.position,
                duplicateCount: 1,
                signalStrength: 0
            };

            seen.set(uniqueKey, evidenceItem);
            evidence.push(evidenceItem);
        }
    }

    for (const item of evidence) {
        item.signalStrength = calculateSignalStrength(
            item,
            item.duplicateCount
        );
    }

    return evidence;
}

function summarizeEvidence(evidence) {
    const summary = {};

    for (const item of evidence) {
        if (!summary[item.category]) {
            summary[item.category] = 0;
        }

        summary[item.category]++;
    }

    return summary;
}

function runEvidenceEngine(rawResults) {
    const evidence = buildEvidence(rawResults);

    const sourceDiversity = calculateSourceDiversity(evidence);

    const confidence = calculateConfidence(
    evidence,
    sourceDiversity
    );

    return {
        totalEvidence: evidence.length,
        categoryCounts: summarizeEvidence(evidence),
	sourceDiversity,
	confidence,
        evidence
    };
}

module.exports = {
    runEvidenceEngine
};