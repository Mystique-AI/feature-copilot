import openai
import google.generativeai as genai
from typing import List, Optional
from ..core.config import settings


class AIService:
    """
    AI Service that auto-detects which provider to use based on available API keys.
    - If OPENAI_API_KEY is set, uses OpenAI
    - If GENAI_API_KEY is set, uses Google GenAI
    - If both are set, prefers the one specified in AI_PROVIDER_* settings, or OpenAI by default
    """
    
    # Model mappings for each complexity level
    OPENAI_MODELS = {
        "low": "gpt-3.5-turbo",
        "medium": "gpt-4",
        "high": "gpt-4-turbo",
    }
    
    GENAI_MODELS = {
        "low": "gemini-1.5-flash",
        "medium": "gemini-1.5-pro", 
        "high": "gemini-1.5-pro",
    }
    
    def __init__(self):
        self.openai_api_key = settings.OPENAI_API_KEY
        self.genai_api_key = settings.GENAI_API_KEY
        
        # Auto-detect available provider
        self.available_provider = self._detect_provider()
        print(f"[AI Service] Detected provider: {self.available_provider}")
        
        if self.genai_api_key:
            genai.configure(api_key=self.genai_api_key)
    
    def _detect_provider(self) -> str:
        """Auto-detect which AI provider to use based on available API keys"""
        has_openai = bool(self.openai_api_key and self.openai_api_key.strip())
        has_genai = bool(self.genai_api_key and self.genai_api_key.strip())
        
        if has_openai and has_genai:
            # Both available - check if there's a preference in settings
            # Default to OpenAI if no preference
            return "openai"
        elif has_openai:
            return "openai"
        elif has_genai:
            return "genai"
        else:
            return "none"
    
    def _get_model(self, complexity: str) -> str:
        """Get the appropriate model for the detected provider and complexity"""
        complexity = complexity if complexity in ["low", "medium", "high"] else "low"
        
        if self.available_provider == "openai":
            # Use custom model from settings if available
            if complexity == "low" and settings.OPENAI_MODEL_LOW:
                return settings.OPENAI_MODEL_LOW
            elif complexity == "medium" and settings.OPENAI_MODEL_MEDIUM:
                return settings.OPENAI_MODEL_MEDIUM
            elif complexity == "high" and settings.OPENAI_MODEL_HIGH:
                return settings.OPENAI_MODEL_HIGH
            return self.OPENAI_MODELS.get(complexity, "gpt-3.5-turbo")
        else:
            return self.GENAI_MODELS.get(complexity, "gemini-1.5-flash")

    async def generate_text(self, prompt: str, complexity: str = "low") -> str:
        """Generate text using the auto-detected AI provider"""
        
        if self.available_provider == "none":
            return "Error: No AI API key configured. Please set OPENAI_API_KEY or GENAI_API_KEY in your .env file."
        
        model = self._get_model(complexity)
        
        if self.available_provider == "openai":
            try:
                client = openai.AsyncOpenAI(api_key=self.openai_api_key)
                response = await client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}]
                )
                return response.choices[0].message.content
            except Exception as e:
                return f"OpenAI Error: {str(e)}"

        elif self.available_provider == "genai":
            try:
                model_instance = genai.GenerativeModel(model)
                response = model_instance.generate_content(prompt)
                return response.text
            except Exception as e:
                return f"GenAI Error: {str(e)}"
        
        return "Error: Invalid AI Provider configuration."

    async def generate_embedding(self, text: str) -> Optional[List[float]]:
        """
        Generate embedding vector for text using auto-detected provider.
        Returns a list of floats (the embedding vector) or None on error.
        
        Models and dimensions are configured via .env:
        - OPENAI_EMBEDDING_MODEL (default: text-embedding-3-large)
        - GENAI_EMBEDDING_MODEL (default: models/gemini-embedding-001)
        - EMBEDDING_DIMENSIONS (default: 1024)
        """
        if self.available_provider == "none":
            print("[AI Service] Error: No AI API key configured for embeddings")
            return None
        
        dimensions = settings.EMBEDDING_DIMENSIONS
        
        if self.available_provider == "openai":
            try:
                model = settings.OPENAI_EMBEDDING_MODEL
                client = openai.AsyncOpenAI(api_key=self.openai_api_key)
                response = await client.embeddings.create(
                    model=model,
                    input=text,
                    dimensions=dimensions
                )
                print(f"[AI Service] OpenAI embedding: model={model}, dims={dimensions}")
                return response.data[0].embedding
            except Exception as e:
                print(f"[AI Service] OpenAI Embedding Error: {str(e)}")
                return None

        elif self.available_provider == "genai":
            try:
                model = settings.GENAI_EMBEDDING_MODEL
                result = genai.embed_content(
                    model=model,
                    content=text,
                    output_dimensionality=dimensions
                )
                print(f"[AI Service] GenAI embedding: model={model}, dims={dimensions}")
                return result['embedding']
            except Exception as e:
                print(f"[AI Service] GenAI Embedding Error: {str(e)}")
                return None
        
        return None

    async def generate_embeddings_batch(self, texts: List[str]) -> List[Optional[List[float]]]:
        """
        Generate embeddings for multiple texts.
        Returns list of embedding vectors (or None for failed ones).
        """
        results = []
        for text in texts:
            embedding = await self.generate_embedding(text)
            results.append(embedding)
        return results
    
    def get_embedding_dimensions(self) -> int:
        """Return the embedding dimensions from settings"""
        return settings.EMBEDDING_DIMENSIONS


ai_service = AIService()
