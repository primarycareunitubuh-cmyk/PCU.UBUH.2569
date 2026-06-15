import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  Plus, 
  Trash2, 
  Download, 
  Eye, 
  Check, 
  AlertCircle,
  FileCode,
  Lock,
  Image as ImageIcon 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AssessmentItem } from '../data';
import { 
  uploadEvidenceFile, 
  deleteEvidenceFile, 
  getEvidenceFileContent, 
  EvidenceFileMeta, 
  EvidenceFileData 
} from '../dbService';

interface ItemEvaluationModalProps {
  item: AssessmentItem;
  currentScore: number;
  currentNote: string;
  files: EvidenceFileMeta[];
  assessmentId: string;
  role?: 'editor' | 'supervisor';
  onClose: () => void;
  onSaveItem: (score: number, note: string) => void;
  onFilesChanged: () => void;
}

export default function ItemEvaluationModal({
  item,
  currentScore,
  currentNote,
  files,
  assessmentId,
  role = 'editor',
  onClose,
  onSaveItem,
  onFilesChanged
}: ItemEvaluationModalProps) {
  const [score, setScore] = useState<number>(currentScore);
  const [note, setNote] = useState<string>(currentNote);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [previewFile, setPreviewFile] = useState<EvidenceFileData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter files belonging specifically to this assessment item
  const itemFiles = files.filter(f => f.itemId === item.id);

  // Sub-evidence checkbox auditing states
  const [checkedEvidence, setCheckedEvidence] = useState<string[]>([]);

  // Score validation & checkmarks parsing from notes
  useEffect(() => {
    setScore(currentScore);
    setNote(currentNote);
    setErrorMsg('');
    setSuccessMsg('');
    setPreviewFile(null);

    const parsed: string[] = [];
    item.evidence.forEach(ev => {
      if (currentNote.includes(`[✓] ${ev}`)) {
        parsed.push(ev);
      }
    });
    setCheckedEvidence(parsed);
  }, [item, currentScore, currentNote]);

  const recommendedScore = Number(
    item.evidence.length > 0 
      ? ((checkedEvidence.length / item.evidence.length) * item.maxScore).toFixed(1)
      : 0
  );

  const applyRecommendedScore = () => {
    if (role === 'supervisor') return;
    setScore(recommendedScore);
  };

  const toggleEvidence = (ev: string) => {
    if (role === 'supervisor') return;
    const next = checkedEvidence.includes(ev)
      ? checkedEvidence.filter(x => x !== ev)
      : [...checkedEvidence, ev];

    setCheckedEvidence(next);

    // Clean existing checkmarks from notes to avoid duplicate/stale tags
    let cleanNote = note;
    item.evidence.forEach(e => {
      cleanNote = cleanNote.replace(`[✓] ${e}\n`, '').replace(`[✓] ${e}`, '');
      cleanNote = cleanNote.replace(`[ ] ${e}\n`, '').replace(`[ ] ${e}`, '');
    });
    cleanNote = cleanNote.trim();

    // Rebuild prefix with latest checkmarks status
    const prefix = item.evidence.map(e => next.includes(e) ? `[✓] ${e}` : `[ ] ${e}`).join('\n');
    setNote(prefix + (cleanNote ? '\n\n' + cleanNote : ''));
  };

  const handleScoreChange = (val: string) => {
    if (role === 'supervisor') return; // Supervisors cannot modify score
    const num = parseFloat(val);
    if (isNaN(num)) {
      setScore(0);
    } else {
      setScore(num);
    }
  };

  const incrementScore = () => {
    if (role === 'supervisor') return;
    setScore((prev) => {
      const next = prev + 0.5;
      return next > item.maxScore ? item.maxScore : next;
    });
  };

  const decrementScore = () => {
    if (role === 'supervisor') return;
    setScore((prev) => {
      const next = prev - 0.5;
      return next < 0 ? 0 : next;
    });
  };

  // Drag and Drop Handlers
  const handleDrag = (e: React.DragEvent) => {
    if (role === 'supervisor') return;
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    if (role === 'supervisor') return;
    setErrorMsg('');
    setSuccessMsg('');

    // Check size limit: 850KB to preserve Firestore document sizes
    const LIMIT_BYTES = 850 * 1024;
    if (file.size > LIMIT_BYTES) {
      setErrorMsg(`ไฟล์ "${file.name}" มีขนาดเกินเกณฑ์ 850KB (ขนาดปัจจุบัน: ${(file.size / (1024 * 1024)).toFixed(2)} MB) กรุณาใช้รูปภาพขนาดเล็กหรือบีบอัด PDF ก่อนอัปโหลด`);
      return;
    }

    setIsUploading(true);
    try {
      // FileReader to Base64 String
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;
        if (!base64Data) {
          setErrorMsg('ไม่สามารถอ่านข้อมูลไบนารีจากไฟล์นี้ได้');
          setIsUploading(false);
          return;
        }

        try {
          // Upload metadata & data URI to dbService
          await uploadEvidenceFile(assessmentId, item.id, file.name, file.type, file.size, base64Data);
          setSuccessMsg(`อัปโหลดไฟล์หลักฐาน "${file.name}" ข้อมูลถูกอัปเดตลง Firestore เรียบร้อยแล้ว!`);
          onFilesChanged();
        } catch (err: any) {
          setErrorMsg(err?.message || 'ไม่สามารถเชื่อมต่อ Firestore มั่นใจคลาวด์ออนไลน์');
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setErrorMsg('เกิดปัญหาในการประมวลผลไฟล์ภายในเครื่อง');
      setIsUploading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (role === 'supervisor') return;
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (role === 'supervisor') return;
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    if (role === 'supervisor') return;
    fileInputRef.current?.click();
  };

  // Preview & Download actions
  const handlePreviewFile = async (fileMeta: EvidenceFileMeta) => {
    setPreviewLoading(true);
    setErrorMsg('');
    try {
      const fileData = await getEvidenceFileContent(assessmentId, fileMeta.id);
      if (fileData) {
        setPreviewFile(fileData);
      } else {
        setErrorMsg('ไม่สามารถดึงข้อมูลเนื้อหาไฟล์จาก Firestore คลาวด์');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('เกิดข้อผิดพลาดในการดึงข้อมูลไฟล์พรีวิว');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownloadFile = async (file: EvidenceFileMeta | EvidenceFileData) => {
    if (role === 'supervisor') {
      alert('⚠️ นโยบายความปลอดภัยหน่วยบริการปฐมภูมิ: ไม่อนุญาตให้ผู้นิเทศก์ดาวน์โหลดหลักฐานภายนอกเครื่อง');
      return;
    }
    try {
      let base64Data = '';
      if ('data' in file) {
        base64Data = file.data;
      } else {
        const full = await getEvidenceFileContent(assessmentId, file.id);
        if (!full) throw new Error('Empty file content');
        base64Data = full.data;
      }

      // Base64 into absolute download Blob
      const link = document.createElement('a');
      link.href = base64Data;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('ไม่สามารถดาวน์โหลดไฟล์ชิ้นนี้ได้');
    }
  };

  const handleDeleteFile = async (id: string) => {
    if (role === 'supervisor') return;
    if (!confirm('ท่านต้องการลบไฟล์เกณฑ์เอกสารหลักฐานชิ้นนี้ใช่หรือไม่?')) return;
    try {
      await deleteEvidenceFile(assessmentId, id);
      onFilesChanged();
    } catch (err) {
      alert('ไม่สามารถลบไฟล์ออกจากระบบคลาวด์ได้');
    }
  };

  const handleSave = () => {
    if (role === 'supervisor') return;
    onSaveItem(score, note);
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) {
      return <FileText className="h-6 w-6 text-red-505" />;
    }
    if (mimeType.includes('image')) {
      return <ImageIcon className="h-6 w-6 text-indigo-505" />;
    }
    if (mimeType.includes('msword') || mimeType.includes('officedocument')) {
      return <FileText className="h-6 w-6 text-blue-505" />;
    }
    return <FileCode className="h-6 w-6 text-teal-605" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.97, y: 25 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]"
      >
        {/* Sticky Modal Title */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-teal-50 px-6 py-4 rounded-t-2xl">
          <div>
            <span className="inline-flex rounded-full bg-teal-600/10 px-2.5 py-0.5 text-xs font-semibold text-teal-800">
              ข้อที่ {item.code} (คะแนนเต็ม {item.maxScore} คะแนน)
            </span>
            <h3 className="text-sm font-semibold text-slate-900 mt-1 line-clamp-1">{item.name}</h3>
          </div>
          <button 
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Scroll Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          
          {/* Goal Guidelines / Description */}
          <div className="rounded-xl border border-teal-100 bg-teal-50/20 p-4">
            <h4 className="text-xs font-bold text-teal-900 uppercase tracking-wide">รายละเอียดและเกณฑ์การตรวจประเมิน:</h4>
            <p className="text-sm text-slate-800 mt-1 leading-relaxed">{item.description}</p>
            
            <h5 className="text-xs font-bold text-teal-950 uppercase tracking-wide mt-4 flex items-center gap-1.5 mb-2">
              <span>📋 ติ๊กหัวข้อย่อยและเอกสารอ้างอิงที่มีพร้อม (ระบบจะคำนวณสัดส่วนคะแนนแนะนำให้อัตโนมัติ):</span>
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
              {item.evidence.map((ev, index) => {
                const isChecked = checkedEvidence.includes(ev);
                return (
                  <button
                    key={index}
                    type="button"
                    disabled={role === 'supervisor'}
                    onClick={() => toggleEvidence(ev)}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left text-xs transition cursor-pointer select-none group w-full ${
                      isChecked
                        ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950 font-medium'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900'
                    } disabled:pointer-events-none`}
                  >
                    <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      isChecked 
                        ? 'border-emerald-600 bg-emerald-600 text-white' 
                        : 'border-slate-300 bg-white group-hover:border-slate-400'
                    }`}>
                      {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                    <span className="leading-tight">{ev}</span>
                  </button>
                );
              })}
            </div>

            {item.evidence.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-emerald-55/40 border border-emerald-100 p-3 text-xs text-emerald-800">
                <span className="font-semibold flex items-center gap-1.5">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>ประเมินตนเองรายข้อย่อยผ่าน {checkedEvidence.length}/{item.evidence.length} รายงาน</span>
                </span>
                {role !== 'supervisor' && (
                  <button
                    type="button"
                    onClick={applyRecommendedScore}
                    className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg shadow-sm transition text-xs cursor-pointer"
                  >
                    <span>👉 ใช้คะแนนคำแนะนำ ({recommendedScore} คะแนน)</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Left Column: Scoring & Notes */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  1. ให้คะแนนการประเมิน (ค่าตั้งแต่ 0 - {item.maxScore}):
                </label>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={decrementScore}
                    type="button"
                    disabled={role === 'supervisor'}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition font-bold disabled:opacity-40"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max={item.maxScore}
                    value={score}
                    disabled={role === 'supervisor'}
                    onChange={(e) => handleScoreChange(e.target.value)}
                    className="h-10 w-24 rounded-lg border border-slate-200 text-center font-bold text-slate-900 outline-none focus:border-teal-500 disabled:bg-slate-100"
                  />
                  <button 
                    onClick={incrementScore}
                    type="button"
                    disabled={role === 'supervisor'}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition font-bold disabled:opacity-40"
                  >
                    +
                  </button>
                  <span className="text-xs text-slate-500 font-medium">คะแนนเต็มคือ {item.maxScore}</span>
                </div>
                {score > item.maxScore && (
                  <p className="text-[10px] text-rose-500 font-medium mt-1">คะแนนเกินค่าสากลของเกณฑ์หัวข้อนี้</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  2. บันทึกคำอธิบายหลักฐาน / ข้อค้นพบ:
                </label>
                <textarea
                  value={note}
                  disabled={role === 'supervisor'}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="รายละเอียดเอกสารอ้างอิง เลขที่หนังสือราชการ หรือบันทึกปัญหาที่พบระหว่างทำการคัดกรอง..."
                  rows={6}
                  className="w-full text-sm rounded-xl border border-slate-200 p-3 bg-slate-50 focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition outline-none disabled:opacity-75 disabled:bg-slate-50"
                />
              </div>
            </div>

            {/* Right Column: File Upload & Evidence Attachments */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  3. อัปโหลดไฟล์เอกสารหลักฐาน (จำกัดขนาดไม่เกิน 850 KB):
                </label>
                
                {role === 'supervisor' ? (
                  /* Read-only feedback layout for supervisor */
                  <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 p-6 text-center flex flex-col items-center justify-center">
                    <Lock className="h-7 w-7 text-indigo-500 mb-1.5" />
                    <p className="text-xs font-bold text-indigo-900">สิทธิ์พิจารณาข้อมูลสำหรับผู้นิเทศ (อ่านอย่างเดียว)</p>
                    <p className="text-[10px] text-indigo-600 mt-1 leading-relaxed max-w-[280px]">
                      ผู้นิเทศสามารถกดปุ่มพรีวิวเพื่อตรวจทานไฟล์ผ่านเซิร์ฟเวอร์สำรองได้ทันที แต่ระบบจะบล็อกตัวเลือกการลบ แร็กไฟล์ หรือดาวน์โหลด
                    </p>
                  </div>
                ) : (
                  /* Drag and Drop Zone for Evaluator */
                  <div 
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={triggerFileInput}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center ${
                      dragActive 
                        ? 'border-teal-500 bg-teal-50/50' 
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/40 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileSelect}
                      accept=".pdf,.doc,.docx,image/*"
                      className="hidden"
                    />
                    <Upload className={`h-8 w-8 mb-2 ${dragActive ? 'text-teal-600' : 'text-slate-400'}`} />
                    <p className="text-xs font-semibold text-slate-800">ลากแล้ววางที่นี่ หรือ คลิกเพื่อเลือกไฟล์</p>
                    <p className="text-[10px] text-slate-500 mt-1">ประเภทเอกสารที่รองรับ: Word (.doc/.docx), PDF (.pdf), รูปภาพ (.png/.jpg)</p>
                  </div>
                )}
              </div>

              {/* Status Indicator */}
              {(isUploading || previewLoading) && (
                <div className="rounded-lg bg-teal-50 p-2.5 flex items-center justify-center gap-2 border border-teal-100">
                  <svg className="animate-spin h-5 w-5 text-teal-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.162 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-xs text-teal-800 font-semibold">กำลังติดต่อฐานข้อมูลคลาวด์...</span>
                </div>
              )}

              {errorMsg && (
                <div className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-600 flex items-center gap-2 border border-rose-100 font-medium">
                  <AlertCircle className="h-4 w-4" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-800 flex items-center gap-2 border border-emerald-100 font-medium">
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Uploaded File List */}
              <div className="space-y-2">
                <h5 className="text-xs font-bold text-slate-800">ไฟล์อ้างอิงที่แนบไว้ ({itemFiles.length}):</h5>
                {itemFiles.length === 0 ? (
                  <p className="text-xs text-slate-500 italic bg-slate-50 p-3 rounded-lg border border-slate-100">ยังไม่มีเอกสารแนบในข้อนี้</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {itemFiles.map((file) => (
                      <div 
                        key={file.id} 
                        className="flex items-center justify-between rounded-lg border border-slate-100 bg-white p-2.5 hover:shadow-xs transition"
                      >
                        <div className="flex items-center gap-2 max-w-[65%]">
                          {getFileIcon(file.type)}
                          <div className="overflow-hidden">
                            <p className="text-xs text-slate-800 font-bold truncate select-all" title={file.name}>
                              {file.name}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {(file.size / 1024).toFixed(1)} KB • {new Date(file.uploadedAt).toLocaleDateString('th-TH')}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handlePreviewFile(file)}
                            title="ดูตัวอย่างแบบปลอดภัย"
                            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          
                          {role !== 'supervisor' && (
                            <>
                              <button
                                onClick={() => handleDownloadFile(file)}
                                title="ดาวน์โหลดเก็บไว้"
                                className="rounded p-1 text-teal-600 hover:bg-slate-100 hover:text-teal-700 cursor-pointer"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteFile(file.id)}
                                title="ลบออกจากระบบ"
                                className="rounded p-1 text-red-500 hover:bg-rose-50 hover:text-red-600 cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Inline Preview Window */}
          <AnimatePresence>
            {previewFile && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 relative"
              >
                <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    🔎 พรีวิวในระบบคลาวด์: {previewFile.name}
                  </span>
                  <button 
                    onClick={() => setPreviewFile(null)} 
                    className="p-1 hover:bg-slate-200 rounded text-slate-500 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center justify-center bg-white p-3 rounded-lg border border-slate-100 max-h-[300px] overflow-auto">
                  {previewFile.type.startsWith('image/') ? (
                    <img 
                      src={previewFile.data} 
                      alt={previewFile.name} 
                      className="max-h-[260px] object-contain rounded"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="text-center py-6 w-full">
                      <FileText className="h-10 w-10 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-700">{previewFile.name}</p>
                      <p className="text-xs text-slate-500 mt-1">ไฟล์เอกสารทางการอ้างอิง ({previewFile.type.split('/')[1]?.toUpperCase()})</p>
                      
                      {role !== 'supervisor' ? (
                        <button
                          onClick={() => handleDownloadFile(previewFile)}
                          className="mt-3 text-xs inline-flex items-center gap-1 bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg shadow-sm font-semibold transition cursor-pointer"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>ดาวน์โหลดรายละเอียดตัวจริิง</span>
                        </button>
                      ) : (
                        <p className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg mt-3 font-semibold inline-block">
                          ⚠️ นโยบายความปลอดภัย PDPA: ไม่อนุญาตให้ดาวน์โหลดเอกสารต้นฉบับภายนอกเวิร์กสเปซ
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* Modal Sticky Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 rounded-b-2xl">
          {role === 'supervisor' ? (
            <button 
              onClick={onClose}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
            >
              ปิดหน้าต่างตรวจประเมิน
            </button>
          ) : (
            <>
              <button 
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button 
                onClick={handleSave}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-sm transition cursor-pointer flex items-center gap-1.5"
              >
                <Check className="h-4 w-4" />
                <span>บันทึกความก้าวหน้าและการประเมินตนเอง</span>
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
