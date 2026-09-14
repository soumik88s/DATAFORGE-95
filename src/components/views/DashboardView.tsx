import React, { useEffect, useState } from 'react';
import { RetroWindow } from '../retro/RetroWindow.js';
import { BevelButton } from '../retro/BevelButton.js';
import { D3Chart } from '../charts/D3Chart.js';
import { api } from '../../utils/api.js';
import { DatasetMetadata, SystemStats, AuditLog, DatasetRecord } from '../../types.js';

interface DashboardViewProps {
  onSelectDataset: (datasetId: string) => void;
  onNavigate: (view: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onSelectDataset,
  onNavigate
}) => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [recentDatasets, setRecentDatasets] = useState<DatasetMetadata[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [activeDatasetRecords, setActiveDatasetRecords] = useState<DatasetRecord[]>([]);
  const [activeDatasetMeta, setActiveDatasetMeta] = useState<DatasetMetadata | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        const overview = await api.getOverview();
        if (overview) {
          setStats(overview.stats || null);
          const datasetsList = Array.isArray(overview.recentDatasets) ? overview.recentDatasets : [];
          const auditLogsList = Array.isArray(overview.recentAuditLogs) ? overview.recentAuditLogs : [];
          setRecentDatasets(datasetsList);
          setRecentLogs(auditLogsList);

          // Load the primary sample dataset for immediate D3 interaction
          if (datasetsList.length > 0) {
            const first = datasetsList[0];
            const dsDetail = await api.getDatasetDetails(first.id, { pageSize: 50 });
            if (dsDetail) {
              setActiveDatasetMeta(dsDetail.metadata || null);
              setActiveDatasetRecords(Array.isArray(dsDetail.records) ? dsDetail.records : []);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load dashboard overview', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  return (
    <div className="flex flex-col gap-3 pb-12">
      {/* Windows 95 Control Center Header / Quick Stats Strip */}
      <RetroWindow
        title="DATAFORGE 95 - ANALYTICS CONTROL CENTER [SYSTEM MONITOR]"
        icon="🖥️"
        statusBarText={`KERNEL STATUS: NOMINAL | UPTIME: ${stats?.uptimeSeconds || 120}s | MEMORY BUFFERS: OK`}
      >
        {/* Metric Summary Boxes */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-3">
          {/* Total Datasets */}
          <div className="bevel-inset-gray p-2 text-center bg-[#c0c0c0]">
            <div className="text-[10px] font-bold text-[#404040]">TOTAL DATASETS</div>
            <div className="text-xl sm:text-2xl font-black font-mono text-[#000080]">
              {String(stats?.totalDatasets ?? 0).padStart(5, '0')}
            </div>
            <div className="text-[9px] text-[#555555]">All domains loaded</div>
          </div>

          {/* Total Records */}
          <div className="bevel-inset-gray p-2 text-center bg-[#c0c0c0]">
            <div className="text-[10px] font-bold text-[#404040]">TOTAL RECORDS</div>
            <div className="text-xl sm:text-2xl font-black font-mono text-[#008000]">
              {(stats?.totalRecords ?? 0).toLocaleString()}
            </div>
            <div className="text-[9px] text-[#555555]">Rows cataloged</div>
          </div>

          {/* Active Users */}
          <div className="bevel-inset-gray p-2 text-center bg-[#c0c0c0]">
            <div className="text-[10px] font-bold text-[#404040]">ACTIVE USERS</div>
            <div className="text-xl sm:text-2xl font-black font-mono text-[#800080]">
              {String(stats?.activeUsers ?? 3).padStart(3, '0')}
            </div>
            <div className="text-[9px] text-[#555555]">RBAC authorized</div>
          </div>

          {/* Analyses Created */}
          <div className="bevel-inset-gray p-2 text-center bg-[#c0c0c0]">
            <div className="text-[10px] font-bold text-[#404040]">ANALYSES CREATED</div>
            <div className="text-xl sm:text-2xl font-black font-mono text-[#800000]">
              {String(stats?.analysesCreated ?? 142).padStart(5, '0')}
            </div>
            <div className="text-[9px] text-[#555555]">Profiles compiled</div>
          </div>

          {/* Recent Dataset */}
          <div className="bevel-inset-gray p-2 text-center bg-[#c0c0c0] truncate">
            <div className="text-[10px] font-bold text-[#404040]">RECENT DATASET</div>
            <div className="text-xs font-bold text-black truncate mt-1">
              {stats?.recentDatasetName || 'None'}
            </div>
            <div className="text-[9px] text-[#000080] font-mono">READY</div>
          </div>

          {/* Most Used Category */}
          <div className="bevel-inset-gray p-2 text-center bg-[#c0c0c0] truncate">
            <div className="text-[10px] font-bold text-[#404040]">TOP CATEGORY</div>
            <div className="text-xs font-bold text-black truncate mt-1">
              {stats?.mostUsedCategory || 'Energy'}
            </div>
            <div className="text-[9px] text-[#008000] font-mono">DOMINANT</div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#808080] pt-2">
          <div className="flex items-center gap-1">
            <BevelButton onClick={() => onNavigate('datasets')} className="text-xs">
              📁 Manage Datasets
            </BevelButton>
            <BevelButton onClick={() => onNavigate('reports')} className="text-xs">
              📝 Analytics Reports
            </BevelButton>
            <BevelButton onClick={() => onNavigate('audit')} className="text-xs">
              📜 Audit Trail
            </BevelButton>
          </div>
          <div className="text-xs font-mono text-[#555555]">
            SYSTEM CLOCK: 100MHz BUS &bull; FAST MATH COMPLIANT
          </div>
        </div>
      </RetroWindow>

      {/* Main Analytics Terminal & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Left: Interactive D3 Visualizer Terminal */}
        <div className="lg:col-span-2">
          <RetroWindow
            title={`ANALYTICS TERMINAL - ${activeDatasetMeta?.name || 'SAMPLE DATASET'}`}
            icon="📈"
            menuItems={['File', 'Export', 'Transform', 'Help']}
            statusBarText="D3 ENGINE: HARDWARE ACCELERATED RENDER"
          >
            {activeDatasetMeta && activeDatasetRecords.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold">
                    ACTIVE SOURCE: <span className="text-[#000080]">{activeDatasetMeta.name}</span> ({activeDatasetMeta.category})
                  </div>
                  <BevelButton
                    onClick={() => onSelectDataset(activeDatasetMeta.id)}
                    className="text-[11px] py-0.5 px-2"
                  >
                    Deep Analysis View &rarr;
                  </BevelButton>
                </div>

                <D3Chart
                  data={activeDatasetRecords}
                  columns={activeDatasetMeta.columns}
                  initialType="bar"
                  title={activeDatasetMeta.name}
                />
              </div>
            ) : (
              <div className="bevel-inset p-8 text-center bg-white font-mono text-xs">
                {loading ? 'INITIALIZING D3 TERMINAL...' : 'NO ACTIVE DATASET LOADED.'}
              </div>
            )}
          </RetroWindow>
        </div>

        {/* Right: Category Distribution & Domain Breakdown */}
        <div className="flex flex-col gap-3">
          <RetroWindow title="CATEGORY DISTRIBUTION" icon="📊">
            <div className="space-y-2">
              <div className="text-xs text-[#404040]">
                Breakdown of active datasets by domain classification:
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {(stats?.categoryDistribution || []).map((cat, idx) => {
                  const maxRecords = stats?.totalRecords || 1;
                  const pct = Math.min(100, Math.round((cat.records / maxRecords) * 100));
                  return (
                    <div key={idx} className="bevel-inset-gray p-1.5 bg-[#dfdfdf]">
                      <div className="flex justify-between text-xs font-bold mb-0.5">
                        <span className="truncate">{cat.category}</span>
                        <span className="font-mono text-[#000080]">
                          {cat.count} ds / {cat.records} rows
                        </span>
                      </div>
                      {/* Retro Progress Bar */}
                      <div className="bevel-inset h-3 bg-white w-full overflow-hidden flex">
                        <div
                          className="h-full bg-[#000080] border-r border-black"
                          style={{ width: `${Math.max(5, pct)}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-[#808080] pt-2 text-center">
                <BevelButton onClick={() => onNavigate('datasets')} className="w-full text-xs">
                  + Ingest New Domain Dataset
                </BevelButton>
              </div>
            </div>
          </RetroWindow>

          {/* Recent Audit / System Activity */}
          <RetroWindow title="SYSTEM EVENT FEED" icon="📜">
            <div className="bevel-inset bg-black text-[#00ff00] p-2 font-mono text-[11px] h-44 overflow-y-auto space-y-1">
              {recentLogs.length > 0 ? (
                recentLogs.slice(0, 8).map((log, idx) => (
                  <div key={idx} className="leading-tight border-b border-[#222222] pb-0.5">
                    <span className="text-[#ffff00]">
                      [{new Date(log.timestamp).toLocaleTimeString()}]
                    </span>{' '}
                    <span className="text-white font-bold">{log.action}:</span> {log.details}
                  </div>
                ))
              ) : (
                <div>NO AUDIT LOGS RECORDED YET.</div>
              )}
            </div>
          </RetroWindow>
        </div>
      </div>

      {/* Recent Datasets Table */}
      <RetroWindow
        title="CATALOGED DATASETS REPOSITORY"
        icon="📁"
        menuItems={['View', 'Sort', 'Filter', 'Properties']}
      >
        <div className="overflow-x-auto bevel-inset bg-white">
          <table className="retro-table" summary="List of recent cataloged datasets in DATAFORGE 95">
            <thead>
              <tr>
                <th>ID</th>
                <th>Dataset Name</th>
                <th>Category</th>
                <th>Rows</th>
                <th>Columns</th>
                <th>File Type</th>
                <th>Upload Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentDatasets.map(ds => (
                <tr key={ds.id}>
                  <td className="font-mono text-[#000080] font-bold">{ds.id}</td>
                  <td className="font-bold text-black">{ds.name}</td>
                  <td>
                    <span className="px-1.5 py-0.5 bg-[#c0c0c0] text-black border border-[#808080] text-[10px]">
                      {ds.category}
                    </span>
                  </td>
                  <td className="font-mono text-right">{ds.rowCount.toLocaleString()}</td>
                  <td className="font-mono text-right">{ds.columnCount}</td>
                  <td className="font-mono">{ds.fileType}</td>
                  <td className="text-[#555555]">{new Date(ds.uploadDate).toLocaleDateString()}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <BevelButton
                        onClick={() => onSelectDataset(ds.id)}
                        className="text-[10px] py-0.5 px-2"
                        variant="primary"
                      >
                        ⚡ Analyze
                      </BevelButton>
                      <BevelButton
                        onClick={async () => {
                          const detail = await api.getDatasetDetails(ds.id, { pageSize: 50 });
                          setActiveDatasetMeta(detail.metadata);
                          setActiveDatasetRecords(detail.records);
                        }}
                        className="text-[10px] py-0.5 px-1.5"
                      >
                        Preview
                      </BevelButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </RetroWindow>
    </div>
  );
};
