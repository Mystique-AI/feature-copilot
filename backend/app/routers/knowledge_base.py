"""
Knowledge Base Router

API endpoints for managing knowledge base documents.
Files are stored in /uploads/knowledge/ directory, not in the database.
"""
import os
import uuid
import json
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime

from ..core import database
from ..core.config import settings
from ..core.permissions import check_permission
from ..models import knowledge_base as models
from ..models import user as user_models
from ..schemas import knowledge_base as schemas
from .auth import get_current_user
from ..services.ai_service import ai_service


def parse_ai_json_response(ai_response: str) -> dict:
    """
    Parse AI-generated JSON with multiple fallback attempts to handle common issues.
    Returns the parsed dictionary or raises HTTPException on failure.
    """
    import re
    import ast
    
    # Clean up response (remove markdown code blocks if present)
    cleaned_response = ai_response.strip()
    if cleaned_response.startswith("```"):
        cleaned_response = cleaned_response.split("```")[1]
        if cleaned_response.startswith("json"):
            cleaned_response = cleaned_response[4:]
    cleaned_response = cleaned_response.strip()
    
    structure = None
    parse_error = None
    
    # Attempt 1: Direct parse
    try:
        structure = json.loads(cleaned_response)
        return structure
    except json.JSONDecodeError as e:
        parse_error = e
        print(f"[KB DEBUG] Initial JSON parse failed: {e}")
    
    # Attempt 2: Fix common issues - unescaped newlines in strings
    try:
        # Replace literal newlines that are inside string values
        fixed = re.sub(r'(?<!\\)\n(?=[^"]*"[,\}\]])', '\\n', cleaned_response)
        structure = json.loads(fixed)
        print("[KB DEBUG] JSON parsed after fixing newlines")
        return structure
    except json.JSONDecodeError:
        pass
    
    # Attempt 3: Try to extract valid JSON portion
    try:
        start = cleaned_response.find('{')
        end = cleaned_response.rfind('}')
        if start != -1 and end != -1:
            json_portion = cleaned_response[start:end+1]
            structure = json.loads(json_portion)
            print("[KB DEBUG] JSON parsed after extracting portion")
            return structure
    except json.JSONDecodeError:
        pass
    
    # Attempt 4: Use ast.literal_eval as last resort
    try:
        py_str = cleaned_response.replace('true', 'True').replace('false', 'False').replace('null', 'None')
        structure = ast.literal_eval(py_str)
        print("[KB DEBUG] JSON parsed via ast.literal_eval")
        return structure
    except:
        pass
    
    # All attempts failed
    print(f"[KB DEBUG] All JSON parse attempts failed. Original error: {parse_error}")
    print(f"[KB DEBUG] Cleaned response was: {cleaned_response[:500]}...")
    raise HTTPException(
        status_code=500,
        detail=f"AI response was not valid JSON. Please try again. Error: {str(parse_error)}"
    )


def is_kb_admin(user: user_models.User) -> bool:
    """Check if user can manage knowledge bases (admin role OR env admin)"""
    is_role_admin = check_permission(user, "manage_users")
    is_env_admin = settings.is_admin_email(user.email)
    print(f"[KB DEBUG] User: {user.email}, Role: {user.role}, is_role_admin: {is_role_admin}, is_env_admin: {is_env_admin}")
    return is_role_admin or is_env_admin


def structure_to_markdown(structure: dict) -> str:
    """
    Convert the entire JSON structure to a well-formatted markdown document.
    This creates a single text representation for embedding the whole KB.
    """
    kb_name = structure.get("name", "Knowledge Base")
    kb_domain = structure.get("domain", "general")
    kb_description = structure.get("description", "")
    
    lines = [
        f"# {kb_name}",
        f"**Domain:** {kb_domain}",
    ]
    
    if kb_description:
        lines.append(f"**Description:** {kb_description}")
    
    lines.append("")
    
    def process_section(section: dict, depth: int = 0):
        """Recursively convert section to markdown"""
        section_id = section.get("id", "")
        title = section.get("title", "")
        content = section.get("content", "")
        
        # Create header with appropriate depth (## for top level, ### for sub, etc.)
        header_level = "#" * min(depth + 2, 6)
        
        lines.append(f"{header_level} {section_id}. {title}")
        lines.append("")
        if content:
            lines.append(content)
            lines.append("")
        
        # Process subsections
        for subsection in section.get("subsections", []):
            process_section(subsection, depth + 1)
    
    for section in structure.get("sections", []):
        process_section(section)
    
    return "\n".join(lines)


async def generate_and_store_embedding_from_markdown(
    db: Session, 
    kb_id: int, 
    kb_name: str,
    markdown_content: str
) -> int:
    """
    Generate a single embedding for markdown content and store in database.
    Returns 1 if successful, 0 if failed.
    """
    print(f"[KB] Generating embedding for: {kb_name} ({len(markdown_content)} chars)")
    
    # Delete existing embeddings for this KB (in case of reprocessing)
    db.query(models.KnowledgeEmbedding).filter(
        models.KnowledgeEmbedding.kb_id == kb_id
    ).delete()
    
    # Truncate content if too long for embedding (most models have limits)
    max_embed_length = 8000  # Conservative limit
    embed_text = markdown_content[:max_embed_length] if len(markdown_content) > max_embed_length else markdown_content
    
    # Generate embedding
    embedding = await ai_service.generate_embedding(embed_text)
    
    if embedding is None:
        print(f"[KB] Failed to generate embedding")
        return 0
    
    # Store embedding
    db_embedding = models.KnowledgeEmbedding(
        kb_id=kb_id,
        section_address="root",
        section_title=kb_name,
        embedding=embedding
    )
    db.add(db_embedding)
    db.commit()
    
    print(f"[KB] Embedding created successfully")
    return 1


async def generate_and_store_embeddings(
    db: Session, 
    kb_id: int, 
    structure: dict
) -> int:
    """
    Legacy function for JSON structure - converts to markdown first.
    """
    kb_name = structure.get("name", "Knowledge Base")
    markdown_text = structure_to_markdown(structure)
    return await generate_and_store_embedding_from_markdown(db, kb_id, kb_name, markdown_text)


router = APIRouter()

# Directory for knowledge base files
KNOWLEDGE_DIR = "uploads/knowledge"
os.makedirs(KNOWLEDGE_DIR, exist_ok=True)

# Allowed file extensions
ALLOWED_EXTENSIONS = {".txt", ".md", ".pdf"}

# Prompt for formatting plain text to markdown
FORMAT_TO_MARKDOWN_PROMPT = """Convert the following text into well-formatted markdown documentation.

INSTRUCTIONS:
1. Add appropriate headers (# ## ###) to organize the content hierarchically
2. Use bullet points or numbered lists where appropriate
3. Use **bold** for important terms and concepts
4. Use `code` formatting for technical terms, file names, or code references
5. Add horizontal rules (---) to separate major sections if needed
6. Preserve all the original information - do not summarize or remove content
7. Make the document easy to read and navigate

TEXT TO FORMAT:
{content}

OUTPUT: Return ONLY the formatted markdown, no explanations or code blocks wrapping."""


# AI Prompt for processing uploaded content
KNOWLEDGE_EXTRACTION_PROMPT = """You are a technical documentation specialist. Analyze the following content and create a structured knowledge base document.

INSTRUCTIONS:
1. Identify the main domain/area this content covers (backend, frontend, database, devops, api, mobile, infrastructure, or general)
2. Extract key information and organize it into clear sections and subsections
3. Keep descriptions concise - each paragraph should be 2-3 sentences max
4. Focus on information useful for mapping new feature requests to relevant code areas
5. Use technical but clear language

OUTPUT FORMAT - Return ONLY valid JSON with this exact structure:
{{
  "domain": "<detected domain>",
  "name": "<suggested name for this knowledge base>",
  "description": "<one sentence describing what this KB covers>",
  "sections": [
    {{
      "id": "1",
      "title": "<section title>",
      "content": "<brief description of this section>",
      "subsections": [
        {{
          "id": "1.1",
          "title": "<subsection title>",
          "content": "<brief description>",
          "subsections": [
            {{
              "id": "1.1.1",
              "title": "<sub-subsection title>",
              "content": "<brief content>"
            }}
          ]
        }}
      ]
    }}
  ],
  "metadata": {{
    "total_sections": <number>,
    "key_topics": ["<topic1>", "<topic2>"]
  }}
}}

CONTENT TO ANALYZE:
{content}

Remember: Return ONLY valid JSON, no markdown code blocks or explanations."""


def generate_markdown_from_structure(structure: dict, level: int = 1) -> str:
    """Convert JSON structure to markdown format"""
    markdown = ""
    
    if level == 1:
        markdown += f"# {structure.get('name', 'Knowledge Base')}\n\n"
        if structure.get('description'):
            markdown += f"_{structure['description']}_\n\n"
        markdown += f"**Domain:** {structure.get('domain', 'general')}\n\n"
        markdown += "---\n\n"
    
    for section in structure.get('sections', []):
        # Determine heading level (max h4)
        heading = "#" * min(level + 1, 4)
        markdown += f"{heading} {section.get('id', '')}. {section.get('title', '')}\n\n"
        markdown += f"{section.get('content', '')}\n\n"
        
        # Recursively process subsections
        if section.get('subsections'):
            for subsection in section['subsections']:
                sub_heading = "#" * min(level + 2, 5)
                markdown += f"{sub_heading} {subsection.get('id', '')}. {subsection.get('title', '')}\n\n"
                markdown += f"{subsection.get('content', '')}\n\n"
                
                # Third level
                if subsection.get('subsections'):
                    for sub_sub in subsection['subsections']:
                        markdown += f"**{sub_sub.get('id', '')}. {sub_sub.get('title', '')}**\n\n"
                        markdown += f"{sub_sub.get('content', '')}\n\n"
    
    return markdown


def get_section_by_address(structure: dict, address: str) -> Optional[dict]:
    """Retrieve a section by its address (e.g., '1.2.3')"""
    parts = address.split(".")
    
    def find_section(sections: list, target_id: str) -> Optional[dict]:
        for section in sections:
            if section.get("id") == target_id:
                return section
        return None
    
    current_sections = structure.get("sections", [])
    current_section = None
    
    for i in range(len(parts)):
        target_id = ".".join(parts[:i+1])
        current_section = find_section(current_sections, target_id)
        
        if current_section is None:
            return None
        
        if i < len(parts) - 1:
            current_sections = current_section.get("subsections", [])
    
    return current_section


async def extract_content_from_file(file: UploadFile) -> str:
    """Extract text content from uploaded file"""
    content = await file.read()
    ext = os.path.splitext(file.filename)[1].lower()
    
    if ext in [".txt", ".md"]:
        # Decode text files directly
        try:
            return content.decode("utf-8")
        except UnicodeDecodeError:
            return content.decode("latin-1")
    
    elif ext == ".pdf":
        # For PDF, use pypdf to extract text
        try:
            import pypdf
            import io
            
            pdf_reader = pypdf.PdfReader(io.BytesIO(content))
            text_content = []
            
            for page in pdf_reader.pages:
                text_content.append(page.extract_text())
            
            return "\n\n".join(text_content)
        except ImportError:
            # If pypdf not installed, send raw content to LLM with instruction
            # This is a fallback - LLM can sometimes parse PDF text
            raise HTTPException(
                status_code=500,
                detail="PDF processing requires pypdf library. Please install it or upload TXT/MD files."
            )
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Error reading PDF: {str(e)}"
            )
    
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: .txt, .md, .pdf"
        )


@router.post("/upload", response_model=schemas.KnowledgeBaseResponse)
async def upload_knowledge_base(
    file: UploadFile = File(...),
    name: str = Form(...),
    domain: str = Form("general"),
    description: Optional[str] = Form(None),
    db: Session = Depends(database.get_db),
    current_user: user_models.User = Depends(get_current_user)
):
    """
    Upload a TXT, MD, or PDF file to create a new knowledge base.
    
    - MD files are stored directly (already formatted)
    - TXT/PDF files are formatted to markdown using AI, then stored
    - Embeddings are generated from the content for semantic search
    """
    # Check admin permission (role admin OR env admin)
    if not is_kb_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can manage knowledge bases"
        )
    
    # Validate file extension
    ext = os.path.splitext(file.filename)[1].lower()
    print(f"[KB] Uploading: {file.filename} (ext: {ext})")
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Extract content from file
    try:
        content = await extract_content_from_file(file)
        print(f"[KB] Extracted {len(content)} characters")
    except Exception as e:
        print(f"[KB] Error extracting content: {e}")
        raise
    
    if not content.strip():
        raise HTTPException(
            status_code=400,
            detail="File appears to be empty or could not be read"
        )
    
    # For TXT and PDF files, format to markdown using LLM
    if ext in [".txt", ".pdf"]:
        print(f"[KB] Formatting {ext} file to markdown using AI...")
        try:
            # Truncate if too long for AI context
            max_content_length = 30000
            format_content = content[:max_content_length] if len(content) > max_content_length else content
            
            prompt = FORMAT_TO_MARKDOWN_PROMPT.format(content=format_content)
            markdown_content = await ai_service.generate_text(prompt, complexity="medium")
            
            # Check for AI errors
            if markdown_content.startswith("Error:"):
                print(f"[KB] AI formatting failed: {markdown_content}")
                # Fallback to original content if AI fails
                markdown_content = content
            else:
                print(f"[KB] AI formatted to {len(markdown_content)} characters")
                
                # If content was truncated, append the rest
                if len(content) > max_content_length:
                    markdown_content += f"\n\n---\n\n## Additional Content\n\n{content[max_content_length:]}"
        except Exception as e:
            print(f"[KB] AI formatting error: {e}, using original content")
            markdown_content = content
    else:
        # MD files are already formatted
        markdown_content = content
    
    # Generate unique filename and save markdown
    unique_id = str(uuid.uuid4())
    markdown_filename = f"{unique_id}.md"
    markdown_path = os.path.join(KNOWLEDGE_DIR, markdown_filename)
    
    print(f"[KB] Saving markdown to {markdown_path}...")
    try:
        async with aiofiles.open(markdown_path, 'w') as f:
            await f.write(markdown_content)
        print(f"[KB] File saved successfully")
    except Exception as e:
        print(f"[KB] Error saving file: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Extract description from first meaningful line if not provided
    if not description:
        # Skip markdown headers and get first content line
        lines = markdown_content.strip().split('\n')
        for line in lines:
            line = line.strip()
            # Skip empty lines and headers
            if line and not line.startswith('#'):
                description = line[:200]
                break
    
    # Create database record
    print(f"[KB] Creating database record...")
    db_kb = models.KnowledgeBase(
        name=name,
        domain=domain,
        description=description,
        json_filename=None,  # No JSON for direct uploads
        markdown_filename=markdown_filename,
        original_filename=file.filename,
        created_by_id=current_user.id,
        updated_by_id=current_user.id
    )
    
    try:
        db.add(db_kb)
        db.commit()
        db.refresh(db_kb)
        print(f"[KB] Database record created with ID: {db_kb.id}")
    except Exception as e:
        print(f"[KB] Database error: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    
    # Generate embedding from formatted markdown content
    print(f"[KB] Generating embedding...")
    try:
        embeddings_count = await generate_and_store_embedding_from_markdown(db, db_kb.id, name, markdown_content)
        print(f"[KB] Generated {embeddings_count} embedding(s)")
    except Exception as e:
        print(f"[KB] Warning: Failed to generate embedding: {e}")
        # Don't fail the whole upload if embeddings fail
    
    return {
        "id": db_kb.id,
        "name": db_kb.name,
        "domain": db_kb.domain,
        "description": db_kb.description,
        "original_filename": db_kb.original_filename,
        "version": db_kb.version,
        "created_at": db_kb.created_at,
        "updated_at": db_kb.updated_at,
        "created_by_name": current_user.full_name,
        "updated_by_name": current_user.full_name
    }


@router.get("/", response_model=List[schemas.KnowledgeBaseResponse])
async def list_knowledge_bases(
    domain: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_user: user_models.User = Depends(get_current_user)
):
    """List all knowledge bases, optionally filtered by domain"""
    query = db.query(models.KnowledgeBase)
    
    if domain:
        query = query.filter(models.KnowledgeBase.domain == domain)
    
    kbs = query.order_by(models.KnowledgeBase.updated_at.desc()).all()
    
    return [
        {
            "id": kb.id,
            "name": kb.name,
            "domain": kb.domain,
            "description": kb.description,
            "original_filename": kb.original_filename,
            "version": kb.version,
            "created_at": kb.created_at,
            "updated_at": kb.updated_at,
            "created_by_name": kb.created_by.full_name if kb.created_by else None,
            "updated_by_name": kb.updated_by.full_name if kb.updated_by else None
        }
        for kb in kbs
    ]


@router.get("/domains")
async def get_domains(current_user: user_models.User = Depends(get_current_user)):
    """Get list of valid domains"""
    return {"domains": schemas.VALID_DOMAINS}


@router.get("/{kb_id}", response_model=schemas.KnowledgeBaseWithContent)
async def get_knowledge_base(
    kb_id: int,
    db: Session = Depends(database.get_db),
    current_user: user_models.User = Depends(get_current_user)
):
    """Get a knowledge base with full content"""
    kb = db.query(models.KnowledgeBase).filter(models.KnowledgeBase.id == kb_id).first()
    
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    # Read markdown file
    markdown_path = os.path.join(KNOWLEDGE_DIR, kb.markdown_filename)
    markdown_content = ""
    structure = None
    
    try:
        async with aiofiles.open(markdown_path, 'r') as f:
            markdown_content = await f.read()
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="Knowledge base file not found. The file may have been deleted."
        )
    
    # Read JSON structure if it exists (legacy uploads)
    if kb.json_filename:
        json_path = os.path.join(KNOWLEDGE_DIR, kb.json_filename)
        try:
            async with aiofiles.open(json_path, 'r') as f:
                structure = json.loads(await f.read())
        except FileNotFoundError:
            structure = None
    
    return {
        "id": kb.id,
        "name": kb.name,
        "domain": kb.domain,
        "description": kb.description,
        "original_filename": kb.original_filename,
        "version": kb.version,
        "created_at": kb.created_at,
        "updated_at": kb.updated_at,
        "created_by_name": kb.created_by.full_name if kb.created_by else None,
        "updated_by_name": kb.updated_by.full_name if kb.updated_by else None,
        "markdown_content": markdown_content,
        "structure": structure
    }


@router.get("/{kb_id}/section/{address}")
async def get_section(
    kb_id: int,
    address: str,
    db: Session = Depends(database.get_db),
    current_user: user_models.User = Depends(get_current_user)
):
    """Get a specific section by address (e.g., '1.2.3') - only works for structured KBs"""
    kb = db.query(models.KnowledgeBase).filter(models.KnowledgeBase.id == kb_id).first()
    
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    # Section navigation only works for KBs with JSON structure
    if not kb.json_filename:
        raise HTTPException(
            status_code=400, 
            detail="This knowledge base does not have a structured format. View the full markdown content instead."
        )
    
    json_path = os.path.join(KNOWLEDGE_DIR, kb.json_filename)
    
    try:
        async with aiofiles.open(json_path, 'r') as f:
            structure = json.loads(await f.read())
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Knowledge base file not found")
    
    section = get_section_by_address(structure, address)
    
    if not section:
        raise HTTPException(
            status_code=404,
            detail=f"Section '{address}' not found in knowledge base"
        )
    
    # Get child addresses
    children = []
    for sub in section.get("subsections", []):
        children.append(sub.get("id"))
    
    # Get parent address
    parts = address.split(".")
    parent_address = ".".join(parts[:-1]) if len(parts) > 1 else None
    
    return {
        "address": section.get("id"),
        "title": section.get("title"),
        "content": section.get("content"),
        "parent_address": parent_address,
        "children": children
    }


@router.put("/{kb_id}", response_model=schemas.KnowledgeBaseResponse)
async def update_knowledge_base(
    kb_id: int,
    update: schemas.KnowledgeBaseUpdate,
    db: Session = Depends(database.get_db),
    current_user: user_models.User = Depends(get_current_user)
):
    """Update knowledge base metadata"""
    if not is_kb_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can manage knowledge bases"
        )
    
    kb = db.query(models.KnowledgeBase).filter(models.KnowledgeBase.id == kb_id).first()
    
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    # Update fields
    if update.name is not None:
        kb.name = update.name
    if update.domain is not None:
        kb.domain = update.domain
    if update.description is not None:
        kb.description = update.description
    
    kb.updated_by_id = current_user.id
    kb.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(kb)
    
    return {
        "id": kb.id,
        "name": kb.name,
        "domain": kb.domain,
        "description": kb.description,
        "original_filename": kb.original_filename,
        "version": kb.version,
        "created_at": kb.created_at,
        "updated_at": kb.updated_at,
        "created_by_name": kb.created_by.full_name if kb.created_by else None,
        "updated_by_name": kb.updated_by.full_name if kb.updated_by else None
    }


@router.post("/{kb_id}/reprocess", response_model=schemas.KnowledgeBaseResponse)
async def reprocess_knowledge_base(
    kb_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    current_user: user_models.User = Depends(get_current_user)
):
    """
    Re-upload and reprocess a knowledge base with new content.
    Increments version number.
    """
    if not is_kb_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can manage knowledge bases"
        )
    
    kb = db.query(models.KnowledgeBase).filter(models.KnowledgeBase.id == kb_id).first()
    
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    # Validate file extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Extract content from file
    content = await extract_content_from_file(file)
    
    if not content.strip():
        raise HTTPException(status_code=400, detail="File appears to be empty")
    
    # For TXT and PDF files, format to markdown using LLM
    if ext in [".txt", ".pdf"]:
        print(f"[KB] Formatting {ext} file to markdown using AI...")
        try:
            max_content_length = 30000
            format_content = content[:max_content_length] if len(content) > max_content_length else content
            
            prompt = FORMAT_TO_MARKDOWN_PROMPT.format(content=format_content)
            markdown_content = await ai_service.generate_text(prompt, complexity="medium")
            
            if markdown_content.startswith("Error:"):
                markdown_content = content
            elif len(content) > max_content_length:
                markdown_content += f"\n\n---\n\n## Additional Content\n\n{content[max_content_length:]}"
        except Exception as e:
            print(f"[KB] AI formatting error: {e}, using original content")
            markdown_content = content
    else:
        markdown_content = content
    
    # Delete old files
    if kb.json_filename:
        old_json_path = os.path.join(KNOWLEDGE_DIR, kb.json_filename)
        if os.path.exists(old_json_path):
            os.remove(old_json_path)
    
    old_markdown_path = os.path.join(KNOWLEDGE_DIR, kb.markdown_filename)
    if os.path.exists(old_markdown_path):
        os.remove(old_markdown_path)
    
    # Generate new markdown file
    unique_id = str(uuid.uuid4())
    markdown_filename = f"{unique_id}.md"
    markdown_path = os.path.join(KNOWLEDGE_DIR, markdown_filename)
    
    async with aiofiles.open(markdown_path, 'w') as f:
        await f.write(markdown_content)
    
    # Update database record
    kb.json_filename = None  # New uploads don't use JSON
    kb.markdown_filename = markdown_filename
    kb.original_filename = file.filename
    kb.version += 1
    kb.updated_by_id = current_user.id
    kb.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(kb)
    
    # Regenerate embedding
    try:
        await generate_and_store_embedding_from_markdown(db, kb.id, kb.name, markdown_content)
    except Exception as e:
        print(f"[KB] Warning: Failed to regenerate embedding: {e}")
    
    return {
        "id": kb.id,
        "name": kb.name,
        "domain": kb.domain,
        "description": kb.description,
        "original_filename": kb.original_filename,
        "version": kb.version,
        "created_at": kb.created_at,
        "updated_at": kb.updated_at,
        "created_by_name": kb.created_by.full_name if kb.created_by else None,
        "updated_by_name": current_user.full_name
    }


@router.delete("/{kb_id}")
async def delete_knowledge_base(
    kb_id: int,
    db: Session = Depends(database.get_db),
    current_user: user_models.User = Depends(get_current_user)
):
    """Delete a knowledge base and its files"""
    if not is_kb_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can manage knowledge bases"
        )
    
    kb = db.query(models.KnowledgeBase).filter(models.KnowledgeBase.id == kb_id).first()
    
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    # Delete files
    if kb.json_filename:
        json_path = os.path.join(KNOWLEDGE_DIR, kb.json_filename)
        if os.path.exists(json_path):
            os.remove(json_path)
    
    markdown_path = os.path.join(KNOWLEDGE_DIR, kb.markdown_filename)
    if os.path.exists(markdown_path):
        os.remove(markdown_path)
    
    # Delete database record
    db.delete(kb)
    db.commit()
    
    return {"message": "Knowledge base deleted successfully"}


@router.get("/{kb_id}/download/markdown")
async def download_markdown(
    kb_id: int,
    db: Session = Depends(database.get_db),
    current_user: user_models.User = Depends(get_current_user)
):
    """Download the generated markdown file"""
    kb = db.query(models.KnowledgeBase).filter(models.KnowledgeBase.id == kb_id).first()
    
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    markdown_path = os.path.join(KNOWLEDGE_DIR, kb.markdown_filename)
    
    if not os.path.exists(markdown_path):
        raise HTTPException(status_code=404, detail="Markdown file not found")
    
    return FileResponse(
        markdown_path,
        filename=f"{kb.name.replace(' ', '_')}.md",
        media_type="text/markdown"
    )


@router.get("/{kb_id}/download/json")
async def download_json(
    kb_id: int,
    db: Session = Depends(database.get_db),
    current_user: user_models.User = Depends(get_current_user)
):
    """Download the structured JSON file (only available for legacy structured KBs)"""
    kb = db.query(models.KnowledgeBase).filter(models.KnowledgeBase.id == kb_id).first()
    
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    if not kb.json_filename:
        raise HTTPException(
            status_code=404, 
            detail="This knowledge base does not have a JSON structure file. Download the markdown instead."
        )
    
    json_path = os.path.join(KNOWLEDGE_DIR, kb.json_filename)
    
    if not os.path.exists(json_path):
        raise HTTPException(status_code=404, detail="JSON file not found")
    
    return FileResponse(
        json_path,
        filename=f"{kb.name.replace(' ', '_')}.json",
        media_type="application/json"
    )


# ============================================================================
# Vector Search Utilities (for internal use)
# ============================================================================

async def search_knowledge_base_internal(
    query: str,
    db: Session,
    limit: int = 5,
    min_score: float = 0.0,
    domain: Optional[str] = None
) -> List[dict]:
    """
    Internal function to search knowledge base by vector similarity.
    Can be imported and used by other modules without HTTP context.
    
    Args:
        query: The search query text
        db: Database session
        limit: Maximum number of results (default 5)
        min_score: Minimum similarity score (0-1), default 0
        domain: Optional domain filter
    
    Returns:
        List of matching KB entries with content and scores
    """
    from sqlalchemy import text
    
    # Generate embedding for the query
    print(f"[KB Internal Search] Searching for: {query[:100]}...")
    query_embedding = await ai_service.generate_embedding(query)
    
    if query_embedding is None:
        print("[KB Internal Search] Failed to generate embedding")
        return []
    
    # Search with vector similarity
    if domain:
        results = db.execute(
            text("""
                SELECT 
                    ke.kb_id,
                    ke.section_title,
                    kb.name as kb_name,
                    kb.domain,
                    kb.description,
                    kb.markdown_filename,
                    ke.embedding <=> :embedding as distance
                FROM knowledge_embeddings ke
                JOIN knowledge_bases kb ON ke.kb_id = kb.id
                WHERE kb.domain = :domain
                ORDER BY ke.embedding <=> :embedding
                LIMIT :limit
            """),
            {"embedding": str(query_embedding), "domain": domain, "limit": limit}
        ).fetchall()
    else:
        results = db.execute(
            text("""
                SELECT 
                    ke.kb_id,
                    ke.section_title,
                    kb.name as kb_name,
                    kb.domain,
                    kb.description,
                    kb.markdown_filename,
                    ke.embedding <=> :embedding as distance
                FROM knowledge_embeddings ke
                JOIN knowledge_bases kb ON ke.kb_id = kb.id
                ORDER BY ke.embedding <=> :embedding
                LIMIT :limit
            """),
            {"embedding": str(query_embedding), "limit": limit}
        ).fetchall()
    
    print(f"[KB Internal Search] Found {len(results)} raw results")
    
    # Log all similarity scores for debugging
    if results:
        print(f"[KB Internal Search] Similarity scores (threshold={min_score}):")
        for row in results:
            sim = max(0, 1 - float(row.distance))
            status = "✓" if sim >= min_score else "✗"
            print(f"  {status} {row.kb_name} ({row.domain}): {sim:.4f}")
    
    # Process results and filter by min_score
    search_results = []
    for row in results:
        similarity = max(0, 1 - float(row.distance))
        
        # Skip if below minimum score threshold
        if similarity < min_score:
            continue
        
        # Load markdown content directly
        markdown_path = os.path.join(KNOWLEDGE_DIR, row.markdown_filename)
        markdown_content = ""
        
        try:
            async with aiofiles.open(markdown_path, 'r') as f:
                markdown_content = await f.read()
        except Exception as e:
            print(f"[KB Internal Search] Error loading KB {row.kb_id}: {e}")
        
        search_results.append({
            "kb_id": row.kb_id,
            "kb_name": row.kb_name,
            "domain": row.domain,
            "description": row.description or "",
            "content": markdown_content,
            "similarity_score": round(similarity, 4)
        })
    
    print(f"[KB Internal Search] {len(search_results)} results above {min_score} threshold")
    return search_results


# ============================================================================
# Vector Search Endpoints
# ============================================================================

@router.post("/search")
async def search_knowledge_base(
    query: str,
    limit: int = 5,
    domain: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_user: user_models.User = Depends(get_current_user)
):
    """
    Search across all knowledge bases using vector similarity.
    Returns the most relevant sections with their content retrieved from JSON files.
    
    Args:
        query: The search query text
        limit: Maximum number of results (default 5)
        domain: Optional domain filter (backend, frontend, etc.)
    """
    # Generate embedding for the query
    print(f"[KB Search] Searching for: {query}")
    query_embedding = await ai_service.generate_embedding(query)
    
    if query_embedding is None:
        raise HTTPException(
            status_code=500,
            detail="Failed to generate embedding for search query"
        )
    
    # Build the query with vector similarity
    from sqlalchemy import text
    from pgvector.sqlalchemy import Vector
    
    # Use cosine distance for similarity search
    # Lower distance = more similar
    if domain:
        results = db.execute(
            text("""
                SELECT 
                    ke.id,
                    ke.kb_id,
                    ke.section_address,
                    ke.section_title,
                    kb.name as kb_name,
                    kb.domain,
                    kb.description,
                    ke.embedding <=> :embedding as distance
                FROM knowledge_embeddings ke
                JOIN knowledge_bases kb ON ke.kb_id = kb.id
                WHERE kb.domain = :domain
                ORDER BY ke.embedding <=> :embedding
                LIMIT :limit
            """),
            {"embedding": str(query_embedding), "domain": domain, "limit": limit}
        ).fetchall()
    else:
        results = db.execute(
            text("""
                SELECT 
                    ke.id,
                    ke.kb_id,
                    ke.section_address,
                    ke.section_title,
                    kb.name as kb_name,
                    kb.domain,
                    kb.description,
                    ke.embedding <=> :embedding as distance
                FROM knowledge_embeddings ke
                JOIN knowledge_bases kb ON ke.kb_id = kb.id
                ORDER BY ke.embedding <=> :embedding
                LIMIT :limit
            """),
            {"embedding": str(query_embedding), "limit": limit}
        ).fetchall()
    
    print(f"[KB Search] Found {len(results)} results")
    
    # Build search results from database records
    search_results = []
    for row in results:
        # Convert distance to similarity score (1 - distance for cosine)
        similarity = max(0, 1 - float(row.distance))
        
        search_results.append({
            "kb_id": row.kb_id,
            "kb_name": row.kb_name,
            "domain": row.domain,
            "description": row.description or "",
            "similarity_score": round(similarity, 4)
        })
    
    return {
        "query": query,
        "results": search_results,
        "total": len(search_results)
    }


@router.get("/{kb_id}/embeddings/count")
async def get_embeddings_count(
    kb_id: int,
    db: Session = Depends(database.get_db),
    current_user: user_models.User = Depends(get_current_user)
):
    """Get the number of embeddings for a knowledge base"""
    count = db.query(models.KnowledgeEmbedding).filter(
        models.KnowledgeEmbedding.kb_id == kb_id
    ).count()
    
    return {"kb_id": kb_id, "embeddings_count": count}


@router.post("/{kb_id}/embeddings/regenerate")
async def regenerate_embeddings(
    kb_id: int,
    db: Session = Depends(database.get_db),
    current_user: user_models.User = Depends(get_current_user)
):
    """Regenerate embeddings for a knowledge base"""
    if not is_kb_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can regenerate embeddings"
        )
    
    kb = db.query(models.KnowledgeBase).filter(models.KnowledgeBase.id == kb_id).first()
    
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    # Load content - prefer markdown file
    markdown_path = os.path.join(KNOWLEDGE_DIR, kb.markdown_filename)
    
    try:
        async with aiofiles.open(markdown_path, 'r') as f:
            markdown_content = await f.read()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Knowledge base markdown file not found")
    
    # Regenerate embeddings from markdown content
    embeddings_count = await generate_and_store_embedding_from_markdown(db, kb_id, kb.name, markdown_content)
    
    return {
        "kb_id": kb_id,
        "embeddings_regenerated": embeddings_count,
        "message": f"Successfully regenerated {embeddings_count} embeddings"
    }
