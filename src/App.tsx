import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Activity, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  HelpCircle,
  Search,
  ChevronRight,
  LogOut,
  RefreshCw,
  Printer,
  Sparkles,
  Award,
  CircleAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ASSESSMENT_PARTS, 
  ASSESSMENT_ITEMS, 
  getItemsForPart, 
  getPartMaxScore, 
  getPartPassingThreshold, 
  AssessmentItem 
} from './data';
import { 
  saveAssessment, 
  getAssessment, 
  getAllAssessments,
  getEvidenceFileList, 
  AssessmentData, 
  EvidenceFileMeta 
} from './dbService';
import AuthModal from './components/AuthModal';
import ItemEvaluationModal from './components/ItemEvaluationModal';

export default function App() {
  // Session UI states
  const [activeUnit, setActiveUnit] = useState<AssessmentData | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFileMeta[]>([]);
  
  // Dual-role states
  const [sessionRole, setSessionRole] = useState<'editor' | 'supervisor'>('editor');
  const [allUnitsList, setAllUnitsList] = useState<AssessmentData[]>([]);

  // Selection/Evaluation states
  const [selectedPart, setSelectedPart] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [evaluatedItem, setEvaluatedItem] = useState<AssessmentItem | null>(null);
  
  // Sync status
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [authError, setAuthError] = useState<string>('');

  // Load files list whenever unit or evaluations change
  const reloadFilesList = async (id: string) => {
    try {
      const list = await getEvidenceFileList(id);
      setEvidenceFiles(list);
    } catch (err) {
      console.error("Failed to load uploaded files:", err);
    }
  };

  // Auth Handler: Loads existing assessment or sets up a fresh one
  const handleAuthConfirm = async (info: {
    email: string;
    name: string;
    district: string;
    province: string;
    role: 'editor' | 'supervisor';
  }) => {
    setSessionLoading(true);
    setAuthError('');
    setSessionRole(info.role);
    const docId = info.email.replace(/[@.]/g, '_');
    try {
      if (info.role === 'supervisor') {
        const list = await getAllAssessments();
        setAllUnitsList(list);
        if (list.length > 0) {
          // Default to the first unit or UBUH unit if found
          const defaultUnit = list.find(u => u.unitName.includes('อุบล')) || list[0];
          setActiveUnit(defaultUnit);
          await reloadFilesList(defaultUnit.id);
        } else {
          // Fallback if no data uploaded yet
          const tempUnit: AssessmentData = {
            id: 'no_data',
            unitEmail: info.email,
            unitName: 'ยังไม่มีสถิติโรงพยาบาลส่งข้อมูล',
            district: '-',
            province: 'อุบลราชธานี',
            scores: {},
            notes: {},
            updatedAt: new Date().toISOString()
          };
          setActiveUnit(tempUnit);
          setEvidenceFiles([]);
        }
      } else {
        const existing = await getAssessment(docId);
        if (existing) {
          setActiveUnit(existing);
          await reloadFilesList(existing.id);
        } else {
          // Build empty state
          const initialScores: Record<string, number> = {};
          const initialNotes: Record<string, string> = {};
          ASSESSMENT_ITEMS.forEach(it => {
            initialScores[it.id] = 0;
            initialNotes[it.id] = '';
          });

          const freshUnit: AssessmentData = {
            id: docId,
            unitEmail: info.email,
            unitName: info.name,
            district: info.district,
            province: info.province,
            scores: initialScores,
            notes: initialNotes,
            updatedAt: new Date().toISOString()
          };
          await saveAssessment(freshUnit);
          setActiveUnit(freshUnit);
          setEvidenceFiles([]);
        }
      }
      setCloudStatus('success');
      setTimeout(() => setCloudStatus('idle'), 3000);
    } catch (err: any) {
      setCloudStatus('error');
      console.error(err);
      
      const rawMsg = err instanceof Error ? err.message : String(err);
      let friendlyMsg = rawMsg;
      try {
        const parsed = JSON.parse(rawMsg);
        if (parsed?.error) {
          friendlyMsg = parsed.error;
        }
      } catch (e) {}
      
      setAuthError(`❌ เชื่อมต่อล้มเหลว: ${friendlyMsg}\nกรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต หรือติดต่อผู้ดูแลระบบให้ช่วยตรวจสอบ Firestore Rule`);
    } finally {
      setSessionLoading(false);
    }
  };

  const handleSwitchUnit = async (unitId: string) => {
    const selected = allUnitsList.find(u => u.id === unitId);
    if (selected) {
      setActiveUnit(selected);
      await reloadFilesList(selected.id);
    }
  };

  const handleRefreshSupervisorData = async () => {
    if (sessionRole !== 'supervisor') {
      if (activeUnit) {
        setCloudStatus('syncing');
        await reloadFilesList(activeUnit.id);
        setCloudStatus('success');
        setTimeout(() => setCloudStatus('idle'), 3000);
      }
      return;
    }
    setCloudStatus('syncing');
    try {
      const units = await getAllAssessments();
      setAllUnitsList(units);
      if (activeUnit) {
        const updatedActive = units.find(u => u.id === activeUnit.id) || units[0];
        if (updatedActive) {
          setActiveUnit(updatedActive);
          await reloadFilesList(updatedActive.id);
        }
      }
      setCloudStatus('success');
      setTimeout(() => setCloudStatus('idle'), 3000);
    } catch (err) {
      setCloudStatus('error');
      console.error(err);
    }
  };

  // Save changes to db with status reports
  const handleSaveEvaluation = async (score: number, note: string) => {
    if (!activeUnit || !evaluatedItem) return;

    setCloudStatus('syncing');
    
    // Immutable field updates
    const updatedScores = { ...activeUnit.scores, [evaluatedItem.id]: score };
    const updatedNotes = { ...activeUnit.notes, [evaluatedItem.id]: note };

    const updatedUnit: AssessmentData = {
      ...activeUnit,
      scores: updatedScores,
      notes: updatedNotes,
      updatedAt: new Date().toISOString()
    };

    try {
      await saveAssessment(updatedUnit);
      setActiveUnit(updatedUnit);
      setCloudStatus('success');
      setEvaluatedItem(null); // Close modal
      setTimeout(() => setCloudStatus('idle'), 3000);
    } catch (err) {
      setCloudStatus('error');
      alert('ไม่สามารถเชื่อมต่อฐานข้อมูลคลาวด์เพื่อบันทึกผลได้');
    }
  };

  // Global calculations
  const calculatePartScore = (partIndex: number): number => {
    if (!activeUnit) return 0;
    const partItems = getItemsForPart(partIndex);
    const sum = partItems.reduce((acc, it) => acc + (activeUnit.scores[it.id] || 0), 0);
    return Math.round(sum * 10) / 10;
  };

  const calculateTotalScore = (): number => {
    let sum = 0;
    for (let i = 1; i <= 8; i++) {
      sum += calculatePartScore(i);
    }
    return Math.round(sum * 10) / 10;
  };

  const countEvaluated = (): number => {
    if (!activeUnit) return 0;
    return ASSESSMENT_ITEMS.filter(it => (activeUnit.scores[it.id] > 0 || activeUnit.notes[it.id] !== '')).length;
  };

  // Check compliance criteria for parts
  const isPartPassing = (partIndex: number): boolean => {
    const score = calculatePartScore(partIndex);
    const threshold = getPartPassingThreshold(partIndex);
    return score >= threshold;
  };

  // Check overall assessment status: passed if S1-S4 scores match full, and S5-S8 are >= 80%
  const checkOverallCompliance = (): boolean => {
    for (let i = 1; i <= 8; i++) {
      if (!isPartPassing(i)) return false;
    }
    return true;
  };

  // Open Browser Print
  const handlePrint = () => {
    window.print();
  };

  const handleLogout = () => {
    if (confirm('คุณต้องการเปลี่ยนหน่วยบริการตรวจประเมินหรือออกจากระบบใช่หรือไม่?')) {
      setActiveUnit(null);
      setEvidenceFiles([]);
    }
  };

  // Filter items inside checklist panel
  const getFilteredItems = (): AssessmentItem[] => {
    const items = getItemsForPart(selectedPart);
    if (!searchTerm) return items;
    return items.filter(it => 
      it.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      it.code.includes(searchTerm) ||
      it.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased flex flex-col">
      {/* Dynamic Background Gradient Decorator */}
      <div className="absolute top-0 left-0 right-0 h-40 bg-teal-800/10 pointer-events-none" />

      {/* Sync Status Banner */}
      <div className="sticky top-0 z-40 bg-slate-900 text-white text-xs px-6 py-2.5 flex items-center justify-between border-b border-slate-700/50 backdrop-blur-md bg-opacity-95">
        <div className="flex items-center gap-1.5 font-medium">
          <Database className="h-4 w-4 text-emerald-400" />
          <span>ระบบคลาวด์ซิงค์ (Firebase Firestore) :</span>
          {activeUnit ? (
            <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {activeUnit.unitEmail}
            </span>
          ) : (
            <span className="text-slate-400">ยังไม่เชื่อมต่อ</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {cloudStatus === 'syncing' && (
            <span className="flex items-center gap-1 text-teal-300 font-semibold animate-pulse">
              <RefreshCw className="h-3 w-3 animate-spin" /> กำลังซิงค์คลาวด์แฝง...
            </span>
          )}
          {cloudStatus === 'success' && (
            <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5" /> บันทึกข้อมูลคลาวด์สำเร็จ!
            </span>
          )}
          {cloudStatus === 'error' && (
            <span className="text-rose-400 font-semibold flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" /> ซิงค์คลาวด์ผิดพลาด!
            </span>
          )}
          {cloudStatus === 'idle' && activeUnit && (
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>เชื่อมต่อฐานข้อมูลคลาวด์แบบเรียลไทม์ [✓ Online]</span>
            </span>
          )}

          {activeUnit && (
            <button 
              onClick={handleLogout} 
              className="text-slate-300 hover:text-white inline-flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded border border-slate-700 transition text-[10px] uppercase font-bold cursor-pointer"
            >
              <LogOut className="h-3 w-3" /> ออกระบบ / เปลี่ยนหน่วย
            </button>
          )}
        </div>
      </div>

      {/* Main Container */}
      {!activeUnit ? (
        <AuthModal onConfirm={handleAuthConfirm} isLoading={sessionLoading} externalError={authError} />
      ) : (
        <div className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 lg:p-8 space-y-6">
          
          {/* Dashboard Header Panel */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
            <div className="space-y-1.5 z-10 w-full md:w-auto">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-teal-600 text-white rounded-lg px-2.5 py-1 text-xs font-bold leading-normal uppercase">
                  ประจำปี พ.ศ. 2569
                </span>
                <span className="text-xs text-teal-800 font-bold bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-lg">
                  โรงพยาบาลมหาวิทยาลัยอุบลราชธานี
                </span>
                {sessionRole === 'supervisor' && (
                  <span className="text-xs text-indigo-800 font-bold bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg">
                    สิทธิ์ผู้นิเทศภายนอก (อ่านอย่างเดียว)
                  </span>
                )}
              </div>

              {sessionRole === 'supervisor' && allUnitsList.length > 0 ? (
                <div className="mt-3">
                  <label className="block text-[11px] font-bold text-indigo-900 mb-1">เลือกตรวจประเมินหน่วยงานในระบบคลาวด์:</label>
                  <select
                    value={activeUnit.id}
                    onChange={(e) => handleSwitchUnit(e.target.value)}
                    className="text-xs font-bold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-2 focus:border-indigo-500 outline-none w-full max-w-sm cursor-pointer transition shadow-xs"
                  >
                    {allUnitsList.map(unit => (
                      <option key={unit.id} value={unit.id}>
                        {unit.unitName} ({unit.unitEmail})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 mt-1">
                  {activeUnit.unitName}
                </h1>
              )}

              <p className="text-xs text-slate-500 font-medium">
                ที่ตั้งส่วนงาน: อำเภอ{activeUnit.district} จังหวัด{activeUnit.province}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap z-10 w-full md:w-auto">
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 text-xs font-semibold text-slate-700 shadow-xs transition cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>พิมพ์ / บันทึกรายงาน PDF</span>
              </button>
              <button 
                onClick={handleRefreshSupervisorData}
                className="inline-flex items-center gap-1.5 h-9 rounded-xl border border-teal-150 bg-teal-50 hover:bg-teal-100 px-4 text-xs font-semibold text-teal-800 shadow-xs transition cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>รีเฟรชสถิติล่าสุด</span>
              </button>
            </div>
            
            {/* Background Aesthetic Splashes */}
            <div className="absolute top-0 right-0 h-40 w-40 bg-teal-50 rounded-full blur-3xl -z-0 opacity-40 translate-x-12 -translate-y-12" />
          </div>

          {/* Stats Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Stat Card 1: Score Progress */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">คะแนนผลการประเมินรวม</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-slate-900">{calculateTotalScore()}</span>
                  <span className="text-slate-400 text-sm font-semibold">/ 335 คะแนน</span>
                </div>
                <p className="text-[10px] text-slate-500 font-medium">รวมผลลัพธ์จากข้อประเมิน 8 หมวดคุณภาพ</p>
              </div>
              <div className="h-16 w-16 flex items-center justify-center rounded-full bg-slate-50 border border-slate-100">
                <Award className="h-8 w-8 text-teal-600" />
              </div>
            </div>

            {/* Stat Card 2: Coverage Counter */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">ปริมาณข้อที่ได้รับการสำรวจ</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-teal-600">{countEvaluated()}</span>
                  <span className="text-slate-400 text-sm font-semibold">/ {ASSESSMENT_ITEMS.length} ข้อ</span>
                </div>
                {/* Horizontal Progress Bar */}
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
                  <div 
                    className="bg-teal-500 h-full transition-all duration-500" 
                    style={{ width: `${(countEvaluated() / ASSESSMENT_ITEMS.length) * 100}%` }}
                  />
                </div>
              </div>
              <div className="h-16 w-16 flex items-center justify-center rounded-full bg-teal-50 border border-teal-100/50">
                <Activity className="h-7 w-7 text-teal-600" />
              </div>
            </div>

            {/* Stat Card 3: Compliance Badge */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">สถานะผ่านมาตรฐานภาพรวม</span>
                <div className="mt-1">
                  {checkOverallCompliance() ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-800 text-xs font-bold border border-emerald-500/20">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      <span>ผ่านเกณฑ์ประเมินปี 2569</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-rose-800 text-xs font-bold border border-rose-500/20">
                      <CircleAlert className="h-4 w-4 text-rose-600" />
                      <span>ยังไม่ผ่านเกณฑ์มาตรฐาน</span>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 leading-normal mt-1.5">S1-S4 ต้องพรีเมี่ยมเต็ม และ S5-S8 ต้องผ่านมาไม่น้อยกว่าร้อยละ 80 ของแต่ละข้อ</p>
              </div>
              <div className="h-16 w-16 flex items-center justify-center rounded-full bg-emerald-50 border border-emerald-100/50">
                <Sparkles className="h-7 w-7 text-teal-600" />
              </div>
            </div>
          </div>

          {/* Core Content Layout Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Sidebar parts list (Col span 4) */}
            <div className="lg:col-span-4 space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1 mb-1">
                หมวดการประเมินแยกตามรายด้าน
              </h2>
              <div className="space-y-2">
                {ASSESSMENT_PARTS.map((part) => {
                  const hasPassed = isPartPassing(part.index);
                  const currentScore = calculatePartScore(part.index);
                  const isActive = selectedPart === part.index;

                  return (
                    <button
                      key={part.index}
                      onClick={() => setSelectedPart(part.index)}
                      className={`w-full hover:shadow-xs p-4 rounded-xl text-left border transition relative flex items-center justify-between cursor-pointer ${
                        isActive 
                          ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-700/10' 
                          : 'bg-white text-slate-800 border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <div className="space-y-1 max-w-[70%]">
                        <span className={`text-[10px] font-bold block uppercase tracking-wide ${isActive ? 'text-teal-100' : 'text-slate-400'}`}>
                          หมวดที่ {part.index}
                        </span>
                        <h4 className="text-xs font-bold tracking-tight line-clamp-1">
                          {part.title.split('ด้าน')[1] || part.title}
                        </h4>
                        <span className={`text-[10px] font-medium block truncate ${isActive ? 'text-teal-50' : 'text-slate-500'}`}>
                          {part.passingThresholdText}
                        </span>
                      </div>

                      <div className="text-right flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-sm font-black tracking-tight">
                          {currentScore} <span className={`text-[10px] font-normal ${isActive ? 'text-teal-100' : 'text-slate-400'}`}>/ {part.maxScore}</span>
                        </span>
                        {hasPassed ? (
                          <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[8px] font-bold border ${
                            isActive 
                              ? 'bg-emerald-400/20 text-emerald-250 border-emerald-400/30' 
                              : 'bg-emerald-500/10 text-emerald-800 border-emerald-500/20'
                          }`}>
                            ผ่านเกณฑ์
                          </span>
                        ) : (
                          <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[8px] font-bold border ${
                            isActive 
                              ? 'bg-rose-400/20 text-rose-250 border-rose-450/30' 
                              : 'bg-rose-500/10 text-rose-800 border-rose-500/20'
                          }`}>
                            ไม่ผ่าน
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Main Checklist panel (Col span 8) */}
            <div className="lg:col-span-8 space-y-4">
              
              {/* Category summary header cards */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="space-y-1">
                  <span className="text-xs text-teal-600 font-bold tracking-wide">
                    {ASSESSMENT_PARTS[selectedPart - 1].title}
                  </span>
                  <h2 className="text-base font-bold text-slate-900">
                    รายการตรวจประเมินแยกแยะทีละข้อ (จำนวน {getItemsForPart(selectedPart).length} ข้อรายละเอียด)
                  </h2>
                  <p className="text-xs text-slate-500 leading-normal">
                    {ASSESSMENT_PARTS[selectedPart - 1].description}
                  </p>
                </div>

                {/* Inline filter search input */}
                <div className="mt-4 flex max-w-md items-center gap-2 border border-slate-200 bg-slate-50 rounded-xl px-3 py-1.5 focus-within:bg-white focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500 transition">
                  <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="ป้อนรหัส เช่น 1.1 หรือคำค้นหา เช่น แพทย์, วัคซีน"
                    className="w-full text-xs font-semibold text-slate-900 border-none outline-none bg-transparent"
                  />
                </div>
              </div>

              {/* Items checklist */}
              <div className="space-y-3">
                {getFilteredItems().map((it) => {
                  const score = activeUnit.scores[it.id] || 0;
                  const itemNote = activeUnit.notes[it.id] || '';
                  const itemFilesCount = evidenceFiles.filter(f => f.itemId === it.id).length;

                  return (
                    <motion.div
                      key={it.id}
                      layout="position"
                      className="bg-white rounded-2xl p-5 shadow-xs border border-slate-100 hover:border-slate-200 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1 max-w-[80%]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex h-5 items-center justify-center rounded-lg bg-slate-100 px-2 text-[10px] font-bold text-slate-600">
                            ข้อ {it.code}
                          </span>
                          
                          {/* File Counter Badge */}
                          {itemFilesCount > 0 && (
                            <span className="inline-flex items-center gap-1 h-5 rounded-lg bg-teal-50 px-2 text-[10px] font-bold text-teal-700 border border-teal-100">
                              <FileText className="h-3 w-3" />
                              <span>เอกสารแนบ {itemFilesCount} ไฟล์</span>
                            </span>
                          )}

                          {itemNote && (
                            <span className="inline-flex h-5 items-center justify-center rounded-lg bg-indigo-50 px-2 text-[10px] font-bold text-indigo-700 border border-indigo-100">
                              มีบันทึกรายงาน
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-bold text-slate-900 leading-normal">
                          {it.name}
                        </h4>
                        
                        <p className="text-xs text-slate-500 leading-normal line-clamp-1">
                          {it.description}
                        </p>
                        
                        {itemNote && (
                          <div className="rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-600 border border-slate-100 max-w-full truncate">
                            <strong>บันทึก:</strong> {itemNote}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-2 border-t md:border-t-0 pt-3 md:pt-0 border-slate-50">
                        <div className="text-left md:text-right">
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">ผลคะแนนที่ได้</p>
                          <span className="text-sm font-black text-slate-900">
                            {score} <span className="text-[10px] text-slate-400 font-normal">/ {it.maxScore}</span>
                          </span>
                        </div>

                        <button
                          onClick={() => setEvaluatedItem(it)}
                          className={`inline-flex items-center gap-1 h-8 rounded-lg text-white px-3 text-xs font-semibold shadow-sm transition hover:shadow-md cursor-pointer ${
                            sessionRole === 'supervisor' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-teal-600 hover:bg-teal-700'
                          }`}
                        >
                          <span>{sessionRole === 'supervisor' ? 'ตรวจดูหลักฐานหลัก' : 'ประเมินและแนบข้อมูล'}</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}

                {getFilteredItems().length === 0 && (
                  <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center">
                    <HelpCircle className="h-10 w-10 text-slate-400 mx-auto mb-2" />
                    <h3 className="text-sm font-bold text-slate-800">ไม่พบคำค้นหาหรือตัวชี้วัดในหมวดนี้</h3>
                    <p className="text-xs text-slate-500 mt-1">กรุณาลองป้อนหมวดหมู่ รหัสย่อย หรือลองล้างคำค้นหา</p>
                  </div>
                )}
              </div>

            </div>
          </div>
          
          {/* Printable Report View (Visible only during window.print()) */}
          <div className="hidden print:block bg-white text-black p-8 font-sans space-y-6" id="printable-area">
            <div className="text-center space-y-2 border-b-2 border-black pb-4">
              <h1 className="text-2xl font-black">ใบรายงานผลสรุปตัวประเมินพัฒนาคุณภาพและมาตรฐานปฐมภูมิ</h1>
              <h2 className="text-lg font-bold">ข้อมูลการรับการประเมินประจำปีงบประมาณ พ.ศ. 2569</h2>
              <div className="text-sm space-y-1">
                <p><strong>ชื่อหน่วยบริการ:</strong> {activeUnit.unitName} (อำเภอ{activeUnit.district} จังหวัด{activeUnit.province})</p>
                <p><strong>อีเมลประสานงาน:</strong> {activeUnit.unitEmail}</p>
                <p><strong>วันที่ตรวจพยานหลักฐาน:</strong> {new Date().toLocaleDateString('th-TH')}</p>
              </div>
            </div>

            <table className="w-full text-sm border-collapse border border-black">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-black p-2 text-left">หมวดหมู่คุณภาพการประเมิน</th>
                  <th className="border border-black p-2 text-center w-24">คะแนนเต็ม</th>
                  <th className="border border-black p-2 text-center w-24">คะแนนที่ได้</th>
                  <th className="border border-black p-2 text-center w-28">เกณฑ์ผลลัพธ์</th>
                </tr>
              </thead>
              <tbody>
                {ASSESSMENT_PARTS.map((part) => (
                  <tr key={part.index}>
                    <td className="border border-black p-2">
                      <strong>หมวดที่ {part.index}:</strong> {part.title}
                    </td>
                    <td className="border border-black p-2 text-center">{part.maxScore}</td>
                    <td className="border border-black p-2 text-center font-bold">{calculatePartScore(part.index)}</td>
                    <td className="border border-black p-2 text-center">
                      {isPartPassing(part.index) ? 'ผ่านเกณฑ์ ✓' : 'ไม่ผ่านเกณฑ์ ✗'}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold">
                  <td className="border border-black p-2 text-right">สรุปผลยอดรวมภาพรวมของระบบปฐมภูมิ</td>
                  <td className="border border-black p-2 text-center">335</td>
                  <td className="border border-black p-2 text-center text-lg font-black">{calculateTotalScore()}</td>
                  <td className="border border-black p-2 text-center">
                    {checkOverallCompliance() ? 'ผ่านการรับรอง ✓' : 'ไม่ผ่านการรับรอง ✗'}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="grid grid-cols-2 gap-12 pt-16 text-center text-sm">
              <div className="space-y-12">
                <p>ลงชื่อ............................................................<br />( พยานประเมินผู้ตรวจวิเคราะห์ )</p>
                <p>ผู้ควบคุมกำกับด้านแล็บและระบบแพทย์</p>
              </div>
              <div className="space-y-12">
                <p>ลงชื่อ............................................................<br />( เจ้าหน้าที่หรือผู้อำนวยการหน่วยบริการ )</p>
                <p>ผู้รับการประเมินคุณภาพและมาตรฐานหลัก</p>
              </div>
            </div>
          </div>

          {/* Render Active Evaluation Modal Dialog */}
          <AnimatePresence>
            {evaluatedItem && (
              <ItemEvaluationModal
                item={evaluatedItem}
                currentScore={activeUnit.scores[evaluatedItem.id] || 0}
                currentNote={activeUnit.notes[evaluatedItem.id] || ''}
                files={evidenceFiles}
                assessmentId={activeUnit.id}
                role={sessionRole}
                onClose={() => setEvaluatedItem(null)}
                onSaveItem={handleSaveEvaluation}
                onFilesChanged={() => reloadFilesList(activeUnit.id)}
              />
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
