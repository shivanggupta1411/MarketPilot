function groupByType(evidence) {
    const groups = {
        competitor: [],
        pricing: [],
        customer_pain: [],
        market_signal: [],
        opportunity: [],
        general: []
    };

    for (const item of evidence) {
        if (groups[item.type]) {
            groups[item.type].push(item);
        } else {
            groups.general.push(item);
        }
    }

    return groups;
}

function topEvidence(items, limit = 5) {
    return [...items]
        .sort((a, b) => b.signalStrength - a.signalStrength)
        .slice(0, limit);
}

function generateReport(productIdea, evidenceData) {
    const evidence = evidenceData.evidence || [];
    const groups = groupByType(evidence);

    return {
        productIdea,

        overview: {
            totalEvidence: evidence.length,
            sourcesAnalyzed: new Set(
                evidence.map(item => item.source).filter(Boolean)
            ).size,
	    sourceDiversity: evidenceData.sourceDiversity || 0
        },

        competitor: {
            count: groups.competitor.length,
            evidence: topEvidence(groups.competitor)
        },

        pricing: {
            count: groups.pricing.length,
            evidence: topEvidence(groups.pricing)
        },

        customerPain: {
            count: groups.customer_pain.length,
            evidence: topEvidence(groups.customer_pain)
        },

        marketSignals: {
            count: groups.market_signal.length,
            evidence: topEvidence(groups.market_signal)
        },

        opportunity: {
            count: groups.opportunity.length,
            evidence: topEvidence(groups.opportunity)
        },

        evidence
    };
}

module.exports = {
    generateReport
};