import React, { useEffect, useState, useRef } from 'react';
import { RetroWindow } from '../retro/RetroWindow.js';
import { BevelButton } from '../retro/BevelButton.js';
import { RetroInput, RetroSelect } from '../retro/RetroInput.js';
import { RetroModal } from '../retro/RetroModal.js';
import { api } from '../../utils/api.js';
import { DatasetMetadata, DatasetRecord, User, CleanResult } from '../../types.js';

interface DatasetExplorerViewProps {
  currentUser: User | null;
  onSelectDatasetForAnalysis: (datasetId: string) => void;
}

export const DatasetExplorerView: React.FC<DatasetExplorerViewProps> = ({
  currentUser,
  onSelectDatasetForAnalysis
}) => {
  const [datasets, setDatasets] = useState<DatasetMetadata[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'my' | 'demo' | 'shared' | 'favorites'>(() => {
    return currentUser?.role === 'ADMIN' ? 'all' : 'my';
  });
  const [hideSampleDatasets, setHideSampleDatasets] = useState<boolean>(() => {
    return Boolean(currentUser?.hideSampleDatasets);
  });
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [repoViewMode, setRepoViewMode] = useState<'detail' | 'table'>('detail');

  // Selected dataset active records & pagination
  const [activeMetadata, setActiveMetadata] = useState<DatasetMetadata | null>(null);
  const [records, setRecords] = useState<DatasetRecord[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalFiltered, setTotalFiltered] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [tableSearch, setTableSearch] = useState('');
  const [sortCol, setSortCol] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());

  // Modals
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [cleanModalOpen, setCleanModalOpen] = useState(false);
  const [cleanResult, setCleanResult] = useState<CleanResult | null>(null);
  const [newCatModalOpen, setNewCatModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  // Upload state
  const [uploadName, setUploadName] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadCategory, setUploadCategory] = useState('Custom User Dataset');
  const [uploadSource, setUploadSource] = useState('Manual Ingestion');
  const [uploadCsvText, setUploadCsvText] = useState('');
  const [uploadBase64, setUploadBase64] = useState<string | null>(null);
  const [uploadFileType, setUploadFileType] = useState('CSV');
  const [uploadIsShared, setUploadIsShared] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<'IDLE' | 'UPLOADING' | 'PROCESSING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Rename state
  const [renameValue, setRenameValue] = useState('');
  const [newCatName, setNewCatName] = useState('');

  // Clean form state
  const [cleanSelectedCol, setCleanSelectedCol] = useState<string>('');

  // Initial fetch
  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadDatasets();
  }, [selectedCategory, searchQuery, scope, hideSampleDatasets, currentUser]);

  async function loadCategories() {
    try {
      const cats = await api.getCategories();
      setCategories(cats);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadDatasets() {
    try {
      const list = await api.getDatasets({
        category: selectedCategory,
        search: searchQuery,
        scope,
        includeDemo: !hideSampleDatasets
      });
      setDatasets(list);
      if (list.length > 0) {
        if (!selectedDatasetId || !list.some(d => d.id === selectedDatasetId)) {
          setSelectedDatasetId(list[0].id);
        }
      } else {
        setSelectedDatasetId('');
        setActiveMetadata(null);
        setRecords([]);
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  }

  // Load records when dataset or table pagination changes
  useEffect(() => {
    if (!selectedDatasetId) return;
    loadRecords();
  }, [selectedDatasetId, page, pageSize, tableSearch, sortCol, sortDir]);

  async function loadRecords() {
    try {
      const data = await api.getDatasetDetails(selectedDatasetId, {
        page,
        pageSize,
        search: tableSearch,
        sortCol,
        sortDir
      });
      setActiveMetadata(data.metadata);
      setRecords(data.records);
      setTotalFiltered(data.totalFiltered);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  }

  // Permission calculation
  const canModify = Boolean(
    currentUser &&
    (currentUser.role === 'ADMIN' ||
      (currentUser.role === 'ANALYST' && activeMetadata?.ownerId === currentUser.id))
  );

  const canDelete = Boolean(
    currentUser &&
    (currentUser.role === 'ADMIN' ||
      (currentUser.role === 'ANALYST' && (activeMetadata?.ownerId === currentUser.id || activeMetadata?.isDemo)))
  );

  // File validation and selection handler
  const handleFileSelection = (file: File) => {
    if (!file) return;
    setUploadError(null);
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.csv', '.xlsx', '.xls'].includes(ext)) {
      const err = 'Unsupported file format. Please upload CSV, XLS, or XLSX.';
      setUploadError(err);
      setErrorMessage(err);
      return;
    }
    const MAX_SIZE = 25 * 1024 * 1024; // 25MB
    if (file.size > MAX_SIZE) {
      const err = 'File exceeds the maximum upload size (25MB limit).';
      setUploadError(err);
      setErrorMessage('File exceeds the maximum upload size.');
      return;
    }
    if (file.size === 0) {
      const err = 'The dataset contains no usable records (empty file).';
      setUploadError(err);
      setErrorMessage('The dataset contains no usable records.');
      return;
    }

    setUploadFile(file);
    setUploadFileType(ext === '.csv' ? 'CSV' : 'EXCEL');
    if (!uploadName.trim()) {
      setUploadName(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelection(file);
    }
  };

  const submitUpload = async () => {
    setUploadError(null);
    if (!uploadFile && !uploadCsvText.trim()) {
      const err = 'Please select a file to upload.';
      setUploadError(err);
      setErrorMessage(err);
      return;
    }

    const finalName = uploadName.trim() || (uploadFile ? uploadFile.name.replace(/\.[^/.]+$/, '') : 'Custom Dataset');

    try {
      setUploadLoading(true);
      setUploadState('UPLOADING');

      let res: { success?: boolean; message: string; metadata: DatasetMetadata };

      if (uploadFile) {
        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('name', finalName);
        formData.append('description', uploadDesc.trim());
        formData.append('category', uploadCategory);
        formData.append('source', uploadSource.trim() || `Upload: ${uploadFile.name}`);
        if (uploadIsShared) {
          formData.append('isShared', 'true');
        }
        setUploadState('PROCESSING');
        res = await api.uploadDatasetFile(formData);
      } else {
        setUploadState('PROCESSING');
        res = await api.uploadDataset({
          name: finalName,
          description: uploadDesc.trim(),
          category: uploadCategory,
          source: uploadSource.trim() || 'Direct Ingestion',
          fileType: uploadFileType,
          isShared: uploadIsShared,
          rawContent: uploadCsvText
        });
      }

      setUploadState('SUCCESS');
      setSuccessMessage(`Dataset "${res.metadata.name}" processed and ingested successfully! (${res.metadata.rowCount} rows, ${res.metadata.columnCount} columns)`);
      setUploadModalOpen(false);
      // Reset form
      setUploadFile(null);
      setUploadName('');
      setUploadDesc('');
      setUploadCsvText('');
      setUploadBase64(null);
      setUploadIsShared(false);
      setUploadState('IDLE');
      await loadDatasets();
      setSelectedDatasetId(res.metadata.id);
    } catch (err: any) {
      setUploadState('ERROR');
      const msg = err.message || 'Unable to process the dataset. Please try again.';
      setUploadError(msg);
      setErrorMessage(msg);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    if (!activeMetadata) return;
    try {
      setExportLoading(true);
      await api.downloadDataset(activeMetadata.id, format, activeMetadata.name);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setExportLoading(false);
    }
  };

  const handleSort = (colName: string) => {
    if (sortCol === colName) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(colName);
      setSortDir('asc');
    }
  };

  const toggleColumnVisibility = (colName: string) => {
    const next = new Set(hiddenCols);
    if (next.has(colName)) {
      next.delete(colName);
    } else {
      next.add(colName);
    }
    setHiddenCols(next);
  };

  const executeDataCleaning = async (
    action: 'DEDUPLICATE' | 'DROP_MISSING' | 'IMPUTE_MEAN' | 'IMPUTE_MEDIAN' | 'TRIM_WHITESPACE' | 'NORMALIZE_NAMES' | 'DROP_OUTLIERS',
    col?: string
  ) => {
    if (!selectedDatasetId) return;
    try {
      const res = await api.cleanDataset(selectedDatasetId, action, col);
      setCleanModalOpen(false);
      setCleanResult(res);
      await loadRecords();
      await loadDatasets();
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const handleToggleFavorite = async (id: string) => {
    try {
      const res = await api.toggleFavoriteDataset(id);
      setSuccessMessage(res.isLiked ? '⭐ Dataset added to your favorites!' : 'Dataset removed from favorites.');
      await loadDatasets();
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const handleDismissDemoDataset = async (id: string, name?: string) => {
    const dsName = name || activeMetadata?.name || 'sample dataset';
    if (!confirm(`Do you want to remove the sample dataset "${dsName}" from your workspace? (You can restore sample datasets anytime).`)) {
      return;
    }
    try {
      await api.dismissDataset(id);
      setSuccessMessage(`Sample dataset "${dsName}" removed from your workspace.`);
      await loadDatasets();
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const handleRestoreSamples = async () => {
    try {
      await api.restoreSampleDatasets();
      setHideSampleDatasets(false);
      setSuccessMessage('Sample demo datasets restored to your workspace.');
      await loadDatasets();
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const handleToggleHideSamples = async () => {
    const nextVal = !hideSampleDatasets;
    setHideSampleDatasets(nextVal);
    try {
      await api.updatePreferences({ hideSampleDatasets: nextVal });
    } catch {
      // ignore
    }
  };

  const handleDeleteDataset = async () => {
    if (!selectedDatasetId || !activeMetadata) return;

    if (activeMetadata.isDemo) {
      await handleDismissDemoDataset(selectedDatasetId, activeMetadata.name);
      return;
    }

    if (!confirm(`Are you sure you want to permanently delete "${activeMetadata.name}" from DATAFORGE 95?`)) return;

    try {
      await api.deleteDataset(selectedDatasetId);
      setSuccessMessage(`Dataset deleted successfully.`);
      await loadDatasets();
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const handleRename = async () => {
    if (!renameValue.trim() || !selectedDatasetId) return;
    try {
      await api.updateDataset(selectedDatasetId, { name: renameValue.trim() });
      setRenameModalOpen(false);
      setSuccessMessage('Dataset name updated.');
      await loadRecords();
      await loadDatasets();
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      await api.addCategory(newCatName.trim());
      setNewCatModalOpen(false);
      setNewCatName('');
      await loadCategories();
      setSuccessMessage('New category registered in master directory.');
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const getQualityGradeColor = (grade?: string) => {
    switch (grade) {
      case 'A+':
      case 'A':
        return 'bg-[#008000] text-white';
      case 'B':
        return 'bg-[#000080] text-white';
      case 'C':
        return 'bg-[#808000] text-white';
      default:
        return 'bg-[#800000] text-white';
    }
  };

  return (
    <div className="flex flex-col gap-3 pb-12">
      {/* Top Controls & Category Filters */}
      <RetroWindow
        title="DATASET REPOSITORY & SPREADSHEET EXPLORER"
        icon="📁"
        menuItems={['File', 'Edit', 'Data', 'Tools', 'Help']}
      >
        {/* Scope Filter Bar (All / My / Demo / Shared / Favorites) */}
        <div className="flex flex-wrap items-center justify-between gap-1 p-1 border-b border-[#808080] bg-[#d0d0d0] text-xs font-bold">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[#333333] px-1 mr-1">View Scope:</span>
            {currentUser && (
              <BevelButton
                onClick={() => setScope('my')}
                active={scope === 'my'}
                className={`py-0.5 px-2 text-xs ${scope === 'my' ? 'bg-[#000080] text-white font-bold' : ''}`}
              >
                👤 My Workspace {scope === 'my' ? `(${datasets.length})` : ''}
              </BevelButton>
            )}
            <BevelButton
              onClick={() => setScope('all')}
              active={scope === 'all'}
              className={`py-0.5 px-2 text-xs ${scope === 'all' ? 'bg-[#000080] text-white font-bold' : ''}`}
            >
              ★ All Accessible
            </BevelButton>
            <BevelButton
              onClick={() => setScope('favorites')}
              active={scope === 'favorites'}
              className={`py-0.5 px-2 text-xs ${scope === 'favorites' ? 'bg-[#000080] text-white font-bold' : ''}`}
            >
              ⭐ Favorites
            </BevelButton>
            <BevelButton
              onClick={() => setScope('demo')}
              active={scope === 'demo'}
              className={`py-0.5 px-2 text-xs ${scope === 'demo' ? 'bg-[#000080] text-white font-bold' : ''}`}
            >
              💾 Sample Demo Data
            </BevelButton>
            <BevelButton
              onClick={() => setScope('shared')}
              active={scope === 'shared'}
              className={`py-0.5 px-2 text-xs ${scope === 'shared' ? 'bg-[#000080] text-white font-bold' : ''}`}
            >
              🌐 Shared
            </BevelButton>
          </div>

          <div className="flex items-center gap-2 pr-1">
            <label className="flex items-center gap-1 text-[11px] font-normal cursor-pointer select-none text-[#222]">
              <input
                type="checkbox"
                checked={hideSampleDatasets}
                onChange={handleToggleHideSamples}
                className="w-3.5 h-3.5"
              />
              <span>Hide Sample Datasets</span>
            </label>
            <BevelButton
              onClick={handleRestoreSamples}
              className="py-0.5 px-1.5 text-[10px]"
              title="Restore any dismissed sample demo datasets to your workspace"
            >
              🔄 Restore Samples
            </BevelButton>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 p-2 bevel-inset-gray bg-[#c0c0c0]">
          {/* Domain Category Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#000080]">Domain Category:</span>
            <RetroSelect
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="text-xs font-bold"
            >
              <option value="ALL">★ ALL CATEGORIES ({datasets.length})</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </RetroSelect>

            {currentUser && currentUser.role !== 'VIEWER' && (
              <BevelButton
                onClick={() => setNewCatModalOpen(true)}
                className="text-[11px] py-1"
                title="Add New Category"
              >
                + New Category
              </BevelButton>
            )}
          </div>

          {/* Search Bar */}
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <span className="text-xs font-bold">Search:</span>
            <RetroInput
              placeholder="Search dataset name, source, or desc..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="text-xs py-1"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {currentUser && currentUser.role !== 'VIEWER' ? (
              <BevelButton
                onClick={() => setUploadModalOpen(true)}
                variant="primary"
                className="text-xs py-1 px-3 font-bold"
              >
                ⬆ Upload CSV / Excel
              </BevelButton>
            ) : (
              <span className="text-[11px] text-[#555555] italic">
                {currentUser ? 'Viewer role: Ingestion disabled' : 'Log in as Analyst or Admin to upload data'}
              </span>
            )}
          </div>
        </div>

        {/* Dataset Selection Tabs */}
        {datasets.length === 0 ? (
          <div className="p-6 text-center text-xs font-mono text-[#555555] bevel-inset bg-white my-2">
            {scope === 'my' ? (
              <div className="max-w-md mx-auto py-4">
                <div className="text-3xl mb-2">📁</div>
                <p className="font-bold text-[#000080] text-sm mb-1.5">PERSONAL WORKSPACE READY</p>
                <p className="text-[#333333] mb-4 leading-relaxed font-sans text-xs">
                  Welcome to DATAFORGE 95! You are currently viewing your private workspace.
                  No personal datasets have been uploaded yet. Upload a CSV or Excel spreadsheet to begin your analysis, or explore the pre-loaded sample datasets.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <BevelButton
                    onClick={() => setUploadModalOpen(true)}
                    variant="primary"
                    className="py-1 px-3 text-xs font-bold"
                  >
                    ⬆ Upload CSV / Excel File
                  </BevelButton>
                  <BevelButton
                    onClick={() => setScope('demo')}
                    className="py-1 px-3 text-xs font-bold"
                  >
                    💾 View Sample Demo Data
                  </BevelButton>
                </div>
              </div>
            ) : scope === 'favorites' ? (
              <div className="max-w-md mx-auto py-4">
                <div className="text-3xl mb-2">⭐</div>
                <p className="font-bold text-[#000080] text-sm mb-1.5">NO FAVORITE DATASETS</p>
                <p className="text-[#333333] mb-4 leading-relaxed font-sans text-xs">
                  You have not added any datasets to your favorites yet. Click the "⭐ Like / Favorite" button on any dataset to easily access it here.
                </p>
                <BevelButton
                  onClick={() => setScope('all')}
                  className="py-1 px-3 text-xs font-bold"
                >
                  Browse All Datasets
                </BevelButton>
              </div>
            ) : (
              <p>No datasets found matching your current category and search criteria.</p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-1.5 py-1.5 px-1 border-b border-[#808080]">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <span className="text-xs font-bold text-[#404040] whitespace-nowrap mr-1">Active File:</span>
              {datasets.map(ds => {
                const isSelected = ds.id === selectedDatasetId;
                return (
                  <BevelButton
                    key={ds.id}
                    onClick={() => {
                      setSelectedDatasetId(ds.id);
                      setPage(1);
                    }}
                    active={isSelected}
                    className={`text-xs py-1 px-2.5 whitespace-nowrap ${
                      isSelected ? 'bg-[#000080] text-white font-bold' : ''
                    }`}
                  >
                    <span>{ds.category === 'Energy' ? '⚡' : ds.category.includes('Finance') ? '💹' : ds.category.includes('Healthcare') ? '🩺' : '📄'}</span>
                    <span className="truncate max-w-[140px]">{ds.name}</span>
                    <span className="text-[10px] opacity-75">({ds.rowCount} rows)</span>
                  </BevelButton>
                );
              })}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <BevelButton
                onClick={() => setRepoViewMode(repoViewMode === 'table' ? 'detail' : 'table')}
                className="text-[11px] py-1 px-2 whitespace-nowrap font-bold"
              >
                {repoViewMode === 'table' ? '📄 Active File View' : '📁 Repository Catalog Table'}
              </BevelButton>
            </div>
          </div>
        )}

        {/* Repository Catalog Table View (when toggled) */}
        {repoViewMode === 'table' && datasets.length > 0 && (
          <div className="my-2 bevel-inset bg-white overflow-x-auto">
            <div className="p-1.5 bg-[#000080] text-white text-xs font-bold flex justify-between items-center">
              <span>DATASET INVENTORY REPOSITORY &bull; {datasets.length} REGISTERED DATASETS</span>
              <span className="text-[10px] font-normal">Click Analyze to enter Studio</span>
            </div>
            <table className="retro-table text-xs w-full">
              <thead>
                <tr>
                  <th className="w-8 text-center" title="Favorite / Liked">⭐</th>
                  <th>Dataset Name</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th className="text-right">Rows</th>
                  <th className="text-right">Cols</th>
                  <th>Quality</th>
                  <th>Owner</th>
                  <th>Uploaded</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {datasets.map(ds => (
                  <tr
                    key={ds.id}
                    className={`cursor-pointer ${ds.id === selectedDatasetId ? 'bg-[#c0d4f8]' : 'hover:bg-[#f0f0f0]'}`}
                    onClick={() => setSelectedDatasetId(ds.id)}
                  >
                    <td className="text-center" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleToggleFavorite(ds.id)}
                        className="hover:scale-125 transition-transform text-xs cursor-pointer p-0.5"
                        title={ds.isLiked ? 'Favorited. Click to unlike.' : 'Click to like/favorite this dataset'}
                      >
                        {ds.isLiked ? '⭐' : '☆'}
                      </button>
                    </td>
                    <td className="font-bold text-black flex items-center gap-1.5">
                      <span>{ds.category === 'Energy' ? '⚡' : ds.category.includes('Finance') ? '💹' : ds.category.includes('Healthcare') ? '🩺' : '📄'}</span>
                      <span>{ds.name}</span>
                    </td>
                    <td>
                      <span className="px-1 py-0.5 bg-[#e0e0e0] border border-[#808080] text-[10px]">
                        {ds.category}
                      </span>
                    </td>
                    <td className="font-mono text-[11px]">{ds.fileType}</td>
                    <td className="font-mono text-right">{ds.rowCount.toLocaleString()}</td>
                    <td className="font-mono text-right">{ds.columnCount}</td>
                    <td>
                      {ds.qualityScore ? (
                        <span className={`px-1 py-0.5 border border-black font-bold text-[10px] ${getQualityGradeColor(ds.qualityScore.grade)}`}>
                          Grade {ds.qualityScore.grade} ({ds.qualityScore.overallScore}%)
                        </span>
                      ) : (
                        <span className="text-[#888888] font-mono text-[10px]">Pending</span>
                      )}
                    </td>
                    <td className="text-black font-mono text-[11px]">{ds.uploadedBy || 'system'}</td>
                    <td className="text-[#555555] font-mono text-[10px]">{new Date(ds.uploadDate || ds.createdAt || Date.now()).toLocaleDateString()}</td>
                    <td>
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <BevelButton
                          onClick={() => onSelectDatasetForAnalysis(ds.id)}
                          variant="primary"
                          className="text-[10px] py-0.5 px-2 font-bold"
                        >
                          ⚡ Analyze
                        </BevelButton>
                        {ds.isDemo && (
                          <BevelButton
                            onClick={() => handleDismissDemoDataset(ds.id, ds.name)}
                            className="text-[10px] py-0.5 px-1.5 text-[#800000]"
                            title="Remove sample dataset from your personal workspace"
                          >
                            ✕ Dismiss
                          </BevelButton>
                        )}
                        <BevelButton
                          onClick={() => {
                            setSelectedDatasetId(ds.id);
                            setRepoViewMode('detail');
                          }}
                          className="text-[10px] py-0.5 px-1.5"
                        >
                          Inspect
                        </BevelButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Selected Dataset Metadata Card */}
        {activeMetadata && (
          <div className="my-2 p-2 bevel-outset bg-[#e0e0e0] flex flex-col gap-2 text-xs">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-black text-[#000080]">{activeMetadata.name}</span>
                  <span className="px-1.5 py-0.2 bg-[#00aa00] text-white text-[10px] font-bold border border-black">
                    {activeMetadata.category}
                  </span>
                  {activeMetadata.isDemo ? (
                    <span className="px-1.5 py-0.2 bg-[#000080] text-white text-[10px] font-bold border border-black">
                      SYSTEM DEMO
                    </span>
                  ) : activeMetadata.isShared ? (
                    <span className="px-1.5 py-0.2 bg-[#008080] text-white text-[10px] font-bold border border-black">
                      PUBLIC SHARED
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 bg-[#800080] text-white text-[10px] font-bold border border-black">
                      PRIVATE (OWNER: {activeMetadata.uploadedBy})
                    </span>
                  )}
                  {activeMetadata.qualityScore && (
                    <span className={`px-1.5 py-0.2 text-[10px] font-bold border border-black ${getQualityGradeColor(activeMetadata.qualityScore.grade)}`}>
                      QUALITY: {activeMetadata.qualityScore.overallScore}% ({activeMetadata.qualityScore.grade})
                    </span>
                  )}
                  <span className="text-[10px] text-[#555555] font-mono">ID: {activeMetadata.id}</span>
                </div>
                <div className="text-[#404040]">
                  {activeMetadata.description} &bull; <span className="font-semibold">Source:</span> {activeMetadata.source}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-[#333333]">
                  <span>Total Rows: <strong>{activeMetadata.rowCount.toLocaleString()}</strong></span>
                  <span>Columns: <strong>{activeMetadata.columnCount}</strong></span>
                  <span>Duplicates: <strong className={activeMetadata.duplicateCount > 0 ? 'text-[#ff0000]' : 'text-[#008000]'}>{activeMetadata.duplicateCount}</strong></span>
                  <span>Uploaded by: <strong>{activeMetadata.uploadedBy}</strong></span>
                  <span>Upload date: <strong>{new Date(activeMetadata.uploadDate).toLocaleDateString()}</strong></span>
                </div>
              </div>

              {/* Quick Action Toolbar */}
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Like / Favorite Button */}
                <BevelButton
                  onClick={() => handleToggleFavorite(activeMetadata.id)}
                  active={activeMetadata.isLiked}
                  className={`text-xs py-1.5 px-2.5 font-bold ${activeMetadata.isLiked ? 'bg-[#ffffcc] text-[#800000]' : ''}`}
                  title={activeMetadata.isLiked ? 'Favorited! Click to unlike' : 'Click to like/favorite this dataset'}
                >
                  {activeMetadata.isLiked ? '⭐ Favorited' : '☆ Like / Favorite'}
                </BevelButton>

                <BevelButton
                  onClick={() => onSelectDatasetForAnalysis(activeMetadata.id)}
                  variant="primary"
                  className="text-xs py-1.5 px-3 font-bold"
                >
                  🔬 Open Analytics Studio &rarr;
                </BevelButton>

                {/* Real Export Controls */}
                <BevelButton
                  onClick={() => handleExport('csv')}
                  disabled={exportLoading}
                  className="text-xs py-1"
                  title="Download full dataset as CSV"
                >
                  💾 Export CSV
                </BevelButton>
                <BevelButton
                  onClick={() => handleExport('json')}
                  disabled={exportLoading}
                  className="text-xs py-1"
                  title="Download full dataset as JSON"
                >
                  💾 Export JSON
                </BevelButton>

                <BevelButton
                  onClick={() => {
                    setRenameValue(activeMetadata.name);
                    setRenameModalOpen(true);
                  }}
                  disabled={!canModify}
                  title={!canModify ? 'Requires dataset ownership or ADMIN role' : 'Rename dataset'}
                  className="text-xs py-1"
                >
                  Rename
                </BevelButton>

                <BevelButton
                  onClick={() => setCleanModalOpen(true)}
                  disabled={!canModify}
                  title={!canModify ? 'Requires dataset ownership or ADMIN role' : 'Open Data Cleaning Suite'}
                  className="text-xs py-1"
                >
                  🧹 Clean Data
                </BevelButton>

                {activeMetadata.isDemo && (
                  <BevelButton
                    onClick={() => handleDismissDemoDataset(activeMetadata.id, activeMetadata.name)}
                    className="text-xs py-1 font-bold text-[#800000]"
                    title="Remove this sample dataset from your personal workspace"
                  >
                    ✕ Dismiss Sample Data
                  </BevelButton>
                )}

                <BevelButton
                  onClick={handleDeleteDataset}
                  disabled={!canDelete}
                  title={activeMetadata.isDemo ? 'Remove this sample dataset from your workspace' : (!canDelete ? 'Requires ownership or Admin' : 'Delete dataset')}
                  variant="danger"
                  className="text-xs py-1"
                >
                  {activeMetadata.isDemo ? '✕ Remove' : 'Delete'}
                </BevelButton>
              </div>
            </div>

            {/* Data Quality Score & Health Diagnostics Banner */}
            {activeMetadata.qualityScore && (
              <div className="bevel-inset p-2 bg-[#f0f0f0] border border-[#808080]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#a0a0a0] pb-1.5 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#000080]">AUTOMATED DATA QUALITY ENGINE SCORECARD:</span>
                    <span className={`px-2 py-0.5 text-xs font-bold border border-black ${getQualityGradeColor(activeMetadata.qualityScore.grade)}`}>
                      GRADE {activeMetadata.qualityScore.grade} &mdash; {activeMetadata.qualityScore.overallScore} / 100
                    </span>
                  </div>
                  {canModify && activeMetadata.qualityScore.overallScore < 100 && (
                    <button
                      onClick={() => setCleanModalOpen(true)}
                      className="text-[11px] underline font-bold text-[#000080] hover:text-blue-800 cursor-pointer"
                    >
                      &rarr; Launch Remediation Wizard
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                  <div className="p-1.5 bevel-outset bg-white">
                    <div className="text-[#555555] text-[10px]">COMPLETENESS</div>
                    <div className="font-bold text-black text-sm">{activeMetadata.qualityScore.completeness}%</div>
                    <div className="text-[9px] text-[#666666]">{(activeMetadata.qualityScore.totalMissingCells ?? activeMetadata.qualityScore.missingCells ?? 0)} missing cells</div>
                  </div>
                  <div className="p-1.5 bevel-outset bg-white">
                    <div className="text-[#555555] text-[10px]">VALIDITY</div>
                    <div className="font-bold text-black text-sm">{activeMetadata.qualityScore.validity}%</div>
                    <div className="text-[9px] text-[#666666]">Schema conforms</div>
                  </div>
                  <div className="p-1.5 bevel-outset bg-white">
                    <div className="text-[#555555] text-[10px]">UNIQUENESS</div>
                    <div className="font-bold text-black text-sm">{activeMetadata.qualityScore.uniqueness}%</div>
                    <div className="text-[9px] text-[#666666]">{activeMetadata.duplicateCount ?? activeMetadata.qualityScore.duplicateRows ?? 0} duplicate rows</div>
                  </div>
                  <div className="p-1.5 bevel-outset bg-white">
                    <div className="text-[#555555] text-[10px]">CONSISTENCY</div>
                    <div className="font-bold text-black text-sm">{activeMetadata.qualityScore.consistency}%</div>
                    <div className="text-[9px] text-[#666666]">Type regularity</div>
                  </div>
                </div>

                {(activeMetadata.qualityScore.issues?.length || 0) > 0 && (
                  <div className="mt-2 text-[10px] text-[#800000] font-mono">
                    <span className="font-bold">Detected Diagnostics: </span>
                    {activeMetadata.qualityScore.issues?.join(' • ')}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Column Types & Data Health Summary Drawer */}
        {activeMetadata && (
          <details className="my-2 bevel-inset-gray p-2 bg-[#dfdfdf] select-none text-xs">
            <summary className="font-bold cursor-pointer text-[#000080] hover:underline">
              [+] Inspect Column Schemas, Data Types &amp; Missing Value Diagnostics ({activeMetadata.columns.length} columns)
            </summary>
            <div className="mt-2 overflow-x-auto">
              <table className="retro-table">
                <thead>
                  <tr>
                    <th>Column Name</th>
                    <th>Data Type</th>
                    <th>Missing Values</th>
                    <th>Unique Count</th>
                    <th>Sample Preview</th>
                    <th>Toggle Visibility</th>
                  </tr>
                </thead>
                <tbody>
                  {activeMetadata.columns.map(c => (
                    <tr key={c.name}>
                      <td className="font-bold text-black font-mono">{c.name}</td>
                      <td>
                        <span className={`px-1.5 py-0.5 text-[10px] font-mono font-bold ${
                          c.type === 'numeric' ? 'bg-[#000080] text-white' : c.type === 'date' ? 'bg-[#008080] text-white' : 'bg-[#e0e0e0] text-black border border-[#808080]'
                        }`}>
                          {c.type.toUpperCase()}
                        </span>
                      </td>
                      <td className={`font-mono text-right ${c.missingCount > 0 ? 'text-[#ff0000] font-bold' : 'text-[#008000]'}`}>
                        {c.missingCount}
                      </td>
                      <td className="font-mono text-right">{c.uniqueCount}</td>
                      <td className="font-mono text-[10px] text-[#555555] truncate max-w-xs">
                        {c.sampleValues.join(', ')}
                      </td>
                      <td className="text-center">
                        <button
                          onClick={() => toggleColumnVisibility(c.name)}
                          className="text-[10px] underline cursor-pointer text-[#000080]"
                        >
                          {hiddenCols.has(c.name) ? 'Show' : 'Hide'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}

        {/* Spreadsheet Data Grid */}
        {activeMetadata && (
          <div className="flex flex-col gap-2 mt-2">
            {/* Grid Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-1 bevel-inset-gray text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold">Filter Rows:</span>
                <RetroInput
                  placeholder="Search within records..."
                  value={tableSearch}
                  onChange={e => {
                    setTableSearch(e.target.value);
                    setPage(1);
                  }}
                  className="py-0.5 px-1.5 text-xs w-48"
                />
                <span className="text-[#555555]">
                  Showing {totalFiltered.toLocaleString()} matching rows
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-bold">Rows per page:</span>
                <RetroSelect
                  value={pageSize}
                  onChange={e => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="py-0.5 text-xs"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </RetroSelect>

                {/* Pagination controls */}
                <BevelButton
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="py-0.5 px-2 text-xs"
                >
                  &larr; Prev
                </BevelButton>
                <span className="font-mono text-xs font-bold">
                  Page {page} of {Math.max(1, totalPages)}
                </span>
                <BevelButton
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  className="py-0.5 px-2 text-xs"
                >
                  Next &rarr;
                </BevelButton>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto bevel-inset bg-white max-h-[500px]">
              <table className="retro-table text-xs">
                <thead>
                  <tr>
                    <th className="w-12 text-center">#</th>
                    {activeMetadata.columns
                      .filter(c => !hiddenCols.has(c.name))
                      .map(col => (
                        <th
                          key={col.name}
                          onClick={() => handleSort(col.name)}
                          className="cursor-pointer select-none hover:bg-[#000066] transition-colors"
                          title={`Sort by ${col.name}`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span>{col.name}</span>
                            <span className="text-[10px]">
                              {sortCol === col.name ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                            </span>
                          </div>
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan={activeMetadata.columns.length + 1} className="text-center py-6 text-[#808080] font-mono">
                        No records matching filter parameters.
                      </td>
                    </tr>
                  ) : (
                    records.map((row, idx) => {
                      const rowNum = (page - 1) * pageSize + idx + 1;
                      return (
                        <tr key={idx} className="hover:bg-[#f0f0f0]">
                          <td className="text-center font-mono text-[10px] text-[#666666] bg-[#e0e0e0]">
                            {rowNum}
                          </td>
                          {activeMetadata.columns
                            .filter(c => !hiddenCols.has(c.name))
                            .map(col => {
                              const val = row[col.name];
                              const isNull = val === null || val === undefined || val === '';
                              return (
                                <td
                                  key={col.name}
                                  className={
                                    col.type === 'numeric'
                                      ? 'text-right font-mono'
                                      : col.type === 'date'
                                      ? 'font-mono'
                                      : ''
                                  }
                                >
                                  {isNull ? (
                                    <span className="text-[#ff0000] italic text-[10px] font-mono">&lt;NULL&gt;</span>
                                  ) : typeof val === 'number' ? (
                                    val.toLocaleString()
                                  ) : (
                                    String(val)
                                  )}
                                </td>
                              );
                            })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Status Bar */}
            <div className="flex justify-between items-center px-2 py-1 bevel-inset-gray bg-[#c0c0c0] text-[11px] font-mono">
              <span>Selected: <strong>{activeMetadata.name}</strong> &bull; Total records: {activeMetadata.rowCount.toLocaleString()}</span>
              <span>Visible columns: {activeMetadata.columns.length - hiddenCols.size} / {activeMetadata.columns.length}</span>
            </div>
          </div>
        )}
      </RetroWindow>

      {/* Upload CSV / Excel Modal */}
      <RetroModal
        isOpen={uploadModalOpen}
        title="INGEST &amp; PROCESS DATASET (CSV / EXCEL)"
        onClose={() => setUploadModalOpen(false)}
        footer={
          <div className="flex gap-2">
            <BevelButton onClick={() => setUploadModalOpen(false)} disabled={uploadLoading}>
              Cancel
            </BevelButton>
            <BevelButton onClick={submitUpload} variant="primary" disabled={uploadLoading}>
              {uploadLoading ? 'Processing Dataset...' : 'Upload &amp; Ingest'}
            </BevelButton>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          <div className="p-2 bevel-inset-gray bg-[#ffffd0] text-[#800000] font-bold">
            NOTE: All uploaded files undergo automated sanitization, column profiling, duplicate detection, and schema validation.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <RetroInput
              label="Dataset Name:"
              placeholder="e.g. Q3 Healthcare Index"
              value={uploadName}
              onChange={e => setUploadName(e.target.value)}
            />

            <RetroSelect
              label="Domain Category:"
              value={uploadCategory}
              onChange={e => setUploadCategory(e.target.value)}
            >
              {categories.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </RetroSelect>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <RetroInput
              label="Data Source / Origin:"
              placeholder="e.g. Government Open Data / Sensor Feed"
              value={uploadSource}
              onChange={e => setUploadSource(e.target.value)}
            />

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-black">Target Storage Format:</label>
              <div className="flex items-center gap-2 p-1.5 bevel-inset bg-white text-xs font-mono">
                <span>{uploadFileType === 'EXCEL' ? '📊 EXCEL SPREADSHEET' : '📄 CSV DELIMITED'}</span>
                <span className="text-[10px] text-[#555555]">
                  {uploadFile ? `(${uploadFile.name})` : '(Auto-detected on selection)'}
                </span>
              </div>
            </div>
          </div>

          {/* Windows 95 Drag & Drop File Upload Box */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-black flex items-center justify-between">
              <span>Select or Drop File to Upload:</span>
              <span className="text-[10px] font-normal text-[#555555]">Supports .CSV, .XLS, .XLSX (Max 25MB)</span>
            </label>
            <div
              onDragOver={e => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(true);
              }}
              onDragLeave={e => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
              }}
              onDrop={e => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileSelection(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`p-3 bevel-inset cursor-pointer transition-colors text-center border-2 border-dashed ${
                isDragging ? 'bg-[#c0d4f8] border-[#000080]' : 'bg-white border-[#808080]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleFileUpload}
                className="hidden"
              />
              {uploadFile ? (
                <div className="flex items-center justify-between gap-2 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{uploadFileType === 'EXCEL' ? '📊' : '📄'}</span>
                    <div>
                      <div className="font-bold text-[#000080] text-xs">{uploadFile.name}</div>
                      <div className="text-[10px] text-[#555555]">
                        Size: {(uploadFile.size / 1024).toFixed(1)} KB &bull; Type: {uploadFileType} &bull; Ready for ingestion
                      </div>
                    </div>
                  </div>
                  <BevelButton
                    onClick={(e) => {
                      e.stopPropagation();
                      setUploadFile(null);
                      setUploadError(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-[10px] py-0.5 px-2"
                  >
                    Clear
                  </BevelButton>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 py-1">
                  <span className="text-2xl">💾</span>
                  <div className="font-bold text-black text-xs">
                    Drag &amp; Drop CSV / Excel File Here, or <span className="text-[#000080] underline">Click to Browse</span>
                  </div>
                  <div className="text-[10px] text-[#555555]">
                    Valid files will be automatically profiled for column types, nulls, and anomalies.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Ingestion Progress / Status Bar */}
          {uploadLoading && (
            <div className="p-2 bevel-inset bg-[#e8e8e8] space-y-1.5">
              <div className="flex justify-between items-center text-xs font-bold text-[#000080]">
                <span>
                  {uploadState === 'UPLOADING'
                    ? 'Transmitting file to DATAFORGE 95 backend...'
                    : 'Parsing records, validating schema & computing quality score...'}
                </span>
                <span className="animate-pulse">PROCESSING</span>
              </div>
              <div className="h-3 bevel-inset bg-white overflow-hidden">
                <div className="h-full bg-[#000080] animate-pulse w-3/4"></div>
              </div>
            </div>
          )}

          {/* Upload Error Banner */}
          {uploadError && (
            <div className="p-2 bevel-outset bg-[#ffdddd] border border-[#ff0000] text-[#800000] text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="font-bold">❌ Error:</span>
                <span>{uploadError}</span>
              </div>
              <BevelButton onClick={() => setUploadError(null)} className="text-[10px] py-0.5">
                Dismiss
              </BevelButton>
            </div>
          )}

          {currentUser?.role === 'ADMIN' && (
            <div className="flex items-center gap-2 p-1.5 bevel-inset bg-[#e8e8e8]">
              <input
                type="checkbox"
                id="is-shared-cb"
                checked={uploadIsShared}
                onChange={e => setUploadIsShared(e.target.checked)}
                className="cursor-pointer"
              />
              <label htmlFor="is-shared-cb" className="font-bold text-[#000080] cursor-pointer text-xs">
                Make Publicly Shared (Visible to all users and viewers)
              </label>
            </div>
          )}

          <RetroInput
            label="Brief Description:"
            placeholder="Analytical context and metadata notes..."
            value={uploadDesc}
            onChange={e => setUploadDesc(e.target.value)}
          />

          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-black">Or Paste Raw CSV Data Directly:</label>
              <BevelButton
                onClick={() => {
                  setUploadName('Global Renewable Energy Sample');
                  setUploadCategory('Energy');
                  setUploadSource('IRENA');
                  setUploadDesc('Sample renewable wind and solar energy metrics.');
                  setUploadCsvText(`date,country,energy_source,production_gwh,capacity_mw,investment_usd,carbon_reduction_tons
2024-01-15,Germany,Wind,1240.5,3200,45000000,850000
2024-01-18,Denmark,Wind,890.2,2100,32000000,620000
2024-01-22,China,Solar,3420.0,8500,120000000,2350000
2024-01-28,USA,Solar,2150.8,5400,88000000,1480000
2024-02-05,Brazil,Hydro,4800.0,11200,150000000,3400000
2024-02-12,India,Solar,2890.4,7100,95000000,1980000
2024-02-20,USA,Wind,3100.6,7800,110000000,2150000
2024-03-01,Germany,Solar,980.3,4200,52000000,680000`);
                }}
                className="text-[10px] py-0.5"
              >
                Insert Sample Template
              </BevelButton>
            </div>
            <textarea
              className="retro-input font-mono text-[11px] h-28 w-full"
              placeholder="col1,col2,col3&#10;val1,val2,val3"
              value={uploadCsvText}
              onChange={e => setUploadCsvText(e.target.value)}
            />
          </div>
        </div>
      </RetroModal>

      {/* Rename Modal */}
      <RetroModal
        isOpen={renameModalOpen}
        title="RENAME DATASET"
        onClose={() => setRenameModalOpen(false)}
        footer={
          <div className="flex gap-2">
            <BevelButton onClick={() => setRenameModalOpen(false)}>Cancel</BevelButton>
            <BevelButton onClick={handleRename} variant="primary">
              Apply
            </BevelButton>
          </div>
        }
      >
        <div className="space-y-2">
          <RetroInput
            label="New Dataset Name:"
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
          />
        </div>
      </RetroModal>

      {/* Comprehensive Data Cleaning & Validation Suite Modal */}
      <RetroModal
        isOpen={cleanModalOpen}
        title="DATA CLEANING & VALIDATION TOOL"
        onClose={() => setCleanModalOpen(false)}
        footer={
          <BevelButton onClick={() => setCleanModalOpen(false)}>Close</BevelButton>
        }
      >
        <div className="space-y-3 text-xs max-h-[500px] overflow-y-auto pr-1">
          <div className="font-bold text-[#000080]">
            Automated Data Sanity &amp; Remediation Utilities:
          </div>

          {/* 1. Deduplication */}
          <div className="p-2 bevel-outset bg-white space-y-1.5">
            <div className="font-bold text-black flex justify-between items-center">
              <span>1. Deduplication Routine</span>
              <span className={activeMetadata && activeMetadata.duplicateCount > 0 ? 'text-[#ff0000] font-mono' : 'text-[#008000] font-mono'}>
                {activeMetadata?.duplicateCount || 0} duplicates
              </span>
            </div>
            <div className="text-[#555555]">
              Scans dataset for exact record duplicates and eliminates redundant rows.
            </div>
            <BevelButton
              onClick={() => executeDataCleaning('DEDUPLICATE')}
              className="text-xs"
            >
              Execute Deduplication
            </BevelButton>
          </div>

          {/* 2. Impute Mean */}
          <div className="p-2 bevel-outset bg-white space-y-1.5">
            <div className="font-bold text-black">2. Mean Imputation (Numeric Columns)</div>
            <div className="text-[#555555]">
              Replaces empty numeric cells with column arithmetic mean.
            </div>
            <div className="flex items-center gap-2">
              <RetroSelect
                id="impute-mean-select"
                className="text-xs"
                value={cleanSelectedCol || activeMetadata?.columns.find(c => c.type === 'numeric')?.name || ''}
                onChange={e => setCleanSelectedCol(e.target.value)}
              >
                {activeMetadata?.columns
                  .filter(c => c.type === 'numeric')
                  .map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.missingCount} missing)
                    </option>
                  ))}
              </RetroSelect>
              <BevelButton
                onClick={() => {
                  const sel = cleanSelectedCol || activeMetadata?.columns.find(c => c.type === 'numeric')?.name;
                  if (sel) executeDataCleaning('IMPUTE_MEAN', sel);
                }}
                className="text-xs"
              >
                Impute Mean
              </BevelButton>
            </div>
          </div>

          {/* 3. Impute Median */}
          <div className="p-2 bevel-outset bg-white space-y-1.5">
            <div className="font-bold text-black">3. Median Imputation (Robust to Outliers)</div>
            <div className="text-[#555555]">
              Fills blank numeric cells with median (50th percentile) value.
            </div>
            <div className="flex items-center gap-2">
              <RetroSelect
                id="impute-med-select"
                className="text-xs"
                value={cleanSelectedCol || activeMetadata?.columns.find(c => c.type === 'numeric')?.name || ''}
                onChange={e => setCleanSelectedCol(e.target.value)}
              >
                {activeMetadata?.columns
                  .filter(c => c.type === 'numeric')
                  .map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.missingCount} missing)
                    </option>
                  ))}
              </RetroSelect>
              <BevelButton
                onClick={() => {
                  const sel = cleanSelectedCol || activeMetadata?.columns.find(c => c.type === 'numeric')?.name;
                  if (sel) executeDataCleaning('IMPUTE_MEDIAN', sel);
                }}
                className="text-xs"
              >
                Impute Median
              </BevelButton>
            </div>
          </div>

          {/* 4. Drop Incomplete Rows */}
          <div className="p-2 bevel-outset bg-white space-y-1.5">
            <div className="font-bold text-black">4. Drop Incomplete Rows (Listwise Deletion)</div>
            <div className="text-[#555555]">
              Removes rows containing missing values in a specific column or across all columns.
            </div>
            <div className="flex items-center gap-2">
              <BevelButton
                onClick={() => executeDataCleaning('DROP_MISSING')}
                variant="danger"
                className="text-xs"
              >
                Drop Any Incomplete Row
              </BevelButton>
            </div>
          </div>

          {/* 5. Trim Whitespace */}
          <div className="p-2 bevel-outset bg-white space-y-1.5">
            <div className="font-bold text-black">5. Trim Leading / Trailing Whitespace</div>
            <div className="text-[#555555]">
              Strips invisible padding, line breaks, and space characters across all string variables.
            </div>
            <BevelButton
              onClick={() => executeDataCleaning('TRIM_WHITESPACE')}
              className="text-xs"
            >
              Trim Text Variables
            </BevelButton>
          </div>

          {/* 6. Normalize Column Headers */}
          <div className="p-2 bevel-outset bg-white space-y-1.5">
            <div className="font-bold text-black">6. Normalize Header Syntax</div>
            <div className="text-[#555555]">
              Standardizes column names into clean, lowercase snake_case headers.
            </div>
            <BevelButton
              onClick={() => executeDataCleaning('NORMALIZE_NAMES')}
              className="text-xs"
            >
              Normalize Headers
            </BevelButton>
          </div>

          {/* 7. Drop Outliers (IQR) */}
          <div className="p-2 bevel-outset bg-white space-y-1.5">
            <div className="font-bold text-black">7. Drop Outliers via Interquartile Range (IQR)</div>
            <div className="text-[#555555]">
              Prunes anomalous records exceeding the 1.5 &times; IQR statistical fence boundaries.
            </div>
            <BevelButton
              onClick={() => executeDataCleaning('DROP_OUTLIERS')}
              variant="danger"
              className="text-xs"
            >
              Prune IQR Outliers
            </BevelButton>
          </div>
        </div>
      </RetroModal>

      {/* Clean Result Dialog with Detailed Before/After Transparency */}
      {cleanResult && (
        <RetroModal
          isOpen={true}
          title="DATA CLEANING &amp; REMEDIATION REPORT"
          icon="🧹"
          onClose={() => setCleanResult(null)}
          footer={
            <BevelButton onClick={() => setCleanResult(null)} variant="primary">
              Acknowledge &amp; Return
            </BevelButton>
          }
        >
          <div className="space-y-3 text-xs">
            <div className="p-2 bevel-outset bg-[#e8ffe8] border border-[#008000] text-[#006000] font-bold">
              ✔ {cleanResult.details}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
              <div className="p-2 bevel-inset bg-white">
                <div className="text-[#666666] text-[10px]">ROWS AFFECTED</div>
                <div className="text-base font-black text-[#000080]">{cleanResult.rowsAffected.toLocaleString()}</div>
              </div>
              <div className="p-2 bevel-inset bg-white">
                <div className="text-[#666666] text-[10px]">ROW COUNT</div>
                <div className="text-xs font-bold">{cleanResult.beforeRowCount} &rarr; {cleanResult.afterRowCount}</div>
              </div>
              <div className="p-2 bevel-inset bg-white">
                <div className="text-[#666666] text-[10px]">QUALITY BEFORE</div>
                <div className="text-xs font-bold text-[#800000]">
                  {cleanResult.qualityScoreBefore ? `${cleanResult.qualityScoreBefore.overallScore}% (${cleanResult.qualityScoreBefore.grade})` : 'N/A'}
                </div>
              </div>
              <div className="p-2 bevel-inset bg-white">
                <div className="text-[#666666] text-[10px]">QUALITY AFTER</div>
                <div className="text-xs font-bold text-[#008000]">
                  {cleanResult.qualityScoreAfter ? `${cleanResult.qualityScoreAfter.overallScore}% (${cleanResult.qualityScoreAfter.grade})` : 'N/A'}
                </div>
              </div>
            </div>

            {cleanResult.qualityScoreAfter && (
              <div className="p-2 bevel-inset-gray bg-[#f8f8f8] text-[11px] font-mono space-y-1">
                <div className="font-bold text-[#000080]">UPDATED QUALITY BREAKDOWN:</div>
                <div className="flex justify-between">
                  <span>Completeness:</span>
                  <strong>{cleanResult.qualityScoreAfter.completeness}%</strong>
                </div>
                <div className="flex justify-between">
                  <span>Uniqueness:</span>
                  <strong>{cleanResult.qualityScoreAfter.uniqueness}%</strong>
                </div>
                <div className="flex justify-between">
                  <span>Validity:</span>
                  <strong>{cleanResult.qualityScoreAfter.validity}%</strong>
                </div>
                <div className="flex justify-between">
                  <span>Consistency:</span>
                  <strong>{cleanResult.qualityScoreAfter.consistency}%</strong>
                </div>
              </div>
            )}
          </div>
        </RetroModal>
      )}

      {/* Add New Category Modal */}
      <RetroModal
        isOpen={newCatModalOpen}
        title="REGISTER NEW DOMAIN CATEGORY"
        onClose={() => setNewCatModalOpen(false)}
        footer={
          <div className="flex gap-2">
            <BevelButton onClick={() => setNewCatModalOpen(false)}>Cancel</BevelButton>
            <BevelButton onClick={handleAddCategory} variant="primary">
              Register Category
            </BevelButton>
          </div>
        }
      >
        <div className="space-y-2">
          <RetroInput
            label="Domain Category Name:"
            placeholder="e.g. Telecommunications, Agriculture, Aviation..."
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
          />
        </div>
      </RetroModal>

      {/* Feedback Toast / Alert Dialogs */}
      {errorMessage && (
        <RetroModal
          isOpen={true}
          title="SYSTEM ALERT - DATAFORGE 95"
          icon="⚠️"
          isError={true}
          onClose={() => setErrorMessage(null)}
        >
          <div className="text-xs font-bold text-[#800000] py-2">{errorMessage}</div>
        </RetroModal>
      )}

      {successMessage && (
        <RetroModal
          isOpen={true}
          title="OPERATION COMPLETE"
          icon="✔"
          onClose={() => setSuccessMessage(null)}
        >
          <div className="text-xs font-bold text-[#008000] py-2">{successMessage}</div>
        </RetroModal>
      )}
    </div>
  );
};
