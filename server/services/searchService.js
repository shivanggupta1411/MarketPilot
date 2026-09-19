const axios = require("axios");

async function searchGoogle(query) {
    const response = await axios.get(
        "https://serpapi.com/search.json",
        {
            params: {
                engine: "google",
                q: query,
                api_key: process.env.SERPAPI_KEY,
                num: 10
            }
        }
    );

    return (response.data.organic_results || []).map(result => ({
        position: result.position,
        title: result.title,
        link: result.link,
        snippet: result.snippet || "",
        source: result.source || ""
    }));
}

module.exports = {
    searchGoogle
};