import React, { useEffect, useState } from 'react';
import { RetroWindow } from '../retro/RetroWindow.js';
import { BevelButton } from '../retro/BevelButton.js';
import { RetroTabs, TabItem } from '../retro/RetroTabs.js';
import { RetroInput, RetroSelect } from '../retro/RetroInput.js';
import { RetroModal } from '../retro/RetroModal.js';
import { D3Chart } from '../charts/D3Chart.js';
import { api } from '../../utils/api.js';
import {
  DatasetMetadata,
  DatasetRecord,
  DatasetStatistics,
  CorrelationMatrix,
  AnomalyAnalysis,
  Report,
  ChartType,
  SavedAnalysis
} from '../../types.js';

interface DatasetAnalysisViewProps {
  datasetId: string;
  onBackToDatasets: () => void;
  onOpenReport?: (reportId: string) => void;
}

export const DatasetAnalysisView: React.FC<DatasetAnalysisViewProps> = ({
  datasetId,
  onBackToDatasets
}) => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [metadata, setMetadata] = useState<DatasetMetadata | null>(null);
  const [records, setRecords] = useState<DatasetRecord[]>([]);
  const [stats, setStats] = useState<DatasetStatistics | null>(null);
  const [correlation, setCorrelation] = useState<CorrelationMatrix | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyAnalysis | null>(null);
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Chart Configuration (allows reloading saved analyses)
  const [activeChartConfig, setActiveChartConfig] = useState<{
    chartType: ChartType;
    selectedX?: string;
    selectedY?: string;
    aggregation?: 'sum' | 'mean' | 'count' | 'min' | 'max';
  }>({ chartType: 'bar' });

  // Save Analysis Modal state
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [saveType, setSaveType] = useState('Comparative Visualization');
  const [pendingChartConfig, setPendingChartConfig] = useState<{
    chartType: ChartType;
    selectedX: string;
    selectedY: string;
    aggregation: 'sum' | 'mean' | 'count' | 'min' | 'max';
  } | null>(null);
  const [savingAnalysis, setSavingAnalysis] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Data Tab spreadsheet state
  const [dataSearch, setDataSearch] = useState('');
  const [dataPage, setDataPage] = useState(1);
  const [dataPageSize, setDataPageSize] = useState(25);
  const [sortCol, setSortCol] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [totalFiltered, setTotalFiltered] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Reports state
  const [reportTitle, setReportTitle] = useState('');
  const [reportNotes, setReportNotes] = useState('');
  const [createdReport, setCreatedReport] = useState<Report | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  // Initial load
  useEffect(() => {
    async function loadAllAnalysisData() {
      if (!datasetId) {
        setLoading(false);
        setError('No dataset specified for analysis. Please select a dataset from the repository.');
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch basic details
        const details = await api.getDatasetDetails(datasetId, {
          page: dataPage,
          pageSize: dataPageSize,
          search: dataSearch,
          sortCol,
          sortDir
        });
        if (details) {
          setMetadata(details.metadata || null);
          setRecords(Array.isArray(details.records) ? details.records : []);
          setTotalFiltered(details.totalFiltered || 0);
          setTotalPages(details.totalPages || 1);
        }

        // Concurrently load statistics, correlation, anomalies, and saved analyses
        const [statsData, corrData, anomalyData, analysesData] = await Promise.all([
          api.getStatistics(datasetId).catch(() => null),
          api.getCorrelation(datasetId).catch(() => null),
          api.getAnomalies(datasetId).catch(() => null),
          api.getAnalyses(datasetId).catch(() => [])
        ]);

        setStats(statsData);
        setCorrelation(corrData);
        setAnomalies(anomalyData);
        setSavedAnalyses(Array.isArray(analysesData) ? analysesData : []);
      } catch (err: any) {
        setError(err.message || 'Failed to load dataset analytics');
      } finally {
        setLoading(false);
      }
    }
    loadAllAnalysisData();
  }, [datasetId, dataPage, dataPageSize, dataSearch, sortCol, sortDir]);

  const tabs: TabItem[] = [
    { id: 'overview', label: '1. Overview', icon: '📋' },
    { id: 'data', label: '2. Data Grid', icon: '▦' },
    { id: 'statistics', label: '3. Statistics', icon: '∑' },
    { id: 'charts', label: '4. D3 Charts', icon: '📈' },
    { id: 'correlation', label: '5. Correlation', icon: '⚯' },
    { id: 'anomalies', label: '6. Anomalies', icon: '⚠️', badge: (anomalies?.anomalies?.length || (anomalies?.iqrAnomalies?.length || 0) + (anomalies?.zScoreAnomalies?.length || 0) || anomalies?.totalAnomalies || 0) },
    { id: 'reports', label: '7. Reports', icon: '📑' },
    { id: 'saved', label: '8. Saved Views', icon: '💾', badge: savedAnalyses?.length || 0 }
  ];

  const handlePromptSave = (cfg: {
    chartType: ChartType;
    selectedX: string;
    selectedY: string;
    aggregation: 'sum' | 'mean' | 'count' | 'min' | 'max';
  }) => {
    setPendingChartConfig(cfg);
    setSaveTitle(`${metadata?.name || 'Dataset'} - ${cfg.chartType.toUpperCase()} of ${cfg.selectedY || cfg.selectedX}`);
    setSaveType('Quantitative Visualization');
    setSaveModalOpen(true);
  };

  const handleSaveAnalysisSubmit = async () => {
    if (!pendingChartConfig || !saveTitle.trim()) return;
    try {
      setSavingAnalysis(true);
      await api.createAnalysis({
        datasetId,
        title: saveTitle.trim(),
        analysisType: saveType,
        selectedColumns: [pendingChartConfig.selectedX, pendingChartConfig.selectedY].filter(Boolean),
        chartType: pendingChartConfig.chartType,
        config: {
          selectedX: pendingChartConfig.selectedX,
          selectedY: pendingChartConfig.selectedY,
          aggregation: pendingChartConfig.aggregation
        }
      });
      setSaveModalOpen(false);
      setSaveSuccessMsg(`Analysis "${saveTitle.trim()}" successfully saved!`);
      // Refresh saved analyses
      const refreshed = await api.getAnalyses(datasetId);
      setSavedAnalyses(refreshed);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingAnalysis(false);
    }
  };

  const handleLoadSavedAnalysis = (sa: SavedAnalysis) => {
    const cols = Array.isArray(sa.selectedColumns) ? sa.selectedColumns : [];
    setActiveChartConfig({
      chartType: sa.chartType,
      selectedX: sa.config?.selectedX || (cols.length > 0 ? cols[0] : undefined),
      selectedY: sa.config?.selectedY || (cols.length > 1 ? cols[1] : undefined),
      aggregation: sa.config?.aggregation || 'sum'
    });
    setActiveTab('charts');
  };

  const handleDeleteSavedAnalysis = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this saved analysis view?')) return;
    try {
      await api.deleteAnalysis(id);
      const refreshed = await api.getAnalyses(datasetId);
      setSavedAnalyses(refreshed);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGenerateReport = async () => {
    try {
      setGeneratingReport(true);
      const title = reportTitle || `${metadata?.name} - Comprehensive Analytics Report`;
      const rep = await api.createReport(datasetId, title, reportNotes);
      setCreatedReport(rep);
      setReportModalOpen(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGeneratingReport(false);
    }
  };

  if (loading && !metadata) {
    return (
      <div className="p-8 bevel-outset bg-[#c0c0c0] text-center font-mono text-xs">
        <div className="text-sm font-bold text-[#000080] mb-2">
          DATAFORGE 95 - COMPILING ANALYTICAL MATRICES...
        </div>
        <div className="w-48 mx-auto bevel-inset h-4 bg-white overflow-hidden p-0.5">
          <div className="h-full bg-[#000080] animate-pulse w-3/4"></div>
        </div>
      </div>
    );
  }

  if (error || !metadata) {
    return (
      <RetroModal isOpen={true} title="ERROR LOADING DATASET" onClose={onBackToDatasets} isError={true}>
        <div className="text-xs font-bold text-[#800000]">{error || 'Dataset not found.'}</div>
        <div className="mt-4">
          <BevelButton onClick={onBackToDatasets}>Return to Repository</BevelButton>
        </div>
      </RetroModal>
    );
  }

  // Calculate Data Quality Score
  const totalCells = metadata.rowCount * metadata.columnCount;
  const missingCells = metadata.columns.reduce((acc, c) => acc + c.missingCount, 0);
  const missingPct = totalCells > 0 ? (missingCells / totalCells) * 100 : 0;
  const qualityScore = Math.max(0, Math.round(100 - missingPct * 5 - (metadata.duplicateCount / (metadata.rowCount || 1)) * 50));

  return (
    <div className="flex flex-col gap-2 pb-12">
      {/* Header Window with Dataset Specs */}
      <RetroWindow
        title={`DATAFORGE 95 ANALYTICS STUDIO - [${metadata.name}]`}
        icon="🔬"
        menuItems={['File', 'Export', 'Statistics', 'D3-Render', 'Help']}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 p-2 bevel-inset-gray bg-[#c0c0c0] mb-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black text-[#000080]">{metadata.name}</span>
              <span className="px-1.5 py-0.2 bg-[#000080] text-white text-[10px] font-bold font-mono">
                {metadata.category}
              </span>
              <span className="text-[10px] text-[#555555] font-mono">ID: {metadata.id}</span>
            </div>
            <div className="text-xs text-[#404040]">
              {metadata.description} &bull; <strong>Origin:</strong> {metadata.source} &bull; <strong>Uploaded:</strong>{' '}
              {new Date(metadata.uploadDate).toLocaleDateString()}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <BevelButton onClick={onBackToDatasets} className="text-xs py-1">
              &larr; Back to Datasets
            </BevelButton>
            <BevelButton onClick={handleGenerateReport} variant="primary" className="text-xs py-1">
              📄 Generate Report
            </BevelButton>
          </div>
        </div>

        {/* Authentic Windows 95 Tab Bar */}
        <RetroTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        {/* Tab Content Canvas */}
        <div className="p-3 bg-[#c0c0c0] bevel-outset border-t-0 -mt-[1px]">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-3">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bevel-inset-gray p-2 bg-[#dfdfdf]">
                  <div className="text-[10px] text-[#555555] font-bold">TOTAL ROWS</div>
                  <div className="text-2xl font-black font-mono text-[#000080]">
                    {metadata.rowCount.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-[#404040]">Cataloged records</div>
                </div>

                <div className="bevel-inset-gray p-2 bg-[#dfdfdf]">
                  <div className="text-[10px] text-[#555555] font-bold">COLUMNS</div>
                  <div className="text-2xl font-black font-mono text-[#008000]">
                    {metadata.columnCount}
                  </div>
                  <div className="text-[10px] text-[#404040]">
                    {(metadata.columns || []).filter(c => c.type === 'numeric').length} numeric / {(metadata.columns || []).filter(c => c.type !== 'numeric').length} categorical
                  </div>
                </div>

                <div className="bevel-inset-gray p-2 bg-[#dfdfdf]">
                  <div className="text-[10px] text-[#555555] font-bold">DATA HEALTH SCORE</div>
                  <div className={`text-2xl font-black font-mono ${qualityScore >= 80 ? 'text-[#008000]' : 'text-[#ff0000]'}`}>
                    {qualityScore}%
                  </div>
                  <div className="text-[10px] text-[#404040]">
                    {missingCells} missing / {metadata.duplicateCount} duplicates
                  </div>
                </div>

                <div className="bevel-inset-gray p-2 bg-[#dfdfdf]">
                  <div className="text-[10px] text-[#555555] font-bold">ANOMALIES FLAGGED</div>
                  <div className="text-2xl font-black font-mono text-[#800000]">
                    {anomalies?.totalAnomalies || 0}
                  </div>
                  <div className="text-[10px] text-[#404040]">IQR &amp; Z-score methods</div>
                </div>
              </div>

              {/* Column Schema & Health Diagnostics */}
              <div className="bevel-outset p-2 bg-[#e0e0e0]">
                <div className="text-xs font-bold text-[#000080] mb-2 flex items-center justify-between">
                  <span>COLUMN SCHEMA PROFILER &amp; INTEGRITY BREAKDOWN</span>
                  <span className="text-[10px] text-[#555555] font-mono">ENCODING: UTF-8 / ASCII</span>
                </div>
                <div className="overflow-x-auto bevel-inset bg-white">
                  <table className="retro-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Column Name</th>
                        <th>Type</th>
                        <th>Nulls</th>
                        <th>Null %</th>
                        <th>Distinct Values</th>
                        <th>Sample Values</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metadata.columns.map((col, idx) => {
                        const pct = ((col.missingCount / (metadata.rowCount || 1)) * 100).toFixed(1);
                        return (
                          <tr key={col.name}>
                            <td className="text-center font-mono text-[10px] bg-[#f0f0f0]">{idx + 1}</td>
                            <td className="font-bold font-mono text-black">{col.name}</td>
                            <td>
                              <span
                                className={`px-1.5 py-0.2 text-[10px] font-mono font-bold ${
                                  col.type === 'numeric'
                                    ? 'bg-[#000080] text-white'
                                    : col.type === 'date'
                                    ? 'bg-[#008080] text-white'
                                    : 'bg-[#e0e0e0] text-black border border-[#808080]'
                                }`}
                              >
                                {col.type.toUpperCase()}
                              </span>
                            </td>
                            <td className={`font-mono text-right ${col.missingCount > 0 ? 'text-[#ff0000] font-bold' : ''}`}>
                              {col.missingCount}
                            </td>
                            <td className="font-mono text-right">{pct}%</td>
                            <td className="font-mono text-right">{col.uniqueCount}</td>
                            <td className="font-mono text-[10px] text-[#555555] truncate max-w-sm">
                              {col.sampleValues.slice(0, 4).join(', ')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DATA GRID */}
          {activeTab === 'data' && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 p-1.5 bevel-inset-gray text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold">Search records:</span>
                  <RetroInput
                    placeholder="Search terms..."
                    value={dataSearch}
                    onChange={e => {
                      setDataSearch(e.target.value);
                      setDataPage(1);
                    }}
                    className="py-0.5 px-2 text-xs w-52"
                  />
                  <span className="text-[#555555]">
                    {totalFiltered.toLocaleString()} matching rows
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-bold">Page Size:</span>
                  <RetroSelect
                    value={dataPageSize}
                    onChange={e => {
                      setDataPageSize(Number(e.target.value));
                      setDataPage(1);
                    }}
                    className="py-0.5 text-xs"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </RetroSelect>

                  <BevelButton
                    onClick={() => setDataPage(Math.max(1, dataPage - 1))}
                    disabled={dataPage <= 1}
                    className="py-0.5 px-2 text-xs"
                  >
                    &larr; Prev
                  </BevelButton>
                  <span className="font-mono font-bold">
                    Page {dataPage} of {totalPages || 1}
                  </span>
                  <BevelButton
                    onClick={() => setDataPage(Math.min(totalPages, dataPage + 1))}
                    disabled={dataPage >= totalPages}
                    className="py-0.5 px-2 text-xs"
                  >
                    Next &rarr;
                  </BevelButton>
                </div>
              </div>

              <div className="bevel-inset bg-white overflow-x-auto max-h-[520px]">
                <table className="retro-table">
                  <thead>
                    <tr>
                      <th className="w-10 text-center">#</th>
                      {metadata.columns.map(col => {
                        const isSorted = sortCol === col.name;
                        return (
                          <th
                            key={col.name}
                            onClick={() => {
                              if (sortCol === col.name) {
                                setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortCol(col.name);
                                setSortDir('asc');
                              }
                            }}
                            className="cursor-pointer hover:bg-[#b0b0b0]"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span>{col.name}</span>
                              <span className="text-[10px] text-[#000080]">
                                {isSorted ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                              </span>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((row, idx) => {
                      const absoluteRowIndex = (dataPage - 1) * dataPageSize + idx + 1;
                      return (
                        <tr key={idx}>
                          <td className="text-center font-mono text-[10px] text-[#666666] bg-[#f8f8f8]">
                            {absoluteRowIndex}
                          </td>
                          {metadata.columns.map(col => {
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
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: STATISTICS */}
          {activeTab === 'statistics' && stats && (
            <div className="space-y-4">
              {/* Numerical Variables Summary */}
              <div>
                <div className="text-xs font-bold text-[#000080] border-b border-[#808080] pb-1 mb-2">
                  NUMERICAL VARIABLES &mdash; PARAMETRIC &amp; NON-PARAMETRIC PROFILES
                </div>
                <div className="overflow-x-auto bevel-inset bg-white">
                  <table className="retro-table text-xs">
                    <thead>
                      <tr>
                        <th>Variable</th>
                        <th>Count</th>
                        <th>Mean</th>
                        <th>Median</th>
                        <th>Mode</th>
                        <th>StdDev</th>
                        <th>Variance</th>
                        <th>Min</th>
                        <th>Max</th>
                        <th>Q1 (25%)</th>
                        <th>Q3 (75%)</th>
                        <th>IQR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(stats.numericColumns || Object.values(stats.numeric || {})).map((num: any) => {
                        const colName = num.name || num.column;
                        const modeVal = num.mode;
                        const modeDisplay = Array.isArray(modeVal)
                          ? (modeVal.length > 0 ? modeVal.join(', ') : 'N/A')
                          : (modeVal !== null && modeVal !== undefined ? String(modeVal) : 'N/A');
                        const q1 = num.quartiles ? num.quartiles.q1 : num.q1;
                        const q3 = num.quartiles ? num.quartiles.q3 : num.q3;
                        const iqr = num.iqr ?? ((q3 !== undefined && q1 !== undefined) ? (q3 - q1).toFixed(2) : 'N/A');

                        return (
                          <tr key={colName}>
                            <td className="font-bold font-mono text-black">{colName}</td>
                            <td className="font-mono text-right">{num.count}</td>
                            <td className="font-mono text-right text-[#000080] font-bold">
                              {num.mean?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </td>
                            <td className="font-mono text-right">{num.median?.toLocaleString()}</td>
                            <td className="font-mono text-right">{modeDisplay}</td>
                            <td className="font-mono text-right">
                              {num.stdDev?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </td>
                            <td className="font-mono text-right">
                              {num.variance?.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                            </td>
                            <td className="font-mono text-right text-[#008000] font-bold">{num.min}</td>
                            <td className="font-mono text-right text-[#ff0000] font-bold">{num.max}</td>
                            <td className="font-mono text-right">{q1}</td>
                            <td className="font-mono text-right">{q3}</td>
                            <td className="font-mono text-right font-bold">{iqr}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Categorical Variables Summary */}
              <div>
                <div className="text-xs font-bold text-[#000080] border-b border-[#808080] pb-1 mb-2">
                  CATEGORICAL &amp; DISCRETE VARIABLES &mdash; FREQUENCY DISTRIBUTIONS
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(stats.categoricalColumns || Object.values(stats.categorical || {})).map((cat: any) => {
                    const catName = cat.name || cat.column;
                    const topItems = cat.topCategories || cat.topValues || [];
                    return (
                      <div key={catName} className="bevel-outset p-2 bg-[#e0e0e0]">
                        <div className="flex justify-between items-center text-xs font-bold mb-1">
                          <span className="text-[#000080]">{catName}</span>
                          <span className="font-mono text-[10px]">
                            {cat.uniqueCount} unique / Mode: {cat.mode || (topItems[0]?.value ?? 'N/A')}
                          </span>
                        </div>
                        <div className="bevel-inset bg-white max-h-40 overflow-y-auto">
                          <table className="retro-table text-xs">
                            <thead>
                              <tr>
                                <th>Value</th>
                                <th>Frequency</th>
                                <th>Percentage</th>
                              </tr>
                            </thead>
                            <tbody>
                              {topItems.map((tv: any, idx: number) => (
                                <tr key={idx}>
                                  <td className="font-mono">{tv.value}</td>
                                  <td className="font-mono text-right">{tv.count}</td>
                                  <td className="font-mono text-right">{typeof tv.percentage === 'number' ? tv.percentage.toFixed(1) : tv.percentage}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CHARTS (FULL D3 ENGINE) */}
          {activeTab === 'charts' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-[#000080] mb-1">
                <span>D3.JS INTERACTIVE QUANTITATIVE ENGINE &bull; 10 VISUALIZATION MODELS</span>
                {savedAnalyses.length > 0 && (
                  <button
                    onClick={() => setActiveTab('saved')}
                    className="text-[11px] underline text-[#000080] hover:text-blue-800 cursor-pointer"
                  >
                    View Saved Analysis Views ({savedAnalyses.length}) &rarr;
                  </button>
                )}
              </div>
              <D3Chart
                data={records}
                columns={metadata.columns}
                initialType={activeChartConfig.chartType}
                initialX={activeChartConfig.selectedX}
                initialY={activeChartConfig.selectedY}
                initialAggregation={activeChartConfig.aggregation}
                title={metadata.name}
                onSaveAnalysis={handlePromptSave}
              />
            </div>
          )}

          {/* TAB 5: CORRELATION */}
          {activeTab === 'correlation' && correlation && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-[#000080] border-b border-[#808080] pb-1 flex justify-between">
                <span>PEARSON CORRELATION MATRIX (r)</span>
                <span className="text-[10px] text-[#404040]">
                  [-1.00: Inverse &bull; 0.00: Orthogonal &bull; +1.00: Direct]
                </span>
              </div>

              {(correlation?.columns?.length || 0) > 0 ? (
                <div>
                  <div className="overflow-x-auto bevel-inset bg-white">
                    <table className="retro-table text-xs font-mono">
                      <thead>
                        <tr>
                          <th>Var</th>
                          {correlation.columns.map(c => (
                            <th key={c} className="text-center">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {correlation.columns.map((rowCol, rIdx) => (
                          <tr key={rowCol}>
                            <td className="font-bold text-black bg-[#f0f0f0]">{rowCol}</td>
                            {correlation.columns.map((colCol, cIdx) => {
                              const r = correlation.matrix[rIdx][cIdx];
                              let bgColor = '#ffffff';
                              let textColor = '#000000';
                              if (r === 1) {
                                bgColor = '#d0d0ff';
                              } else if (r >= 0.5) {
                                bgColor = '#c0e0c0';
                                textColor = '#006000';
                              } else if (r <= -0.5) {
                                bgColor = '#ffcccc';
                                textColor = '#800000';
                              }
                              return (
                                <td
                                  key={colCol}
                                  className="text-center font-bold"
                                  style={{ backgroundColor: bgColor, color: textColor }}
                                  title={`${rowCol} vs ${colCol}: r = ${r}`}
                                >
                                  {r.toFixed(2)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Significant Pairings Table */}
                  <div className="mt-3 bevel-outset p-2 bg-[#dfdfdf]">
                    <div className="text-xs font-bold text-[#000080] mb-1">
                      SIGNIFICANT CORRELATION PAIRS (|r| &ge; 0.40)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {correlation.strongCorrelations.map((pair, idx) => (
                        <div key={idx} className="bevel-inset-gray p-2 bg-white text-xs">
                          <div className="font-bold text-black flex justify-between">
                            <span>{pair.col1} &harr; {pair.col2}</span>
                            <span className={`font-mono font-black ${pair.r > 0 ? 'text-[#008000]' : 'text-[#800000]'}`}>
                              r = {pair.r.toFixed(2)}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#555555] mt-1">
                            {pair.r > 0 ? 'Strong Positive Co-movement' : 'Strong Negative Inverse Relationship'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bevel-inset bg-white text-xs font-mono">
                  INSUFFICIENT NUMERICAL COLUMNS FOR CORRELATION MATRIX CALCULATION.
                </div>
              )}
            </div>
          )}

          {/* TAB 6: ANOMALIES */}
          {activeTab === 'anomalies' && anomalies && (
            <div className="space-y-3">
              <div className="p-2 bevel-outset bg-[#ffffe0] border border-black text-xs">
                <div className="font-bold text-[#800000] flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>DISCLAIMER: STATISTICAL OUTLIER DETECTION SPECIFICATION</span>
                </div>
                <div className="text-[#333333] mt-1">
                  Values displayed below represent statistical mathematical flags generated via the{' '}
                  <strong>Interquartile Range (IQR Fence)</strong> method and standard{' '}
                  <strong>Z-Score (&gt; 2.5 &sigma;)</strong> testing. They do not constitute verified errors or fraudulent entries, but warrant analytical inspection.
                </div>
              </div>

              {/* Anomaly Records List */}
              <div className="bevel-outset p-2 bg-[#e0e0e0]">
                {(() => {
                  const anomalyList = anomalies.anomalies || [
                    ...(anomalies.iqrAnomalies || []),
                    ...(anomalies.zScoreAnomalies || [])
                  ];
                  return (
                    <>
                      <div className="text-xs font-bold text-[#000080] mb-2 flex justify-between items-center">
                        <span>DETECTED ANOMALIES ({anomalies.totalAnomalies ?? anomalyList.length} EVENTS IDENTIFIED)</span>
                        <span className="text-[10px] text-[#555555] font-mono">METHOD: IQR &amp; Z-SCORE</span>
                      </div>

                      <div className="overflow-x-auto bevel-inset bg-white max-h-96">
                        <table className="retro-table text-xs">
                          <thead>
                            <tr>
                              <th>Row #</th>
                              <th>Target Column</th>
                              <th>Observed Value</th>
                              <th>Method</th>
                              <th>Severity</th>
                              <th>Mathematical Explanation</th>
                            </tr>
                          </thead>
                          <tbody>
                            {anomalyList.length > 0 ? (
                              anomalyList.map((anom, idx) => (
                                <tr key={idx}>
                                  <td className="font-mono text-center">{anom.rowIndex + 1}</td>
                                  <td className="font-mono font-bold text-[#000080]">{anom.column}</td>
                                  <td className="font-mono text-right font-bold text-[#800000]">
                                    {typeof anom.value === 'number' ? anom.value.toLocaleString() : anom.value}
                                  </td>
                                  <td>
                                    <span className="px-1 py-0.5 bg-[#c0c0c0] text-black border border-black font-mono text-[10px]">
                                      {anom.method}
                                    </span>
                                  </td>
                                  <td>
                                    <span
                                      className={`px-1.5 py-0.2 text-[10px] font-bold text-white ${
                                        anom.severity === 'HIGH'
                                          ? 'bg-[#ff0000]'
                                          : anom.severity === 'MEDIUM'
                                          ? 'bg-[#cc6600]'
                                          : 'bg-[#808000]'
                                      }`}
                                    >
                                      {anom.severity || 'FLAGGED'}
                                    </span>
                                  </td>
                                  <td className="text-[#333333] text-[11px]">{anom.explanation}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={6} className="text-center py-6 font-mono text-xs text-[#008000]">
                                  ✔ NO STATISTICAL OUTLIERS DETECTED ACROSS NUMERICAL CHANNELS.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* TAB 7: REPORTS */}
          {activeTab === 'reports' && (
            <div className="space-y-3">
              <div className="bevel-outset p-3 bg-[#e0e0e0] space-y-3">
                <div className="text-xs font-bold text-[#000080] border-b border-[#808080] pb-1">
                  GENERATE EXECUTIVE DATA INTELLIGENCE REPORT
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <RetroInput
                    label="Report Document Title:"
                    value={reportTitle}
                    placeholder={`${metadata.name} - Executive Intelligence Dossier`}
                    onChange={e => setReportTitle(e.target.value)}
                  />
                  <RetroInput
                    label="Analyst Notes &amp; Observations:"
                    value={reportNotes}
                    placeholder="Provide contextual conclusions, hypothesis notes, or recommendations..."
                    onChange={e => setReportNotes(e.target.value)}
                  />
                </div>
                <BevelButton
                  onClick={handleGenerateReport}
                  variant="primary"
                  disabled={generatingReport}
                  className="text-xs py-1.5 px-4 font-bold"
                >
                  {generatingReport ? 'Compiling Dossier...' : '⚡ Generate & Preview Report'}
                </BevelButton>
              </div>
            </div>
          )}

          {/* TAB 8: SAVED VIEWS & ANALYSES */}
          {activeTab === 'saved' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-[#808080] pb-1">
                <div className="text-xs font-bold text-[#000080]">
                  SAVED ANALYTICAL CONFIGURATIONS &bull; PERSISTED QUERY STATES ({savedAnalyses.length})
                </div>
                <BevelButton
                  onClick={() => setActiveTab('charts')}
                  className="text-xs py-1 px-2 font-bold"
                >
                  ➕ Configure New Analysis
                </BevelButton>
              </div>

              {savedAnalyses.length === 0 ? (
                <div className="p-8 bevel-inset bg-white text-center">
                  <div className="text-2xl mb-2">💾</div>
                  <div className="text-xs font-bold text-[#000080] mb-1">
                    NO SAVED ANALYSES ON FILE FOR THIS DATASET
                  </div>
                  <p className="text-xs text-[#404040] max-w-md mx-auto mb-3">
                    You can preserve chart configurations, customized dimension projections, and aggregations.
                    Open the <strong>4. D3 Charts</strong> tab, configure your visualization, and click <strong>💾 Save Analysis</strong>.
                  </p>
                  <BevelButton
                    onClick={() => setActiveTab('charts')}
                    variant="primary"
                    className="text-xs py-1.5 px-4"
                  >
                    Open D3 Chart Engine &rarr;
                  </BevelButton>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="overflow-x-auto bevel-inset bg-white">
                    <table className="retro-table text-xs">
                      <thead>
                        <tr>
                          <th>Analysis Title</th>
                          <th>Model Type</th>
                          <th>Target Dimensions</th>
                          <th>Aggregation</th>
                          <th>Creator</th>
                          <th>Timestamp</th>
                          <th className="text-center">Operations</th>
                        </tr>
                      </thead>
                      <tbody>
                        {savedAnalyses.map(sa => (
                          <tr key={sa.id} className="hover:bg-[#e0e0ff]">
                            <td className="font-bold text-[#000080]">
                              {sa.title}
                            </td>
                            <td>
                              <span className="font-mono px-1 py-0.5 bg-[#d0d0d0] border border-[#808080] text-[10px] uppercase font-bold">
                                {sa.chartType}
                              </span>
                            </td>
                            <td className="font-mono text-[11px]">
                              X: {sa.config.selectedX || sa.selectedColumns[0] || 'N/A'}
                              {sa.config.selectedY ? ` | Y: ${sa.config.selectedY}` : ''}
                            </td>
                            <td className="font-mono text-[11px] uppercase">
                              {sa.config.aggregation || 'sum'}
                            </td>
                            <td className="font-mono text-[11px]">
                              {sa.userName || 'Analyst'}
                            </td>
                            <td className="font-mono text-[11px] text-[#505050]">
                              {new Date(sa.createdAt).toLocaleDateString()} {new Date(sa.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td>
                              <div className="flex items-center justify-center gap-1.5">
                                <BevelButton
                                  onClick={() => handleLoadSavedAnalysis(sa)}
                                  variant="primary"
                                  className="text-[11px] py-0.5 px-2"
                                  title="Load this visualization in the D3 Chart Engine"
                                >
                                  📈 Load View
                                </BevelButton>
                                <BevelButton
                                  onClick={e => handleDeleteSavedAnalysis(sa.id, e)}
                                  className="text-[11px] py-0.5 px-2 text-[#800000]"
                                  title="Delete saved analysis"
                                >
                                  ✖ Delete
                                </BevelButton>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </RetroWindow>

      {/* Save Analysis Modal */}
      {saveModalOpen && (
        <RetroModal
          isOpen={true}
          title="PERSIST DATA ANALYSIS CONFIGURATION"
          icon="💾"
          onClose={() => setSaveModalOpen(false)}
          footer={
            <div className="flex justify-end gap-2">
              <BevelButton onClick={() => setSaveModalOpen(false)}>
                Cancel
              </BevelButton>
              <BevelButton
                onClick={handleSaveAnalysisSubmit}
                variant="primary"
                disabled={savingAnalysis || !saveTitle.trim()}
              >
                {savingAnalysis ? 'Saving Configuration...' : '💾 Save Analysis'}
              </BevelButton>
            </div>
          }
        >
          <div className="space-y-3 text-xs">
            <p className="text-[#000080] font-bold">
              Save current quantitative configuration to the database for instant retrieval.
            </p>
            <RetroInput
              label="Analysis Dossier Title:"
              value={saveTitle}
              onChange={e => setSaveTitle(e.target.value)}
              placeholder="e.g. Q3 Regional Output Comparison"
            />
            <div>
              <label className="block text-[11px] font-bold text-[#000080] mb-1">
                Analysis Classification:
              </label>
              <RetroSelect
                value={saveType}
                onChange={e => setSaveType(e.target.value)}
                className="w-full text-xs"
              >
                <option value="Comparative Visualization">Comparative Visualization</option>
                <option value="Trend &amp; Time-Series">Trend &amp; Time-Series</option>
                <option value="Distribution Analysis">Distribution Analysis</option>
                <option value="Correlation Assessment">Correlation Assessment</option>
                <option value="Executive KPI Snapshot">Executive KPI Snapshot</option>
              </RetroSelect>
            </div>

            {pendingChartConfig && (
              <div className="p-2 bevel-inset bg-[#f0f0f0] font-mono text-[11px] space-y-1">
                <div className="font-bold text-[#000080]">Active Parameters:</div>
                <div>Visualization Engine: <span className="font-bold text-black uppercase">{pendingChartConfig.chartType}</span></div>
                <div>Independent Dimension (X): <span className="font-bold text-black">{pendingChartConfig.selectedX || 'None'}</span></div>
                <div>Dependent Metric (Y): <span className="font-bold text-black">{pendingChartConfig.selectedY || 'Count / None'}</span></div>
                <div>Aggregation Function: <span className="font-bold text-black uppercase">{pendingChartConfig.aggregation}</span></div>
              </div>
            )}
          </div>
        </RetroModal>
      )}

      {/* Save Success Toast Modal */}
      {saveSuccessMsg && (
        <RetroModal
          isOpen={true}
          title="ANALYSIS RECORDED"
          icon="ℹ️"
          onClose={() => setSaveSuccessMsg(null)}
          footer={
            <div className="flex justify-end gap-2">
              <BevelButton
                onClick={() => {
                  setSaveSuccessMsg(null);
                  setActiveTab('saved');
                }}
                variant="primary"
              >
                View Saved Analyses ({savedAnalyses.length})
              </BevelButton>
              <BevelButton onClick={() => setSaveSuccessMsg(null)}>
                OK
              </BevelButton>
            </div>
          }
        >
          <div className="text-xs text-[#000080] font-bold p-2">
            {saveSuccessMsg}
          </div>
        </RetroModal>
      )}

      {/* Generated Report Preview Modal */}
      {reportModalOpen && createdReport && (
        <RetroModal
          isOpen={true}
          title={`EXECUTIVE REPORT - ${createdReport.title}`}
          icon="📑"
          onClose={() => setReportModalOpen(false)}
          footer={
            <div className="flex items-center gap-2">
              <BevelButton
                onClick={() => {
                  window.print();
                }}
              >
                🖨 Print Report
              </BevelButton>
              <BevelButton
                onClick={() => {
                  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(createdReport, null, 2));
                  const downloadAnchor = document.createElement('a');
                  downloadAnchor.setAttribute('href', dataStr);
                  downloadAnchor.setAttribute('download', `dataforge95_report_${createdReport.id}.json`);
                  downloadAnchor.click();
                }}
              >
                💾 Export JSON
              </BevelButton>
              <BevelButton onClick={() => setReportModalOpen(false)} variant="primary">
                Close
              </BevelButton>
            </div>
          }
        >
          <div className="space-y-3 text-xs max-h-[70vh] overflow-y-auto pr-1">
            <div className="p-3 bevel-inset bg-white">
              <div className="border-b-2 border-black pb-2 mb-2 flex justify-between items-start">
                <div>
                  <h2 className="text-base font-black text-[#000080]">{createdReport.title}</h2>
                  <div className="text-[10px] text-[#555555] font-mono">
                    REPORT ID: {createdReport.id} &bull; COMPILED: {new Date(createdReport.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="border border-black bg-[#ffffe0] px-2 py-1 text-[10px] font-mono font-bold">
                  CONFIDENTIAL - INTERNAL USE
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <strong className="text-[#000080]">Target Dataset:</strong> {createdReport.datasetName}
                </div>
                <div>
                  <strong className="text-[#000080]">Executive Summary:</strong>
                  <p className="mt-1 p-2 bg-[#f0f0f0] border border-[#808080] leading-relaxed">
                    {createdReport.summary}
                  </p>
                </div>

                <div>
                  <strong className="text-[#000080]">Core Statistical Highlights:</strong>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5">
                    {createdReport.highlights.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <strong className="text-[#000080]">Outlier / Anomaly Diagnostics:</strong>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[#800000]">
                    {createdReport.anomalies.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <strong className="text-[#000080]">Recommended Actions:</strong>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[#008000] font-semibold">
                    {createdReport.recommendations.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>

                {createdReport.customNotes && (
                  <div>
                    <strong className="text-[#000080]">Analyst Remarks:</strong>
                    <p className="italic text-[#404040] mt-0.5">{createdReport.customNotes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </RetroModal>
      )}
    </div>
  );
};
