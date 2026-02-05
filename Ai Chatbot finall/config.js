// =============================================
// API CONFIGURATION FILE
// =============================================
// Set your API keys in a .env file (see .env.example)

require('dotenv').config();

module.exports = {
    // GROQ API Key (FREE & Fast!) - Get from: https://console.groq.com/keys
    // Sign up free at groq.com, then get your API key
    GROQ_API_KEY: process.env.GROQ_API_KEY || "",
    
    // Hugging Face API Key (Get free key from: https://huggingface.co/settings/tokens)
    // Sign up at huggingface.co, go to Settings > Access Tokens > Create new token
    HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY || "",
    
    // Server Port
    PORT: process.env.PORT || 3000
};

