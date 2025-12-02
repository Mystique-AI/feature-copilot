import { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Sidebar from '../components/Sidebar';
import { 
  getCurrentUser, 
  getKnowledgeBases, 
  getKnowledgeBase,
  getKnowledgeDomains,
  uploadKnowledgeBase, 
  updateKnowledgeBase,
  reprocessKnowledgeBase,
  deleteKnowledgeBase,
  downloadKnowledgeMarkdown,
  downloadKnowledgeJson
} from '../services/api';

const DOMAIN_COLORS = {
  backend: 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-400',
  frontend: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400',
  database: 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400',
  devops: 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-400',
  api: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-400',
  mobile: 'bg-pink-100 text-pink-800 dark:bg-pink-500/20 dark:text-pink-400',
  infrastructure: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-400',
  ai: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-400',
  general: 'bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-400',
};

// Markdown renderer component with full GFM support (tables, lists, etc.)
function MarkdownRenderer({ content }) {
  if (!content) return null;
  
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headers
          h1: ({children}) => <h1 className="text-2xl font-black text-black dark:text-white mt-6 mb-4">{children}</h1>,
          h2: ({children}) => <h2 className="text-xl font-bold text-black dark:text-white mt-6 mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">{children}</h2>,
          h3: ({children}) => <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-5 mb-2">{children}</h3>,
          h4: ({children}) => <h4 className="text-base font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">{children}</h4>,
          h5: ({children}) => <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-3 mb-1">{children}</h5>,
          
          // Paragraphs
          p: ({children}) => <p className="my-2 text-gray-700 dark:text-gray-300">{children}</p>,
          
          // Lists
          ul: ({children}) => <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>,
          ol: ({children}) => <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>,
          li: ({children}) => <li className="text-gray-700 dark:text-gray-300">{children}</li>,
          
          // Tables
          table: ({children}) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700">
                {children}
              </table>
            </div>
          ),
          thead: ({children}) => <thead className="bg-gray-50 dark:bg-gray-800">{children}</thead>,
          tbody: ({children}) => <tbody className="divide-y divide-gray-200 dark:divide-gray-700">{children}</tbody>,
          tr: ({children}) => <tr>{children}</tr>,
          th: ({children}) => <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{children}</th>,
          td: ({children}) => <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{children}</td>,
          
          // Code
          code: ({inline, children}) => inline 
            ? <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono text-pink-600 dark:text-pink-400">{children}</code>
            : <code className="block bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm font-mono overflow-x-auto">{children}</code>,
          pre: ({children}) => <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded my-3 overflow-x-auto">{children}</pre>,
          
          // Other elements
          strong: ({children}) => <strong className="font-semibold">{children}</strong>,
          em: ({children}) => <em className="italic text-gray-600 dark:text-gray-400">{children}</em>,
          hr: () => <hr className="my-4 border-gray-200 dark:border-gray-700" />,
          a: ({href, children}) => <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
          blockquote: ({children}) => <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 my-2 italic text-gray-600 dark:text-gray-400">{children}</blockquote>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// Recursive section tree component
function SectionTree({ sections, level = 0, onSelectSection }) {
  if (!sections || sections.length === 0) return null;
  
  return (
    <ul className={`${level > 0 ? 'ml-4 border-l border-gray-200 dark:border-gray-700 pl-3' : ''}`}>
      {sections.map((section) => (
        <li key={section.id} className="py-1">
          <button
            onClick={() => onSelectSection(section)}
            className="text-left w-full hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-2 py-1 text-sm transition-colors"
          >
            <span className="text-gray-500 dark:text-gray-500 font-mono text-xs mr-2">{section.id}</span>
            <span className="text-gray-800 dark:text-gray-200">{section.title}</span>
          </button>
          {section.subsections && section.subsections.length > 0 && (
            <SectionTree 
              sections={section.subsections} 
              level={level + 1} 
              onSelectSection={onSelectSection}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

export default function KnowledgeBase() {
  const [currentUser, setCurrentUser] = useState(null);
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedKB, setSelectedKB] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list', 'detail', 'structure'
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Upload form state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadDomain, setUploadDomain] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  
  // Edit form state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editKB, setEditKB] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDomain, setEditDomain] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteKB, setDeleteKB] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [user, kbs, domainsData] = await Promise.all([
        getCurrentUser(),
        getKnowledgeBases(),
        getKnowledgeDomains()
      ]);
      setCurrentUser(user);
      setKnowledgeBases(kbs);
      setDomains(domainsData.domains || []);
    } catch (error) {
      console.error('Failed to load data', error);
      setMessage({ type: 'error', text: 'Failed to load knowledge bases' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile || !uploadName || !uploadDomain) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' });
      return;
    }
    
    setUploading(true);
    setMessage({ type: '', text: '' });
    
    try {
      await uploadKnowledgeBase(
        uploadFile,
        uploadName || null,
        uploadDomain || null,
        uploadDescription || null
      );
      setMessage({ type: 'success', text: 'Knowledge base created successfully!' });
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadName('');
      setUploadDomain('');
      setUploadDescription('');
      loadData();
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Failed to upload knowledge base' 
      });
    } finally {
      setUploading(false);
    }
  };

  const handleViewDetail = async (kb) => {
    try {
      const fullKB = await getKnowledgeBase(kb.id);
      setSelectedKB(fullKB);
      setViewMode('detail');
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load knowledge base details' });
    }
  };

  const handleEdit = (kb) => {
    setEditKB(kb);
    setEditName(kb.name);
    setEditDomain(kb.domain);
    setEditDescription(kb.description || '');
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateKnowledgeBase(editKB.id, {
        name: editName,
        domain: editDomain,
        description: editDescription
      });
      setMessage({ type: 'success', text: 'Knowledge base updated!' });
      setShowEditModal(false);
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update knowledge base' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteKB) return;
    setDeleting(true);
    try {
      await deleteKnowledgeBase(deleteKB.id);
      setMessage({ type: 'success', text: 'Knowledge base deleted!' });
      setShowDeleteConfirm(false);
      setDeleteKB(null);
      if (selectedKB?.id === deleteKB.id) {
        setSelectedKB(null);
        setViewMode('list');
      }
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete knowledge base' });
    } finally {
      setDeleting(false);
    }
  };

  const handleSelectSection = (section) => {
    setSelectedSection(section);
  };

  const isAdmin = currentUser?.role === 'admin' || currentUser?.is_env_admin;

  if (loading) {
    return (
      <div className="flex h-screen w-full">
        <Sidebar />
        <main className="flex flex-1 items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full">
      <Sidebar />
      
      <main className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex-1 p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-black dark:text-white text-4xl font-black leading-tight tracking-[-0.033em]">
                Knowledge Base
              </h1>
              <p className="text-gray-500 mt-1">
                Manage system documentation for feature mapping
              </p>
            </div>
            
            {isAdmin && viewMode === 'list' && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90"
              >
                <span className="material-symbols-outlined text-xl">add</span>
                Upload Document
              </button>
            )}
            
            {viewMode !== 'list' && (
              <button
                onClick={() => {
                  setViewMode('list');
                  setSelectedKB(null);
                  setSelectedSection(null);
                }}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                <span className="material-symbols-outlined">arrow_back</span>
                Back to List
              </button>
            )}
          </div>

          {/* Message */}
          {message.text && (
            <div className={`mb-4 p-4 rounded-lg ${
              message.type === 'success' 
                ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400' 
                : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400'
            }`}>
              {message.text}
            </div>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <div className="grid gap-4">
              {knowledgeBases.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-[#111a22] rounded-xl border border-gray-200 dark:border-gray-700">
                  <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600">
                    menu_book
                  </span>
                  <p className="mt-4 text-gray-500">No knowledge bases yet</p>
                  {isAdmin && (
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="mt-4 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90"
                    >
                      Upload Your First Document
                    </button>
                  )}
                </div>
              ) : (
                knowledgeBases.map((kb) => (
                  <div
                    key={kb.id}
                    className="bg-white dark:bg-[#111a22] rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-black dark:text-white">
                            {kb.name}
                          </h3>
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${DOMAIN_COLORS[kb.domain] || DOMAIN_COLORS.general}`}>
                            {kb.domain}
                          </span>
                          <span className="text-xs text-gray-400">v{kb.version}</span>
                        </div>
                        
                        {kb.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            {kb.description}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Source: {kb.original_filename}</span>
                          <span>Updated: {new Date(kb.updated_at).toLocaleDateString()}</span>
                          {kb.updated_by_name && <span>By: {kb.updated_by_name}</span>}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewDetail(kb)}
                          className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                          title="View Details"
                        >
                          <span className="material-symbols-outlined">visibility</span>
                        </button>
                        
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => handleEdit(kb)}
                              className="p-2 text-gray-500 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                              title="Edit"
                            >
                              <span className="material-symbols-outlined">edit</span>
                            </button>
                            <button
                              onClick={() => {
                                setDeleteKB(kb);
                                setShowDeleteConfirm(true);
                              }}
                              className="p-2 text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                              title="Delete"
                            >
                              <span className="material-symbols-outlined">delete</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Detail View */}
          {viewMode === 'detail' && selectedKB && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Structure Panel */}
              <div className="lg:col-span-1 bg-white dark:bg-[#111a22] rounded-xl border border-gray-200 dark:border-gray-700 p-4 h-fit max-h-[calc(100vh-200px)] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-black dark:text-white">Structure</h3>
                  <div className="flex gap-2">
                    <a
                      href={downloadKnowledgeMarkdown(selectedKB.id)}
                      className="p-1 text-gray-500 hover:text-primary"
                      title="Download Markdown"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className="material-symbols-outlined text-lg">markdown</span>
                    </a>
                    <a
                      href={downloadKnowledgeJson(selectedKB.id)}
                      className="p-1 text-gray-500 hover:text-primary"
                      title="Download JSON"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className="material-symbols-outlined text-lg">data_object</span>
                    </a>
                  </div>
                </div>
                
                <SectionTree 
                  sections={selectedKB.structure?.sections || []} 
                  onSelectSection={handleSelectSection}
                />
              </div>
              
              {/* Content Panel */}
              <div className="lg:col-span-2 bg-white dark:bg-[#111a22] rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
                <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-bold text-black dark:text-white">{selectedKB.name}</h2>
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${DOMAIN_COLORS[selectedKB.domain] || DOMAIN_COLORS.general}`}>
                      {selectedKB.domain}
                    </span>
                  </div>
                  {selectedKB.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">{selectedKB.description}</p>
                  )}
                </div>
                
                {selectedSection ? (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <button
                        onClick={() => setSelectedSection(null)}
                        className="text-sm text-primary hover:underline"
                      >
                        ← Full Document
                      </button>
                      <span className="text-gray-400">|</span>
                      <span className="text-sm text-gray-500 font-mono">{selectedSection.id}</span>
                    </div>
                    <h3 className="text-lg font-bold text-black dark:text-white mb-3">
                      {selectedSection.title}
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300">{selectedSection.content}</p>
                    
                    {selectedSection.subsections && selectedSection.subsections.length > 0 && (
                      <div className="mt-6">
                        <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">Subsections</h4>
                        <div className="grid gap-2">
                          {selectedSection.subsections.map(sub => (
                            <button
                              key={sub.id}
                              onClick={() => setSelectedSection(sub)}
                              className="text-left p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <span className="font-mono text-xs text-gray-500 mr-2">{sub.id}</span>
                              <span className="text-gray-800 dark:text-gray-200">{sub.title}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="markdown-content">
                    <MarkdownRenderer content={selectedKB.markdown_content} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowUploadModal(false)}></div>
          <div className="relative z-10 w-full max-w-lg rounded-xl bg-white dark:bg-[#111a22] p-6 shadow-xl m-4">
            <h3 className="text-lg font-bold mb-4 text-black dark:text-white">Upload Knowledge Base</h3>
            
            <form onSubmit={handleUpload} className="space-y-4">
              {/* File Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Document File *
                </label>
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    uploadFile 
                      ? 'border-primary bg-primary/5' 
                      : 'border-gray-300 dark:border-gray-600 hover:border-primary'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,.pdf"
                    onChange={(e) => setUploadFile(e.target.files[0])}
                    className="hidden"
                  />
                  {uploadFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-primary">description</span>
                      <span className="text-gray-700 dark:text-gray-300">{uploadFile.name}</span>
                    </div>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-3xl text-gray-400">cloud_upload</span>
                      <p className="mt-2 text-sm text-gray-500">
                        Click to upload TXT, MD, or PDF
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Name - Required */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#233648] px-4 py-2 text-black dark:text-white"
                  placeholder="e.g., Backend Architecture"
                  required
                />
              </div>

              {/* Domain */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Domain *
                </label>
                <select
                  value={uploadDomain}
                  onChange={(e) => setUploadDomain(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#233648] px-4 py-2 text-black dark:text-white"
                  required
                >
                  <option value="">Select domain</option>
                  {domains.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Optional Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#233648] px-4 py-2 text-black dark:text-white"
                  rows={2}
                  placeholder="Brief description of what this document covers"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile || !uploadName || !uploadDomain}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {uploading && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  )}
                  {uploading ? 'Processing...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editKB && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowEditModal(false)}></div>
          <div className="relative z-10 w-full max-w-md rounded-xl bg-white dark:bg-[#111a22] p-6 shadow-xl m-4">
            <h3 className="text-lg font-bold mb-4 text-black dark:text-white">Edit Knowledge Base</h3>
            
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#233648] px-4 py-2 text-black dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Domain
                </label>
                <select
                  value={editDomain}
                  onChange={(e) => setEditDomain(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#233648] px-4 py-2 text-black dark:text-white"
                  required
                >
                  {domains.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#233648] px-4 py-2 text-black dark:text-white"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deleteKB && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteConfirm(false)}></div>
          <div className="relative z-10 w-full max-w-md rounded-xl bg-white dark:bg-[#111a22] p-6 shadow-xl m-4">
            <h3 className="text-lg font-bold mb-2 text-black dark:text-white">Delete Knowledge Base</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to delete <strong>{deleteKB.name}</strong>? This action cannot be undone.
            </p>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
