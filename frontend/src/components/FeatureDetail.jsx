import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { aiAssist, transitionFeature, addComment, updateFeature, uploadAttachment, getAttachments, deleteAttachment } from '../services/api';
import VoiceInput from './VoiceInput';

// Reusable Markdown renderer component
function MarkdownContent({ content, className = "" }) {
  if (!content) return null;
  
  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        p: ({children}) => <p className="my-1 text-sm text-gray-600 dark:text-gray-300">{children}</p>,
        ul: ({children}) => <ul className="list-disc list-inside my-1 space-y-0.5 text-sm">{children}</ul>,
        ol: ({children}) => <ol className="list-decimal list-inside my-1 space-y-0.5 text-sm">{children}</ol>,
        li: ({children}) => <li className="text-gray-600 dark:text-gray-300">{children}</li>,
        h1: ({children}) => <h1 className="text-lg font-bold mt-3 mb-1">{children}</h1>,
        h2: ({children}) => <h2 className="text-base font-bold mt-2 mb-1">{children}</h2>,
        h3: ({children}) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
        strong: ({children}) => <strong className="font-semibold">{children}</strong>,
        code: ({inline, children}) => inline 
          ? <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs font-mono text-pink-600 dark:text-pink-400">{children}</code>
          : <code className="block bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs font-mono overflow-x-auto">{children}</code>,
        pre: ({children}) => <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded my-2 overflow-x-auto text-xs">{children}</pre>,
        table: ({children}) => (
          <div className="overflow-x-auto my-2">
            <table className="min-w-full text-xs divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700">
              {children}
            </table>
          </div>
        ),
        thead: ({children}) => <thead className="bg-gray-50 dark:bg-gray-800">{children}</thead>,
        tbody: ({children}) => <tbody className="divide-y divide-gray-200 dark:divide-gray-700">{children}</tbody>,
        th: ({children}) => <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{children}</th>,
        td: ({children}) => <td className="px-2 py-1 text-xs text-gray-600 dark:text-gray-300">{children}</td>,
        a: ({href, children}) => <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
      }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

const STATUS_OPTIONS = [
  { value: 'submitted', label: 'Submitted', bgClass: 'bg-blue-100 dark:bg-blue-500/20', textClass: 'text-blue-800 dark:text-blue-400' },
  { value: 'under_review', label: 'Under Review', bgClass: 'bg-yellow-100 dark:bg-yellow-500/20', textClass: 'text-yellow-800 dark:text-yellow-400' },
  { value: 'approved', label: 'Approved', bgClass: 'bg-green-100 dark:bg-green-500/20', textClass: 'text-green-800 dark:text-green-400' },
  { value: 'rejected', label: 'Rejected', bgClass: 'bg-red-100 dark:bg-red-500/20', textClass: 'text-red-800 dark:text-red-400' },
  { value: 'in_development', label: 'In Development', bgClass: 'bg-purple-100 dark:bg-purple-500/20', textClass: 'text-purple-800 dark:text-purple-400' },
  { value: 'in_qa', label: 'In QA', bgClass: 'bg-orange-100 dark:bg-orange-500/20', textClass: 'text-orange-800 dark:text-orange-400' },
  { value: 'completed', label: 'Completed', bgClass: 'bg-emerald-100 dark:bg-emerald-500/20', textClass: 'text-emerald-800 dark:text-emerald-400' },
  { value: 'deployed', label: 'Deployed', bgClass: 'bg-teal-100 dark:bg-teal-500/20', textClass: 'text-teal-800 dark:text-teal-400' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', bgClass: 'bg-gray-100 dark:bg-gray-500/20', textClass: 'text-gray-800 dark:text-gray-400' },
  { value: 'medium', label: 'Medium', bgClass: 'bg-blue-100 dark:bg-blue-500/20', textClass: 'text-blue-800 dark:text-blue-400' },
  { value: 'high', label: 'High', bgClass: 'bg-orange-100 dark:bg-orange-500/20', textClass: 'text-orange-800 dark:text-orange-400' },
  { value: 'critical', label: 'Critical', bgClass: 'bg-red-100 dark:bg-red-500/20', textClass: 'text-red-800 dark:text-red-400' },
];

const AI_ACTIONS = [
  { action: 'summarize', label: '✨ Summarize', className: 'bg-teal-500/20 text-teal-600 dark:text-teal-400 hover:bg-teal-500/30' },
  { action: 'elaborate', label: '✨ Elaborate', className: 'bg-purple-500/20 text-purple-600 dark:text-purple-400 hover:bg-purple-500/30' },
  { action: 'generate_ac', label: '✨ Generate Acceptance Criteria', className: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/30' },
  { action: 'generate_user_stories', label: '✨ Generate User Stories', className: 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/30' },
  { action: 'suggest_problem_statement', label: '✨ Improve Problem Statement', className: 'bg-pink-500/20 text-pink-600 dark:text-pink-400 hover:bg-pink-500/30' },
  { action: 'generate_tasks', label: '✨ Break into Tasks', className: 'bg-orange-500/20 text-orange-600 dark:text-orange-400 hover:bg-orange-500/30' },
];

// Reusable Editable Section Component
const EditableSection = ({ 
  field, 
  label, 
  value, 
  isMarkdown = true,
  editingField,
  startEditing,
  cancelEditing,
  saveField,
  editValue,
  setEditValue,
  savingField
}) => {
  const isEditing = editingField === field;
  
  return (
    <div className="group relative">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
        {!isEditing && (
          <button 
            onClick={() => startEditing(field, value)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-primary"
            title={`Edit ${label}`}
          >
            <span className="material-symbols-outlined text-xs">edit</span>
          </button>
        )}
      </div>
      
      {isEditing ? (
        <div className="mt-1">
          {isMarkdown ? (
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full h-32 p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#233648] text-sm font-mono focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder={`Enter ${label.toLowerCase()} (markdown supported)...`}
              autoFocus
            />
          ) : (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#233648] text-sm"
              placeholder={`Enter ${label.toLowerCase()}...`}
              autoFocus
            />
          )}
          <div className="flex justify-end gap-2 mt-2">
            <button 
              onClick={cancelEditing}
              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              disabled={savingField}
            >
              Cancel
            </button>
            <button 
              onClick={saveField}
              disabled={savingField}
              className="px-3 py-1 text-xs bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
            >
              {savingField && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>}
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-1 min-h-[20px]">
          {field === 'tags' ? (
            <div className="flex flex-wrap gap-2">
              {value && value.length > 0 ? (
                value.map((tag) => (
                  <span key={tag} className="inline-flex items-center px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    {tag}
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-400 italic">No tags</span>
              )}
            </div>
          ) : isMarkdown ? (
            <div className="relative">
              {value ? (
                <MarkdownContent content={value} />
              ) : (
                <p className="text-sm text-gray-400 italic">No content provided</p>
              )}
            </div>
          ) : (
            <p className="text-xl font-bold text-black dark:text-white">{value}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default function FeatureDetail({ feature, onClose, onUpdate }) {
  const [activeTab, setActiveTab] = useState('details');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState(feature.comments || []);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState('');
  const fileInputRef = useRef(null);
  
  // Editing state
  const [editingField, setEditingField] = useState(null); // 'title', 'description', 'use_case', 'tags'
  const [editValue, setEditValue] = useState('');
  const [savingField, setSavingField] = useState(false);

  // Reset comments and attachments when feature changes
  useEffect(() => {
    setComments(feature.comments || []);
    setAttachments([]);
    setAiResult(null);
    setEditingField(null);
  }, [feature.id]);

  useEffect(() => {
    if (activeTab === 'attachments') {
      loadAttachments();
    }
  }, [activeTab, feature.id]);

  const startEditing = (field, value) => {
    setEditingField(field);
    // For tags, convert array to comma-separated string
    if (field === 'tags' && Array.isArray(value)) {
      setEditValue(value.join(', '));
    } else {
      setEditValue(value || '');
    }
  };

  const cancelEditing = () => {
    setEditingField(null);
    setEditValue('');
  };

  const saveField = async () => {
    if (!editingField) return;
    
    setSavingField(true);
    try {
      let updateData = {};
      
      if (editingField === 'tags') {
        // Parse comma-separated tags
        const tagsArray = editValue.split(',').map(t => t.trim()).filter(t => t);
        updateData = { tags: tagsArray };
      } else {
        updateData = { [editingField]: editValue };
      }
      
      await updateFeature(feature.id, updateData);
      onUpdate(); // Refresh parent
      setEditingField(null);
    } catch (error) {
      console.error(`Failed to update ${editingField}`, error);
    } finally {
      setSavingField(false);
    }
  };

  const loadAttachments = async () => {
    try {
      const data = await getAttachments(feature.id);
      setAttachments(data);
    } catch (error) {
      console.error('Failed to load attachments', error);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const newAttachment = await uploadAttachment(feature.id, file);
      setAttachments([newAttachment, ...attachments]);
    } catch (error) {
      console.error('Failed to upload file', error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    try {
      await deleteAttachment(attachmentId);
      setAttachments(attachments.filter(a => a.id !== attachmentId));
    } catch (error) {
      console.error('Failed to delete attachment', error);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleAiAction = async (action) => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const context = `Title: ${feature.title}\n\nDescription: ${feature.description}\n\nUse Case: ${feature.use_case || 'Not specified'}`;
      const result = await aiAssist(action, context, 'medium');
      setAiResult({ action, result: result.result });
    } catch (error) {
      console.error('AI action failed', error);
      setAiResult({ action, result: 'Error: Failed to get AI response' });
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    try {
      const newComment = await addComment(feature.id, comment);
      setComments([newComment, ...comments]);
      setComment('');
    } catch (error) {
      console.error('Failed to add comment', error);
    }
  };

  const handleStatusChange = async () => {
    try {
      await transitionFeature(feature.id, selectedStatus, statusReason);
      onUpdate();
      setShowStatusModal(false);
    } catch (error) {
      console.error('Failed to change status', error);
    }
  };

  const handlePriorityChange = async () => {
    if (!selectedPriority) return;
    try {
      await updateFeature(feature.id, { priority: selectedPriority });
      onUpdate();
      setShowPriorityModal(false);
      setSelectedPriority('');
    } catch (error) {
      console.error('Failed to change priority', error);
    }
  };

  const handleApplyAiResult = async () => {
    if (!aiResult) return;
    try {
      let updateData = {};
      
      if (aiResult.action === 'generate_ac') {
        updateData = { acceptance_criteria: aiResult.result };
      } else if (aiResult.action === 'generate_user_stories') {
        updateData = { use_case: aiResult.result };
      } else if (aiResult.action === 'elaborate' || aiResult.action === 'summarize') {
        updateData = { description: aiResult.result };
      }

      if (Object.keys(updateData).length > 0) {
        await updateFeature(feature.id, updateData);
        onUpdate();
        setAiResult(null);
      }
    } catch (error) {
      console.error('Failed to apply AI result', error);
    }
  };

  const getStatusClasses = (status) => {
    const opt = STATUS_OPTIONS.find(s => s.value === status);
    return opt ? `${opt.bgClass} ${opt.textClass}` : 'bg-gray-100 dark:bg-gray-500/20 text-gray-800 dark:text-gray-400';
  };

  const getPriorityClasses = (priority) => {
    const opt = PRIORITY_OPTIONS.find(p => p.value === priority);
    return opt ? `${opt.bgClass} ${opt.textClass}` : 'bg-gray-100 dark:bg-gray-500/20 text-gray-800 dark:text-gray-400';
  };

  const editProps = {
    editingField,
    startEditing,
    cancelEditing,
    saveField,
    editValue,
    setEditValue,
    savingField
  };

  return (
    <aside className="flex w-[480px] flex-col border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111a22] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-bold text-black dark:text-white">Feature Details</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {['details', 'ai', 'comments', 'attachments'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-medium capitalize ${
              activeTab === tab
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'details' && (
          <div className="flex flex-col gap-4">
            <EditableSection 
              field="title" 
              label="Title" 
              value={feature.title} 
              isMarkdown={false}
              {...editProps}
            />

            <div className="flex gap-4">
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Status</p>
                <button
                  onClick={() => setShowStatusModal(true)}
                  className={`mt-1 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium cursor-pointer hover:opacity-80 ${getStatusClasses(feature.status)}`}
                >
                  {STATUS_OPTIONS.find(s => s.value === feature.status)?.label || feature.status}
                  <span className="material-symbols-outlined text-sm">expand_more</span>
                </button>
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Priority</p>
                <button
                  onClick={() => setShowPriorityModal(true)}
                  className={`mt-1 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium cursor-pointer hover:opacity-80 ${getPriorityClasses(feature.priority)}`}
                >
                  {PRIORITY_OPTIONS.find(p => p.value === feature.priority)?.label || feature.priority}
                  <span className="material-symbols-outlined text-sm">expand_more</span>
                </button>
              </div>
            </div>

            <EditableSection 
              field="description" 
              label="Description" 
              value={feature.description}
              {...editProps}
            />

            <EditableSection 
              field="use_case" 
              label="Use Case" 
              value={feature.use_case}
              {...editProps}
            />

            <EditableSection 
              field="acceptance_criteria" 
              label="Acceptance Criteria" 
              value={feature.acceptance_criteria}
              {...editProps}
            />

            <EditableSection 
              field="tags" 
              label="Tags" 
              value={feature.tags} 
              isMarkdown={false}
              {...editProps}
            />

            <div className="flex gap-4 text-sm text-gray-500">
              <div>
                <span className="font-medium">Requester:</span> {feature.requester_name || 'Unknown'}
              </div>
              {feature.assigned_to_name && (
                <div>
                  <span className="font-medium">Assigned:</span> {feature.assigned_to_name}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Use AI to enhance this feature request</p>
            
            <div className="grid grid-cols-2 gap-2">
              {AI_ACTIONS.map(({ action, label, className }) => (
                <button
                  key={action}
                  onClick={() => handleAiAction(action)}
                  disabled={aiLoading}
                  className={`flex items-center justify-center gap-1 rounded-lg h-10 px-3 text-xs font-bold disabled:opacity-50 ${className}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {aiLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            )}

            {aiResult && (
              <div className="mt-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">AI Result</p>
                  {aiResult.action === 'generate_ac' && (
                    <button
                      onClick={handleApplyAiResult}
                      className="text-xs text-primary hover:underline"
                    >
                      Save to Acceptance Criteria
                    </button>
                  )}
                  {aiResult.action === 'generate_user_stories' && (
                    <button
                      onClick={handleApplyAiResult}
                      className="text-xs text-primary hover:underline"
                    >
                      Save to Use Case
                    </button>
                  )}
                  {(aiResult.action === 'elaborate' || aiResult.action === 'summarize') && (
                    <button
                      onClick={handleApplyAiResult}
                      className="text-xs text-primary hover:underline"
                    >
                      Save to Description
                    </button>
                  )}
                </div>
                <MarkdownContent content={aiResult.result} />
              </div>
            )}
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#233648] px-3 py-2 text-sm"
                onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
              />
              <VoiceInput onTranscript={(text) => setComment(prev => prev + text)} />
              <button
                onClick={handleAddComment}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium"
              >
                Send
              </button>
            </div>

            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-black dark:text-white">{c.user_name || 'Unknown'}</span>
                    <span className="text-xs text-gray-500">{new Date(c.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{c.content}</p>
                </div>
              ))}
              {comments.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No comments yet</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'attachments' && (
          <div className="flex flex-col gap-4">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className={`flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-primary hover:bg-primary/5 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <span className="material-symbols-outlined text-gray-400">upload_file</span>
                <span className="text-sm text-gray-500">
                  {uploading ? 'Uploading...' : 'Click to upload screenshot or file'}
                </span>
              </label>
            </div>

            <div className="space-y-2">
              {attachments.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-gray-400">
                      {a.content_type?.startsWith('image/') ? 'image' : 'description'}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-black dark:text-white truncate max-w-[200px]">{a.filename}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(a.size)} • {a.user_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`http://localhost:8000/features/attachments/${a.id}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:text-primary"
                    >
                      <span className="material-symbols-outlined text-sm">download</span>
                    </a>
                    <button
                      onClick={() => handleDeleteAttachment(a.id)}
                      className="text-gray-500 hover:text-red-500"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                </div>
              ))}
              {attachments.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No attachments yet</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status Change Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowStatusModal(false)}></div>
          <div className="relative z-10 w-full max-w-md rounded-xl bg-white dark:bg-[#111a22] p-6 shadow-xl">
            <h3 className="text-lg font-bold mb-4 text-black dark:text-white">Change Status</h3>
            <div className="space-y-3">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedStatus(opt.value)}
                  className={`w-full text-left px-4 py-2 rounded-lg text-sm ${
                    selectedStatus === opt.value
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {(selectedStatus === 'approved' || selectedStatus === 'rejected') && (
              <div className="mt-4">
                <div className="flex gap-2 items-start">
                  <textarea
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    placeholder={selectedStatus === 'rejected' ? 'Reason for rejection...' : 'Approval notes...'}
                    className="flex-1 p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#233648] text-sm"
                    rows={3}
                  />
                  <VoiceInput onTranscript={(text) => setStatusReason(prev => prev + text)} />
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowStatusModal(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusChange}
                disabled={!selectedStatus}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                Update Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Priority Change Modal */}
      {showPriorityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowPriorityModal(false)}></div>
          <div className="relative z-10 w-full max-w-md rounded-xl bg-white dark:bg-[#111a22] p-6 shadow-xl">
            <h3 className="text-lg font-bold mb-4 text-black dark:text-white">Change Priority</h3>
            <div className="space-y-3">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedPriority(opt.value)}
                  className={`w-full text-left px-4 py-2 rounded-lg text-sm ${
                    selectedPriority === opt.value
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowPriorityModal(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handlePriorityChange}
                disabled={!selectedPriority}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                Update Priority
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
