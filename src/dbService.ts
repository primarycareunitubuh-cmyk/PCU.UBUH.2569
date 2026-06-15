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
 * Saves an evidence file in the subcollection of an assessment
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
  
  const fileDoc: EvidenceFileData = {
    id: fileId,
    itemId,
    name,
    type,
    size,
    data: base64Data,
    uploadedAt: new Date().toISOString()
  };

  try {
    await setDoc(fileRef, fileDoc);
    return {
      id: fileId,
      itemId,
      name,
      type,
      size,
      uploadedAt: fileDoc.uploadedAt
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `assessments/${assessmentId}/files/${fileId}`);
    throw error;
  }
}

/**
 * Retreives full file details (including Base64) to trigger downlads/previews
 */
export async function getEvidenceFileContent(assessmentId: string, fileId: string): Promise<EvidenceFileData | null> {
  const fileRef = doc(db, 'assessments', assessmentId, 'files', fileId);
  try {
    const docSnap = await getDoc(fileRef);
    if (docSnap.exists()) {
      return docSnap.data() as EvidenceFileData;
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
 * Deletes a file document by ID
 */
export async function deleteEvidenceFile(assessmentId: string, fileId: string): Promise<void> {
  const fileRef = doc(db, 'assessments', assessmentId, 'files', fileId);
  try {
    await deleteDoc(fileRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `assessments/${assessmentId}/files/${fileId}`);
  }
}
