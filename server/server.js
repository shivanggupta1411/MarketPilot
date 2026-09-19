const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const { runEvidenceEngine } = require("./services/evidence/evidenceEngine");
const { generateReport } = require("./services/report/reportGenerator");
const { analyzeMarket } = require("./services/ai/aiAnalysis");

const { searchGoogle } = require("./services/searchService");
const { runMarketSearch } = require("./services/intelligence/marketSearch");



const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
    res.json({
        project: "MarketPilot",
        status: "online",
        version: "0.2.0"
    });
});

app.get("/api/search", async (req, res) => {
    try {
        const query = req.query.q;

        if (!query) {
            return res.status(400).json({
                success: false,
                error: "Search query is required"
            });
        }

        const results = await searchGoogle(query);

        res.json({
            success: true,
            query,
            count: results.length,
            results
        });

    } catch (error) {
        console.error(
            "Search error:",
            error.response?.data || error.message
        );

        res.status(500).json({
            success: false,
            error: "Unable to perform search"
        });
    }
});

app.get("/api/market-analysis", async (req, res) => {
    try {
        const idea = req.query.idea;

        if (!idea) {
            return res.status(400).json({
                success: false,
                error: "Product idea is required"
            });
        }

        console.log(`\nStarting market analysis for: ${idea}`);

        const analysis = await runMarketSearch(idea);

	const evidence = runEvidenceEngine(analysis);

	const report = generateReport(
	    idea,
	    evidence
	);

	const aiAnalysis = await analyzeMarket(
    	    idea,
    	    report
	);

	res.json({
	    success: true,
	    idea,
	    analysis,
	    evidence,
	    report,
	    aiAnalysis
	});
    } catch (error) {
        console.error(
            "Market analysis error:",
            error.response?.data || error.message
        );

        res.status(500).json({
            success: false,
            error: "Unable to perform market analysis"
        });
    }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`MarketPilot server running on http://localhost:${PORT}`);
});