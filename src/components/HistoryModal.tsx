import React from 'react';
import { motion } from 'motion/react';
import { X, Search, RefreshCw, History } from 'lucide-react';
import { ActivityLog } from '../dbService';

interface HistoryModalProps {
  onClose: () => void;
  logs: ActivityLog[];
  logsLoading: boolean;
  reloadActivityLogs: () => void;
  logSearchTerm: string;
  setLogSearchTerm: (val: string) => void;
  logActionFilter: 'all' | 'edit_evaluation' | 'upload_file' | 'delete_file';
  setLogActionFilter: (val: 'all' | 'edit_evaluation' | 'upload_file' | 'delete_file') => void;
}

export default function HistoryModal({
  onClose,
  logs,
  logsLoading,
  reloadActivityLogs,
  logSearchTerm,
  setLogSearchTerm,
  logActionFilter,
  setLogActionFilter
}: HistoryModalProps) {
  const filteredLogs = logs.filter(log => {
    if (logActionFilter !== 'all' && log.action !== logActionFilter) return false;
    if (!logSearchTerm) return true;
    const term = logSearchTerm.toLowerCase();
    return (
      (log.userEmail || '').toLowerCase().includes(term) ||
      (log.userDisplayName || '').toLowerCase().includes(term) ||
      (log.unitName || '').toLowerCase().includes(term) ||
      (log.details || '').toLowerCase().includes(term) ||
      (log.itemCode || '').toLowerCase().includes(term) ||
      (log.itemName || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-[2rem] w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200"
      >
        <div className="p-6 md:px-8 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-600">
              <History className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 font-sans">
                  ประวัติการใช้งานระบบ
                </h2>
                <span className="bg-orange-100 text-orange-800 border border-orange-200 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                  ADMIN ONLY 👑
                </span>
              </div>
              <p className="text-xs text-slate-500 font-sans mt-0.5">
                ประวัติการแก้ไขข้อมูล การอัปโหลดไฟล์ และกิจกรรมต่างๆ ในระบบ
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col p-6 md:px-8 shrink-0 border-b border-slate-100 gap-4 bg-white">
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
            <div className="flex-1 max-w-md flex items-center gap-2 border border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 focus-within:bg-white focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/20 transition">
              <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                value={logSearchTerm}
                onChange={(e) => setLogSearchTerm(e.target.value)}
                placeholder="ค้นหาประวัติการใช้งาน..."
                className="w-full text-sm font-semibold text-slate-900 border-none outline-none bg-transparent"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {(['all', 'edit_evaluation', 'upload_file', 'delete_file'] as const).map((filter) => {
                  const labelMap = {
                    all: 'ทั้งหมด',
                    edit_evaluation: 'แก้ไขคะแนน',
                    upload_file: 'อัปโหลดไฟล์',
                    delete_file: 'ลบไฟล์'
                  };
                  return (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setLogActionFilter(filter)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        logActionFilter === filter
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {labelMap[filter]}
                    </button>
                  );
                })}
              </div>
              <button 
                onClick={reloadActivityLogs}
                disabled={logsLoading}
                className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 shadow-sm transition cursor-pointer disabled:opacity-50"
                title="รีเฟรชข้อมูล"
              >
                <RefreshCw className={`h-4 w-4 ${logsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:px-8 bg-slate-50/50">
          {logsLoading && filteredLogs.length === 0 ? (
            <div className="text-center py-16">
              <RefreshCw className="h-8 w-8 text-slate-300 animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-semibold font-sans">กำลังดึงข้อมูลประวัติ...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
              <History className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-600 font-bold font-sans">ไม่พบประวัติการใช้งานตามเกณฑ์ค้นหา</p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px] border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-xs">
                      <th className="p-4 w-[160px]">วันเวลา</th>
                      <th className="p-4 w-[200px]">ผู้ใช้งาน / หน่วยงาน</th>
                      <th className="p-4 w-[140px]">ประเภทรายการ</th>
                      <th className="p-4">รายละเอียด</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLogs.map((log) => {
                      let actionBadge = '';
                      if (log.action === 'edit_evaluation') {
                        actionBadge = 'bg-blue-50 text-blue-700 border-blue-200';
                      } else if (log.action === 'upload_file') {
                        actionBadge = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      } else if (log.action === 'delete_file') {
                        actionBadge = 'bg-rose-50 text-rose-700 border-rose-200';
                      }

                      const actionLabel = {
                        edit_evaluation: 'แก้ไขแบบประเมิน',
                        upload_file: 'อัปโหลดไฟล์',
                        delete_file: 'ลบไฟล์'
                      }[log.action];

                      return (
                        <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 align-top text-slate-500 font-medium font-mono whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString('th-TH', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="p-4 align-top">
                            <div className="font-bold text-slate-800 line-clamp-1" title={log.unitName}>{log.unitName}</div>
                            {log.userDisplayName && (
                              <div className="text-[12px] font-semibold text-teal-700 mt-0.5">{log.userDisplayName}</div>
                            )}
                            <div className="text-[11px] text-slate-500 mt-0.5">{log.userEmail}</div>
                          </td>
                          <td className="p-4 align-top whitespace-nowrap">
                            <span className={`inline-flex px-2.5 py-1 rounded-md border text-[11px] font-bold ${actionBadge}`}>
                              {actionLabel}
                            </span>
                            {log.itemCode && (
                              <div className="mt-1.5 inline-block bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 text-[10px] font-bold border border-slate-200">
                                ข้อ {log.itemCode}
                              </div>
                            )}
                          </td>
                          <td className="p-4 align-top font-medium text-slate-700">
                            <div>{log.details}</div>
                            {log.itemName && (
                              <div className="text-[11px] text-slate-500 font-normal mt-1 border-l-2 border-slate-200 pl-2" title={log.itemName}>
                                {log.itemName}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
