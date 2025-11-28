import { useState, useRef, useEffect } from 'react';
import { aiAssist, transitionFeature, addComment, updateFeature, uploadAttachment, getAttachments, deleteAttachment } from '../services/api';
import VoiceInput from './VoiceInput';

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

const AI_ACTIONS = [
  { action: 'summarize', label: '✨ Summarize', className: 'bg-teal-500/20 text-teal-600 dark:text-teal-400 hover:bg-teal-500/30' },
  { action: 'elaborate', label: '✨ Elaborate', className: 'bg-purple-500/20 text-purple-600 dark:text-purple-400 hover:bg-purple-500/30' },
  { action: 'generate_ac', label: '✨ Generate Acceptance Criteria', className: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/30' },
  { action: 'generate_user_stories', label: '✨ Generate User Stories', className: 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/30' },
  { action: 'suggest_problem_statement', label: '✨ Improve Problem Statement', className: 'bg-pink-500/20 text-pink-600 dark:text-pink-400 hover:bg-pink-500/30' },
  { action: 'generate_tasks', label: '✨ Break into Tasks', className: 'bg-orange-500/20 text-orange-600 dark:text-orange-400 hover:bg-orange-500/30' },
];

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
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (activeTab === 'attachments') {
      loadAttachments();
    }
  }, [activeTab, feature.id]);

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

  const handleApplyAiResult = async () => {
    if (!aiResult) return;
    try {
      if (aiResult.action === 'generate_ac') {
        await updateFeature(feature.id, { acceptance_criteria: aiResult.result });
      }
      onUpdate();
      setAiResult(null);
    } catch (error) {
      console.error('Failed to apply AI result', error);
    }
  };

  const getStatusClasses = (status) => {
    const opt = STATUS_OPTIONS.find(s => s.value === status);
    return opt ? `${opt.bgClass} ${opt.textClass}` : 'bg-gray-100 dark:bg-gray-500/20 text-gray-800 dark:text-gray-400';
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
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Title</p>
              <h3 className="mt-1 text-xl font-bold text-black dark:text-white">{feature.title}</h3>
            </div>

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
                <p className="mt-1 text-sm text-black dark:text-white capitalize">{feature.priority}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Description</p>
              <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{feature.description}</p>
            </div>

            {feature.use_case && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Use Case</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{feature.use_case}</p>
              </div>
            )}

            {feature.acceptance_criteria && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Acceptance Criteria</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{feature.acceptance_criteria}</p>
              </div>
            )}

            {feature.tags && feature.tags.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Tags</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {feature.tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

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
                      Apply to Feature
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{aiResult.result}</p>
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
    </aside>
  );
}
