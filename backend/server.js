const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const PORT = 5000;

// Function to call OpenAI API
async function generateReplies(systemPrompt, messages) {
    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4',
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...messages.map(msg => ({ role: 'user', content: msg }))
                ],
                temperature: 0.7,
                max_tokens: 500
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Parse the response to extract 3 replies
        const aiText = response.data.choices[0].message.content;
        
        // Assuming GPT returns replies separated by newlines or numbered
        const replies = aiText.split('\n').filter(r => r.trim()).slice(0, 3);
        
        return replies.length === 3 ? replies : [
            replies[0] || "Sure, sounds good!",
            replies[1] || "Let me check and get back to you",
            replies[2] || "Thanks for letting me know!"
        ];
    } catch (error) {
        console.error('OpenAI API Error:', error.response?.data || error.message);
        // Fallback replies if API fails
        return [
            "Sounds good!",
            "Let me think about it",
            "Thanks for the update!"
        ];
    }
}

// Endpoint to get AI reply
app.post('/generate-replies', async (req, res) => {
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages array required' });
    }
    
    // Read system prompt
    const systemPrompt = fs.readFileSync('./prompts/system_prompt.txt', 'utf-8');
    
    // Generate replies using GPT
    const aiReplies = await generateReplies(systemPrompt, messages);
    
    res.json({ replies: aiReplies });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
