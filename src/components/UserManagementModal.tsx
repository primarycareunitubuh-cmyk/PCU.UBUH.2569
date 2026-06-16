import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Trash2, X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';

interface AuthorizedUser {
  id: string; // Document ID
  email: string;
  role: 'editor' | 'supervisor' | 'admin';
  addedAt: string;
}

interface UserManagementModalProps {
  onClose: () => void;
  currentUserEmail: string;
}

export default function UserManagementModal({ onClose, currentUserEmail }: UserManagementModalProps) {
  const [users, setUsers] = useState<AuthorizedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'editor' | 'supervisor' | 'admin'>('editor');
  const [isDeploying, setIsDeploying] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const q = collection(db, 'authorized_users');
      const snapshot = await getDocs(q);
      const list: AuthorizedUser[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as AuthorizedUser);
      });
      setUsers(list);
    } catch (err: any) {
      setError('ไม่สามารถโหลดข้อมูลผู้ใช้งานได้: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const email = newEmail.trim().toLowerCase();
    
    if (!email) {
      setError('กรุณากรอกอีเมล');
      return;
    }

    if (users.find(u => u.email === email)) {
      setError('อีเมลนี้ถูกเพิ่มไปแล้ว');
      return;
    }

    setIsDeploying(true);
    try {
      // Use email as document ID or auto ID. Let's use auto ID for simplicity, but email is better to avoid dupes? 
      // Firestore `addDoc` uses auto-id. Let's use auto-id.
      await addDoc(collection(db, 'authorized_users'), {
        email: email,
        role: newRole,
        addedAt: new Date().toISOString(),
        addedBy: currentUserEmail
      });
      setNewEmail('');
      await loadUsers();
    } catch (err: any) {
      setError('เกิดข้อผิดพลาดในการเพิ่มผู้ใช้งาน: ' + err.message);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleDelete = async (id: string, email: string) => {
    if (email === 'primarycareunit.ubuh@ubu.ac.th') {
      alert('ไม่สามารถลบบัญชีแอดมินสูงสุดได้');
      return;
    }
    
    if (window.confirm(`ยืนยันการลบสิทธิ์ของ ${email} ?`)) {
      try {
        await deleteDoc(doc(db, 'authorized_users', id));
        await loadUsers();
      } catch (err: any) {
        setError('เกิดข้อผิดพลาดในการลบผู้ใช้งาน: ' + err.message);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl overflow-hidden rounded-[2rem] bg-white shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="bg-slate-800 p-6 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-teal-400" />
            <h3 className="text-lg font-bold font-sans tracking-tight">การจัดการสิทธิ์ผู้ใช้งาน (User Management)</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-700 transition-colors text-slate-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 md:p-8 flex-1 overflow-y-auto space-y-6">
          
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h4 className="text-sm font-bold text-slate-700 mb-4">✨ เพิ่มผู้ใช้งานใหม่</h4>
            <form onSubmit={handleAddUser} className="flex flex-col md:flex-row gap-3 items-start md:items-end">
              <div className="w-full">
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider ml-1">อีเมลผู้ใช้งาน (Email)</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="เช่น doctor@ubu.ac.th"
                  className="w-full text-sm rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-500/10 transition-all font-medium text-slate-700 bg-white"
                />
              </div>
              <div className="w-full md:w-auto shrink-0">
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider ml-1">สิทธิ์การเข้าถึง (Role)</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full md:w-auto text-sm rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-500/10 transition-all font-bold text-slate-700 bg-white cursor-pointer"
                >
                  <option value="editor">บรรณาธิการ (Editor / ประเมิน)</option>
                  <option value="supervisor">ผู้นิเทศ (Supervisor / อ่าน)</option>
                  <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={isDeploying}
                className="w-full md:w-auto bg-teal-600 hover:bg-teal-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer h-[42px] shrink-0"
              >
                <Plus className="h-4 w-4" />
                <span>เพิ่ม</span>
              </button>
            </form>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <h4 className="text-sm font-bold text-slate-700 mb-3 ml-1">📋 รายชื่อผู้ใช้งานที่ได้รับอนุญาต ({users.length} บัญชี)</h4>
            
            {loading ? (
              <p className="text-center py-8 text-slate-400 font-medium text-sm animate-pulse">กำลังโหลดข้อมูลผู้ใช้งาน...</p>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="px-5 py-3">อีเมล (Email)</th>
                      <th className="px-5 py-3">สิทธิ์ (Role)</th>
                      <th className="px-5 py-3 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-5 py-8 text-center text-slate-400 italic">
                          ยังไม่มีข้อมูลในระบบ ผู้ดูแลระบบสามารถเข้าได้โดยอัตโนมัติ
                        </td>
                      </tr>
                    ) : (
                      users.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3.5">
                            {u.email}
                            {u.email === 'primarycareunit.ubuh@ubu.ac.th' && (
                              <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                                Root Admin
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            {u.role === 'admin' && <span className="text-purple-600 font-bold">ผู้ดูแลระบบ (Admin)</span>}
                            {u.role === 'editor' && <span className="text-teal-600 font-bold">ผู้ประเมิน (Editor)</span>}
                            {u.role === 'supervisor' && <span className="text-indigo-600 font-bold">ผู้นิเทศ (Supervisor)</span>}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => handleDelete(u.id, u.email)}
                              disabled={u.email === 'primarycareunit.ubuh@ubu.ac.th'}
                              className="text-slate-400 hover:text-rose-500 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors p-1 rounded-md hover:bg-rose-50"
                              title="ยกเลิกสิทธิ์"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
            
            <div className="mt-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100 text-xs text-blue-700 font-medium leading-relaxed">
              💡 <strong>คำแนะนำ:</strong> อีเมลที่ไม่ได้อยู่ในรายชื่อด้านบน จะไม่สามารถล็อกอินเข้าสู่ระบบได้ (จะพบข้อความแจ้งเตือน "ไม่ได้รับอนุญาต") 
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
