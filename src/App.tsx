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
  CircleAlert,
  History,
  UserCheck,
  Clock,
  User,
  ShieldCheck,
  Building,
  MessageSquare
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
  EvidenceFileMeta,
  getActivityLogs,
  logActivity,
  ActivityLog
} from './dbService';
import AuthModal from './components/AuthModal';
import { HOSPITAL_LOGO_BASE64 } from './config';
import ItemEvaluationModal from './components/ItemEvaluationModal';
import UserManagementModal from './components/UserManagementModal';
import { 
  collection, 
  doc, 
  onSnapshot, 
  query 
} from 'firebase/firestore';
import { db } from './firebase';

import HistoryModal from './components/HistoryModal';

export default function App() {
  // Session UI states
  const [activeUnit, setActiveUnit] = useState<AssessmentData | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFileMeta[]>([]);
  
  // Dual-role states
  const [sessionRole, setSessionRole] = useState<'editor' | 'supervisor' | 'admin'>('editor');
  const [allUnitsList, setAllUnitsList] = useState<AssessmentData[]>([]);

  // User info and logging states
  const [currentUserInfo, setCurrentUserInfo] = useState<{
    email: string;
    displayName?: string;
    name: string;
    role: 'editor' | 'supervisor' | 'admin';
  } | null>(null);

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [logActionFilter, setLogActionFilter] = useState<'all' | 'edit_evaluation' | 'upload_file' | 'delete_file'>('all');

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);

  const reloadActivityLogs = async () => {
    try {
      setLogsLoading(true);
      const logs = await getActivityLogs();
      setActivityLogs(logs);
    } catch (err) {
      console.error("Failed to load activity logs:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  // Selection/Evaluation states
  const [selectedPart, setSelectedPart] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [evaluatedItem, setEvaluatedItem] = useState<AssessmentItem | null>(null);
  
  // Sync status
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [authError, setAuthError] = useState<string>('');
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  // 1. Subscribe to all assessments (supervisor/guest view) - Restricted to the single unified hospital dataset
  useEffect(() => {
    if (!currentUserInfo || sessionRole !== 'supervisor') {
      return;
    }
    
    const colRef = collection(db, 'assessments');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const list: AssessmentData[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as AssessmentData;
        if (data.id === 'primarycareunit_ubuh_ubu_ac_th') {
          list.push(data);
        }
      });
      if (list.length === 0) {
        list.push({
          id: 'primarycareunit_ubuh_ubu_ac_th',
          unitEmail: 'primarycareunit.ubuh@ubu.ac.th',
          unitName: 'โรงพยาบาลมหาวิทยาลัยอุบลราชธานี',
          district: 'วารินชำราบ',
          province: 'อุบลราชธานี',
          scores: {},
          notes: {},
          updatedAt: new Date().toISOString()
        });
      }
      setAllUnitsList(list);
    }, (error) => {
      console.error("Realtime assessments sync error:", error);
    });

    return () => unsubscribe();
  }, [currentUserInfo, sessionRole]);

  // 2. Subscribe to active assessment document
  useEffect(() => {
    if (!currentUserInfo || !activeUnit || !activeUnit.id || activeUnit.id === 'no_data') {
      return;
    }

    const docId = activeUnit.id;
    const docRef = doc(db, 'assessments', docId);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const updatedData = docSnap.data() as AssessmentData;
        
        setActiveUnit((prevActive) => {
          if (!prevActive) return updatedData;
          if (
            prevActive.id === updatedData.id &&
            prevActive.updatedAt === updatedData.updatedAt &&
            JSON.stringify(prevActive.scores) === JSON.stringify(updatedData.scores) &&
            JSON.stringify(prevActive.notes) === JSON.stringify(updatedData.notes)
          ) {
            return prevActive;
          }
          return updatedData;
        });
      }
    }, (error) => {
      console.error(`Realtime active unit sync error for ${docId}:`, error);
    });

    return () => unsubscribe();
  }, [currentUserInfo, activeUnit?.id]);

  // 3. Subscribe to the files subcollection of the active unit in real-time
  useEffect(() => {
    if (!currentUserInfo || !activeUnit || !activeUnit.id || activeUnit.id === 'no_data') {
      setEvidenceFiles([]);
      return;
    }

    const docId = activeUnit.id;
    const filesColRef = collection(db, 'assessments', docId, 'files');
    
    const unsubscribe = onSnapshot(filesColRef, (snapshot) => {
      const files: EvidenceFileMeta[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        files.push({
          id: data.id,
          itemId: data.itemId,
          name: data.name,
          type: data.type,
          size: data.size,
          uploadedAt: data.uploadedAt
        });
      });
      const sortedFiles = files.sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''));
      setEvidenceFiles(sortedFiles);
    }, (error) => {
      console.error(`Realtime evidence files sync error for ${docId}:`, error);
    });

    return () => unsubscribe();
  }, [currentUserInfo, activeUnit?.id]);

  // 4. Subscribe to activity logs in real-time for the admin account
  useEffect(() => {
    if (!currentUserInfo || (currentUserInfo.email !== 'primarycareunit.ubuh@ubu.ac.th' && currentUserInfo.role !== 'admin')) {
      return;
    }

    const logsColRef = collection(db, 'activity_logs');
    
    const unsubscribe = onSnapshot(logsColRef, (snapshot) => {
      const list: ActivityLog[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as ActivityLog);
      });
      const sorted = list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setActivityLogs(sorted);
    }, (error) => {
      console.error("Realtime activity logs sync error:", error);
    });

    return () => unsubscribe();
  }, [currentUserInfo]);

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
    displayName?: string;
    name: string;
    district: string;
    province: string;
    role: 'editor' | 'supervisor' | 'admin';
  }) => {
    setSessionLoading(true);
    setAuthError('');
    setSessionRole(info.role);
    
    // Force all accounts to use the single central database instance of Ubon Ratchathani University Hospital
    const HOSPITAL_DOC_ID = 'primarycareunit_ubuh_ubu_ac_th';
    const docId = HOSPITAL_DOC_ID;

    try {
      const existing = await getAssessment(docId);
      if (existing) {
        setActiveUnit(existing);
        await reloadFilesList(existing.id);
      } else {
        // Build empty state for the central hospital record
        const initialScores: Record<string, number> = {};
        const initialNotes: Record<string, string> = {};
        ASSESSMENT_ITEMS.forEach(it => {
          initialScores[it.id] = 0;
          initialNotes[it.id] = '';
        });

        const freshUnit: AssessmentData = {
          id: HOSPITAL_DOC_ID,
          unitEmail: 'primarycareunit.ubuh@ubu.ac.th',
          unitName: 'โรงพยาบาลมหาวิทยาลัยอุบลราชธานี',
          district: 'วารินชำราบ',
          province: 'อุบลราชธานี',
          scores: initialScores,
          notes: initialNotes,
          updatedAt: new Date().toISOString()
        };
        await saveAssessment(freshUnit);
        setActiveUnit(freshUnit);
        setEvidenceFiles([]);
      }

      // Populate list with the single hospital unit for display and compatibility
      const currentUnit = existing || {
        id: HOSPITAL_DOC_ID,
        unitEmail: 'primarycareunit.ubuh@ubu.ac.th',
        unitName: 'โรงพยาบาลมหาวิทยาลัยอุบลราชธานี',
        district: 'วารินชำราบ',
        province: 'อุบลราชธานี',
        scores: {},
        notes: {},
        updatedAt: new Date().toISOString()
      };
      setAllUnitsList([currentUnit]);
      
      setCurrentUserInfo({ email: info.email, displayName: info.displayName, name: info.name, role: info.role });
      
      // Load logs for admin
      if (info.email === 'primarycareunit.ubuh@ubu.ac.th' || info.role === 'admin') {
        try {
          const logs = await getActivityLogs();
          setActivityLogs(logs);
        } catch (err) {
          console.error("Failed to load initial admin activity logs:", err);
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
    setCloudStatus('syncing');
    try {
      const HOSPITAL_DOC_ID = 'primarycareunit_ubuh_ubu_ac_th';
      const singleUnit = await getAssessment(HOSPITAL_DOC_ID);
      if (singleUnit) {
        setActiveUnit(singleUnit);
        setAllUnitsList([singleUnit]);
        await reloadFilesList(HOSPITAL_DOC_ID);
      }
      if (currentUserInfo?.email === 'primarycareunit.ubuh@ubu.ac.th' || currentUserInfo?.role === 'admin') {
        await reloadActivityLogs();
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
      
      try {
        const userEmail = currentUserInfo?.email || activeUnit.unitEmail;
        const userName = currentUserInfo?.name || activeUnit.unitName;
        await logActivity(
          userEmail,
          currentUserInfo?.displayName,
          userName,
          'edit_evaluation',
          `แก้ไขการประเมินคะแนนเป็น ${score} คะแนน, บันทึก: ${note || '(ว่างเปล่า)'}`,
          evaluatedItem.id,
          evaluatedItem.code,
          evaluatedItem.name
        );
        if (currentUserInfo?.email === 'primarycareunit.ubuh@ubu.ac.th' || currentUserInfo?.role === 'admin') {
          const logs = await getActivityLogs();
          setActivityLogs(logs);
        }
      } catch (logErr) {
        console.error("Failed to log score/note update activity:", logErr);
      }

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
    setActiveUnit(null);
    setEvidenceFiles([]);
    setCurrentUserInfo(null);
    setLogoutConfirm(false);
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
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 antialiased flex flex-col relative overflow-x-hidden font-sans">
      {/* Dynamic Background Gradient Decorator - Softened for a friendly vibe */}
      <div className="absolute top-0 left-0 right-0 h-[50vh] bg-gradient-to-b from-teal-50/80 via-emerald-50/40 to-transparent pointer-events-none" />
      <div className="absolute top-[-10%] -left-64 h-[40rem] w-[40rem] bg-teal-200/20 rounded-full blur-[100px] pointer-events-none mix-blend-multiply" />
      <div className="absolute top-[10%] -right-64 h-[40rem] w-[40rem] bg-emerald-200/20 rounded-full blur-[100px] pointer-events-none mix-blend-multiply" />

      {/* Sync Status Banner */}
      <div className="sticky top-0 z-40 bg-slate-900 text-white text-xs px-6 py-2.5 flex items-center justify-between border-b border-slate-700/50 backdrop-blur-md bg-opacity-95">
        <div className="flex items-center gap-1.5 font-medium">
          <Database className="h-4 w-4 text-emerald-400" />
          <span>ระบบคลาวด์ซิงค์ (Firebase Firestore) :</span>
          {activeUnit ? (
            <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {activeUnit.unitEmail} {(currentUserInfo?.email === 'primarycareunit.ubuh@ubu.ac.th' || currentUserInfo?.role === 'admin') && ' [สิทธิ์แอดมิน 👑]'}
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
            <div className="flex items-center gap-1.5">
              {logoutConfirm ? (
                <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded-md border border-red-500/30 animate-fade-in text-[10px] text-red-200 font-sans font-medium">
                  <span>ยืนยันออกระบบ?</span>
                  <button
                    onClick={handleLogout}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold px-2 py-0.5 rounded cursor-pointer transition text-[9px]"
                  >
                    ใช่
                  </button>
                  <button
                    onClick={() => setLogoutConfirm(false)}
                    className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold px-2 py-0.5 rounded cursor-pointer transition text-[9px]"
                  >
                    ยกเลิก
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setLogoutConfirm(true)} 
                  className="text-slate-300 hover:text-white inline-flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded border border-slate-700 transition text-[10px] uppercase font-bold cursor-pointer"
                >
                  <LogOut className="h-3 w-3" /> ออกระบบ / เปลี่ยนหน่วย
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Container */}
      {!activeUnit ? (
        <AuthModal onConfirm={handleAuthConfirm} isLoading={sessionLoading} externalError={authError} />
      ) : (
        <div className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 lg:p-8 space-y-6">
          {sessionRole === 'editor' && (
            <div className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-2xl p-5 border border-teal-100/60 shadow-sm relative overflow-hidden group transition-all">
              <div className="flex items-start gap-3 relative z-10">
                <div className="mt-0.5 bg-white p-2 rounded-xl border border-teal-100 shadow-xs">
                  <ShieldCheck className="h-5 w-5 text-teal-600" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-teal-900">สิทธิ์ผู้ประเมินร่วมและสัญญะผู้บริหารสูงสุด</h4>
                  <p className="text-[12px] text-teal-800 leading-relaxed font-medium">
                    อนุญาตให้กรอกคะแนน ประเมินมาตรฐาน แนบรายละเอียดย่อย หรืออัปโหลดไฟล์หลักฐาน (Word / PDF / รูปภาพ) และสิทธิ์ดาวน์โหลดตรวจสอบข้อมูลได้ตามปกติในระบบ
                  </p>
                  <div className="bg-white/80 rounded-xl p-3 border border-teal-100/50 text-[11px] text-slate-700 space-y-2 font-medium">
                    <p>👑 <strong className="text-purple-600 mx-1">ผู้ดูแลระบบ (Admin)</strong> ได้รับสิทธิ์ตรวจสอบประวัติย้อนหลังและจัดการสิทธิ์ผู้ใช้งานได้</p>
                    <p>📧 <strong className="text-teal-900 mx-1">ผู้ประเมิน (Editor)</strong> ร่วมประเมินคะแนนและอัปโหลดหลักฐานเข้าฐานข้อมูล</p>
                    <p>👀 <strong className="text-indigo-600 mx-1">ผู้นิเทศ (Supervisor)</strong> มีสิทธิ์อ่านประเมินอย่างเดียว</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Dashboard Header Panel */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/70 backdrop-blur-2xl rounded-[3rem] p-8 px-10 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-white flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative overflow-hidden"
          >
            <div className="space-y-4 z-10 w-full md:w-auto">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-gradient-to-r from-teal-500 to-emerald-400 text-white rounded-full px-4 py-1.5 text-[11px] font-bold leading-normal uppercase shadow-sm">
                  ประจำปี พ.ศ. 2569
                </span>
                <span className="bg-slate-800 text-white rounded-full px-4 py-1.5 text-[11px] font-bold leading-normal shadow-sm">
                  เกณฑ์รอบปี พ.ศ. 2568 - 2570
                </span>
                <span className="text-[11px] text-teal-700 font-bold bg-teal-50 border border-teal-100/50 px-4 py-1.5 rounded-full">
                  โรงพยาบาลมหาวิทยาลัยอุบลราชธานี
                </span>
                {currentUserInfo && (
                  <span className="text-[11px] text-emerald-800 font-extrabold bg-emerald-50 border border-emerald-100 px-4 py-1.5 rounded-full flex items-center gap-1.5 animate-fade-in">
                    <User className="h-3.5 w-3.5 text-emerald-600" />
                    <span>ผู้ใช้งานระบบ: {currentUserInfo.displayName || currentUserInfo.name}</span>
                    {(currentUserInfo.email === 'primarycareunit.ubuh@ubu.ac.th' || currentUserInfo.role === 'admin') && <span className="text-purple-600 font-black ml-1">(ผู้ดูแลระบบสูงสุด 👑)</span>}
                  </span>
                )}
                {sessionRole === 'supervisor' && (
                  <span className="text-[11px] text-indigo-700 font-bold bg-indigo-50 border border-indigo-100 px-4 py-1.5 rounded-full flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    สิทธิ์ผู้นิเทศภายนอก (อ่านอย่างเดียว)
                  </span>
                )}
              </div>

              <div className="flex items-start md:items-center gap-4 mt-3">
                {HOSPITAL_LOGO_BASE64 && (
                  <div className="flex h-16 w-16 md:h-20 md:w-20 shrink-0 items-center justify-center rounded-[1.5rem] bg-white shadow-sm border border-slate-100 overflow-hidden p-2 mt-1 md:mt-0">
                     <img src={HOSPITAL_LOGO_BASE64} alt="Hospital Logo" className="h-full w-full object-contain drop-shadow-sm rounded-lg" />
                  </div>
                )}
                <div className="flex-1 w-full space-y-2">
                  {sessionRole === 'supervisor' && allUnitsList.length > 1 ? (
                    <div>
                      <label className="block text-[11px] font-bold text-indigo-900 mb-2 pl-1">เลือกตรวจประเมินหน่วยงานในระบบคลาวด์:</label>
                      <select
                        value={activeUnit.id}
                        onChange={(e) => handleSwitchUnit(e.target.value)}
                        className="text-[13px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none w-full max-w-sm cursor-pointer transition shadow-sm"
                      >
                        {allUnitsList.map(unit => (
                          <option key={unit.id} value={unit.id}>
                            {unit.unitName} ({unit.unitEmail})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-800">
                      {activeUnit.unitName}
                    </h1>
                  )}

                  <p className="text-sm text-slate-500 font-medium font-sans flex items-center gap-1.5">
                    <Building className="h-4 w-4 text-slate-400" />
                    {activeUnit.district || activeUnit.province ? (
                      `ที่ตั้งส่วนงาน: ${activeUnit.district ? `อำเภอ${activeUnit.district}` : ''} ${activeUnit.province ? `จังหวัด${activeUnit.province}` : ''}`
                    ) : (
                      `ข้อมูลผู้ประสานงานหลัก: ${activeUnit.unitEmail}`
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap z-10 w-full md:w-auto">
              {(currentUserInfo?.email === 'primarycareunit.ubuh@ubu.ac.th' || currentUserInfo?.role === 'admin') && (
                <>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowUserManagement(true)}
                    className="inline-flex items-center gap-2 h-14 rounded-full border-2 border-purple-100 bg-purple-50 hover:bg-purple-100 px-6 text-[15px] font-bold text-purple-600 shadow-[0_4px_15px_rgb(0,0,0,0.03)] hover:shadow-[0_4px_15px_rgb(0,0,0,0.06)] transition-all cursor-pointer"
                  >
                    <UserCheck className="h-4 w-4" />
                    <span>จัดการสิทธิ์</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowHistoryModal(true)}
                    className="inline-flex items-center gap-2 h-14 rounded-full border-2 border-orange-100 bg-orange-50 hover:bg-orange-100 px-6 text-[15px] font-bold text-orange-600 shadow-[0_4px_15px_rgb(0,0,0,0.03)] hover:shadow-[0_4px_15px_rgb(0,0,0,0.06)] transition-all cursor-pointer"
                  >
                    <History className="h-4 w-4" />
                    <span>ดูประวัติการใช้งาน</span>
                  </motion.button>
                </>
              )}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handlePrint}
                className="inline-flex items-center gap-2 h-14 rounded-full border-2 border-slate-100 bg-white hover:border-slate-200 px-6 text-[15px] font-bold text-slate-600 shadow-[0_4px_15px_rgb(0,0,0,0.03)] hover:shadow-[0_4px_15px_rgb(0,0,0,0.06)] transition-all cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>พิมพ์ / บันทึกรายงาน</span>
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleRefreshSupervisorData}
                className="inline-flex items-center gap-2 h-14 rounded-full border border-teal-100 bg-teal-50 hover:bg-teal-100 hover:border-teal-200 px-6 text-[15px] font-bold text-teal-700 shadow-[0_4px_15px_rgb(0,128,128,0.05)] transition-all cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" />
                <span>รีเฟรชข้อมูล</span>
              </motion.button>
            </div>
            
            {/* Background Aesthetic Splashes */}
            <div className="absolute top-0 right-0 h-[30rem] w-[30rem] bg-gradient-to-bl from-teal-200/30 to-emerald-200/10 rounded-full blur-3xl opacity-60 translate-x-32 -translate-y-32 pointer-events-none" />
          </motion.div>

          {/* Stats Bento Grid */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            
            {/* Stat Card 1: Score Progress */}
            <div className="bg-white/70 backdrop-blur-2xl rounded-[2.5rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-white flex items-center justify-between group hover:shadow-[0_12px_40px_rgb(0,0,0,0.04)] transition-all duration-500">
              <div className="space-y-1.5">
                <span className="text-[11px] font-extrabold tracking-widest text-slate-400 uppercase">คะแนนผลการประเมินรวม</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-slate-800">{calculateTotalScore()}</span>
                  <span className="text-slate-400 text-sm font-bold">/ 335 คะแนน</span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">รวมผลลัพธ์จากข้อประเมิน 8 หมวดคุณภาพ</p>
              </div>
              <div className="h-20 w-20 flex items-center justify-center rounded-[1.5rem] bg-teal-50 border border-teal-100 group-hover:scale-105 group-hover:-rotate-3 transition-transform duration-500 shadow-sm text-teal-600">
                <Award className="h-9 w-9" />
              </div>
            </div>

            {/* Stat Card 2: Coverage Counter */}
            <div className="bg-white/70 backdrop-blur-2xl rounded-[2.5rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-white flex items-center justify-between group hover:shadow-[0_12px_40px_rgb(0,0,0,0.04)] transition-all duration-500">
              <div className="space-y-1.5 w-full pr-6">
                <span className="text-[11px] font-extrabold tracking-widest text-slate-400 uppercase">ประมาณการสำรวจ</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-emerald-500">{countEvaluated()}</span>
                  <span className="text-slate-400 text-sm font-bold">/ {ASSESSMENT_ITEMS.length} ข้อ</span>
                </div>
                {/* Horizontal Progress Bar */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-3 shadow-inner">
                  <div 
                    className="bg-gradient-to-r from-emerald-400 to-teal-500 h-full transition-all duration-1000 ease-out" 
                    style={{ width: `${(countEvaluated() / ASSESSMENT_ITEMS.length) * 100}%` }}
                  />
                </div>
              </div>
              <div className="h-20 w-20 shrink-0 flex items-center justify-center rounded-[1.5rem] bg-emerald-50 border border-emerald-100 group-hover:scale-105 group-hover:rotate-3 transition-transform duration-500 shadow-sm text-emerald-500">
                <Activity className="h-9 w-9" />
              </div>
            </div>

            {/* Stat Card 3: Compliance Badge */}
            <div className="bg-white/70 backdrop-blur-2xl rounded-[2.5rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-white flex items-center justify-between group hover:shadow-[0_12px_40px_rgb(0,0,0,0.04)] transition-all duration-500">
              <div className="space-y-2.5">
                <span className="text-[11px] font-extrabold tracking-widest text-slate-400 uppercase">สถานะผ่านมาตรฐาน</span>
                <div className="mt-1">
                  {checkOverallCompliance() ? (
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-[13px] font-bold border border-emerald-200">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      <span>ผ่านเกณฑ์ประเมินปี 2569</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-50 text-rose-600 text-[13px] font-bold border border-rose-200">
                      <CircleAlert className="h-4 w-4 text-rose-500" />
                      <span>ยังไม่ผ่านเกณฑ์มาตรฐาน</span>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed max-w-[200px]">
                  S1-S4 ต้องพรีเมี่ยมเต็ม และ S5-S8 ต้องผ่านมาไม่น้อยกว่าร้อยละ 80 อย่างถูกต้อง
                </p>
              </div>
              <div className="h-20 w-20 shrink-0 flex items-center justify-center rounded-[1.5rem] bg-cyan-50 border border-cyan-100 group-hover:scale-105 group-hover:-rotate-3 transition-transform duration-500 shadow-sm text-cyan-500">
                <Sparkles className="h-9 w-9" />
              </div>
            </div>
          </motion.div>

          {/* Core Content Layout Split */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
          >
            
            {/* Sidebar parts list (Col span 4) */}
            <div className="lg:col-span-4 space-y-4">
              <h2 className="text-[13px] font-extrabold uppercase tracking-widest text-slate-400 px-2 pb-1">
                หมวดการประเมินแยกตามรายด้าน
              </h2>
              <div className="space-y-3">
                {ASSESSMENT_PARTS.map((part, index) => {
                  const hasPassed = isPartPassing(part.index);
                  const currentScore = calculatePartScore(part.index);
                  const isActive = selectedPart === part.index;

                  return (
                    <motion.button
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * index }}
                      key={part.index}
                      onClick={() => setSelectedPart(part.index)}
                      className={`w-full hover:shadow-md p-5 rounded-[2rem] text-left border-2 transition-all duration-300 relative flex items-center justify-between cursor-pointer group ${
                        isActive 
                          ? 'bg-teal-500 text-white border-teal-500 shadow-[0_8px_30px_rgba(20,184,166,0.3)] ring-4 ring-teal-500/10' 
                          : 'bg-white/70 backdrop-blur-2xl text-slate-700 border-white hover:border-teal-200'
                      }`}
                    >
                      <div className="space-y-1 max-w-[70%]">
                        <span className={`text-[11px] font-extrabold block uppercase tracking-wider ${isActive ? 'text-teal-100' : 'text-slate-400 group-hover:text-teal-600 transition-colors'}`}>
                          หมวดที่ {part.index}
                        </span>
                        <h4 className={`text-[15px] leading-tight font-extrabold tracking-tight line-clamp-2 ${isActive ? 'text-white' : 'text-slate-800 group-hover:text-teal-900 transition-colors'}`}>
                          {part.title.split('ด้าน')[1] || part.title}
                        </h4>
                        <span className={`text-[11px] font-medium block truncate ${isActive ? 'text-teal-50' : 'text-slate-500'}`}>
                          {part.passingThresholdText}
                        </span>
                      </div>

                      <div className="text-right flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span className="text-xl font-black tracking-tight">
                          {currentScore} <span className={`text-[11px] font-bold ${isActive ? 'text-teal-100' : 'text-slate-400'}`}>/ {part.maxScore}</span>
                        </span>
                        {hasPassed ? (
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold border ${
                            isActive 
                              ? 'bg-white/20 text-white border-white/20' 
                              : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          }`}>
                            ผ่านเกณฑ์
                          </span>
                        ) : (
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold border ${
                            isActive 
                              ? 'bg-rose-400/20 text-rose-50 border-rose-400/30' 
                              : 'bg-rose-50 text-rose-500 border-rose-100'
                          }`}>
                            ไม่ผ่าน
                          </span>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Main Checklist panel (Col span 8) */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Category summary header cards */}
              <div className="bg-white/70 backdrop-blur-2xl rounded-[3rem] p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-white relative overflow-hidden group">
                <div className="absolute top-0 right-0 h-48 w-48 bg-gradient-to-br from-teal-200/40 to-emerald-200/20 rounded-full blur-[60px] pointer-events-none -translate-y-10 translate-x-10"></div>
                <div className="space-y-2 relative z-10">
                  <span className="text-[13px] text-teal-600 font-extrabold tracking-widest uppercase flex items-center gap-2">
                    {ASSESSMENT_PARTS[selectedPart - 1].title}
                  </span>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 leading-tight">
                    รายการตรวจประเมินแยกแยะทีละข้อ
                  </h2>
                  <p className="text-sm font-medium text-slate-500 leading-relaxed pt-1">
                    {ASSESSMENT_PARTS[selectedPart - 1].description} <span className="font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md ml-1">จำนวน {getItemsForPart(selectedPart).length} ข้อรายละเอียด</span>
                  </p>
                </div>

                {/* Inline filter search input */}
                <div className="mt-8 flex max-w-lg items-center gap-3 border-2 border-slate-100 bg-white/60 backdrop-blur-md rounded-full px-5 py-3 focus-within:bg-white focus-within:border-teal-400 focus-within:shadow-md transition-all duration-300 relative z-10 shadow-sm group-hover:shadow-md">
                  <Search className="h-5 w-5 text-slate-400 flex-shrink-0 group-focus-within:text-teal-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="ป้อนรหัส เช่น 1.1 หรือคำค้นหา เช่น แพทย์, วัคซีน"
                    className="w-full text-[15px] font-semibold text-slate-700 border-none outline-none bg-transparent placeholder:text-slate-400 placeholder:font-medium"
                  />
                </div>
              </div>

              {/* Items checklist */}
              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                {getFilteredItems().map((it, index) => {
                  const score = activeUnit.scores[it.id] || 0;
                  const itemNote = activeUnit.notes[it.id] || '';
                  const itemFilesCount = evidenceFiles.filter(f => f.itemId === it.id).length;

                  return (
                    <motion.div
                      key={it.id}
                      layout="position"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                      className="bg-white/80 backdrop-blur-2xl rounded-[2.5rem] p-7 md:p-8 shadow-[0_4px_20px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white hover:border-teal-100 transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-6 group"
                    >
                      <div className="space-y-2.5 max-w-[75%]">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-extrabold text-slate-600 border border-slate-200 shadow-sm">
                            ข้อ {it.code}
                          </span>
                          
                          {/* File Counter Badge */}
                          {itemFilesCount > 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1 text-[11px] font-bold text-indigo-600 border border-indigo-100 shadow-sm">
                              <FileText className="h-3 w-3" />
                              <span>แนบแล้ว {itemFilesCount} ไฟล์</span>
                            </span>
                          )}

                          {itemNote && (
                            <span className="inline-flex items-center rounded-lg bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-600 border border-amber-100 shadow-sm gap-1.5">
                              <MessageSquare className="h-3 w-3" />
                              มีบันทึกรายงาน
                            </span>
                          )}
                        </div>

                        <h4 className="text-[17px] font-extrabold text-slate-800 leading-snug group-hover:text-teal-900 transition-colors">
                          {it.name}
                        </h4>
                        
                        <p className="text-[13px] font-medium text-slate-500 leading-relaxed">
                          {it.description}
                        </p>
                      </div>

                      <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-4 shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 mt-4 md:mt-0">
                        <div className="text-left md:text-right">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">ผลคะแนน</p>
                          <div className="flex items-baseline gap-1.5 justify-start md:justify-end">
                            <span className={`text-2xl font-black ${score > 0 ? 'text-teal-600' : 'text-slate-800'}`}>
                              {score}
                            </span>
                            <span className="text-sm font-bold text-slate-400">/ {it.maxScore}</span>
                          </div>
                        </div>

                        <motion.button
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => setEvaluatedItem(it)}
                          className={`inline-flex items-center gap-2 h-12 rounded-full text-white px-6 text-[15px] font-bold shadow-md transition-all cursor-pointer whitespace-nowrap ${
                            sessionRole === 'supervisor' ? 'bg-indigo-500 hover:bg-indigo-600 hover:shadow-indigo-500/25' : 'bg-teal-500 hover:bg-teal-600 hover:shadow-teal-500/25'
                          }`}
                        >
                          <span>{sessionRole === 'supervisor' ? 'ตรวจดูหลักฐาน' : 'ประเมินและแนบข้อมูล'}</span>
                          <ChevronRight className="h-4 w-4" />
                        </motion.button>
                      </div>
                    </motion.div>
                  );
                })}
                </AnimatePresence>

                {getFilteredItems().length === 0 && (
                  <motion.div 
                    initial={{opacity: 0}}
                    animate={{opacity: 1}}
                    className="rounded-[2rem] border border-slate-200 border-dashed bg-white/50 backdrop-blur-xl p-16 text-center"
                  >
                    <HelpCircle className="h-10 w-10 text-slate-400 mx-auto mb-2" />
                    <h3 className="text-sm font-bold text-slate-800">ไม่พบคำค้นหาหรือตัวชี้วัดในหมวดนี้</h3>
                    <p className="text-xs text-slate-500 mt-1">กรุณาลองป้อนหมวดหมู่ รหัสย่อย หรือลองล้างคำค้นหา</p>
                  </motion.div>
                )}
              </div>

            </div>
          </motion.div>

          {/* Admin Activity Logs Modal (Visible only to admin) */}
          <AnimatePresence>
            {(currentUserInfo?.email === 'primarycareunit.ubuh@ubu.ac.th' || currentUserInfo?.role === 'admin') && showHistoryModal && (
              <HistoryModal
                onClose={() => setShowHistoryModal(false)}
                logs={activityLogs}
                logsLoading={logsLoading}
                reloadActivityLogs={reloadActivityLogs}
                logSearchTerm={logSearchTerm}
                setLogSearchTerm={setLogSearchTerm}
                logActionFilter={logActionFilter}
                setLogActionFilter={setLogActionFilter}
              />
            )}
          </AnimatePresence>

          {/* Printable Report View (Visible only during window.print()) */}
          <div className="hidden print:block bg-white text-black p-8 font-sans space-y-6" id="printable-area">
            <div className="text-center space-y-2 border-b-2 border-black pb-4">
              <h1 className="text-2xl font-black">ใบรายงานผลสรุปตัวประเมินพัฒนาคุณภาพและมาตรฐานปฐมภูมิ</h1>
              <h2 className="text-lg font-bold">ข้อมูลการรับการประเมินประจำปีงบประมาณ พ.ศ. 2569</h2>
              <div className="text-sm space-y-1">
                <p><strong>ชื่อหน่วยบริการ:</strong> {activeUnit.unitName}{(activeUnit.district || activeUnit.province) ? ` (${[activeUnit.district ? `อำเภอ${activeUnit.district}` : '', activeUnit.province ? `จังหวัด${activeUnit.province}` : ''].filter(Boolean).join(' ')})` : ''}</p>
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
                currentUserEmail={currentUserInfo?.email || activeUnit.unitEmail}
                currentUserDisplayName={currentUserInfo?.displayName}
                currentUserName={currentUserInfo?.name || activeUnit.unitName}
                onClose={() => setEvaluatedItem(null)}
                onSaveItem={handleSaveEvaluation}
                onFilesChanged={async () => {
                  await reloadFilesList(activeUnit.id);
                  if (currentUserInfo?.email === 'primarycareunit.ubuh@ubu.ac.th' || currentUserInfo?.role === 'admin') {
                    const logs = await getActivityLogs();
                    setActivityLogs(logs);
                  }
                }}
              />
            )}
          </AnimatePresence>

          {/* Admin User Management Modal */}
          <AnimatePresence>
            {(currentUserInfo?.email === 'primarycareunit.ubuh@ubu.ac.th' || currentUserInfo?.role === 'admin') && showUserManagement && (
              <UserManagementModal 
                currentUserEmail={currentUserInfo.email}
                onClose={() => setShowUserManagement(false)}
              />
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
