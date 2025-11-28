"""
Centralized AI Prompts Configuration

All AI prompts used throughout the application are defined here.
This makes it easy to modify, version, and manage prompts in one place.
"""

# Feature Request AI Actions - used in feature detail panel
FEATURE_PROMPTS = {
    "summarize": """Summarize the following feature request concisely in 2-3 sentences, 
highlighting the key functionality and benefit. Use markdown formatting (bold for key terms, bullet points if listing multiple items).

{context}""",

    "elaborate": """Elaborate on the following feature request using markdown formatting (## headers, bullet points, **bold** for emphasis). Provide:
1. More detailed explanation of the functionality
2. Potential technical considerations
3. Possible edge cases to consider
4. Expected user workflow

Feature Request:
{context}""",

    "rewrite_professional": """Rewrite the following feature request to sound more professional, 
clear, and well-structured. Maintain all the original information but improve clarity.
Use markdown formatting (## headers, bullet points, **bold** for key terms).

{context}""",

    "generate_ac": """Generate detailed Acceptance Criteria for the following feature request. 
Format using markdown with numbered lists and **bold** for key actions. Use Given/When/Then format where appropriate.

Feature Request:
{context}""",

    "generate_user_stories": """Create User Stories for the following feature request using markdown formatting.
Use the format: **As a** [user role], **I want** [goal], **so that** [benefit]
Generate 3-5 relevant user stories as a numbered list:

Feature Request:
{context}""",

    "suggest_problem_statement": """Rewrite the following as a clear problem statement using markdown formatting (## headers, bullet points, **bold** for emphasis). Explain:
1. What is the current situation/pain point
2. Who is affected
3. What is the impact of not solving this
4. What is the desired outcome

Original:
{context}""",

    "generate_test_cases": """Generate test cases for the following feature using markdown formatting.
Use ## headers for each test case with the following structure:
- **Test Name**: Name of the test
- **Preconditions**: Setup required
- **Steps**: Numbered list of steps
- **Expected Result**: Expected outcome

Include happy path, edge cases, error scenarios, and performance considerations if applicable.

Feature:
{context}""",

    "technical_summary": """Create a technical summary for developers based on this feature request using markdown formatting (## headers, bullet points, **bold** for key terms, `code` for technical names). Include:
1. High-level technical approach
2. Potential components/modules affected
3. Data model considerations
4. API endpoints needed
5. Estimated complexity (Low/Medium/High)

Feature Request:
{context}""",

    "simplify": """Explain the following feature request in simpler, non-technical terms 
that anyone can understand. Avoid jargon and use everyday language.
Use markdown formatting (bullet points, **bold** for key concepts).

{context}""",

    "generate_tasks": """Break down this feature request into specific developer tasks using markdown formatting.
Use ## headers for each task with:
- **Task Name**: Name of the task
- **Description**: Brief description
- **Estimated Effort**: Hours
- **Dependencies**: List if any

Feature Request:
{context}""",

    "find_duplicates": """Analyze this feature request and identify using markdown formatting (## headers, bullet points, **bold** for emphasis):
1. Potential overlap with common existing features
2. Similar functionality that might already exist
3. Related features that should be considered together

Feature Request:
{context}""",

    # Feature creation from brief - generates full feature JSON
    "generate_feature": """Based on this feature request brief, generate a structured response in JSON format with the following fields:
- title: A clear, concise title (max 60 chars) - plain text, no markdown
- description: A detailed description of the feature (2-3 paragraphs explaining what it does, why it's needed, and how it should work). Use markdown formatting with headers (##), bullet points, bold text, etc. to make it well-structured and readable.
- use_case: Who will use this and how it benefits them (1-2 paragraphs). Use markdown formatting with bullet points, bold text, etc. for clarity.
- priority: One of "low", "medium", "high", "critical" based on the urgency/importance indicated
- tags: An array of 2-4 relevant tags (lowercase, single words like "reporting", "ui", "integration", etc.)

Brief: {context}

Respond ONLY with valid JSON, no markdown code blocks or explanation.""",
}

# Comment suggestions
COMMENT_PROMPTS = {
    "suggest_questions": """Based on this feature request, suggest 3-5 clarifying questions 
that would help better understand the requirements:

{context}""",

    "suggest_response": """Suggest a professional response to this feature request comment. 
The response should acknowledge the point and provide constructive feedback:

Comment: {context}""",
}

# Status transition prompts
STATUS_PROMPTS = {
    "rejection_reason": """Suggest a professional and constructive rejection reason for this feature request. 
Include:
1. Acknowledgment of the request
2. Clear explanation of why it cannot be approved
3. Suggestions for alternatives or future consideration

Feature: {context}""",

    "approval_notes": """Generate approval notes for this feature request. Include:
1. Summary of what is being approved
2. Any conditions or constraints
3. Recommended next steps

Feature: {context}""",
}


def get_prompt(category: str, action: str, **kwargs) -> str:
    """
    Get a formatted prompt by category and action.
    
    Args:
        category: The prompt category (feature, comment, status)
        action: The specific action/prompt name
        **kwargs: Variables to format into the prompt
    
    Returns:
        Formatted prompt string
    """
    prompts = {
        "feature": FEATURE_PROMPTS,
        "comment": COMMENT_PROMPTS,
        "status": STATUS_PROMPTS,
    }
    
    category_prompts = prompts.get(category, {})
    prompt_template = category_prompts.get(action, "{action}:\n\n{context}")
    
    return prompt_template.format(**kwargs)
