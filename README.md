# ChatAIde

## About
ChatAIde is your conversational aide that helps you reply naturally, quickly, and confidently.  
It reduces indecision by generating one recommended reply plus two backup options that match your natural tone, emotional context, and writing style.
Designed to feel human, empathetic, and context-aware, ChatAIde adapts dynamically to each conversation.

---

## Problem
Do you ever get a text and don’t know how to reply?  
You end up overthinking, asking friends for help, or sending something awkward that you tend to regret. 
ChatAIde solves this problem by suggesting replies that match your natural tone and sound humanized, while reducing indecision.

---

## Solution
ChatAIde scans your recent messages and generates **1 recommended reply** plus **2 backup options**, which are all human-like, empathetic, and match the conversation tone.  
It adapts automatically, varying from conversation to conversation. You don’t pick a persona, it chooses for you. 
Emojis, humor, and empathy are included when appropriate.  

---

## Features
- Tone & context detection (emotional, casual, professional, playful)  
- Humanized, indecision-reducing replies  
- 1 recommended + 2 backup options  
- Age-appropriate fallback for younger users  
- Emoji-aware, natural imperfections included  
- Demo-ready for WhatsApp Web / Chrome Extension

---

## Core Concepts Behind the System

ChatAIde’s intelligence relies on three core concepts:

1. **Tone & Context Analysis**  
   - Scans recent conversation messages to infer tone (casual, playful, professional, emotional) and emotional context (stress, excitement, awkwardness, neutral).  
   - Generates replies that are natural and aligned with the conversation.

2. **Humanized Reply Generation**  
   - Produces 1 recommended reply plus 2 backup options to reduce indecision.  
   - Replies include slight imperfections, filler words, and emojis to feel more human when required.  
   - Avoids sounding robotic, introducing new topics, or overexplaining.

3. **Fallback & Safety Rules**  
   - If a user has minimal message history, ChatAIde defaults to friendly, neutral replies.  
   - Age-appropriate rules applied for underage users to ensure safety and social appropriateness.  

This combination ensures ChatAIde adapts dynamically to each conversation, providing replies that are human-like, context-aware, and decision-ready.

---

## Demo

1. **Indecisive Reply**  
   - Incoming message: *“lol idk maybe”*  
   - ChatAIde suggests:  
     - Recommended: “Hmm… might be tough, but I’ll try😅”  
     - Backup 1: “I can’t, sorry! Hope you find someone”  
     - Backup 2: “Maybe… I’ll let you know soon”

2. **Emotional Support**  
   - Incoming message: *“I’m just really overwhelmed right now”*  
   - ChatAIde suggests:  
     - Recommended: “Hey, it happens…take a deep breath”  
     - Backup 1: “I’m here if you want to vent”  
     - Backup 2: “Don’t stress too much, you’ve got this! ❤️”

3. **Casual Planning**  
   - Incoming message: *“Are you coming tonight?”*  
   - ChatAIde suggests:  
     - Recommended: “Yeah, I'll come! It sounds fun”  
     - Backup 1: “I might be late, but I’ll be there!”  
     - Backup 2: “Can’t make it tonight, but let’s catch up soon!”

---

## Tech Stack & Implementation Details

- **Frontend**: React / Next.js — creates the extension popup interface and displays generated replies.  
- **Backend**: Node.js or FastAPI — handles API calls to the AI and manages fallback logic.  
- **AI Engine**: GPT (or other LLM)  
  - Prompt engineering encodes humanization rules, indecision reduction, and tone adaptation.  
  - Generates 1 recommended reply + 2 backup replies per message.  
- **Additional Features**:  
  - Typing animation to simulate thinking  
  - Optional GIF/emoji display  
  - Chrome Extension integration to scan web apps like WhatsApp, Instagram, or iMessage Web  
- **Data Handling**:  
  - No personal messages are stored — all processing happens in real-time to respect privacy.  

---

## How to Run

1. Clone the repo: `git clone https://github.com/nicoleburl/chatAIde.git`  
2. Open `backend/prompts/system_prompt.txt` for AI logic  
3. Run backend to call AI  
4. Connect extension popup to test demo  

---

## Team
- **Ananya Chopra** — Product & Prompt / Demo Script  
- **Rimi Dalal** — Backend / API integration  
- **Nicole Burlacu** — Frontend / Chrome Extension UI
