const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');

dotenv.config();

const port = process.env.PORT || 3000;
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('Missing GEMINI_API_KEY environment variable.');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }, { apiVersion: 'v1beta' });

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.post('/summarise', async (req, res) => {
  console.log('Received /summarise request');

  const { text } = req.body || {};
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Request body must include a non-empty "text" string.' });
  }

  console.log(`Received text with length: ${text.length}`);

  let prompt;
  if (text.startsWith('QUESTION ABOUT TERMS AND CONDITIONS:')) {
    // This is a question from the Ask mode
    const parts = text.split('CONTEXT:');
    const question = parts[0].replace('QUESTION ABOUT TERMS AND CONDITIONS:', '').trim();
    const context = parts.length > 1 ? parts[1].trim() : '';
    
    prompt = `Answer the following question about these Terms and Conditions: "${question}"
    
    Provide a detailed and comprehensive answer (2-4 sentences) that thoroughly explains the information.
    Include specific policies, examples, or clauses from the Terms and Conditions when available.
    Use simple language that anyone can understand, avoiding technical jargon.
    If the answer is not found in the text, explain that "This information is not specified in the Terms and Conditions" and mention any related sections that might be relevant.`;
    
    console.log(`Answering question: ${question}`);
  } else {
    // Regular summarization request
    prompt = `Summarize these Terms and Conditions in simple, easy-to-understand bullet points. Focus on key data policies, user rights, and any hidden clauses.
  
VERY IMPORTANT FORMAT REQUIREMENTS:
1. Use clear bullet points with "•" symbol
2. Organize in sections with clear headings (e.g., "Data Collection", "User Rights", "Key Restrictions")
3. DO NOT use markdown symbols or formatting codes like ###, **, --
4. Keep each bullet point concise and in simple language
5. Use proper HTML formatting with <h3> tags for section headers and <ul><li> tags for bullet points
6. Include 3-5 points for each section
7. Start with a brief introduction paragraph`;
  }

  try {
    const safetySettings = [
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_NONE',
      },
    ];

    const fullPrompt = `${prompt}\n\n${text}`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
      safetySettings,
    });

    const response = result.response;

    // Log the full response for debugging
    console.log('Gemini Full Response:', JSON.stringify(response, null, 2));

    let summary = response?.candidates?.[0]?.content?.parts?.[0]?.text || 'No summary returned by AI.';
    
    // Clean up any markdown artifacts if they still exist
    summary = summary
      .replace(/^#+\s*/gm, '')       // Remove markdown headers
      .replace(/\*\*/g, '')           // Remove bold markers
      .replace(/---+/g, '')           // Remove horizontal rules
      .replace(/```[a-z]*\n|```/g, '') // Remove code blocks
      .replace(/^\s*[-*]\s*/gm, '• '); // Convert any remaining bullet types to •
    
    // If summary doesn't have HTML formatting, add basic structure
    if (!summary.includes('<h3>') && !summary.includes('<li>')) {
      summary = `<div class="summary-container">
        ${summary}
      </div>`;
    }

    return res.json({ summary });
  } catch (error) {
    console.error('Error while summarising:', error);
    return res.status(500).json({ error: 'Failed to generate summary.' });
  }
});

app.listen(port, () => {
  console.log(`SummIt server listening on port ${port}`);
});
