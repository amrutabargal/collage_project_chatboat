# API Key Quota Error - Solution Guide

## ⚠️ Problem: Quota Exceeded Error

If you see this error:
```
Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests
```

## ✅ Solutions

### Solution 1: Wait for Quota Reset
- Free tier quota resets every 24 hours
- Wait and try again later
- Check quota status: https://ai.dev/rate-limit

### Solution 2: Get a New API Key
1. Go to: https://ai.google.dev/
2. Sign in with Google account
3. Click "Get API Key"
4. Create a new API key
5. Copy the new key

### Solution 3: Update API Key in Application

**Method 1: Using UI Button**
- Click the "key" icon button (appears when quota error occurs)
- Enter your new API key
- Click OK

**Method 2: Using Browser Console**
1. Press F12 to open Developer Tools
2. Go to Console tab
3. Type: `updateAPIKey("YOUR_NEW_API_KEY")`
4. Press Enter
5. Refresh the page

**Method 3: Edit script.js Directly**
1. Open `script.js` file
2. Find line: `const API_KEY = "your-key-here";`
3. Replace with your new API key
4. Save and refresh browser

### Solution 4: Upgrade to Paid Plan
- Free tier has limited requests
- Upgrade for more quota
- Visit: https://ai.google.dev/pricing

## 🔑 How to Get Google Gemini API Key

1. **Visit:** https://ai.google.dev/
2. **Sign in** with your Google account
3. **Click** "Get API Key" button
4. **Create** a new project or select existing
5. **Copy** the generated API key
6. **Update** in the application

## 📝 Quick Fix Steps

1. Get new API key from https://ai.google.dev/
2. Open browser console (F12)
3. Type: `updateAPIKey("paste-your-key-here")`
4. Press Enter
5. Refresh page
6. Try searching again

## 💡 Tips

- **Free tier limits:** ~15 requests per minute, ~1500 requests per day
- **Multiple keys:** You can use multiple API keys
- **Key rotation:** Switch keys when one quota is exceeded
- **Monitor usage:** Check https://ai.dev/rate-limit regularly

## 🆘 Still Having Issues?

1. Check API key is valid
2. Verify key has Gemini API enabled
3. Check billing/quota in Google Cloud Console
4. Try a different Google account
5. Contact Google AI support

---

**Note:** The application now shows helpful error messages when quota is exceeded. Follow the on-screen instructions for best results.

