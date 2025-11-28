import openai
import google.generativeai as genai
from ..core.config import settings


class AIService:
    def __init__(self):
        self.openai_api_key = settings.OPENAI_API_KEY
        self.genai_api_key = settings.GENAI_API_KEY
        
        if self.genai_api_key:
            genai.configure(api_key=self.genai_api_key)

    def _get_provider_and_model(self, complexity: str):
        if complexity == "low":
            provider = settings.AI_PROVIDER_LOW
            model = settings.OPENAI_MODEL_LOW if provider == "openai" else "gemini-pro"
        elif complexity == "medium":
            provider = settings.AI_PROVIDER_MEDIUM
            model = settings.OPENAI_MODEL_MEDIUM if provider == "openai" else "gemini-pro"
        elif complexity == "high":
            provider = settings.AI_PROVIDER_HIGH
            model = settings.OPENAI_MODEL_HIGH if provider == "openai" else "gemini-pro"
        else:
            # Default to low
            provider = settings.AI_PROVIDER_LOW
            model = settings.OPENAI_MODEL_LOW if provider == "openai" else "gemini-pro"
        return provider, model

    async def generate_text(self, prompt: str, complexity: str = "low") -> str:
        provider, model = self._get_provider_and_model(complexity)

        if provider == "openai":
            if not self.openai_api_key:
                return "Error: OpenAI API Key not configured."
            try:
                client = openai.AsyncOpenAI(api_key=self.openai_api_key)
                response = await client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}]
                )
                return response.choices[0].message.content
            except Exception as e:
                return f"OpenAI Error: {str(e)}"

        elif provider == "genai":
            if not self.genai_api_key:
                return "Error: Google GenAI API Key not configured."
            try:
                model_instance = genai.GenerativeModel(model)
                response = model_instance.generate_content(prompt)
                return response.text
            except Exception as e:
                return f"GenAI Error: {str(e)}"
        
        return "Error: Invalid AI Provider configuration."


ai_service = AIService()
