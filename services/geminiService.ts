import { GoogleGenAI } from "@google/genai";

// Initialize the client with the API key from environment variables
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates a caption for the provided image using Gemini Flash.
 * @param base64Image The base64 encoded image string (without the data:image/png;base64, prefix if possible, but the API handles cleanup usually).
 * @returns A promise that resolves to the generated text.
 */
export const generatePhotoCaption = async (base64Image: string): Promise<string> => {
  try {
    // Clean the base64 string if it contains the header
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, '');

    const language = navigator.language || 'en-US';

    const prompt = `
      You are a warm, nostalgic, and friendly AI inside a retro instant camera.
      Analyze this photo and write a SHORT, warm blessing or a nice, aesthetic comment about the moment captured.
      Use the language code: ${language}.
      Keep it under 15 words.
      Do not use hashtags.
      Do not use quotes.
      Just the handwritten-style note.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: cleanBase64,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    });

    return response.text || "A beautiful moment...";
  } catch (error) {
    console.error("Error generating caption:", error);
    return "Captured in time.";
  }
};