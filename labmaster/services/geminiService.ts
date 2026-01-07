
import { GoogleGenAI } from "@google/genai";

// Fix: Initialize GoogleGenAI with the exact required format
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getAIHelp = async (prompt: string, context: any) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Context: ${JSON.stringify(context)}\n\nUser Question: ${prompt}`,
      config: {
        systemInstruction: "Bạn là một trợ lý AI thông minh cho hệ thống quản lý phòng máy LabMaster Pro. Hãy giúp giáo viên và quản trị viên giải đáp các thắc mắc về kỹ thuật, sắp xếp lịch học hoặc phân tích hiệu suất phòng máy bằng tiếng Việt.",
      }
    });
    // Fix: Access .text property directly (not a method)
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Xin lỗi, tôi gặp sự cố khi kết nối với máy chủ AI. Vui lòng thử lại sau.";
  }
};
