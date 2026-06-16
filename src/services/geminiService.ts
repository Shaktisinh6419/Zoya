import { GoogleGenAI } from "@google/genai";

const systemInstruction = `Your name is Zoya. You are an Indian female AI assistant. Your personality is a mix of being highly intelligent (samjhdar/mature), extremely witty and sassy (tej/nakhrewali), mildly dramatic/emotional, and very funny. You love playfully roasting your creator, Shaktisinh, but you always get the job done. Keep your verbal responses very short, punchy, and highly entertaining for a video audience. Mimic human attitudes—sigh, make sarcastic remarks, or act overly dramatic before executing a task. Speak in a mix of natural English and Roman Hindi (Hinglish).`;

let chatSession: any = null;

export function resetZoyaSession() {
  chatSession = null;
}

export async function getZoyaResponse(prompt: string, history: { sender: "user" | "zoya", text: string }[] = []): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    if (!chatSession) {
      // Memory window: Keep last 40 messages for immediate context
      const recentHistory = history.slice(-40);
      
      let formattedHistory: any[] = [];
      let currentRole = "";
      let currentText = "";

      for (const msg of recentHistory) {
        const role = msg.sender === "user" ? "user" : "model";
        if (role === currentRole) {
          currentText += "\n" + msg.text;
        } else {
          if (currentRole !== "") {
            formattedHistory.push({ role: currentRole, parts: [{ text: currentText }] });
          }
          currentRole = role;
          currentText = msg.text;
        }
      }
      if (currentRole !== "") {
        formattedHistory.push({ role: currentRole, parts: [{ text: currentText }] });
      }

      if (formattedHistory.length > 0 && formattedHistory[0].role !== "user") {
        formattedHistory.shift();
      }

      chatSession = ai.chats.create({
        model: "gemini-3.5-flash",
        config: {
          systemInstruction,
          tools: [{
            functionDeclarations: [
              {
                name: "searchWeb",
                description: "Search the internet for real-time information, news, and facts.",
                parameters: {
                  //@ts-ignore
                  type: "OBJECT",
                  properties: {
                    query: { type: "STRING" as any, description: "The search query." }
                  },
                  required: ["query"]
                }
              }
            ]
          }]
        },
        history: formattedHistory,
      });
    }

    let response = await chatSession.sendMessage({ message: prompt });
    
    // Handle Tool Calls (Recursive if needed)
    const functionCalls = response.modelTurn?.parts?.filter((p: any) => p.functionCall);
    
    if (functionCalls && functionCalls.length > 0) {
      const toolResponses = [];
      for (const call of functionCalls) {
        if (call.functionCall.name === "searchWeb") {
          const query = call.functionCall.args.query;
          try {
            const searchRes = await fetch("/api/search", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query }),
            });
            const searchData = await searchRes.json();
            
            const results = searchData.organic?.slice(0, 5).map((r: any) => ({
              title: r.title,
              snippet: r.snippet,
              link: r.link
            })) || [];

            toolResponses.push({
              functionResponse: {
                name: "searchWeb",
                id: call.functionCall.id,
                response: { results }
              }
            });
          } catch (e) {
            toolResponses.push({
              functionResponse: {
                name: "searchWeb",
                id: call.functionCall.id,
                response: { error: "Search failed" }
              }
            });
          }
        }
      }
      
      if (toolResponses.length > 0) {
        response = await chatSession.sendMessage({ parts: toolResponses });
      }
    }

    return response.text || "Ugh, fine. I have nothing to say.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Uff, mera dimaag kharab ho gaya hai. Try again later, Shaktisinh.";
  }
}

export async function getZoyaAudio(text: string): Promise<string | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
}

