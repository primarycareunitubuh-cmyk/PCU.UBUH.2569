import React, { useState, useEffect } from 'react';
import { 
  X, Plus, Trash2, Edit2, Copy, Save, FileText, ChevronDown, 
  ChevronUp, AlertCircle, Sparkles, PlusCircle, Check, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getFiscalYearCriteria, 
  saveFiscalYearCriteria, 
  getAvailableFiscalYears 
} from '../dbService';
import { PartInfo, AssessmentItem, ASSESSMENT_PARTS, ASSESSMENT_ITEMS } from '../data';

interface CriteriaManagementModalProps {
  onClose: () => void;
  currentUserEmail: string;
  onCriteriaSaved: (updatedYear: number) => void;
  currentActiveYear: number;
}

export default function CriteriaManagementModal({ 
  onClose, 
  currentUserEmail, 
  onCriteriaSaved,
  currentActiveYear
}: CriteriaManagementModalProps) {
  const [selectedYear, setSelectedYear] = useState<number>(currentActiveYear);
  const [availableYears, setAvailableYears] = useState<number[]>([2569]);
  const [parts, setParts] = useState<PartInfo[]>([]);
  const [items, setItems] = useState<AssessmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Editing state for Part
  const [editingPartId, setEditingPartId] = useState<number | null>(null);
  const [editPartTitle, setEditPartTitle] = useState('');
  const [editPartDesc, setEditPartDesc] = useState('');
  const [editPartPassingText, setEditPartPassingText] = useState('');

  // Editing state for Item
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemCode, setEditItemCode] = useState('');
  const [editItemName, setEditItemName] = useState('');
  const [editItemMaxScore, setEditItemMaxScore] = useState<number>(1);
  const [editItemDesc, setEditItemDesc] = useState('');
  const [editItemEvidence, setEditItemEvidence] = useState<string[]>([]);
  const [newEvidenceInput, setNewEvidenceInput] = useState('');

  // Adding state for New Item
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemPartNum, setNewItemPartNum] = useState<number>(1);
  const [newItemCode, setNewItemCode] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemMaxScore, setNewItemMaxScore] = useState<number>(1);
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemEvidence, setNewItemEvidence] = useState<string[]>([]);
  const [newAddEvidenceInput, setNewAddEvidenceInput] = useState('');

  // Creating state for Clone Year
  const [isCloning, setIsCloning] = useState(false);
  const [newYearInput, setNewYearInput] = useState<string>('');

  // Expand and collapse state for parts
  const [expandedParts, setExpandedParts] = useState<Record<number, boolean>>({ 1: true });

  useEffect(() => {
    loadYearsAndCriteria();
  }, [selectedYear]);

  const loadYearsAndCriteria = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      // 1. Get available years
      const years = await getAvailableFiscalYears();
      setAvailableYears(years);

      // 2. Get criteria for selected year
      const criteria = await getFiscalYearCriteria(selectedYear);
      if (criteria) {
        setParts(criteria.parts);
        setItems(criteria.items);
      } else {
        // Fallback to static master criteria if not yet in database
        setParts(ASSESSMENT_PARTS);
        setItems(ASSESSMENT_ITEMS);
      }
    } catch (err: any) {
      setError('เกิดข้อผิดพลาดในการดึงข้อมูลจากฐานข้อมูล: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const togglePartExpand = (index: number) => {
    setExpandedParts(prev => ({ ...prev, [index]: !prev[index] }));
  };

  // Update Part Info
  const handleStartEditPart = (part: PartInfo) => {
    setEditingPartId(part.index);
    setEditPartTitle(part.title);
    setEditPartDesc(part.description);
    setEditPartPassingText(part.passingThresholdText || '');
  };

  const handleSavePartEdit = () => {
    if (!editPartTitle.trim()) {
      setError('จำเป็นต้องระบุหัวข้อส่วนประเมิน');
      return;
    }
    setParts(prev => prev.map(p => p.index === editingPartId ? {
      ...p,
      title: editPartTitle.trim(),
      description: editPartDesc.trim(),
      passingThresholdText: editPartPassingText.trim()
    } : p));
    setEditingPartId(null);
    setSuccess('แก้ไขส่วนประเมินจำลองไว้ชั่วคราวแล้ว กรุณากด "บันทึกการเปลี่ยนแปลงทั้งหมด" เพื่อเขียนลงคลาวด์');
  };

  // Delete Item
  const handleDeleteItem = (itemId: string, itemCode: string) => {
    if (window.confirm(`คุณแน่ใจหรือไม่ที่จะลบตัวชี้วัดข้อ "${itemCode}" ออกจากปีงบประมาณ ${selectedYear}? (ข้อมูลผลประเมินที่ผูกกับข้อนี้ในปีนี้อาจไม่แสดงผล)`)) {
      setItems(prev => prev.filter(it => it.id !== itemId));
      setSuccess('ลบตัวชี้วัดชั่วคราวแล้ว กรุณากด "บันทึกการเปลี่ยนแปลงทั้งหมด" เพื่อยืนยันและอัปเดตคะแนนรวม');
    }
  };

  // Edit Item Info
  const handleStartEditItem = (item: AssessmentItem) => {
    setEditingItemId(item.id);
    setEditItemCode(item.code);
    setEditItemName(item.name);
    setEditItemMaxScore(item.maxScore);
    setEditItemDesc(item.description || '');
    setEditItemEvidence(item.evidence || []);
    setNewEvidenceInput('');
  };

  const handleAddEditEvidence = () => {
    const trimmed = newEvidenceInput.trim();
    if (trimmed && !editItemEvidence.includes(trimmed)) {
      setEditItemEvidence(prev => [...prev, trimmed]);
      setNewEvidenceInput('');
    }
  };

  const handleRemoveEditEvidence = (idx: number) => {
    setEditItemEvidence(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveItemEdit = () => {
    if (!editItemCode.trim() || !editItemName.trim()) {
      setError('กรุณาระบุรหัสตัวชี้วัด (Code) และชื่อเกณฑ์การประเมิน');
      return;
    }
    setItems(prev => prev.map(it => it.id === editingItemId ? {
      ...it,
      code: editItemCode.trim(),
      name: editItemName.trim(),
      maxScore: Number(editItemMaxScore),
      description: editItemDesc.trim(),
      evidence: editItemEvidence
    } : it));
    setEditingItemId(null);
    setSuccess('อัปเดตเกณฑ์ตัวชี้วัดแล้วชั่วคราว กรุณากด "บันทึกการเปลี่ยนแปลงทั้งหมด" เพื่อเขียนลงคลาวด์');
  };

  // Add New Item
  const handleAddEvidenceToNewItem = () => {
    const trimmed = newAddEvidenceInput.trim();
    if (trimmed && !newItemEvidence.includes(trimmed)) {
      setNewItemEvidence(prev => [...prev, trimmed]);
      setNewAddEvidenceInput('');
    }
  };

  const handleRemoveEvidenceFromNewItem = (idx: number) => {
    setNewItemEvidence(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCreateNewItem = () => {
    if (!newItemCode.trim() || !newItemName.trim()) {
      setError('กรุณากรอกรหัสหัวข้อ (เช่น 5.7) และชื่อคำอธิบายเกณฑ์ตัวชี้วัด');
      return;
    }

    const generatedId = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newItem: AssessmentItem = {
      id: generatedId,
      part: newItemPartNum,
      code: newItemCode.trim(),
      name: newItemName.trim(),
      maxScore: Number(newItemMaxScore),
      description: newItemDesc.trim(),
      evidence: newItemEvidence
    };

    setItems(prev => [...prev, newItem].sort((a, b) => {
      // Natural sorting based on code string
      return a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' });
    }));

    // Reset adding state
    setIsAddingItem(false);
    setNewItemCode('');
    setNewItemName('');
    setNewItemMaxScore(1);
    setNewItemDesc('');
    setNewItemEvidence([]);
    
    // Automatically expand the part the item was added to
    setExpandedParts(prev => ({ ...prev, [newItemPartNum]: true }));
    setSuccess('เพิ่มตัวชี้วัดใหม่แล้วชั่วคราว กรุณากด "บันทึกการเปลี่ยนแปลงทั้งหมด" ด้านล่างก่อนปิดหน้าต่างเพื่อยืนยัน');
  };

  // Duplicate entire criteria set to a new year
  const handleCloneToNewYear = async () => {
    setError('');
    setSuccess('');
    const newYear = parseInt(newYearInput.trim());
    if (isNaN(newYear) || newYear < 2500 || newYear > 2700) {
      setError('กรุณาระบุมูลค่าปี พ.ศ. ให้ถูกต้อง (เช่น 2570)');
      return;
    }

    if (availableYears.includes(newYear)) {
      setError(`ปีงบประมาณ ${newYear} มีข้อมูลเกณฑ์ตัวชี้วัดอยู่แล้วในระบบ`);
      return;
    }

    setIsCloning(true);
    try {
      // Auto compute part scores based on the cloned items
      const updatedParts = parts.map(p => {
        const itemSum = items
          .filter(it => it.part === p.index)
          .reduce((sum, it) => sum + it.maxScore, 0);
        return { ...p, maxScore: itemSum || p.maxScore };
      });

      await saveFiscalYearCriteria(newYear, updatedParts, items, currentUserEmail);
      setAvailableYears(prev => [newYear, ...prev].sort((a,b) => b-a));
      setSelectedYear(newYear);
      setNewYearInput('');
      setIsCloning(false);
      setSuccess(`คัดลอกเกณฑ์ทั้งหมดไปยังปีงบประมาณ ${newYear} สำเร็จแล้วตอนนี้ท่านกำลังรับชมปีใหม่!`);
    } catch (err: any) {
      setError('เกิดข้อผิดพลาดในการสร้างปีงบประมาณใหม่: ' + err.message);
      setIsCloning(false);
    }
  };

  // Submit and Save everything back into the database
  const handleSaveAll = async () => {
    setError('');
    setSuccess('');
    setIsSaving(true);
    try {
      // For each part, automatically calculate and update its maxScore based on active child items!
      const updatedParts = parts.map(p => {
        const itemSum = items
          .filter(it => it.part === p.index)
          .reduce((sum, it) => sum + it.maxScore, 0);
        
        return {
          ...p,
          maxScore: itemSum // Auto-set the total score of parents dynamically!
        };
      });

      await saveFiscalYearCriteria(selectedYear, updatedParts, items, currentUserEmail);
      setParts(updatedParts);
      setSuccess(`บันทึกเกณฑ์ตัวชี้วัดทั้งหมดของปีงบประมาณ ${selectedYear} เรียบร้อยแล้ว!`);
      // Trigger callback to recompute and sync
      onCriteriaSaved(selectedYear);
    } catch (err: any) {
      setError('ไม่สามารถบันทึกเกณฑ์ตัวชี้วัดได้: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-3xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100"
      >
        {/* Header */}
        <div className="p-6 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-md shadow-purple-200">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 font-sans">
                จัดการชุดเกณฑ์ตัวชี้วัดและปีงบประมาณ
              </h2>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                สิทธิ์ผู้ดูแลระบบสูงสุด • บัญชี {currentUserEmail}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Workspace Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Notifications */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 flex items-start gap-2.5 font-sans animate-fade-in"
              >
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <span className="text-xs font-bold leading-normal">{error}</span>
              </motion.div>
            )}
            {success && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 flex items-start gap-2.5 font-sans animate-fade-in"
              >
                <div className="h-4 w-4 bg-emerald-500 rounded-full flex items-center justify-center text-white flex-shrink-0 mt-0.5 text-[10px]">✓</div>
                <span className="text-xs font-bold leading-normal">{success}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Top Panel: Selector & Years Creation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-purple-50/20 border border-purple-100 rounded-2xl p-5">
            {/* Selector column */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 block font-sans">
                เลือกปีงบประมาณที่ต้องการปรับแก้อิงเกณฑ์:
              </label>
              <div className="flex gap-2">
                <select 
                  value={selectedYear} 
                  onChange={(e) => {
                    setSelectedYear(Number(e.target.value));
                    setExpandedParts({ 1: true });
                  }}
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-xs"
                >
                  {availableYears.map(year => (
                    <option key={year} value={year}>ปีงบประมาณไทย พ.ศ. {year}</option>
                  ))}
                </select>
                <button 
                  onClick={loadYearsAndCriteria}
                  className="px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  โหลดซ้ำ
                </button>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                * ปีงบประมาณไทยจะคำนวณตั้งแต่วันที่ 1 ตุลาคม ไปจนถึง 30 กันยายนของวันปีถัดไปโดยระบบจะนำระบบกรองกลุ่มเอกสารเรียงตามหมวดหมู่โฟลเดอร์ปีนั้นโดยอัตโนมัติ
              </p>
            </div>

            {/* Creation column */}
            <div className="space-y-2 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-5 flex flex-col justify-between">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700 block font-sans">
                  คัดลอกหรือตั้งปีงบประมาณข้อประเมินใหม่:
                </label>
                <div className="flex gap-2 mt-1.5">
                  <input 
                    type="number" 
                    placeholder="ระบุปี พ.ศ. ใหม่ เช่น 2570" 
                    value={newYearInput}
                    onChange={(e) => setNewYearInput(e.target.value)}
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold placeholder:text-slate-400 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button 
                    onClick={handleCloneToNewYear}
                    disabled={isCloning}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-purple-100 hover:shadow-lg transition cursor-pointer disabled:opacity-50"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>{isCloning ? 'กำลังสร้าง...' : 'สร้างและเชื่อมโยงเกณฑ์'}</span>
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-purple-600 font-bold mt-1.5 block">
                ⭐ ระบบจะนำเอาชุดข้อมูลตัวเลือกเกณฑ์ของปี พ.ศ. {selectedYear} ไปเป็นแม่แบบตั้งต้นให้โดยอัตโนมัติ ซึ่งจะแยกฐานข้อมูลออกประเมินเป็นเอกเทศทำให้ข้อมูลเก่าปลอดภัย 100%
              </p>
            </div>
          </div>

          {/* Quick Stats bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-150 p-4 rounded-xl font-sans">
            <div className="flex items-center gap-6">
              <div className="text-xs">
                <span className="text-slate-500 font-semibold">จำนวนกลุ่มประเมินหลัก:</span>
                <span className="text-slate-800 font-black ml-1.5 text-sm">{parts.length} ส่วน</span>
              </div>
              <div className="text-xs border-l border-slate-200 pl-6">
                <span className="text-slate-500 font-semibold">รวมตัวชี้วัดทั้งหมด:</span>
                <span className="text-slate-800 font-black ml-1.5 text-sm">{items.length} ข้อ</span>
              </div>
              <div className="text-xs border-l border-slate-200 pl-6">
                <span className="text-slate-500 font-semibold">คะแนนรวมสะสม:</span>
                <span className="text-purple-700 font-black ml-1.5 text-sm">{items.reduce((s, it) => s + it.maxScore, 0)} คะแนน</span>
              </div>
            </div>

            <button 
              onClick={() => {
                setNewItemPartNum(1);
                setIsAddingItem(true);
              }}
              className="text-xs font-bold inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg shadow-sm hover:shadow-md transition cursor-pointer"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>เพิ่มหัวข้อตัวชี้วัดใหม่</span>
            </button>
          </div>

          {/* Loading spinner */}
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <div className="h-10 w-10 border-4 border-purple-500/35 border-t-purple-600 rounded-full animate-spin"></div>
              <p className="text-sm text-slate-500 font-semibold">กำลังเชื่อมต่อข้อมูลเกณฑ์ตัวชี้วัดบนระบบคลาวด์...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Form Add New Item */}
              <AnimatePresence>
                {isAddingItem && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-2 border-emerald-200 bg-emerald-50/15 rounded-2xl p-5 overflow-hidden font-sans space-y-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[20px]">✨</span>
                        <h3 className="text-sm font-bold text-emerald-800 leading-normal">
                          เพิ่มตัวชี้วัดชุดประเมินตัวใหม่
                        </h3>
                      </div>
                      <button 
                        onClick={() => setIsAddingItem(false)}
                        className="text-xs font-bold text-slate-400 hover:text-slate-600 bg-white border border-slate-200 px-2 py-1 rounded"
                      >
                        ยกเลิก
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-sans">
                      <div className="space-y-1.5">
                        <label className="font-semibold text-slate-600 block">อยู่ในกลุ่มการประเมิน (Part):</label>
                        <select 
                          value={newItemPartNum}
                          onChange={(e) => setNewItemPartNum(Number(e.target.value))}
                          className="w-full bg-white border border-slate-250 p-2 rounded-xl text-slate-800 font-bold focus:ring-1 focus:ring-emerald-500"
                        >
                          {parts.map(p => (
                            <option key={p.index} value={p.index}>ส่วนที่ {p.index} ({p.title.length > 25 ? p.title.substring(0, 25) + '...' : p.title})</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="font-semibold text-slate-600 block">รหัสหัวข้อ (Code เช่น 1.3):</label>
                        <input 
                          type="text" 
                          placeholder="เช่น 1.3" 
                          value={newItemCode}
                          onChange={(e) => setNewItemCode(e.target.value)}
                          className="w-full bg-white border border-slate-250 p-2 rounded-xl text-slate-800 font-bold"
                        />
                      </div>

                      <div className="space-y-1.5 md:col-span-2">
                        <label className="font-semibold text-slate-600 block">ชื่อเกณฑ์ตัวชี้วัด (Indicator Name):</label>
                        <input 
                          type="text" 
                          placeholder="ระบุเกณฑ์ตัวชี้วัดที่ต้องการเพิ่ม..." 
                          value={newItemName}
                          onChange={(e) => setNewItemName(e.target.value)}
                          className="w-full bg-white border border-slate-250 p-2 rounded-xl text-slate-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
                      <div className="space-y-1.5">
                        <label className="font-semibold text-slate-600 block">คะแนนเต็มนิเทศ (Max Score):</label>
                        <input 
                          type="number" 
                          value={newItemMaxScore}
                          onChange={(e) => setNewItemMaxScore(Number(e.target.value))}
                          className="w-full bg-white border border-slate-250 p-2 rounded-xl text-slate-800 font-bold"
                        />
                      </div>

                      <div className="md:col-span-2 space-y-1.5">
                        <label className="font-semibold text-slate-600 block">รายละเอียดจุดพิจารณาประเมินประเด็นหลัก:</label>
                        <textarea 
                          placeholder="คำอธิบายเกณฑ์ตัดสินใจ คะแนนที่จะให้ คำแนะนะเพิ่มเติม..." 
                          value={newItemDesc}
                          onChange={(e) => setNewItemDesc(e.target.value)}
                          rows={2}
                          className="w-full bg-white border border-slate-250 p-2 rounded-xl text-slate-800"
                        />
                      </div>
                    </div>

                    {/* Evidence creation tags */}
                    <div className="space-y-1.5 text-xs font-sans border-t border-emerald-50 pt-3">
                      <label className="font-semibold text-slate-600 block">รายการไฟล์เอกสารหลักฐานแนวทางแนะนำ:</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="เช่น คำสั่งประกาศแต่งตั้งคณะกรรมการ, คู่อันนิติกรรม..." 
                          value={newAddEvidenceInput}
                          onChange={(e) => setNewAddEvidenceInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddEvidenceToNewItem())}
                          className="flex-1 bg-white border border-slate-250 p-2 rounded-xl"
                        />
                        <button 
                          onClick={handleAddEvidenceToNewItem}
                          className="px-4 bg-emerald-100 text-emerald-800 hover:bg-emerald-250 rounded-xl font-bold cursor-pointer transition"
                        >
                          เพิ่มแนบ
                        </button>
                      </div>
                      
                      {newItemEvidence.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2 bg-white/50 p-2.5 rounded-xl border border-dashed border-emerald-200">
                          {newItemEvidence.map((ev, index) => (
                            <span 
                              key={index}
                              className="text-[11px] bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-2.5 py-1 inline-flex items-center gap-1.5"
                            >
                              <span>{ev}</span>
                              <button 
                                onClick={() => handleRemoveEvidenceFromNewItem(index)}
                                className="text-red-500 hover:text-red-700 font-black ml-1 scale-105 cursor-pointer"
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end pt-2">
                      <button 
                        onClick={handleCreateNewItem}
                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs space-x-1 shadow-md hover:shadow-lg transition cursor-pointer"
                      >
                        ✓ เพิ่มตัวชี้วัดข้อนี้
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* List of Parts */}
              <div className="space-y-4">
                {parts.map((p) => {
                  const partItems = items.filter(it => it.part === p.index);
                  const isExpanded = !!expandedParts[p.index];

                  return (
                    <div 
                      key={p.index}
                      className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden hover:border-slate-300 transition shadow-inner bg-linear-to-b from-white to-slate-50/20"
                    >
                      {/* Part Accordion Header */}
                      <div className="p-4 p-x-5 flex items-center justify-between select-none cursor-pointer" onClick={() => togglePartExpand(p.index)}>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="p-2 bg-slate-100 rounded-lg flex-shrink-0 text-slate-700 font-bold font-mono h-8 w-8 text-xs flex items-center justify-center">
                            {p.index}
                          </div>
                          
                          {editingPartId === p.index ? (
                            <div className="flex-1 space-y-2 pr-4 font-sans" onClick={(e) => e.stopPropagation()}>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <input 
                                  type="text"
                                  value={editPartTitle}
                                  onChange={(e) => setEditPartTitle(e.target.value)}
                                  className="bg-white border border-slate-300 rounded px-2.5 py-1 font-bold text-xs w-full focus:outline-purple-500"
                                />
                                <input 
                                  type="text"
                                  placeholder="คำอธิบายสเกลเกณฑ์ตัดสินผ่าน..."
                                  value={editPartPassingText}
                                  onChange={(e) => setEditPartPassingText(e.target.value)}
                                  className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs w-full focus:outline-purple-500"
                                />
                              </div>
                              <textarea
                                value={editPartDesc}
                                onChange={(e) => setEditPartDesc(e.target.value)}
                                rows={2}
                                className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs w-full focus:outline-purple-500"
                              />
                              <div className="flex justify-end gap-1.5">
                                <button 
                                  onClick={() => setEditingPartId(null)}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-bold text-slate-600"
                                >
                                  ยกเลิก
                                </button>
                                <button 
                                  onClick={handleSavePartEdit}
                                  className="px-3 py-1 bg-purple-600 text-white rounded text-[10px] font-bold flex items-center gap-1"
                                >
                                  <Save className="h-3 w-3" />
                                  <span>อัปเดตชิ้นหลัก</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="min-w-0 pr-4">
                              <h3 className="text-sm font-bold text-slate-800 font-sans truncate">
                                {p.title}
                              </h3>
                              <p className="text-xs text-slate-400 font-medium truncate mt-0.5">
                                {p.description} • {p.passingThresholdText ? `เกณฑ์ผ่าน: ${p.passingThresholdText}` : 'ไม่มีข้อมูลเกณฑ์ขั้นต่ำ'}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Right score actions */}
                        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                          <div className="text-right flex-shrink-0">
                            <span className="text-[11px] font-semibold text-slate-400 uppercase">สัดส่วนคะแนนในปีนี้</span>
                            <div className="text-xs font-black text-purple-700 font-mono mt-0.5">
                              {partItems.reduce((acc, it) => acc + it.maxScore, 0)} คะแนน
                            </div>
                          </div>
                          
                          {editingPartId !== p.index && (
                            <button 
                              onClick={() => handleStartEditPart(p)}
                              className="p-1 rounded hover:bg-slate-200/80 text-slate-400 hover:text-purple-600 transition cursor-pointer"
                              title="แก้ไขชื่อส่วนหัว"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          
                          <div 
                            className="p-1 rounded-full hover:bg-slate-200 text-slate-400 cursor-pointer"
                            onClick={() => togglePartExpand(p.index)}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </div>
                      </div>

                      {/* Items contained list */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="border-t border-slate-200 p-3 p-x-5 space-y-2 bg-white"
                          >
                            {partItems.length === 0 ? (
                              <div className="py-6 text-center text-xs text-slate-400 font-medium font-sans">
                                📂 ยังไม่มีตัวชี้วัดย่อยในส่วนนี้ ท่านสามารถเพิ่มตัวชี้วัดเสริมได้ด้วยปุ่มด่วนด้านบน
                              </div>
                            ) : (
                              partItems.map((item) => (
                                <div 
                                  key={item.id}
                                  className="p-3 border border-slate-100 rounded-xl hover:bg-slate-50/50 hover:border-slate-200/80 transition flex gap-3 text-xs"
                                >
                                  {editingItemId === item.id ? (
                                    /* Active Editing fields for Item */
                                    <div className="w-full space-y-3 font-sans">
                                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-slate-500">รหัสข้อ:</label>
                                          <input 
                                            type="text" 
                                            value={editItemCode} 
                                            onChange={(e) => setEditItemCode(e.target.value)}
                                            className="bg-white border border-slate-300 rounded px-2 py-1 w-full font-bold focus:outline-purple-500"
                                          />
                                        </div>
                                        <div className="md:col-span-2 space-y-1">
                                          <label className="text-[10px] font-bold text-slate-500">ชื่อเกณฑ์:</label>
                                          <input 
                                            type="text" 
                                            value={editItemName} 
                                            onChange={(e) => setEditItemName(e.target.value)}
                                            className="bg-white border border-slate-300 rounded px-2 py-1 w-full focus:outline-purple-500"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-slate-500">คะแนนประเมิน:</label>
                                          <input 
                                            type="number" 
                                            value={editItemMaxScore} 
                                            onChange={(e) => setEditItemMaxScore(Number(e.target.value))}
                                            className="bg-white border border-slate-300 rounded px-2 py-1 w-full focus:outline-purple-500 font-bold"
                                          />
                                        </div>
                                      </div>

                                      <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500">รายละเอียดจุดพิจารณาประเมินประเด็นหลัก:</label>
                                        <textarea 
                                          value={editItemDesc} 
                                          onChange={(e) => setEditItemDesc(e.target.value)}
                                          rows={2}
                                          className="bg-white border border-slate-300 rounded px-2 py-1 w-full focus:outline-purple-500"
                                        />
                                      </div>

                                      <div className="space-y-1 border-t border-slate-100 pt-2">
                                        <label className="text-[10px] font-bold text-slate-500 block">รายการหลักฐานแนะนำ:</label>
                                        <div className="flex gap-1.5">
                                          <input 
                                            type="text"
                                            placeholder="กรอกแนวเอกสารหลักฐาน และกดเพิ่มแนบ..."
                                            value={newEvidenceInput}
                                            onChange={(e) => setNewEvidenceInput(e.target.value)}
                                            className="bg-white border border-slate-300 rounded p-1 text-xs flex-1 focus:outline-purple-500"
                                          />
                                          <button 
                                            type="button"
                                            onClick={handleAddEditEvidence}
                                            className="bg-indigo-650 hover:bg-indigo-700 text-indigo shadow-xs border border-indigo-200 hover:text-white transition rounded p-x-3 text-[10px] font-bold cursor-pointer"
                                          >
                                            เพิ่มแนบ
                                          </button>
                                        </div>

                                        {editItemEvidence.length > 0 && (
                                          <div className="flex flex-wrap gap-1 mt-1.5 p-2 bg-slate-50 border border-dotted border-slate-200 rounded-xl">
                                            {editItemEvidence.map((ev, index) => (
                                              <span 
                                                key={index}
                                                className="text-[10px] bg-white border border-slate-200 rounded px-2 py-0.5 inline-flex items-center gap-1"
                                              >
                                                <span>{ev}</span>
                                                <button 
                                                  type="button"
                                                  onClick={() => handleRemoveEditEvidence(index)}
                                                  className="text-red-500 hover:text-red-700 font-bold"
                                                >
                                                  &times;
                                                </button>
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>

                                      <div className="flex justify-end gap-1.5 pt-2">
                                        <button 
                                          type="button"
                                          onClick={() => setEditingItemId(null)}
                                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-bold text-slate-600"
                                        >
                                          ยกเลิก
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={handleSaveItemEdit}
                                          className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold flex items-center gap-1 shadow-sm"
                                        >
                                          <Check className="h-3.5 w-3.5" />
                                          <span>ปรับบันทึกจำลอง</span>
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    /* Normal Display Mode for Item */
                                    <>
                                      <div className="font-mono text-slate-500 font-bold w-12 flex-shrink-0 pt-0.5">
                                        {item.code}
                                      </div>
                                      
                                      <div className="flex-1 space-y-1 pr-3">
                                        <p className="font-bold text-slate-800 leading-relaxed font-sans">
                                          {item.name}
                                        </p>
                                        {item.description && (
                                          <p className="text-slate-400 font-sans leading-relaxed">
                                            {item.description}
                                          </p>
                                        )}
                                        {item.evidence && item.evidence.length > 0 && (
                                          <div className="mt-1.5 flex flex-wrap gap-1">
                                            <span className="text-[10px] text-slate-400 font-bold mr-1 self-center">หลักฐานแนะนำ:</span>
                                            {item.evidence.map((ev, i) => (
                                              <span key={i} className="bg-slate-100 text-slate-500 rounded px-1.5 py-0.5 text-[10px] select-none">
                                                {ev}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>

                                      <div className="flex items-start gap-2.5 flex-shrink-0 font-sans">
                                        <div className="text-center bg-purple-50/50 border border-purple-100 px-2 py-1 rounded-lg">
                                          <span className="text-[9px] text-slate-400 block font-semibold uppercase">ดัชนีคะแนน</span>
                                          <span className="font-mono font-black text-purple-700 leading-none">{item.maxScore}</span>
                                        </div>

                                        <button 
                                          onClick={() => handleStartEditItem(item)}
                                          className="p-1 rounded hover:bg-indigo-50 hover:text-indigo-600 text-slate-400 transition cursor-pointer"
                                          title="แก้ไขเกณฑ์ตัวชี้วัด"
                                        >
                                          <Edit2 className="h-3 w-3" />
                                        </button>
                                        <button 
                                          onClick={() => handleDeleteItem(item.id, item.code)}
                                          className="p-1 rounded hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition cursor-pointer"
                                          title="ลบตัวชี้วัดข้อนี้"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              ))
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-3 items-center justify-between">
          <div className="text-xs">
            <span className="text-orange-600 bg-orange-50 border border-orange-100 px-2.5 py-1 rounded-full font-bold font-sans">
              ⚠️ คำเตือน: ประวัติการประเมินขึ้นกับตัวชี้วัดที่เปิดใช้ปีนั้นๆ
            </span>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
            >
              ยกเลิกและปิด
            </button>
            <button 
              onClick={handleSaveAll}
              disabled={isSaving || loading}
              className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-purple-100 hover:shadow-lg transition cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? 'กำลังบันทึกลง Firestore...' : 'บันทึกการเปลี่ยนแปลงทั้งหมด'}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
