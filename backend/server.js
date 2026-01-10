const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs'); // to read prompts
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const PORT = 5000;

// Endpoint to get AI reply
app.post('/generate-replies', async (req, res) => {
    const { messages } = req.body; // array of last messages
    
    // Read system prompt
    const systemPrompt = fs.readFileSync('./prompts/system_prompt.txt', 'utf-8');
    
    // TODO: call GPT API here with systemPrompt + messages
    // Example: const aiResponse = await callGPT(systemPrompt, messages);
    
    // For now, dummy response
    const aiResponse = [
        "Recommended reply placeholder",
        "Backup reply 1 placeholder",
        "Backup reply 2 placeholder"
    ];
    
    res.json({ replies: aiResponse });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
