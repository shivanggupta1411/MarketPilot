const { searchGoogle } = require("../searchService");

async function runMarketSearch(productIdea) {
    const searches = {
        competitors: `${productIdea} competitors alternatives`,
        pricing: `${productIdea} pricing plans cost`,
        customerPain: `${productIdea} customer complaints problems reviews`,
        marketSignals: `${productIdea} industry growth trends adoption statistics report 2026`,
        opportunities: `${productIdea} problems gaps underserved market`
    };

    console.log("\nStarting parallel market searches...");

    const entries = Object.entries(searches);

    const resultsArray = await Promise.all(
        entries.map(async ([category, query]) => {
            console.log(`Searching ${category}: ${query}`);

            try {
                const results = await searchGoogle(query);

                console.log(
                    `${category}: ${results.length} results`
                );

                return [category, results];

            } catch (error) {
                console.error(
                    `Failed ${category}:`,
                    error.message
                );

                return [category, []];
            }
        })
    );

    const results = Object.fromEntries(resultsArray);

    console.log("All market searches completed.");

    return results;
}

module.exports = {
    runMarketSearch
};