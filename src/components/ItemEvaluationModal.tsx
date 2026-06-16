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
  ExternalLink,
  Image as ImageIcon 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as mammoth from 'mammoth';
import { AssessmentItem } from '../data';

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const cleanB64 = base64.replace(/\s/g, '');
  const binaryString = window.atob(cleanB64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function base64ToBlob(base64Data: string, contentType: string): Blob {
  const base64Parts = base64Data.split(',');
  const cleanB64 = (base64Parts[1] || base64Parts[0] || '').replace(/\s/g, '');
  const byteCharacters = window.atob(cleanB64);
  const byteArrays = [];
  
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }
  
  return new Blob(byteArrays, { type: contentType });
}
import { 
  uploadEvidenceFile, 
  deleteEvidenceFile, 
  getEvidenceFileContent, 
  EvidenceFileMeta, 
  EvidenceFileData,
  logActivity
} from '../dbService';

interface ItemEvaluationModalProps {
  item: AssessmentItem;
  currentScore: number;
  currentNote: string;
  files: EvidenceFileMeta[];
  assessmentId: string;
  role?: 'editor' | 'supervisor';
  currentUserEmail: string;
  currentUserDisplayName?: string;
  currentUserName: string;
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
  currentUserEmail,
  currentUserDisplayName,
  currentUserName,
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
  const [wordHtml, setWordHtml] = useState<string>('');
  const [wordParsingError, setWordParsingError] = useState<string>('');
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string>('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const previewFileNameLower = previewFile ? previewFile.name.toLowerCase() : '';
  const previewFileTypeLower = previewFile ? (previewFile.type || '').toLowerCase() : '';

  const isPreviewImage = previewFile ? previewFileTypeLower.startsWith('image/') : false;
  const isPreviewPdf = previewFile ? (
    previewFileNameLower.endsWith('.pdf') || 
    previewFileTypeLower.includes('pdf')
  ) : false;
  const isPreviewWord = previewFile ? (
    previewFileNameLower.endsWith('.docx') || 
    previewFileNameLower.endsWith('.doc') || 
    previewFileNameLower.endsWith('.dotx') || 
    previewFileNameLower.endsWith('.dotm') || 
    previewFileNameLower.endsWith('.docm') || 
    previewFileTypeLower.includes('word') || 
    previewFileTypeLower.includes('msword') || 
    previewFileTypeLower.includes('office')
  ) : false;

  useEffect(() => {
    if (!previewFile) {
      setWordHtml('');
      setWordParsingError('');
      setPreviewBlobUrl('');
      return;
    }

    const fileNameLower = previewFile.name.toLowerCase();
    const fileTypeLower = (previewFile.type || '').toLowerCase();

    const isPdfFile = fileNameLower.endsWith('.pdf') || fileTypeLower.includes('pdf');
    const isWordFile = fileNameLower.endsWith('.docx') || 
                       fileNameLower.endsWith('.doc') || 
                       fileNameLower.endsWith('.dotx') || 
                       fileNameLower.endsWith('.dotm') || 
                       fileNameLower.endsWith('.docm') || 
                       fileTypeLower.includes('word') || 
                       fileTypeLower.includes('msword') ||
                       fileTypeLower.includes('office');

    // Set up native Blob URL for secure, sandboxed PDF rendering
    let blobUrl = '';
    try {
      const mimeType = isPdfFile ? 'application/pdf' : previewFile.type;
      const blob = base64ToBlob(previewFile.data, mimeType);
      blobUrl = URL.createObjectURL(blob);
      setPreviewBlobUrl(blobUrl);
    } catch (e) {
      console.error("Failed to build file blob URL:", e);
    }

    if (isWordFile) {
      setWordParsingError('');
      setWordHtml('<p class="text-xs text-slate-400 font-sans animate-pulse">กำลังแปลงไฟล์ Word เพื่อพรีวิว กรุณารอสักครู่...</p>');

      const runMammoth = async () => {
        try {
          const base64Parts = previewFile.data.split(',');
          const base64Data = base64Parts[1] || base64Parts[0];
          const arrayBuffer = base64ToArrayBuffer(base64Data);
          
          const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
          if (result.value) {
            setWordHtml(result.value);
          } else {
            setWordHtml('<p class="text-xs text-slate-500 font-sans italic text-center">ไม่มีเนื้อหาที่สามารถแสดงพรีวิวในไฟล์นี้ได้ หรือไฟล์อยู่ในรูปแบบเก่า (.doc)</p>');
          }
        } catch (err: any) {
          console.error("Mammoth conversion error:", err);
          if (previewFile.name.toLowerCase().endsWith('.doc')) {
            setWordParsingError(role === 'supervisor'
              ? 'เนื่องจากไฟล์มีนามสกุลเก่า (.doc) จึงไม่สามารถแสดงตัวอย่างแบบไดนามิกในเบราว์เซอร์ได้ และไม่สามารถดาวน์โหลดไฟล์ต้นฉบับได้เนื่องจากท่านอยู่ในกลุ่มผู้นิเทศ/Guest'
              : 'เนื่องจากไฟล์มีนามสกุลเก่า (.doc) จึงไม่สามารถแสดงตัวอย่างแบบไดนามิกในเบราว์เซอร์ได้สมบูรณ์ กรุณาคลิก "ดาวน์โหลดเพื่อเปิดอ่านไฟล์เอกสาร" เพื่อเปิดด้วย Microsoft Word หรือใช้สกุล .docx แทน'
            );
          } else {
            setWordParsingError(role === 'supervisor'
              ? 'ระบบไม่สามารถแปลงโครงสร้างไฟล์ Word .docx นี้ได้โดยตรง และไม่สามารถดาวน์โหลดไฟล์ต้นฉบับได้เนื่องจากท่านอยู่ในกลุ่มผู้นิเทศ/Guest'
              : 'ระบบไม่สามารถแปลงโครงสร้างไฟล์ Word .docx นี้ได้โดยตรงในเบราว์เซอร์ กรุณาคลิก "ดาวน์โหลดเพื่อเปิดอ่านไฟล์เอกสาร" ด้านล่างเพื่ออ่านเอกสารตัวเต็ม'
            );
          }
          setWordHtml('');
        }
      };

      runMammoth();
    } else {
      setWordHtml('');
      setWordParsingError('');
    }

    // Auto-revoking on closure/toggle to reclaim browser memory heap
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [previewFile]);
  
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

    // Check size limit: 10MB (Chunked Firestore uploads)
    const LIMIT_BYTES = 10 * 1024 * 1024;
    if (file.size > LIMIT_BYTES) {
      setErrorMsg(`ไฟล์ "${file.name}" มีขนาดเกินเกณฑ์ 10MB (ขนาดปัจจุบัน: ${(file.size / (1024 * 1024)).toFixed(2)} MB) กรุณาใช้ไฟล์ที่มีขนาดเล็กลง`);
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
          
          try {
            await logActivity(
              currentUserEmail,
              currentUserDisplayName,
              currentUserName,
              'upload_file',
              `อัปโหลดไฟล์หลักฐาน "${file.name}" (${(file.size / (1024 * 1024)).toFixed(2)} MB)`,
              item.id,
              item.code,
              item.name
            );
          } catch (logErr) {
            console.error("Failed to log activity:", logErr);
          }

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

  const handleOpenInNewWindow = async (fileMeta: EvidenceFileMeta) => {
    setPreviewLoading(true);
    setErrorMsg('');
    try {
      const fileData = await getEvidenceFileContent(assessmentId, fileMeta.id);
      if (!fileData) {
        setErrorMsg('ไม่สามารถดึงข้อมูลเนื้อหาไฟล์จาก Firestore คลาวด์');
        return;
      }

      const fileType = fileData.type || '';
      const fileNameLower = fileData.name.toLowerCase();
      const fileTypeLower = fileType.toLowerCase();

      const isPdf = fileNameLower.endsWith('.pdf') || fileTypeLower.includes('pdf');
      const isWord = fileNameLower.endsWith('.docx') || 
                     fileNameLower.endsWith('.doc') || 
                     fileNameLower.endsWith('.dotx') || 
                     fileNameLower.endsWith('.dotm') || 
                     fileNameLower.endsWith('.docm') || 
                     fileTypeLower.includes('word') || 
                     fileTypeLower.includes('msword') ||
                     fileTypeLower.includes('office');
      const isImage = fileTypeLower.startsWith('image/');

      const mimeType = isPdf ? 'application/pdf' : fileType;

      // Convert Base64 data to native Blob Object URL
      const blob = base64ToBlob(fileData.data, mimeType);
      const blobUrl = URL.createObjectURL(blob);

      if (isPdf || isImage) {
        const win = window.open(blobUrl, '_blank');
        if (!win) {
          setErrorMsg('เบราว์เซอร์บล็อกการเปิดป๊อปอัป กรุณาอนุมัติสิทธิ์ป๊อปอัป (Popups) ในเบราว์เซอร์ของท่านเพื่อเข้าถึงพรีวิวในหน้าใหม่');
        }
        setPreviewLoading(false);
        return;
      }

      const win = window.open('', '_blank');
      if (!win) {
        setErrorMsg('เบราว์เซอร์บล็อกการเปิดป๊อปอัป กรุณาอนุมัติสิทธิ์ป๊อปอัป (Popups) ในเบราว์เซอร์ของท่านเพื่อเข้าถึงพรีวิวในหน้าใหม่');
        setPreviewLoading(false);
        return;
      }

      let wordContentHtml = '';
      if (isWord) {
        try {
          const base64Parts = fileData.data.split(',');
          const base64Data = base64Parts[1] || base64Parts[0];
          const arrayBuffer = base64ToArrayBuffer(base64Data);
          const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
          wordContentHtml = result.value || '<p class="text-slate-500 italic">ไม่มีเนื้อหาที่สามารถแสดงในไฟล์นี้ได้ หรือไฟล์อยู่ในรูปแบบเก่า (.doc)</p>';
        } catch (err) {
          console.error("Mammoth error:", err);
          if (fileData.name.endsWith('.doc')) {
            wordContentHtml = `
              <div style="padding: 20px; background-color: #fffbdf; border: 1px solid #ffeeba; color: #856404; border-radius: 8px; font-family: sans-serif;">
                <strong>⚠️ รูปแบบไฟล์เก่า (.doc):</strong> เนื่องจากไฟล์นี้เป็นรูปแบบเอกสาร Word รุ่นเก่า (.doc) จึงไม่สามารถแสดงแบบไลฟ์ได้สมบูรณ์ในเบราว์เซอร์ 
                กรุณาใช้ปุ่ม <strong>"ดาวน์โหลดเพื่อเปิดด้วย Microsoft Word"</strong> เพื่อเปิดเอกสารออฟไลน์ได้อย่างสมบูรณ์แบบ
              </div>
            `;
          } else {
            wordContentHtml = `
              <div style="padding: 20px; background-color: #fffbdf; border: 1px solid #ffeeba; color: #856404; border-radius: 8px; font-family: sans-serif;">
                <strong>⚠️ ไม่สามารถเรนเดอร์โครงสร้างได้:</strong> เบราว์เซอร์ไม่สามารถแปลงโครงสร้างไฟล์ .docx นี้ได้โดยตรง 
                กรุณาใช้ปุ่ม <strong>"ดาวน์โหลดเพื่อเปิดอ่านเอกสารดั้งเดิม"</strong> เพื่อเปิดบนเครื่องของคุณ
              </div>
            `;
          }
        }
      }

      win.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>${fileData.name} - ระบบตรวจภาพพรีวิวเอกสารอ้างอิง</title>
            <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
            <style>
              body {
                margin: 0;
                padding: 0;
                font-family: 'Sarabun', 'Inter', sans-serif;
                background-color: #f8fafc;
                color: #1e293b;
                display: flex;
                flex-direction: column;
                height: 100vh;
              }
              header {
                background: linear-gradient(135deg, #0f766e 0%, #0d9488 100%);
                color: white;
                padding: 16px 24px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
                z-index: 10;
              }
              .logo-container {
                display: flex;
                align-items: center;
                gap: 12px;
              }
              .logo {
                background-color: rgba(255, 255, 255, 0.15);
                border: 1px solid rgba(255, 255, 255, 0.25);
                border-radius: 50%;
                width: 38px;
                height: 38px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
              }
              .title-group {
                display: flex;
                flex-direction: column;
              }
              .file-title {
                font-size: 14px;
                font-weight: 700;
                letter-spacing: -0.1px;
                max-width: 500px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }
              .subtitle {
                font-size: 10px;
                color: #ccfbf1;
                font-weight: 500;
                margin-top: 1px;
              }
              .btn-group {
                display: flex;
                align-items: center;
                gap: 12px;
              }
              .btn {
                text-decoration: none;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 10px 18px;
                border-radius: 10px;
                font-size: 11.5px;
                font-weight: 700;
                border: none;
                cursor: pointer;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
              }
              .btn-download {
                background-color: #ffffff;
                color: #0d9488;
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
              }
              .btn-download:hover {
                background-color: #f0fdfa;
                transform: translateY(-1px);
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              }
              .btn-close {
                background-color: rgba(0, 0, 0, 0.2);
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.1);
              }
              .btn-close:hover {
                background-color: rgba(0, 0, 0, 0.35);
              }
              .viewer-container {
                flex: 1;
                width: 100%;
                display: flex;
                justify-content: center;
                align-items: stretch;
                overflow: hidden;
                position: relative;
              }
              .pdf-viewer {
                width: 100%;
                height: 100%;
                border: none;
                background-color: #525659;
              }
              .image-wrapper {
                width: 100%;
                overflow: auto;
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 24px;
                background-color: #1e293b;
              }
              .image-preview {
                max-width: 100%;
                max-height: 85vh;
                object-fit: contain;
                border-radius: 12px;
                box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3);
              }
              .word-canvas {
                width: 100%;
                overflow-y: auto;
                padding: 36px 24px;
                display: flex;
                justify-content: center;
              }
              .word-document {
                background-color: white;
                width: 100%;
                max-width: 820px;
                padding: 55px 65px;
                border-radius: 16px;
                box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03), 0 20px 25px -5px rgba(0,0,0,0.05);
                border: 1px solid #e2e8f0;
                line-height: 1.8;
                font-size: 15.5px;
                min-height: 297mm;
                box-sizing: border-box;
              }
              /* Word converted HTML styles */
              .word-document table {
                border-collapse: collapse;
                width: 100%;
                margin: 20px 0;
              }
              .word-document table, .word-document th, .word-document td {
                border: 1px solid #cbd5e1;
                padding: 12px 14px;
              }
              .word-document th {
                background-color: #f8fafc;
                font-weight: 700;
              }
              .word-document p {
                margin: 0 0 14px 0;
              }
              .word-document h1, .word-document h2, .word-document h3 {
                color: #0f766e;
                margin-top: 24px;
              }
              .fallback-alert {
                padding: 50px;
                text-align: center;
                background-color: #1e293b;
                color: white;
                height: 100%;
                width: 100%;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                box-sizing: border-box;
              }
              .fallback-icon {
                font-size: 54px;
                margin-bottom: 20px;
              }
              .fallback-alert h2 {
                margin: 0 0 10px 0;
                font-size: 20px;
                font-weight: 700;
              }
              .fallback-alert p {
                color: #94a3b8;
                font-size: 14px;
                margin-bottom: 24px;
                max-width: 440px;
                line-height: 1.6;
              }
            </style>
          </head>
          <body>
            <header>
              <div class="logo-container">
                <div class="logo">📄</div>
                <div class="title-group">
                  <span class="file-title">พรีวิวตรวจประเมิน: ${fileData.name}</span>
                  <span class="subtitle">ระบบคลาวด์สำรองสำหรับผู้นิเทศ (Guest) และสหสาขา • ขนาด: ${(fileData.size / 1024).toFixed(1)} KB</span>
                </div>
              </div>
              <div class="btn-group">
                ${role !== 'supervisor' ? `
                <a href="${blobUrl}" download="${fileData.name}" class="btn btn-download">
                  💾 ดาวน์โหลดไฟล์เอกสารต้นฉบับ (${fileData.name.split('.').pop()?.toUpperCase()})
                </a>
                ` : ''}
                <button onclick="window.close()" class="btn btn-close">ปิดหน้าต่างพรีวิว</button>
              </div>
            </header>
            
            <div class="viewer-container">
              ${
                isPdf 
                  ? `<object data="${blobUrl}" type="application/pdf" class="pdf-viewer">
                      <embed src="${blobUrl}" type="application/pdf" class="pdf-viewer" />
                      <p style="padding: 40px; text-align: center; color: white; width: 100%;">
                        เบราว์เซอร์ไม่สนับสนุนการแสดงผลแบบฝังในหน้าต่างนี้ 
                        <br/>
                        <a href="${blobUrl}" target="_blank" style="color: #38bdf8; text-decoration: underline; font-weight: bold; margin-top: 10px; display: inline-block;">
                          คลิกที่นี่เพื่อเปิดหน้าต่าง PDF ด่วนแยกอิสระแบบ Fullscreen 🚀
                        </a>
                      </p>
                    </object>` 
                  : isImage 
                    ? `<div class="image-wrapper"><img src="${fileData.data}" class="image-preview" /></div>`
                    : isWord 
                      ? `<div class="word-canvas"><div class="word-document">${wordContentHtml}</div></div>`
                      : `<div class="fallback-alert">
                          <div class="fallback-icon">📂</div>
                          <h2>เบราว์เซอร์ไม่สนับสนุนการแสดงผลแบบไดนามิก</h2>
                          <p>${role === 'supervisor' 
                            ? 'ขออภัย ผู้นิเทศ/Guest ไม่สามารถดาวน์โหลดไฟล์เอกสารออกจากระบบได้ตามหลักนโยบายรักษาความปลอดภัยข้อมูลของโรงพยาบาล' 
                            : 'นามสกุลไฟล์หรือรูปแบบฟอร์แมตเอกสารนี้ ไม่รองรับการเรนเดอร์สดบนหน้าเว็บ ท่านสามารถใช้งานไฟล์ได้อย่างปลอดภัยโดยการดาวน์โหลดไฟล์ดั้งเดิมแทน'}</p>
                          ${role !== 'supervisor' ? `
                          <a href="${blobUrl}" download="${fileData.name}" class="btn btn-download" style="background-color: #0d9488; color: white;">ดาวน์โหลดเอกสารออฟไลน์เพื่อเปิดทันที</a>
                          ` : ''}
                         </div>`
              }
            </div>
          </body>
        </html>
      `);
      win.document.close();
    } catch (err) {
      console.error("Open in new window failed:", err);
      setErrorMsg('เกิดปัญหาในการสื่อสารหรือโหลดไฟล์จากคลาวด์ หรือเบราว์เซอร์บล็อกหน้าต่างแยก');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownloadFile = async (file: EvidenceFileMeta | EvidenceFileData) => {
    if (role === 'supervisor') {
      setErrorMsg('ขออภัย ผู้นิเทศ/Guest สามารถดูตัวอย่างบนเว็บบราวเซอร์ได้เท่านั้น ไม่สามารถดาวน์โหลดไฟล์ได้ในทุกกรณี');
      return;
    }
    try {
      let base64Data = '';
      let fileType = file.type;
      if ('data' in file) {
        base64Data = file.data;
      } else {
        const full = await getEvidenceFileContent(assessmentId, file.id);
        if (!full) throw new Error('Empty file content');
        base64Data = full.data;
        fileType = full.type;
      }

      // Convert Base64 data to native Blob Object URL
      const blob = base64ToBlob(base64Data, fileType);
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up memory after trigger trigger
      setTimeout(() => URL.revokeObjectURL(blobUrl), 150);
    } catch (err) {
      alert('ไม่สามารถดาวน์โหลดหรือประมวลผลไฟล์ชิ้นนี้ได้');
    }
  };

  const handleDeleteFile = async (id: string) => {
    if (role === 'supervisor') return;
    try {
      const fileMeta = itemFiles.find(f => f.id === id);
      const fileName = fileMeta ? fileMeta.name : id;

      await deleteEvidenceFile(assessmentId, id);
      
      try {
        await logActivity(
          currentUserEmail,
          currentUserDisplayName,
          currentUserName,
          'delete_file',
          `ลบไฟล์หลักฐาน "${fileName}"`,
          item.id,
          item.code,
          item.name
        );
      } catch (logErr) {
        console.error("Failed to log activity:", logErr);
      }

      onFilesChanged();
    } catch (err) {
      alert('ไม่สามารถลบไฟล์ออกจากระบบคลาวด์ได้');
    }
  };

  const handleSave = () => {
    if (role === 'supervisor') return;
    onSaveItem(score, note);
  };

  const getFileIcon = (mimeType: string, filename: string = '') => {
    const nameLower = filename.toLowerCase();
    const typeLower = mimeType.toLowerCase();
    if (typeLower.includes('pdf') || nameLower.endsWith('.pdf')) {
      return <FileText className="h-6 w-6 text-red-500" />;
    }
    if (typeLower.includes('image') || nameLower.endsWith('.png') || nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg')) {
      return <ImageIcon className="h-6 w-6 text-indigo-500" />;
    }
    if (
      typeLower.includes('msword') || 
      typeLower.includes('officedocument') || 
      nameLower.endsWith('.docx') || 
      nameLower.endsWith('.doc') || 
      nameLower.endsWith('.dotx') || 
      nameLower.endsWith('.dotm') || 
      nameLower.endsWith('.docm')
    ) {
      return <FileText className="h-6 w-6 text-blue-500" />;
    }
    return <FileCode className="h-6 w-6 text-teal-500" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-xl p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-4xl rounded-[2rem] bg-white/95 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-white/60 flex flex-col max-h-[90vh] overflow-hidden backdrop-blur-2xl"
      >
        {/* Sticky Modal Title */}
        <div className="flex items-center justify-between border-b border-slate-100/50 bg-gradient-to-r from-teal-50 to-emerald-50 px-8 py-5">
          <div>
            <span className="inline-flex rounded-full bg-teal-600/10 px-3 py-1 text-[11px] font-bold tracking-wider uppercase text-teal-800">
              ข้อที่ {item.code} (คะแนนเต็ม {item.maxScore} คะแนน)
            </span>
            <h3 className="text-base font-bold text-slate-900 mt-2 line-clamp-1">{item.name}</h3>
          </div>
          <button 
            onClick={onClose}
            className="rounded-full p-2.5 text-slate-400 bg-white shadow-sm hover:bg-slate-50 hover:text-rose-500 transition cursor-pointer border border-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Scroll Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          
          {/* Goal Guidelines / Description */}
          <div className="rounded-[2rem] border border-teal-100 bg-teal-50/30 p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 h-48 w-48 bg-teal-400/10 rounded-full blur-3xl -z-10 translate-x-10 -translate-y-10" />
            <h4 className="text-[13px] font-extrabold text-teal-900 uppercase tracking-widest">รายละเอียดเกณฑ์และแนวทางประเมิน</h4>
            <p className="text-[15px] font-medium text-slate-700 mt-3 leading-relaxed">{item.description}</p>
            
            <h5 className="text-[13px] font-extrabold text-teal-950 uppercase tracking-wider mt-6 flex items-center gap-2 mb-4">
              <span className="h-2 w-2 rounded-full bg-teal-500" />
              รายการสิ่งที่ต้องมี (ระบบจะช่วยคำนวณขั้นต่ำ)
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              {item.evidence.map((ev, index) => {
                const isChecked = checkedEvidence.includes(ev);
                return (
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    key={index}
                    type="button"
                    disabled={role === 'supervisor'}
                    onClick={() => toggleEvidence(ev)}
                    className={`flex items-start gap-4 p-5 rounded-2xl border text-left text-[14px] transition-all duration-300 cursor-pointer select-none group w-full shadow-sm ${
                      isChecked
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-900 font-bold shadow-md'
                        : 'border-slate-200/60 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 hover:border-teal-200 hover:shadow-md'
                    } disabled:pointer-events-none`}
                  >
                    <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-all duration-300 ${
                      isChecked 
                        ? 'border-emerald-500 bg-emerald-500 text-white shadow-inner scale-110' 
                        : 'border-slate-300 bg-white group-hover:border-teal-400'
                    }`}>
                      {isChecked && <Check className="h-4 w-4 stroke-[3]" />}
                    </div>
                    <span className="leading-relaxed">{ev}</span>
                  </motion.button>
                );
              })}
            </div>

            {item.evidence.length > 0 && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-emerald-500/10 border border-emerald-200/50 p-5 text-[13px] text-emerald-900 shadow-sm"
              >
                <span className="font-extrabold flex items-center gap-2">
                  <span className="flex h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
                  <span>สัดส่วนผ่าน {checkedEvidence.length} จาก {item.evidence.length} รายการ</span>
                </span>
                {role !== 'supervisor' && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={applyRecommendedScore}
                    className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-full shadow-md transition-all text-[13px] cursor-pointer hover:shadow-emerald-500/30"
                  >
                    <span>ใช้คะแนนที่คำนวณ ({recommendedScore})</span>
                  </motion.button>
                )}
              </motion.div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            
            {/* Left Column: Scoring & Notes */}
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                  <span className="h-4 w-4 rounded bg-teal-100 text-teal-700 flex items-center justify-center">1</span>
                  ให้คะแนนการประเมิน
                </label>
                <div className="flex items-center gap-3">
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={decrementScore}
                    type="button"
                    disabled={role === 'supervisor'}
                    className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 transition shadow-sm font-bold disabled:opacity-40"
                  >
                    -
                  </motion.button>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max={item.maxScore}
                    value={score}
                    disabled={role === 'supervisor'}
                    onChange={(e) => handleScoreChange(e.target.value)}
                    className="h-12 w-28 rounded-xl border-2 border-slate-200 text-center font-bold text-lg text-slate-900 outline-none focus:border-teal-500 focus:bg-teal-50/30 transition disabled:bg-slate-100"
                  />
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={incrementScore}
                    type="button"
                    disabled={role === 'supervisor'}
                    className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 transition shadow-sm font-bold disabled:opacity-40"
                  >
                    +
                  </motion.button>
                  <span className="text-xs text-slate-500 font-medium ml-2">/ {item.maxScore} Max</span>
                </div>
                {score > item.maxScore && (
                  <p className="text-[11px] text-rose-500 font-bold mt-2">คะแนนเกินเพดานสูงสุด</p>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                  <span className="h-4 w-4 rounded bg-teal-100 text-teal-700 flex items-center justify-center">2</span>
                  บันทึกข้อค้นพบ / คำอธิบาย
                </label>
                <textarea
                  value={note}
                  disabled={role === 'supervisor'}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="ระบุคำอธิบาย หรือแหล่งอ้างอิงที่สามารถหาเอกสารยืนยัน..."
                  rows={5}
                  className="w-full text-sm font-medium rounded-xl border-2 border-slate-200 p-4 bg-slate-50/50 focus:bg-white focus:border-teal-400 transition outline-none disabled:opacity-75 disabled:bg-slate-100 placeholder:font-normal placeholder:text-slate-400 resize-none leading-relaxed"
                />
              </div>
            </div>

            {/* Right Column: File Upload & Evidence Attachments */}
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                  <span className="h-4 w-4 rounded bg-teal-100 text-teal-700 flex items-center justify-center">3</span>
                  อัปโหลดหลักฐานแนบ (สูงสุด 10MB)
                </label>
                
                {role === 'supervisor' ? (
                  /* Read-only feedback layout for supervisor */
                  <div className="rounded-[1.5rem] border border-dashed border-indigo-200 bg-indigo-50/50 p-8 text-center flex flex-col items-center justify-center h-48">
                    <div className="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center mb-3">
                      <Lock className="h-6 w-6 text-indigo-500" />
                    </div>
                    <p className="text-sm font-bold text-indigo-900">โหมดผู้นิเทศ (อ่านอย่างเดียว)</p>
                    <p className="text-xs text-indigo-600/80 mt-2 leading-relaxed max-w-[280px]">
                      สามารถเปิดดูตัวอย่างไฟล์หลักฐานบนเบราว์เซอร์ได้เท่านั้น ไม่สามารถดาวน์โหลดหรือเพิ่ม/ลบไฟล์หลักฐานได้
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
                    className={`border-2 border-dashed rounded-[1.5rem] h-48 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center ${
                      dragActive 
                        ? 'border-teal-500 bg-teal-50/80 scale-[1.02]' 
                        : 'border-slate-200 hover:border-teal-300 bg-slate-50/50 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileSelect}
                      accept=".pdf,.doc,.docx,.dotx,.dotm,.docm,image/*"
                      className="hidden"
                    />
                    <div className={`h-12 w-12 rounded-full mb-3 flex items-center justify-center transition-colors ${dragActive ? 'bg-teal-200/50' : 'bg-white shadow-sm border border-slate-100'}`}>
                      <Upload className={`h-5 w-5 ${dragActive ? 'text-teal-600' : 'text-slate-400'}`} />
                    </div>
                    <p className="text-sm font-bold text-slate-700">ลากแล้ววาง หรือคลิกเพื่อแนบไฟล์</p>
                    <p className="text-[11px] text-slate-500 mt-1.5 font-medium px-4">PDF, Word Document, รูปภาพ</p>
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
                          {getFileIcon(file.type, file.name)}
                          <div className="overflow-hidden">
                            <p className="text-xs text-slate-800 font-bold truncate select-all" title={file.name}>
                              {file.name}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {(file.size / 1024).toFixed(1)} KB • {new Date(file.uploadedAt).toLocaleDateString('th-TH')}
                            </p>
                          </div>
                        </div>

                        {deleteConfirmId === file.id ? (
                          <div className="flex items-center gap-1 bg-red-50 px-2 py-1 rounded-lg border border-red-100 animate-fade-in">
                            <span className="text-[10px] font-bold text-red-700 font-sans">ลบถาวร?</span>
                            <button
                              onClick={() => {
                                handleDeleteFile(file.id);
                                setDeleteConfirmId(null);
                              }}
                              className="text-[10px] bg-red-600 hover:bg-red-700 text-white font-bold px-2 py-0.5 rounded cursor-pointer transition shadow-xs"
                            >
                              ใช่ ลบเลย
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-2 py-0.5 rounded cursor-pointer transition"
                            >
                              ไม่
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handlePreviewFile(file)}
                              title="ดูตัวอย่างบนหน้าจอนี้"
                              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
                            >
                              <Eye className="h-4 w-4" />
                            </button>

                            <button
                              onClick={() => handleOpenInNewWindow(file)}
                              title="เปิดพรีวิวเต็มตาในแท็บใหม่ (แนะนำสำหรับผู้นิเทศ/Guest)"
                              className="rounded p-1 text-blue-600 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </button>
                            
                            {role !== 'supervisor' && (
                              <button
                                onClick={() => handleDownloadFile(file)}
                                title="ดาวน์โหลดไฟล์ต้นฉบับ"
                                className="rounded p-1 text-teal-600 hover:bg-slate-100 hover:text-teal-700 cursor-pointer"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                            )}

                            {role !== 'supervisor' && (
                              <button
                                onClick={() => setDeleteConfirmId(file.id)}
                                title="ลบออกจากระบบ"
                                className="rounded p-1 text-red-500 hover:bg-rose-50 hover:text-red-600 cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
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

                <div className="flex items-center justify-center bg-white p-4 rounded-lg border border-slate-100 max-h-[650px] overflow-auto w-full">
                  {isPreviewImage ? (
                    <img 
                      src={previewFile.data} 
                      alt={previewFile.name} 
                      className="max-h-[500px] object-contain rounded shadow-xs"
                      referrerPolicy="no-referrer"
                    />
                  ) : isPreviewPdf ? (
                    <div className="w-full flex flex-col items-center gap-4">
                      {previewBlobUrl ? (
                        <div className="w-full relative text-left">
                          <div className="bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-indigo-500/15 border border-indigo-200/60 rounded-2xl p-5 mb-5 shadow-xs font-sans">
                            <div className="flex items-start gap-3">
                              <span className="text-2xl mt-0.5">💡</span>
                              <div>
                                <h4 className="text-sm font-bold text-slate-800 leading-normal">
                                  คำแนะนำสำหรับการเปิดเข้าชมเอกสาร PDF อ้างอิง
                                </h4>
                                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                                  เนื่องด้วยนโยบายความปลอดภัยสูงสุดของเบราว์เซอร์ รวมถึงกรณีแสดงผลผ่านช่องทาง Sandboxed iFrame ระบบขอแนะนำให้ท่านเปิดอ่านแบบดั้งเดิมเต็มหน้าจอในแท็บใหม่ เพื่อการเรนเดอร์ตัวหนังสือที่แม่นยำและสมบูรณ์ 100%
                                </p>
                                
                                {role === 'supervisor' && (
                                  <div className="mt-2.5 inline-block bg-indigo-50 border border-indigo-100 text-[11px] font-semibold text-indigo-700 px-3 py-1 rounded-lg">
                                    🔒 คุณลักษณะจำกัดโหมดผู้นิเทศ (Guest): ปิดการดาวน์โหลดเอกสารออกนอกเครื่อง แต่ยังสามารถเปิดดูพรีวิวบนหน้าเว็บได้ตามปกติ
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="mt-4 flex flex-wrap gap-2.5">
                              <button
                                onClick={() => handleOpenInNewWindow(previewFile)}
                                className="text-xs inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl shadow-md font-bold transition hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                              >
                                <ExternalLink className="h-4 w-4" />
                                <span>📄 คลิกตรงนี้เพื่อเปิดพรีวิว PDF ตัวเต็มในแท็บใหม่ (แนะนำมากที่สุดสำหรับทุกอุปกรณ์)</span>
                              </button>
                            </div>
                          </div>

                          {/* Hidden on mobile to avoid broken rendering */}
                          <div className="hidden md:block">
                            <div className="text-[11px] text-slate-500 mb-2 font-mono flex items-center gap-1.5 justify-center">
                              <span>⬇️ พรีวิวสำรองผ่านช่องทาง Embedded Engine (หากบราวเซอร์ของท่านบล็อกป็อปอัป)</span>
                            </div>
                            <object 
                              data={previewBlobUrl} 
                              type="application/pdf"
                              className="w-full h-[550px] rounded-xl border border-slate-200 shadow-inner"
                            >
                              <iframe 
                                src={previewBlobUrl} 
                                title={previewFile.name}
                                className="w-full h-[550px] rounded-xl border border-slate-200"
                              />
                            </object>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 font-semibold animate-pulse py-12">กำลังประมวลผลพรีวิว PDF...</p>
                      )}
                      
                      <div className="flex flex-wrap gap-3 justify-center">
                        <button
                          onClick={() => handleOpenInNewWindow(previewFile)}
                          className="text-xs inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl shadow-xs font-bold transition cursor-pointer"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>เปิดพรีวิว PDF เต็มจอในแท็บใหม่</span>
                        </button>
                        
                        {role !== 'supervisor' && (
                          <button
                            onClick={() => handleDownloadFile(previewFile)}
                            className="text-xs inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl shadow-xs font-bold transition cursor-pointer"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>ดาวน์โหลดไฟล์ PDF ต้นฉบับ</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : isPreviewWord && !wordParsingError ? (
                    <div className="w-full max-h-[550px] overflow-auto px-5 py-4 bg-slate-50/50 text-slate-800 rounded-xl max-w-none text-left">
                      <div className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl p-3.5 mb-4 leading-relaxed font-sans font-semibold">
                        💡 <strong className="font-bold">ระบบแสดงผลลัพธ์พรีวิวเอกสารอัตโนมัติ:</strong> จำลองการเรนเดอร์โครงสร้างและตัวอักษรของคลาวด์เอกสารต้นฉบับ 
                        {role !== 'supervisor' && ' (หากข้อความหรือตารางมีความซับซ้อนและเรนเดอร์ไม่ครบถ้วน ท่านสามารถกดดาวน์โหลดไฟล์ต้นฉบับเพื่อความปลอดภัยและเปิดบนเซิร์ฟเวอร์แบบออฟไลน์ได้โดยไม่มีข้อจำกัด)'}
                      </div>
                      
                      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs font-sans text-sm space-y-4 prose prose-slate max-w-none">
                        <div 
                          dangerouslySetInnerHTML={{ __html: wordHtml }} 
                          className="word-converted-content overflow-x-auto"
                        />
                      </div>

                      <div className="mt-5 flex justify-center gap-3">
                        <button
                          onClick={() => handleOpenInNewWindow(previewFile)}
                          className="text-xs inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl shadow-xs font-bold transition cursor-pointer"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>เปิดดูพรีวิว Word ในหน้าต่างใหม่ (แนะนำสำหรับผู้นิเทศ/Guest)</span>
                        </button>
                        
                        {role !== 'supervisor' && (
                          <button
                            onClick={() => handleDownloadFile(previewFile)}
                            className="text-xs inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl shadow-xs font-semibold transition cursor-pointer"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>ดาวน์โหลดไฟล์เอกสารต้นฉบับ ({previewFile.name.split('.').pop()?.toUpperCase()})</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 w-full animate-fade-in">
                      <FileText className="h-12 w-12 text-blue-550 mx-auto mb-2 animate-bounce" />
                      <p className="text-sm font-bold text-slate-700">{previewFile.name}</p>
                      
                      {wordParsingError ? (
                        <div className="my-3 mx-auto max-w-md p-3.5 bg-amber-50 border border-amber-200 text-amber-850 text-xs rounded-xl text-left leading-relaxed font-sans font-semibold animate-pulse">
                          ⚠️ {wordParsingError}
                        </div>
                      ) : (
                        <>
                          <p className="text-xs text-slate-500 mt-1">ไฟล์เอกสาร Word หรือ ไฟล์อ้างอิงอื่นๆ (.doc / .docx 或 format อื่นๆ)</p>
                          <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
                            {role === 'supervisor' 
                              ? 'ต้องการเปิดดูพรีวิวในโหมดปลอดภัยของผู้นิเทศ/Guest เพื่อความสะดวกรวดเร็วกรุณาคลิกปุ่ม "เปิดดูในหน้าต่างใหม่"'
                              : 'ต้องการเปิดดูพรีวิวและดาวน์โหลดในโหมดปลอดภัยเพื่อความสะดวกรวดเร็วกรุณาใช้คลิกปุ่ม "เปิดดูในหน้าต่างใหม่" หรือ "ดาวน์โหลดเพื่อเปิดด้วย Microsoft Word"'}
                          </p>
                        </>
                      )}
                      
                      <div className="mt-4 flex justify-center gap-3">
                        <button
                          onClick={() => handleOpenInNewWindow(previewFile)}
                          className="text-xs inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl shadow-xs font-bold transition cursor-pointer"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>เปิดดูพรีวิวประเมินในหน้าต่างใหม่ (Popout Viewer)</span>
                        </button>
                        
                        {role !== 'supervisor' && (
                          <button
                            onClick={() => handleDownloadFile(previewFile)}
                            className="text-xs inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl shadow-xs font-semibold transition cursor-pointer"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>ดาวน์โหลดไฟล์เอกสารต้นฉบับ</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* Modal Sticky Footer */}
        <div className="bg-slate-50/80 backdrop-blur-md px-8 py-5 border-t border-slate-100 flex items-center justify-end gap-3 rounded-b-[2rem]">
          {role === 'supervisor' ? (
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onClose}
              className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full text-sm font-bold shadow-md transition cursor-pointer"
            >
              ปิดหน้าต่างตรวจประเมิน
            </motion.button>
          ) : (
            <>
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                className="px-6 py-2.5 bg-white border-2 border-slate-100 hover:border-slate-200 hover:bg-slate-50 text-slate-600 rounded-full text-sm font-bold shadow-sm transition cursor-pointer"
              >
                ยกเลิก
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSave}
                className="px-6 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-full text-sm font-bold shadow-md shadow-teal-500/20 transition cursor-pointer flex items-center gap-2"
              >
                <Check className="h-4 w-4" />
                <span>บันทึกและปิดหน้าต่าง</span>
              </motion.button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
