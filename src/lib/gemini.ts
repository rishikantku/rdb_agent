function extractJson(text: string) {
  try {
    return JSON.parse(text.trim());
  } catch (e) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      try {
        return JSON.parse(text.substring(start, end + 1));
      } catch (e2) {
        throw new Error('Malformed JSON structure');
      }
    }
    throw new Error('No JSON object found in response');
  }
}

export async function convertNLtoSQL(prompt: string, schema: any, apiKey: string) {
  const schemaContext = JSON.stringify(schema, null, 2);
  const systemPrompt = `
    You are a SQL and Data Architecture expert. 
    Convert the following natural language request into a valid SQL query and a corresponding Mermaid.js data flow diagram.
    
    SCHEMA:
    ${schemaContext}
    
    REQUEST:
    "${prompt}"
    
    OUTPUT FORMAT (STRICT):
    {
      "sql": "valid SQL string",
      "mermaid": "valid mermaid graph LR string"
    }

    METADATA & GUARDRAILS:
    1. The 'transaction_type' column in 'Transactions' ALWAYS uses lowercase values: 'credit', 'debit'.
    2. The 'status' column in 'Accounts' uses: 'Active', 'Inactive'.
    3. If the request is NOT related to database diagnostics, return a forbidden SQL record.
    4. ONLY return the JSON object. NO EXPLANATIONS. NO MARKDOWN.
  `;

  try {
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: {
          response_mime_type: "application/json"
        }
      })
    });

    if (!response.ok) throw new Error("Gemini API error: " + response.statusText);
    
    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    const parsed = extractJson(text);
    
    return {
      sql: parsed.sql || 'SELECT "No SQL generated"',
      mermaid: parsed.mermaid || ''
    };
  } catch (error: any) {
    console.error('[Gemini] Extraction failed', error);
    return {
      sql: 'SELECT "AI Error: ' + error.message.replace(/"/g, "'") + '"',
      mermaid: ''
    };
  }
}
