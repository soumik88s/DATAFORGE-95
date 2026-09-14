import React, { useEffect, useState } from 'react';
import { RetroWindow } from '../retro/RetroWindow.js';
import { RetroInput } from '../retro/RetroInput.js';
import { api } from '../../utils/api.js';
import { AuditLog } from '../../types.js';

export const AuditLogView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filterQuery, setFilterQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLogs() {
      try {
        setLoading(true);
        const data = await api.getAuditLogs();
        setLogs(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadLogs();
  }, []);

  const filtered = logs.filter(
    l =>
      l.action.toLowerCase().includes(filterQuery.toLowerCase()) ||
      l.details.toLowerCase().includes(filterQuery.toLowerCase()) ||
      l.username.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-3 pb-12">
      <RetroWindow
        title="SYSTEM SECURITY AUDIT LOG VIEWER [ADMIN PRIVILEGE]"
        icon="📜"
        menuItems={['File', 'Filter', 'Export', 'Help']}
      >
        <div className="p-2 bevel-inset-gray bg-[#c0c0c0] mb-3 flex flex-wrap justify-between items-center gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold">Filter Log Events:</span>
            <RetroInput
              placeholder="Filter by action, user, or details..."
              value={filterQuery}
              onChange={e => setFilterQuery(e.target.value)}
              className="py-0.5 px-2 text-xs w-60"
            />
          </div>
          <div className="font-mono text-[#404040]">
            TOTAL EVENTS: <strong>{filtered.length}</strong> / {logs.length}
          </div>
        </div>

        <div className="bevel-inset bg-black text-[#00ff00] font-mono text-xs overflow-x-auto max-h-[500px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#333333] text-[#ffff00] bg-[#111111]">
                <th className="p-2">TIMESTAMP</th>
                <th className="p-2">USER</th>
                <th className="p-2">ACTION</th>
                <th className="p-2">DETAILS</th>
                <th className="p-2">IP ADDRESS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id} className="border-b border-[#222222] hover:bg-[#1a1a1a]">
                  <td className="p-2 text-[#888888] whitespace-nowrap">
                    {new Date(l.timestamp).toLocaleString()}
                  </td>
                  <td className="p-2 text-white font-bold whitespace-nowrap">
                    {l.username}
                  </td>
                  <td className="p-2 text-[#00ffff] font-bold whitespace-nowrap">
                    {l.action}
                  </td>
                  <td className="p-2 text-[#00ff00] break-all">
                    {l.details}
                  </td>
                  <td className="p-2 text-[#aaaaaa] whitespace-nowrap">
                    {l.ipAddress || '127.0.0.1'}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-[#ff0000]">
                    {loading ? 'READING AUDIT LOG CHANNELS...' : 'NO AUDIT EVENTS FOUND MATCHING FILTER.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </RetroWindow>
    </div>
  );
};
