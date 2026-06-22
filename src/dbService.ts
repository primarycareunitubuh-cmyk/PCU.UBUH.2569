import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  getDocs, 
  deleteDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from './firebase';
import { PartInfo, AssessmentItem, ASSESSMENT_ITEMS, ASSESSMENT_PARTS } from './data';

export interface AssessmentData {
  id: string; // Sanitized email
  unitEmail: string;
  unitName: string;
  district: string;
  province: string;
  scores: Record<string, number>; // itemId -> score
  notes: Record<string, string>;   // itemId -> note
  evaluated?: Record<string, boolean>; // itemId -> true (has been evaluated)
  updatedAt: string;
}

export interface EvidenceFileMeta {
  id: string;
  itemId: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  url?: string;
  storagePath?: string;
}

export interface EvidenceFileData extends EvidenceFileMeta {
  data: string; // Base64 Data URI
}

/**
 * Saves/updates the main assessment score & notes document in Firestore
 */
export async function saveAssessment(assessment: AssessmentData): Promise<void> {
  const docRef = doc(db, 'assessments', assessment.id);
  const dataToSave = {
    ...assessment,
    updatedAt: new Date().toISOString()
  };
  try {
    await setDoc(docRef, dataToSave, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `assessments/${assessment.id}`);
  }
}

/**
 * Loads an assessment document from Firestore
 */
export async function getAssessment(id: string): Promise<AssessmentData | null> {
  const docRef = doc(db, 'assessments', id);
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as AssessmentData;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `assessments/${id}`);
    return null;
  }
}

/**
 * Fetches all assessments in the database for the supervisor view
 */
export async function getAllAssessments(): Promise<AssessmentData[]> {
  const colRef = collection(db, 'assessments');
  try {
    const qSnap = await getDocs(colRef);
    const list: AssessmentData[] = [];
    qSnap.forEach(docSnap => {
      const data = docSnap.data();
      list.push(data as AssessmentData);
    });
    return list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'assessments');
    return [];
  }
}

/**
 * Saves an evidence file to Google Drive via Google Apps Script and its metadata to Firestore
 */
export async function uploadEvidenceFile(
  assessmentId: string, 
  itemId: string, 
  file: File | Blob, 
  name: string, 
  type: string, 
  size: number
): Promise<EvidenceFileMeta> {
  const fileId = `${itemId}_${Date.now()}`;

  try {
    // 1. Convert file to Base64 String
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    const base64Data = dataUrl.split(',')[1];
    const folderYear = getYearFromAssessmentId(assessmentId);

    // Look up criteria information based on itemId
    const currentItem = ASSESSMENT_ITEMS.find(item => item.id === itemId);
    const itemCode = currentItem ? currentItem.code : '';
    const itemName = currentItem ? currentItem.name : '';
    const currentPartNum = currentItem ? currentItem.part : 1;
    const currentPart = ASSESSMENT_PARTS.find(part => part.index === currentPartNum);
    const partName = currentPart ? currentPart.title : `ส่วนที่ ${currentPartNum}`;

    // Formatting for Google Drive folder separation
    const partFolderName = partName; // e.g. "ส่วนที่ 1 ด้านระบบบริหารจัดการ"
    const itemFolderName = `ข้อ ${itemCode}`; // e.g. "ข้อ 1.1"
    const fullItemFolderName = `ข้อ ${itemCode} ${itemName}`.substring(0, 120);

    // 2. Upload file directly to the user's Google Apps Script Web App (safely bypassing CORS Preflight OPTIONS)
    // Add query parameters for e.parameter-based scripts in addition to JSON body-based scripts
    const baseUrl = 'https://script.google.com/macros/s/AKfycbzB0xAgBngYtD7ptUSh1FQ6Na364rHPOTrBcg4TtAT4gBhWaEnrOzSUYg7iwBiGY_JWcw/exec';
    const queryParams = new URL(baseUrl);
    queryParams.searchParams.set('filename', name);
    queryParams.searchParams.set('fileName', name);
    queryParams.searchParams.set('name', name);
    queryParams.searchParams.set('type', type);
    queryParams.searchParams.set('mimeType', type);
    queryParams.searchParams.set('assessmentId', assessmentId);
    queryParams.searchParams.set('itemId', itemId);
    queryParams.searchParams.set('year', String(folderYear));
    queryParams.searchParams.set('fiscalYear', String(folderYear));
    queryParams.searchParams.set('folderYear', String(folderYear));
    queryParams.searchParams.set('yearFolderName', `ปีงบประมาณ ${folderYear}`);
    
    // Add criteria parameters for subfolder generation
    queryParams.searchParams.set('partFolderName', partFolderName);
    queryParams.searchParams.set('itemFolderName', itemFolderName);
    queryParams.searchParams.set('fullItemFolderName', fullItemFolderName);
    queryParams.searchParams.set('partName', partName);
    queryParams.searchParams.set('itemCode', itemCode);
    queryParams.searchParams.set('itemName', itemName);
    queryParams.searchParams.set('partNumber', String(currentPartNum));

    const scriptUrl = queryParams.toString();

    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8' // text/plain ensures browser handles this as a Simple Request, avoiding preflight rejection by script URL
      },
      body: JSON.stringify({
        // File Name variations
        filename: name,
        fileName: name,
        name: name,
        file_name: name,
        title: name,

        // Mime Type variations
        mimeType: type,
        mimetype: type,
        type: type,
        contentType: type,

        // File Content variations
        file: base64Data,
        base64: base64Data,
        data: base64Data,
        content: base64Data,
        contents: base64Data,

        // Year metadata parameters
        assessmentId: assessmentId,
        itemId: itemId,
        year: folderYear,
        fiscalYear: folderYear,
        folderYear: folderYear,
        yearFolderName: `ปีงบประมาณ ${folderYear}`,

        // Criteria details parameters
        partFolderName,
        itemFolderName,
        fullItemFolderName,
        partName,
        itemCode,
        itemName,
        partNumber: currentPartNum
      })
    });

    if (!response.ok) {
      throw new Error(`Google Apps Script responded with code: ${response.status}`);
    }

    const resText = await response.text();
    let uploadUrl = '';

    try {
      const resJson = JSON.parse(resText);
      uploadUrl = resJson.url || resJson.link || resJson.fileUrl || resJson.webViewLink || '';
      if (!uploadUrl && resJson.id) {
        uploadUrl = `https://drive.google.com/file/d/${resJson.id}/view?usp=drivesdk`;
      }
    } catch {
      if (resText.trim().startsWith('http')) {
        uploadUrl = resText.trim();
      }
    }

    if (!uploadUrl) {
      throw new Error(`อัปโหลดสำเร็จแต่ไม่ได้รับลิงก์ Google Drive กลับคืนมา (คำตอบจากสคริปต์: ${resText.substring(0, 100)})`);
    }

    // 3. Create File Metadata Document in Firestore
    const fileRef = doc(db, 'assessments', assessmentId, 'files', fileId);
    const fileDocMeta: EvidenceFileMeta = {
      id: fileId,
      itemId,
      name,
      type,
      size,
      uploadedAt: new Date().toISOString(),
      url: uploadUrl,
      storagePath: `google-drive://${fileId}` // Marked with custom scheme so we skip Firebase Storage deletion
    };
    
    await setDoc(fileRef, fileDocMeta);

    return fileDocMeta;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `google_drive_via_apps_script`);
    throw error;
  }
}

/**
 * Retreives full file details (including Base64 or URL) to trigger downloads/previews
 */
export async function getEvidenceFileContent(assessmentId: string, fileId: string): Promise<EvidenceFileData | null> {
  const fileRef = doc(db, 'assessments', assessmentId, 'files', fileId);
  try {
    const docSnap = await getDoc(fileRef);
    if (docSnap.exists()) {
      const fileData = docSnap.data() as EvidenceFileData;
      
      // NEW BEHAVIOR: Use Firebase Storage URL directly for data view
      if (fileData.url) {
        return {
          ...fileData,
          data: fileData.url
        };
      }

      // Backward compatibility: If file was uploaded with old code where 'data' is a direct string:
      if (typeof fileData.data === 'string' && fileData.data) {
        return fileData;
      }
      
      // Backward compatibility: Fetch and assemble the chunks
      const chunksColRef = collection(db, 'assessments', assessmentId, 'files', fileId, 'chunks');
      const chunkSnaps = await getDocs(chunksColRef);
      const chunksList: { index: number; data: string }[] = [];
      
      chunkSnaps.forEach(snap => {
        const cData = snap.data();
        if (cData && typeof cData.index === 'number' && typeof cData.data === 'string') {
          chunksList.push({
            index: cData.index,
            data: cData.data
          });
        }
      });
      
      chunksList.sort((a, b) => a.index - b.index);
      const fullBase64 = chunksList.map(c => c.data).join('');
      
      return {
        ...fileData,
        data: fullBase64
      } as EvidenceFileData;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `assessments/${assessmentId}/files/${fileId}`);
    return null;
  }
}

/**
 * Fetches all file metadatas (excluding heavy base64 data to speed up loading)
 * for a specific assessment.
 */
export async function getEvidenceFileList(assessmentId: string): Promise<EvidenceFileMeta[]> {
  const filesColRef = collection(db, 'assessments', assessmentId, 'files');
  try {
    const qSnap = await getDocs(filesColRef);
    const files: EvidenceFileMeta[] = [];
    qSnap.forEach(docSnap => {
      const data = docSnap.data();
      files.push({
        id: data.id,
        itemId: data.itemId,
        name: data.name,
        type: data.type,
        size: data.size,
        uploadedAt: data.uploadedAt,
        url: data.url,
        storagePath: data.storagePath
      });
    });
    return files;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `assessments/${assessmentId}/files`);
    return [];
  }
}

/**
 * Deletes a file document by ID, cleans up Firebase Storage object if exists, 
 * or cleans up legacy chunk subcolleciton
 */
export async function deleteEvidenceFile(assessmentId: string, fileId: string): Promise<void> {
  const fileRef = doc(db, 'assessments', assessmentId, 'files', fileId);
  try {
    const docSnap = await getDoc(fileRef);
    if (!docSnap.exists()) return;
    
    const fileMeta = docSnap.data() as EvidenceFileMeta;

    // 1. Delete parent document from Firestore
    await deleteDoc(fileRef);
    
    // 2a. Delete from Firebase Storage (New Files)
    if (fileMeta.storagePath && !fileMeta.storagePath.startsWith('google-drive://')) {
      const storageRef = ref(storage, fileMeta.storagePath);
      await deleteObject(storageRef).catch(e => console.error("Firebase Storage delete failed for", fileMeta.storagePath, e));
      return;
    }

    // 2b. Fetch and delete all chunks in its subcollection (Legacy Files)
    const chunksColRef = collection(db, 'assessments', assessmentId, 'files', fileId, 'chunks');
    const chunkSnaps = await getDocs(chunksColRef);
    const deletePromises: Promise<void>[] = [];
    
    chunkSnaps.forEach(snap => {
      deletePromises.push(deleteDoc(snap.ref));
    });
    
    await Promise.all(deletePromises);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `assessments/${assessmentId}/files/${fileId}`);
  }
}

export interface ActivityLog {
  id: string;
  userEmail: string;
  userDisplayName?: string;
  unitName: string;
  action: 'edit_evaluation' | 'upload_file' | 'delete_file';
  itemId?: string;
  itemCode?: string;
  itemName?: string;
  details: string;
  timestamp: string;
}

/**
 * Records an activity log inside Firestore for edit history auditing
 */
export async function logActivity(
  userEmail: string,
  userDisplayName: string | undefined,
  unitName: string,
  action: 'edit_evaluation' | 'upload_file' | 'delete_file',
  details: string,
  itemId?: string,
  itemCode?: string,
  itemName?: string
): Promise<void> {
  const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const logRef = doc(db, 'activity_logs', logId);
  const logData: ActivityLog = {
    id: logId,
    userEmail,
    userDisplayName,
    unitName,
    action,
    details,
    itemId,
    itemCode,
    itemName,
    timestamp: new Date().toISOString()
  };
  try {
    await setDoc(logRef, logData);
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}

/**
 * Retrieves all activity logs ordered by timestamp descending
 */
export async function getActivityLogs(): Promise<ActivityLog[]> {
  const colRef = collection(db, 'activity_logs');
  try {
    const qSnap = await getDocs(colRef);
    const list: ActivityLog[] = [];
    qSnap.forEach(docSnap => {
      list.push(docSnap.data() as ActivityLog);
    });
    return list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'activity_logs');
    return [];
  }
}

/**
 * Calculates Buddhist Year from Assessment Document ID
 */
export function getYearFromAssessmentId(assessmentId: string): number {
  if (assessmentId === 'primarycareunit_ubuh_ubu_ac_th') return 2569;
  const match = assessmentId.match(/_(\d{4})$/);
  if (match) {
    return parseInt(match[1]);
  }
  return 2569; // Default fallback is 2569
}

/**
 * Automatically calculates current Thai Fiscal Year (October 1st is start of new FY)
 * Convert to B.E. (Buddhist Era)
 */
export function getCurrentThaiFiscalYear(): number {
  const now = new Date();
  const yearAD = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed (Jan is 1, Oct is 10)
  const fiscalYearAD = month >= 10 ? yearAD + 1 : yearAD;
  return fiscalYearAD + 543; // to B.E.
}

/**
 * Loads dynamic evaluation criteria (Parts and Items) for a specific Fiscal Year
 */
export async function getFiscalYearCriteria(year: number): Promise<{ parts: PartInfo[]; items: AssessmentItem[] } | null> {
  const docRef = doc(db, 'criteria_by_year', String(year));
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        parts: data.parts || [],
        items: data.items || []
      };
    }
    return null;
  } catch (error) {
    console.error(`Failed to load criteria for fiscal year ${year}:`, error);
    return null;
  }
}

/**
 * Saves dynamic evaluation criteria for a specific Fiscal Year in Firestore
 */
export async function saveFiscalYearCriteria(
  year: number,
  parts: PartInfo[],
  items: AssessmentItem[],
  updatedBy: string
): Promise<void> {
  const docRef = doc(db, 'criteria_by_year', String(year));
  try {
    await setDoc(docRef, {
      year,
      parts,
      items,
      updatedAt: new Date().toISOString(),
      updatedBy
    });
  } catch (error) {
    console.error(`Failed to save criteria for fiscal year ${year}:`, error);
    throw error;
  }
}

/**
 * Retrieves all registered Fiscal Years from criteria collection
 */
export async function getAvailableFiscalYears(): Promise<number[]> {
  const colRef = collection(db, 'criteria_by_year');
  try {
    const qSnap = await getDocs(colRef);
    const years: number[] = [];
    qSnap.forEach(docSnap => {
      const y = parseInt(docSnap.id);
      if (!isNaN(y)) {
        years.push(y);
      }
    });
    
    // Always include current fiscal year B.E. 2569 if not yet present
    if (!years.includes(2569)) {
      years.push(2569);
    }
    
    return years.sort((a, b) => b - a); // descending
  } catch (error) {
    console.error("Failed to query criteria years list:", error);
    return [2569];
  }
}
