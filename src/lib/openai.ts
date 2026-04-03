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
    throw new Error('No JSON object found');
  }
}

export async function convertNLtoSQLOpenAI(prompt: string, schema: any, apiKey: string) {
  const schemaContext = JSON.stringify(schema, null, 2);
  const systemPrompt = `
    You are a SQL and Data Architecture expert. 
    Convert the following request into a valid SQL query and a Mermaid.js diagram.
    
    SCHEMA: ${schemaContext}
    REQUEST: "${prompt}"
    
    METADATA & GUARDRAILS:
    1. The 'transaction_type' column in 'Transactions' ALWAYS uses lowercase values: 'credit', 'debit'.
    2. The 'status' column in 'Accounts' uses: 'Active', 'Inactive'.
    3. If the request is NOT related to database diagnostics, return a forbidden SQL record.
    4. ONLY return the JSON object. NO EXPLANATIONS. NO MARKDOWN.
    5. Orientation: graph LR (Left to Right).
  `;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "system", content: systemPrompt }],
        max_tokens: 1000,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      let errorMsg = response.statusText;
      try {
        const errBody = await response.json();
        errorMsg = errBody.error?.message || errorMsg;
      } catch (e) { /* ignore parse error */ }
      throw new Error(`OpenAI API ${response.status}: ${errorMsg}`);
    }
    
    const data = await response.json();
    const text = data.choices[0].message.content;
    const parsed = extractJson(text);
    
    return {
      sql: parsed.sql || 'SELECT "No SQL generated"',
      mermaid: parsed.mermaid || ''
    };
  } catch (error: any) {
    console.error('[OpenAI] Extraction failed', error);
    return {
      sql: 'SELECT "AI Error: ' + error.message.replace(/"/g, "'") + '"',
      mermaid: ''
    };
  }
}
