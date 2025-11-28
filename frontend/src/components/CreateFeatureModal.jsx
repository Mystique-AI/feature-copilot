import { useState, useRef } from 'react';
import { aiAssist } from '../services/api';
import VoiceInput from './VoiceInput';

export default function CreateFeatureModal({ isOpen, onClose, onSubmit }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [useCase, setUseCase] = useState('');
  const [priority, setPriority] = useState('medium');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [brief, setBrief] = useState('');
  const [showBriefInput, setShowBriefInput] = useState(true);
  const [activeField, setActiveField] = useState(null);
  
  // Refs for cursor position
  const briefRef = useRef(null);
  const titleRef = useRef(null);
  const descriptionRef = useRef(null);
  const useCaseRef = useRef(null);

  const handleVoiceTranscript = (transcript) => {
    // Insert transcript at cursor position in the active field
    const insertAtCursor = (ref, setValue, currentValue) => {
      if (ref.current) {
        const start = ref.current.selectionStart || currentValue.length;
        const end = ref.current.selectionEnd || currentValue.length;
        const newValue = currentValue.slice(0, start) + transcript + currentValue.slice(end);
        setValue(newValue);
        // Set cursor position after inserted text
        setTimeout(() => {
          ref.current.selectionStart = ref.current.selectionEnd = start + transcript.length;
          ref.current.focus();
        }, 0);
      } else {
        setValue(currentValue + transcript);
      }
    };

    switch (activeField) {
      case 'brief':
        insertAtCursor(briefRef, setBrief, brief);
        break;
      case 'title':
        insertAtCursor(titleRef, setTitle, title);
        break;
      case 'description':
        insertAtCursor(descriptionRef, setDescription, description);
        break;
      case 'useCase':
        insertAtCursor(useCaseRef, setUseCase, useCase);
        break;
      default:
        // Default to brief if AI section is shown, otherwise description
        if (showBriefInput) {
          setBrief(brief + transcript);
        } else {
          setDescription(description + transcript);
        }
    }
  };

  const handleAddTag = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const tag = tagInput.trim().toLowerCase();
      if (tag && !tags.includes(tag)) {
        setTags([...tags, tag]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleAiGenerate = async () => {
    if (!brief.trim()) return;
    
    setAiLoading(true);
    try {
      // Send to backend which uses centralized prompts
      const result = await aiAssist('generate_feature', brief, 'medium');
      
      try {
        // Try to parse the JSON response
        let jsonStr = result.result;
        // Handle if response is wrapped in markdown code blocks
        if (jsonStr.includes('```')) {
          jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '');
        }
        const data = JSON.parse(jsonStr.trim());
        
        if (data.title) setTitle(data.title);
        if (data.description) setDescription(data.description);
        if (data.use_case) setUseCase(data.use_case);
        if (data.priority && ['low', 'medium', 'high', 'critical'].includes(data.priority)) {
          setPriority(data.priority);
        }
        if (data.tags && Array.isArray(data.tags)) {
          setTags(data.tags.map(t => t.toLowerCase()));
        }
        
        setShowBriefInput(false);
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError);
        // Fallback: just use the brief as description
        setTitle(brief.slice(0, 60));
        setDescription(result.result);
        setShowBriefInput(false);
      }
    } catch (error) {
      console.error('AI generation failed', error);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({ title, description, use_case: useCase, priority, tags });
      // Reset form
      setTitle('');
      setDescription('');
      setUseCase('');
      setPriority('medium');
      setTags([]);
      setBrief('');
      setShowBriefInput(true);
      onClose();
    } catch (error) {
      console.error('Failed to create feature request', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setDescription('');
    setUseCase('');
    setPriority('medium');
    setTags([]);
    setBrief('');
    setShowBriefInput(true);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose}></div>
      
      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-[#111a22]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-black dark:text-white">Create New Feature Request</h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* AI Brief Input */}
        {showBriefInput && (
          <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">✨</span>
              <p className="text-sm font-medium text-black dark:text-white">AI-Assisted Creation</p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Describe your feature idea briefly and AI will generate all the details for you.
            </p>
            <div className="flex gap-2 mb-3">
              <textarea
                ref={briefRef}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                onFocus={() => setActiveField('brief')}
                placeholder="e.g., I need a way to export reports to PDF with custom branding options..."
                rows={3}
                className="flex-1 rounded-lg border border-gray-300 p-3 text-sm focus:border-primary focus:ring-primary dark:border-gray-600 dark:bg-[#233648] dark:text-white resize-none"
              />
              <VoiceInput onTranscript={handleVoiceTranscript} />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAiGenerate}
                disabled={!brief.trim() || aiLoading}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg text-sm font-medium hover:from-purple-600 hover:to-blue-600 disabled:opacity-50"
              >
                {aiLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    <span>Generate with AI</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowBriefInput(false)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Skip, fill manually
              </button>
            </div>
          </div>
        )}

        {/* Show form after AI generation or manual fill */}
        {!showBriefInput && (
          <button
            type="button"
            onClick={() => setShowBriefInput(true)}
            className="mb-4 flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <span>✨</span>
            <span>Regenerate with AI</span>
          </button>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
            <div className="flex gap-2">
              <input
                ref={titleRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onFocus={() => setActiveField('title')}
                placeholder="Brief title for the feature request"
                className="flex-1 rounded-lg border border-gray-300 p-3 text-sm focus:border-primary focus:ring-primary dark:border-gray-600 dark:bg-[#233648] dark:text-white"
                required
              />
              <VoiceInput onTranscript={handleVoiceTranscript} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <div className="flex gap-2">
              <textarea
                ref={descriptionRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onFocus={() => setActiveField('description')}
                placeholder="Detailed description of the feature..."
                rows={4}
                className="flex-1 rounded-lg border border-gray-300 p-3 text-sm focus:border-primary focus:ring-primary dark:border-gray-600 dark:bg-[#233648] dark:text-white resize-none"
                required
              />
              <VoiceInput onTranscript={handleVoiceTranscript} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Use Case</label>
            <div className="flex gap-2">
              <textarea
                ref={useCaseRef}
                value={useCase}
                onChange={(e) => setUseCase(e.target.value)}
                onFocus={() => setActiveField('useCase')}
                placeholder="How will this feature be used? Who benefits?"
                rows={2}
                className="flex-1 rounded-lg border border-gray-300 p-3 text-sm focus:border-primary focus:ring-primary dark:border-gray-600 dark:bg-[#233648] dark:text-white resize-none"
              />
              <VoiceInput onTranscript={handleVoiceTranscript} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-primary focus:ring-primary dark:border-gray-600 dark:bg-[#233648] dark:text-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags</label>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="Type and press Enter"
                className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-primary focus:ring-primary dark:border-gray-600 dark:bg-[#233648] dark:text-white"
              />
            </div>
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
                >
                  {tag}
                  <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-red-500">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg dark:text-gray-300 dark:hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-bold text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
