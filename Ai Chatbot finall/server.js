const express = require('express');
const cors = require('cors');
const path = require('path');

// Load config (use config.js file)
let config;
try {
    config = require('./config.js');
} catch (e) {
    config = {
        GROQ_API_KEY: "",
        HUGGINGFACE_API_KEY: "",
        PORT: 3000
    };
}

const app = express();
const PORT = config.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname)));

// API Keys from config
const GROQ_API_KEY = config.GROQ_API_KEY;
const HUGGINGFACE_API_KEY = config.HUGGINGFACE_API_KEY;

// ================================
// WEB SEARCH API (DuckDuckGo - FREE!)
// ================================
app.post('/api/search', async (req, res) => {
    try {
        const { query } = req.body;
        
        if (!query) {
            return res.status(400).json({ error: { message: 'Search query is required' } });
        }

        // Use DuckDuckGo HTML search and parse results
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        
        const response = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const html = await response.text();
        
        // Parse search results from HTML
        const results = [];
        const resultRegex = /<a class="result__a" href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
        let match;
        
        while ((match = resultRegex.exec(html)) !== null && results.length < 5) {
            results.push({
                url: match[1],
                title: match[2].trim(),
                snippet: match[3].replace(/<[^>]+>/g, '').trim()
            });
        }
        
        // If no results with snippet, try simpler pattern
        if (results.length === 0) {
            const simpleRegex = /<a class="result__a" href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
            while ((match = simpleRegex.exec(html)) !== null && results.length < 5) {
                results.push({
                    url: match[1],
                    title: match[2].trim(),
                    snippet: ''
                });
            }
        }

        res.json({ results, query });
    } catch (error) {
        console.error('Search API Error:', error);
        res.status(500).json({ error: { message: 'Search failed: ' + error.message } });
    }
});

// ================================
// CHAT WITH WEB SEARCH (AI + Search Combined)
// ================================
app.post('/api/chat', async (req, res) => {
    try {
        const { contents } = req.body;
        
        // Get the latest user message
        const lastUserMessage = contents.filter(c => c.role === 'user').pop();
        const userQuery = lastUserMessage?.parts?.[0]?.text || '';
        
        // Check if this looks like a search query
        const isSearchQuery = /^(search|find|what is|who is|where is|when|how to|latest|news|current|tell me about|explain|define)/i.test(userQuery) ||
                             /\?$/.test(userQuery) ||
                             userQuery.split(' ').length >= 3;
        
        let searchContext = '';
        let hasSearchResults = false;
        
        // If it looks like a search query, get web results first
        if (isSearchQuery && userQuery.length > 3) {
            try {
                const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(userQuery)}`;
                const searchResponse = await fetch(searchUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                });
                const html = await searchResponse.text();
                
                const results = [];
                const resultRegex = /<a class="result__a" href="[^"]*"[^>]*>([^<]+)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
                let match;
                // Get more results for comprehensive data
                while ((match = resultRegex.exec(html)) !== null && results.length < 10) {
                    const title = match[1].trim();
                    const snippet = match[2].replace(/<[^>]+>/g, '').trim();
                    if (snippet.length > 10) {
                        results.push({ title, snippet });
                    }
                }
                
                if (results.length > 0) {
                    hasSearchResults = true;
                    searchContext = `\n\n---WEB SEARCH DATA---\nQuery: "${userQuery}"\n`;
                    results.forEach((r, i) => {
                        searchContext += `\nSource ${i+1}: ${r.title}\nInfo: ${r.snippet}\n`;
                    });
                    searchContext += `---END SEARCH DATA---\n`;
                }
            } catch (e) {
                console.log('Search enhancement failed, continuing without:', e.message);
            }
        }
        
        // Convert to Groq/OpenAI format
        const messages = [];
        
        // Enhanced system prompt for FULL comprehensive responses
        const systemPrompt = hasSearchResults ? 
            `You are JEENI AI, an expert research assistant providing COMPLETE information. Today: ${new Date().toLocaleDateString()}.

🎯 YOUR MISSION: Provide FULL, COMPLETE, COMPREHENSIVE data. DO NOT shorten or skip ANY information.

RESPONSE FORMAT:

📌 [MAIN TOPIC]
Complete introduction with full context.

📌 [WHAT IS IT?]
Full detailed explanation - cover everything about what it is, how it works, why it matters.

📌 [KEY FACTS & DETAILS]
✅ Point 1 - Full explanation
✅ Point 2 - Full explanation  
✅ Point 3 - Full explanation
✅ Point 4 - Full explanation
✅ Point 5 - Full explanation
(Add as many points as needed - DO NOT LIMIT)

📌 [HISTORY & BACKGROUND]
Complete history and background information.

📌 [HOW IT WORKS]
Step-by-step detailed explanation of the process/mechanism.

📊 [STATISTICS & DATA]
- All relevant numbers
- All relevant statistics
- All relevant data points
- Market data, growth rates, etc.

📌 [TYPES/CATEGORIES]
List and explain ALL types or categories if applicable.

📌 [ADVANTAGES]
✅ All benefits listed with explanations

📌 [DISADVANTAGES/CHALLENGES]
⚠️ All drawbacks or challenges

📌 [APPLICATIONS/USE CASES]
🎯 All real-world applications

📌 [FUTURE TRENDS]
What's coming next, predictions, future scope.

💡 [EXPERT TIPS]
- Practical tips
- Recommendations
- Best practices

📌 [CONCLUSION]
Comprehensive summary.

🔍 Sources: List all sources used

CRITICAL RULES:
1. NEVER say "in short" or "briefly" - give FULL details
2. NEVER skip information - include EVERYTHING
3. NEVER limit points - add ALL relevant points
4. Cover the topic from ALL angles
5. Include historical context, current state, and future
6. Use emojis (📌✅💡📊⚠️🎯) for visual organization
7. Make it COMPLETE but ORGANIZED with clear sections
8. If search results have data, include ALL of it

You have REAL-TIME web search data. Use ALL information from it.` :
            `You are JEENI AI, providing COMPLETE comprehensive answers. Today: ${new Date().toLocaleDateString()}.

🎯 MISSION: Give FULL, COMPLETE information. Never shorten or skip data.

FORMAT:
📌 [SECTION HEADINGS] - For organization
✅ Key points with FULL explanations
💡 All tips and insights
📊 All statistics and data
⚠️ All warnings/challenges
🎯 All applications

RULES:
1. NEVER shorten - give FULL details
2. NEVER skip - include EVERYTHING
3. NEVER limit - add ALL points needed
4. Organize with emojis and sections
5. Cover topic COMPLETELY from all angles`;
        
        messages.push({
            role: "system",
            content: systemPrompt
        });
        
        for (const item of contents) {
            const role = item.role === 'model' ? 'assistant' : 'user';
            let content = '';
            
            for (const part of item.parts) {
                if (part.text) content += part.text;
                if (part.inline_data) content += "\n[User attached a file]";
            }
            
            // Add search context to the latest user message with formatting instructions
            if (role === 'user' && item === lastUserMessage && searchContext) {
                content += searchContext;
                content += `\n\nAnswer my question "${userQuery}" using ALL the search data above.

IMPORTANT INSTRUCTIONS:
1. Include ALL information from search results - do not skip anything
2. Provide COMPLETE, COMPREHENSIVE answer
3. Cover the topic from EVERY angle
4. Add your own knowledge to make it even more complete
5. Use organized sections with emojis (📌✅💡📊⚠️🎯)
6. DO NOT shorten or summarize - give FULL details
7. Include history, current state, future trends if relevant
8. List ALL advantages, disadvantages, applications
9. Give ALL statistics and data available

The user wants COMPLETE information, not a summary.`;
            }
            
            messages.push({ role, content });
        }
        
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: messages,
                temperature: 0.7,
                max_tokens: 8192,
                stream: false
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            console.error('Groq API Error:', data);
            return res.status(response.status).json({ 
                error: { message: data.error?.message || 'API Error - Check your Groq API key in config.js' } 
            });
        }
        
        // Convert to Gemini format for frontend
        const geminiResponse = {
            candidates: [{
                content: {
                    parts: [{ text: data.choices[0].message.content }]
                }
            }]
        };
        
        res.json(geminiResponse);
    } catch (error) {
        console.error('Chat API Error:', error);
        res.status(500).json({ error: { message: 'Server error: ' + error.message } });
    }
});

// ================================
// GENERATE SKILLS ENDPOINT
// ================================
app.post('/api/generate-skills', async (req, res) => {
    try {
        const { jobTitle } = req.body;
        
        if (!jobTitle) {
            return res.status(400).json({ error: { message: 'Job title is required' } });
        }
        
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: 'You are a professional resume writer. Give concise responses.' },
                    { role: 'user', content: `List the top 5 to 7 most relevant technical and soft skills for a ${jobTitle}. Return ONLY a comma-separated list, nothing else.` }
                ],
                temperature: 0.7,
                max_tokens: 256
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            return res.status(response.status).json({ error: { message: data.error?.message || 'API Error' } });
        }
        
        res.json({ text: data.choices[0].message.content.trim() });
    } catch (error) {
        console.error('Generate Skills Error:', error);
        res.status(500).json({ error: { message: 'Server error: ' + error.message } });
    }
});

// ================================
// GENERATE SUMMARY ENDPOINT
// ================================
app.post('/api/generate-summary', async (req, res) => {
    try {
        const { jobTitle } = req.body;
        
        if (!jobTitle) {
            return res.status(400).json({ error: { message: 'Job title is required' } });
        }
        
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: 'You are a professional resume writer.' },
                    { role: 'user', content: `Write a professional 3-sentence resume summary for a ${jobTitle}. Focus on skills and experience. Give ONLY the summary, no extra text.` }
                ],
                temperature: 0.7,
                max_tokens: 256
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            return res.status(response.status).json({ error: { message: data.error?.message || 'API Error' } });
        }
        
        res.json({ text: data.choices[0].message.content.trim() });
    } catch (error) {
        console.error('Generate Summary Error:', error);
        res.status(500).json({ error: { message: 'Server error: ' + error.message } });
    }
});

// ================================
// IMAGE GENERATION (Hugging Face)
// ================================
app.post('/api/generate-image', async (req, res) => {
    try {
        const { prompt } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ error: { message: 'Prompt is required' } });
        }
        
        if (!HUGGINGFACE_API_KEY || HUGGINGFACE_API_KEY === '') {
            return res.status(400).json({ 
                error: { message: 'Image generation requires HuggingFace API key. Add it to config.js' } 
            });
        }
        
        const response = await fetch(
            'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ inputs: prompt })
            }
        );
        
        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ error: { message: errorText } });
        }
        
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        
        res.json({ image: `data:image/png;base64,${base64}` });
    } catch (error) {
        console.error('Image Generation Error:', error);
        res.status(500).json({ error: { message: 'Server error: ' + error.message } });
    }
});

// ================================
// HEALTH CHECK
// ================================
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        groqConfigured: !!GROQ_API_KEY && GROQ_API_KEY.startsWith('gsk_'),
        huggingfaceConfigured: !!HUGGINGFACE_API_KEY && HUGGINGFACE_API_KEY !== '',
        searchEnabled: true
    });
});

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    const groqOk = GROQ_API_KEY && GROQ_API_KEY.startsWith('gsk_');
    const hfOk = HUGGINGFACE_API_KEY && HUGGINGFACE_API_KEY !== '';
    
    console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                  🤖 AI CHATBOT SERVER RUNNING                     ║
╠═══════════════════════════════════════════════════════════════════╣
║  🌐 Open: http://localhost:${PORT}                                  ║
╠═══════════════════════════════════════════════════════════════════╣
║  ${groqOk ? '✅' : '❌'} Groq AI Chat: ${groqOk ? 'Ready!' : 'ADD KEY TO config.js'}                            ║
║  ✅ Web Search: Ready! (DuckDuckGo - FREE)                        ║
║  ${hfOk ? '✅' : '⚠️ '} Image Gen: ${hfOk ? 'Ready!' : 'Optional - add HuggingFace key'}                          ║
╠═══════════════════════════════════════════════════════════════════╣
║  📝 Get FREE Groq key: https://console.groq.com/keys              ║
╚═══════════════════════════════════════════════════════════════════╝
    `);
    
    if (!groqOk) {
        console.log('\n⚠️  TO MAKE CHAT WORK:');
        console.log('   1. Go to https://console.groq.com/keys');
        console.log('   2. Sign up FREE (no credit card)');
        console.log('   3. Create API key');
        console.log('   4. Add to config.js: GROQ_API_KEY: "gsk_your_key_here"\n');
    }
});
