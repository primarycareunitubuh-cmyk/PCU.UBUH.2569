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
import { db, handleFirestoreError, OperationType } from './firebase';

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
 * Saves an evidence file in the subcollection of an assessment with chunking support
 */
export async function uploadEvidenceFile(
  assessmentId: string, 
  itemId: string, 
  name: string, 
  type: string, 
  size: number, 
  base64Data: string
): Promise<EvidenceFileMeta> {
  const fileId = `${itemId}_${Date.now()}`;
  const fileRef = doc(db, 'assessments', assessmentId, 'files', fileId);
  
  // Create File Metadata Document (Omit heavy 'data' field to keep it under 1MB)
  const fileDocMeta = {
    id: fileId,
    itemId,
    name,
    type,
    size,
    uploadedAt: new Date().toISOString()
  };

  try {
    // 1. Write the metadata document first
    await setDoc(fileRef, fileDocMeta);

    // 2. Chop base64Data into chunks and save them in parallel
    const chunkSize = 500 * 1024; // 500KB chunks
    const uploadPromises: Promise<void>[] = [];
    
    for (let i = 0; i < base64Data.length; i += chunkSize) {
      const chunkStr = base64Data.substring(i, i + chunkSize);
      const chunkIndex = Math.floor(i / chunkSize);
      const chunkRef = doc(db, 'assessments', assessmentId, 'files', fileId, 'chunks', String(chunkIndex));
      
      uploadPromises.push(setDoc(chunkRef, {
        index: chunkIndex,
        data: chunkStr
      }));
    }

    await Promise.all(uploadPromises);

    return {
      ...fileDocMeta
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `assessments/${assessmentId}/files/${fileId}`);
    throw error;
  }
}

/**
 * Retreives full file details (including Base64) to trigger downloads/previews
 */
export async function getEvidenceFileContent(assessmentId: string, fileId: string): Promise<EvidenceFileData | null> {
  const fileRef = doc(db, 'assessments', assessmentId, 'files', fileId);
  try {
    const docSnap = await getDoc(fileRef);
    if (docSnap.exists()) {
      const fileData = docSnap.data() as Record<string, any>;
      
      // Backward compatibility: If file was uploaded with old code where 'data' is a direct string:
      if (typeof fileData.data === 'string' && fileData.data) {
        return fileData as EvidenceFileData;
      }
      
      // Fetch and assemble the chunks
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
      
      // Sort and stitch chunks
      chunksList.sort((a, b) => a.index - b.index);
      const fullBase64 = chunksList.map(c => c.data).join('');
      
      return {
        id: fileData.id,
        itemId: fileData.itemId,
        name: fileData.name,
        type: fileData.type,
        size: fileData.size,
        uploadedAt: fileData.uploadedAt,
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
        uploadedAt: data.uploadedAt
      });
    });
    return files;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `assessments/${assessmentId}/files`);
    return [];
  }
}

/**
 * Deletes a file document by ID and cleans up its chunk subcolleciton
 */
export async function deleteEvidenceFile(assessmentId: string, fileId: string): Promise<void> {
  const fileRef = doc(db, 'assessments', assessmentId, 'files', fileId);
  try {
    // 1. Delete parent document
    await deleteDoc(fileRef);
    
    // 2. Fetch and delete all chunks in its subcollection
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
