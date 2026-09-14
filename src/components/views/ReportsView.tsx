import React, { useEffect, useState } from 'react';
import { RetroWindow } from '../retro/RetroWindow.js';
import { BevelButton } from '../retro/BevelButton.js';
import { RetroModal } from '../retro/RetroModal.js';
import { api } from '../../utils/api.js';
import { Report } from '../../types.js';

interface ReportsViewProps {
  onSelectDatasetForAnalysis: (datasetId: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ onSelectDatasetForAnalysis }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    try {
      setLoading(true);
      const list = await api.getReports();
      setReports(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 pb-12">
      <RetroWindow
        title="EXECUTIVE REPORTS DOSSIER ARCHIVE"
        icon="📑"
        menuItems={['File', 'Print', 'Export', 'Help']}
      >
        <div className="p-2 bevel-inset-gray bg-[#c0c0c0] mb-3 flex justify-between items-center text-xs">
          <div>
            Total Archived Intelligence Reports:{' '}
            <strong className="font-mono text-[#000080]">{reports.length}</strong>
          </div>
          <div className="text-[#555555]">
            Reports can be printed or exported as standard JSON documents.
          </div>
        </div>

        <div className="bevel-inset bg-white overflow-x-auto">
          <table className="retro-table text-xs">
            <thead>
              <tr>
                <th>ID</th>
                <th>Report Title</th>
                <th>Target Dataset</th>
                <th>Created At</th>
                <th>Highlights</th>
                <th>Anomalies</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.length > 0 ? (
                reports.map(rep => (
                  <tr key={rep.id}>
                    <td className="font-mono text-[#000080] font-bold">{rep.id}</td>
                    <td className="font-bold text-black">{rep.title}</td>
                    <td>
                      <span
                        onClick={() => onSelectDatasetForAnalysis(rep.datasetId)}
                        className="cursor-pointer underline text-[#000080] hover:text-[#0000ff]"
                      >
                        {rep.datasetName}
                      </span>
                    </td>
                    <td className="font-mono text-[#555555]">
                      {new Date(rep.createdAt).toLocaleString()}
                    </td>
                    <td className="font-mono text-center">{rep.highlights.length}</td>
                    <td className="font-mono text-center text-[#800000] font-bold">
                      {rep.anomalies.length}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <BevelButton
                          onClick={() => setSelectedReport(rep)}
                          className="text-[10px] py-0.5 px-2"
                          variant="primary"
                        >
                          👁 Read
                        </BevelButton>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-8 font-mono text-[#555555]">
                    {loading ? 'LOADING REPORT ARCHIVES...' : 'NO REPORTS COMPILED YET. NAVIGATE TO A DATASET TO GENERATE A DOSSIER.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </RetroWindow>

      {/* View Report Detail Modal */}
      {selectedReport && (
        <RetroModal
          isOpen={true}
          title={`EXECUTIVE DOSSIER: ${selectedReport.title}`}
          icon="📑"
          onClose={() => setSelectedReport(null)}
          footer={
            <div className="flex items-center gap-2">
              <BevelButton onClick={() => window.print()}>🖨 Print</BevelButton>
              <BevelButton
                onClick={() => {
                  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(selectedReport, null, 2));
                  const downloadAnchor = document.createElement('a');
                  downloadAnchor.setAttribute('href', dataStr);
                  downloadAnchor.setAttribute('download', `dataforge95_report_${selectedReport.id}.json`);
                  downloadAnchor.click();
                }}
              >
                💾 Export JSON
              </BevelButton>
              <BevelButton onClick={() => setSelectedReport(null)} variant="primary">
                Close
              </BevelButton>
            </div>
          }
        >
          <div className="space-y-3 text-xs max-h-[70vh] overflow-y-auto pr-1">
            <div className="p-3 bevel-inset bg-white space-y-2">
              <div className="border-b border-black pb-1">
                <h3 className="font-bold text-sm text-[#000080]">{selectedReport.title}</h3>
                <div className="text-[10px] text-[#555555] font-mono">
                  ID: {selectedReport.id} &bull; DATASET: {selectedReport.datasetName}
                </div>
              </div>

              <div>
                <strong className="text-[#000080]">Summary:</strong>
                <p className="mt-1 p-2 bg-[#f0f0f0] border border-[#808080] leading-relaxed">
                  {selectedReport.summary}
                </p>
              </div>

              <div>
                <strong className="text-[#000080]">Core Highlights:</strong>
                <ul className="list-disc pl-4 mt-1 space-y-0.5">
                  {selectedReport.highlights.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>

              <div>
                <strong className="text-[#000080]">Anomalies &amp; Outliers:</strong>
                <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[#800000]">
                  {selectedReport.anomalies.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>

              <div>
                <strong className="text-[#000080]">Recommendations:</strong>
                <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[#008000] font-semibold">
                  {selectedReport.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>

              {selectedReport.customNotes && (
                <div>
                  <strong className="text-[#000080]">Analyst Remarks:</strong>
                  <p className="italic text-[#404040] mt-0.5">{selectedReport.customNotes}</p>
                </div>
              )}
            </div>
          </div>
        </RetroModal>
      )}
    </div>
  );
};
