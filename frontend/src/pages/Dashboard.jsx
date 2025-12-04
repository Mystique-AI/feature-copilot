import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import CreateFeatureModal from '../components/CreateFeatureModal';
import FeatureDetail from '../components/FeatureDetail';
import { getFeatures, getFeature, createFeature } from '../services/api';

const STATUS_COLORS = {
  submitted: 'blue',
  under_review: 'yellow',
  approved: 'green',
  rejected: 'red',
  in_development: 'purple',
  in_qa: 'orange',
  completed: 'green',
  deployed: 'teal',
};

const STATUS_LABELS = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  in_development: 'In Development',
  in_qa: 'In QA',
  completed: 'Completed',
  deployed: 'Deployed',
};

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [features, setFeatures] = useState([]);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // Load feature from URL on mount
  useEffect(() => {
    const featureId = searchParams.get('feature');
    if (featureId) {
      loadFeatureFromUrl(featureId);
    }
  }, []);

  const loadFeatureFromUrl = async (featureId) => {
    try {
      const fullFeature = await getFeature(parseInt(featureId));
      setSelectedFeature(fullFeature);
    } catch (error) {
      console.error('Failed to load feature from URL', error);
      // Remove invalid feature ID from URL
      searchParams.delete('feature');
      setSearchParams(searchParams);
    }
  };

  useEffect(() => {
    loadFeatures();
  }, [statusFilter, priorityFilter]);

  const loadFeatures = async () => {
    setLoading(true);
    try {
      const filters = {};
      if (statusFilter) filters.status = statusFilter;
      if (priorityFilter) filters.priority = priorityFilter;
      if (search) filters.search = search;
      
      const data = await getFeatures(filters);
      setFeatures(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadFeatures();
  };

  const handleSelectFeature = async (feature) => {
    try {
      const fullFeature = await getFeature(feature.id);
      setSelectedFeature(fullFeature);
      // Update URL with selected feature ID
      setSearchParams({ feature: feature.id.toString() });
    } catch (error) {
      console.error(error);
      setSelectedFeature(feature);
      setSearchParams({ feature: feature.id.toString() });
    }
  };

  const handleCloseFeature = () => {
    setSelectedFeature(null);
    // Remove feature ID from URL
    searchParams.delete('feature');
    setSearchParams(searchParams);
  };

  const handleCreateFeature = async (featureData) => {
    await createFeature(featureData);
    await loadFeatures();
  };

  const handleFeatureUpdate = async () => {
    await loadFeatures();
    if (selectedFeature) {
      const updated = await getFeature(selectedFeature.id);
      setSelectedFeature(updated);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPriorityFilter('');
  };

  return (
    <div className="flex h-screen w-full">
      <Sidebar />
      
      {/* Main Content Area */}
      <main className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex-1 p-8">
          {/* PageHeading */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-black dark:text-white text-4xl font-black leading-tight tracking-[-0.033em]">Feature Requests</p>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="flex min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-primary/90"
            >
              <span className="material-symbols-outlined text-base">add_circle</span>
              <span className="truncate">Create New Request</span>
            </button>
          </div>

          {/* Filter & Search Section */}
          <div className="mt-6 flex flex-col gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111a22] p-4">
            <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
              {/* SearchBar */}
              <div className="flex-grow">
                <div className="flex w-full flex-1 items-stretch rounded-lg h-12">
                  <div className="text-gray-400 flex border border-r-0 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-[#233648] items-center justify-center pl-4 rounded-l-lg">
                    <span className="material-symbols-outlined">search</span>
                  </div>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-r-lg text-black dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-l-0 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-[#233648] h-full placeholder:text-gray-400 px-4 text-base font-normal leading-normal"
                    placeholder="Search by keyword..."
                  />
                </div>
              </div>
              
              {/* Filters */}
              <div className="flex items-center gap-3">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-12 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-[#233648] px-4 text-sm text-black dark:text-white"
                >
                  <option value="">All Status</option>
                  <option value="submitted">Submitted</option>
                  <option value="under_review">Under Review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="in_development">In Development</option>
                  <option value="completed">Completed</option>
                </select>
                
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="h-12 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-[#233648] px-4 text-sm text-black dark:text-white"
                >
                  <option value="">All Priority</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>

                <button
                  type="button"
                  onClick={clearFilters}
                  className="h-12 px-4 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Clear
                </button>
              </div>
            </form>
          </div>

          {/* Feature Request Table */}
          <div className="mt-6 overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-[#111a22]">
                    <tr>
                      <th className="py-3.5 px-4 text-left text-sm font-semibold text-gray-500 dark:text-gray-400">ID</th>
                      <th className="py-3.5 px-4 text-left text-sm font-semibold text-gray-500 dark:text-gray-400">Title</th>
                      <th className="py-3.5 px-4 text-left text-sm font-semibold text-gray-500 dark:text-gray-400">Status</th>
                      <th className="py-3.5 px-4 text-left text-sm font-semibold text-gray-500 dark:text-gray-400">Priority</th>
                      <th className="py-3.5 px-4 text-left text-sm font-semibold text-gray-500 dark:text-gray-400">Requester</th>
                      <th className="py-3.5 px-4 text-left text-sm font-semibold text-gray-500 dark:text-gray-400">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900/50">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading...</td>
                      </tr>
                    ) : features.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No feature requests found</td>
                      </tr>
                    ) : (
                      features.map((feature) => (
                        <tr 
                          key={feature.id} 
                          onClick={() => handleSelectFeature(feature)} 
                          className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 ${selectedFeature?.id === feature.id ? 'bg-primary/5' : ''}`}
                        >
                          <td className="whitespace-nowrap px-4 py-4 text-sm font-mono text-gray-500 dark:text-gray-400">FR-{String(feature.id).padStart(3, '0')}</td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-black dark:text-white max-w-xs truncate">{feature.title}</td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm">
                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-${STATUS_COLORS[feature.status] || 'gray'}-100 text-${STATUS_COLORS[feature.status] || 'gray'}-800 dark:bg-${STATUS_COLORS[feature.status] || 'gray'}-500/20 dark:text-${STATUS_COLORS[feature.status] || 'gray'}-400`}>
                              {STATUS_LABELS[feature.status] || feature.status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600 dark:text-gray-300 capitalize">{feature.priority}</td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{feature.requester_name || 'Unknown'}</td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                            {new Date(feature.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Feature Detail Sidebar */}
      {selectedFeature && (
        <FeatureDetail
          feature={selectedFeature}
          onClose={handleCloseFeature}
          onUpdate={handleFeatureUpdate}
        />
      )}

      {/* Create Feature Modal */}
      <CreateFeatureModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateFeature}
      />
    </div>
  );
}
