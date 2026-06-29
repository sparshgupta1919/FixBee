const functions = require("firebase-functions/v1");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function generateContentWithRetry(model, content, maxRetries = 3) {
    let delay = 1000;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await model.generateContent(content);
        } catch (err) {
            const errStr = String(err);
            const isTransient = errStr.includes("503") || errStr.includes("429") || errStr.includes("Service Unavailable") || errStr.includes("Too Many Requests");
            if (isTransient && i < maxRetries - 1) {
                console.warn(`Transient Gemini error (attempt ${i + 1}/${maxRetries}): ${err}. Retrying in ${delay}ms...`);
                await wait(delay);
                delay *= 2;
            } else {
                throw err;
            }
        }
    }
}

exports.analyzeMedia = functions.runWith({
    secrets: ["GEMINI_API_KEY"]
}).https.onCall(async (data, context) => {
    // Check authentication if needed (highly secure!)
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }

    const { images, video } = data;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new functions.https.HttpsError("failed-precondition", "Gemini API key is not configured on the server.");
    }

    try {
        const mediaParts = [];

        // Add images (expecting array of { data: base64, mimeType: string })
        if (images && Array.isArray(images)) {
            for (const img of images) {
                mediaParts.push({
                    inlineData: {
                        data: img.data,
                        mimeType: img.mimeType
                    }
                });
            }
        }

        // Add video (expecting { data: base64, mimeType: string })
        if (video) {
            mediaParts.push({
                inlineData: {
                    data: video.data,
                    mimeType: video.mimeType
                }
            });
        }

        if (mediaParts.length === 0) {
            throw new functions.https.HttpsError("invalid-argument", "At least one photo or video is required.");
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                responseMimeType: "application/json"
            }
        });
        const prompt = `You are an expert assistant for the community reporting app "FixBee".
Your task is to analyze the provided images/video of a community issue (like a pothole, broken streetlight, garbage piling, water leakage, safety concern, etc.) and generate a structured JSON object containing:
- title: A concise, descriptive title (maximum 120 characters) summarizing the issue.
- category: One of the supported categories: "roads" (for potholes, broken sidewalks, road damage), "water" (leakage, clogged drain, pipe burst), "electricity" (power outages, loose wires), "sanitation" (garbage, sewage, litter), "parks" (issues in public parks or gardens), "lighting" (broken streetlights, dark alleys), "other".
- description: A detailed description explaining what the issue is, what visible damage there is, and how it might impact the residents (around 400 characters, maximum 1000 characters).

Return ONLY the raw JSON object matching this schema, without any markdown formatting or comments:
{
  "title": "string",
  "category": "roads" | "water" | "electricity" | "sanitation" | "parks" | "lighting" | "other",
  "description": "string"
}`;

        const result = await generateContentWithRetry(model, [prompt, ...mediaParts]);
        const response = await result.response;
        const text = response.text();

        return JSON.parse(text);
    } catch (err) {
        console.error("Gemini analysis error:", err);
        throw new functions.https.HttpsError("internal", "Failed to analyze media: " + err.message);
    }
});
