import React, { useState } from 'react';
import { Database, ShieldCheck, Mail, Building, Eye, Users, Lock, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '../firebase';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { HOSPITAL_LOGO_BASE64 } from '../config';

interface AuthModalProps {
  onConfirm: (info: {
    email: string;
    displayName?: string;
    name: string;
    district: string;
    province: string;
    role: 'editor' | 'supervisor' | 'admin';
  }) => void;
  isLoading: boolean;
  externalError?: string;
}

export default function AuthModal({ onConfirm, isLoading, externalError }: AuthModalProps) {
  // State
  const [step, setStep] = useState<'role_selection' | 'login'>('role_selection');
  const [activeTab, setActiveTab] = useState<'editor' | 'supervisor'>('editor');
  
  // Self-Evaluator state fields
  const [name, setName] = useState('');

  // Supervisor state fields
  const [supervisorPasscode, setSupervisorPasscode] = useState('');

  const [error, setError] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    if (!name.trim()) {
      setError('กรุณากรอกข้อมูลชื่อหน่วยงาน/เครือข่ายปฐมภูมิก่อนดำเนินการเข้าสู่ระบบ');
      return;
    }

    setIsGoogleLoading(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const q = query(collection(db, 'authorized_users'), where('email', '==', user.email?.toLowerCase()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty && user.email?.toLowerCase() !== 'primarycareunit.ubuh@ubu.ac.th') {
         await signOut(auth);
         setError('อีเมลของท่านไม่ได้รับอนุญาตให้เข้าถึงข้อมูล กรุณาติดต่อเจ้าหน้าที่');
         setIsGoogleLoading(false);
         return;
      }

      let assignedRole: 'editor' | 'supervisor' | 'admin' = 'editor';
      if (!querySnapshot.empty) {
        assignedRole = querySnapshot.docs[0].data().role;
      } else if (user.email?.toLowerCase() === 'primarycareunit.ubuh@ubu.ac.th') {
        assignedRole = 'admin';
      }

      onConfirm({ 
        email: user.email!, 
        displayName: user.displayName || undefined,
        name: name.trim() || 'โรงพยาบาลมหาวิทยาลัยอุบลราชธานี', // fallback default
        district: '', 
        province: '',
        role: assignedRole
      });
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/unauthorized-domain' || String(err.message).includes('unauthorized-domain')) {
        setError('เกิดข้อผิดพลาดในการรับรองโดเมน (auth/unauthorized-domain) เนื่องจากเซสชันถูกบล็อกภายใน iFrame แนะนำให้กดปุ่ม "เปิดระบบในแท็บใหม่" สีส้มอ่อนเพื่อหลีกเลี่ยงกฎความปลอดภัยของเบราว์เซอร์');
      } else {
        setError('เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วยบัญชี Google: ' + err.message);
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  const handleSubmitSupervisor = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const code = supervisorPasscode.trim();

    if (code !== '999999') {
      setError('ท่านกรอกรหัสไม่ถูกต้อง กรุณาติดต่อแอดมิน');
      return;
    }

    onConfirm({
      email: 'supervisor@guest.local',
      displayName: 'ผู้นิเทศภายนอก (Guest)',
      name: 'ผู้นิเทศภายนอก (Guest)',
      district: 'ส่วนกลาง',
      province: 'อุบลราชธานี',
      role: 'supervisor'
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-xl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/60 bg-white/95 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] backdrop-blur-2xl"
      >
        {/* Core Hospital Header Banner */}
        <div className="bg-gradient-to-br from-teal-400 via-emerald-500 to-teal-500 p-8 text-white text-center relative overflow-hidden">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-white/10 blur-3xl pointer-events-none"></div>
          
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-white/20 backdrop-blur-md border border-white/30 shadow-inner overflow-hidden p-2"
          >
            {HOSPITAL_LOGO_BASE64 ? (
              <img src={HOSPITAL_LOGO_BASE64} alt="Hospital Logo" className="h-full w-full object-contain drop-shadow-md rounded-lg" />
            ) : (
              <Database className="h-10 w-10 text-white" />
            )}
          </motion.div>
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <h3 className="text-xl font-bold font-sans tracking-tight">ระบบฐานข้อมูลและการประเมินตนเอง</h3>
            <p className="text-[13px] text-teal-50 mt-1 font-medium font-sans mb-2">โรงพยาบาลมหาวิทยาลัยอุบลราชธานี</p>
            <div className="mt-2.5 inline-block bg-white/25 backdrop-blur-sm text-[12px] font-black tracking-tight text-white px-4.5 py-1.5 rounded-full border border-white/20 shadow-xs">
              เกณฑ์รอบปี พ.ศ. 2568 - 2570
            </div>
          </motion.div>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          <AnimatePresence mode="wait">
            {step === 'role_selection' ? (
              <motion.div
                key="role_selection"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2">
                  <span className="h-2 w-2 rounded-full bg-teal-400"></span>
                  ระบุประเภทผู้ใช้งานเพื่อเข้าสู่ระบบ
                </h4>
                <div className="flex flex-col gap-3">
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    type="button"
                    onClick={() => { setActiveTab('editor'); setError(''); setStep('login'); }}
                    className="p-4 rounded-3xl border border-slate-100 bg-white hover:border-teal-200 hover:bg-teal-50/50 shadow-sm text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-2xl bg-slate-50 text-slate-400 border border-slate-100 group-hover:bg-teal-500 group-hover:text-white group-hover:shadow-md group-hover:border-teal-400 transition-all">
                        <Users className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="font-bold text-base text-slate-700 group-hover:text-teal-900 transition-colors">1. สำหรับผู้รับการประเมิน (สหสาขา)</div>
                        <div className="text-xs font-medium mt-0.5 text-slate-500 group-hover:text-teal-600 transition-colors">สำหรับการอัพโหลดเอกสารหลักฐาน และการประเมินตนเอง</div>
                      </div>
                    </div>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    type="button"
                    onClick={() => { setActiveTab('supervisor'); setError(''); setStep('login'); }}
                    className="p-4 rounded-3xl border border-slate-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/50 shadow-sm text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-2xl bg-slate-50 text-slate-400 border border-slate-100 group-hover:bg-indigo-500 group-hover:text-white group-hover:shadow-md group-hover:border-indigo-400 transition-all">
                        <Eye className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="font-bold text-base text-slate-700 group-hover:text-indigo-900 transition-colors">2. สำหรับผู้นิเทศ</div>
                        <div className="text-xs font-medium mt-0.5 text-slate-500 group-hover:text-indigo-600 transition-colors">สำหรับเข้าชมและตรวจสอบข้อมูล (อ่านอย่างเดียว)</div>
                      </div>
                    </div>
                  </motion.button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="login_form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="space-y-0"
              >
                <div className="flex items-center gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => { setStep('role_selection'); setError(''); }}
                    className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors flex-shrink-0"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                  </button>
                  <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${activeTab === 'editor' ? 'bg-teal-400' : 'bg-indigo-400'}`}></span>
                    {activeTab === 'editor' ? 'เข้าสู่ระบบสำหรับผู้รับประเมิน' : 'เข้าสู่ระบบสำหรับผู้นิเทศ'}
                  </h4>
                </div>
                
                <div className="border-t border-slate-100/80 mb-4"></div>

                {activeTab === 'editor' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[13px] font-bold text-slate-700 mb-2 flex items-center gap-1.5 ml-2">
                        <Building className="h-4 w-4 text-slate-400" /> ชื่อหน่วยงาน / เครือข่ายปฐมภูมิ
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="ระบุชื่อรพ.สต. หรือหน่วยงานสุขภาพปฐมภูมิ"
                        className="w-full text-[15px] rounded-full border border-slate-200 px-6 py-3.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white focus:border-teal-400 focus:ring-4 focus:ring-teal-500/10 transition-all outline-none font-semibold text-slate-700 placeholder:text-slate-400 shadow-sm"
                      />
                    </div>

                    {(error || externalError) && (
                      <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} className="rounded-3xl bg-rose-50 p-4 px-6 border border-rose-100/50 text-[13px] font-bold text-rose-600 font-sans leading-relaxed">
                        ⚠️ {error || externalError}
                      </motion.div>
                    )}

                    {isInIframe && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl bg-amber-50/90 p-4 border border-amber-200/60 text-xs font-semibold text-amber-800 font-sans leading-relaxed space-y-2.5"
                      >
                        <p className="font-bold text-amber-900 text-[13px] flex items-center gap-1.5">
                          ⚠️ แจ้งเตือน: ตรวจพบการทำงานใต้ iFrame
                        </p>
                        <p className="text-[11.5px] font-medium text-amber-800/90 leading-relaxed">
                          เนื่องจากนโยบายความปลอดภัยและคุกกี้บุคคลที่สาม (Third-party Cookies) ของเบราว์เซอร์ การล็อกอินผ่าน iFrame ของ AI Studio จะเกิดข้อผิดพลาด <strong>auth/unauthorized-domain</strong> เสมอ
                        </p>
                        <button
                          type="button"
                          onClick={() => window.open(window.location.href, '_blank')}
                          className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold rounded-full transition-all cursor-pointer shadow-sm hover:shadow"
                        >
                          🚀 คลิกเปิดแท็บใหม่เพื่อเข้าสู่ระบบที่ปลอดภัย (แนะนำ)
                        </button>
                      </motion.div>
                    )}

                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={isLoading || isGoogleLoading}
                      className="w-full mt-4 inline-flex items-center justify-center gap-3 rounded-full font-bold text-[15px] h-14 transition-all focus:outline-none disabled:opacity-50 cursor-pointer bg-white border-2 border-slate-100 hover:border-slate-200 hover:bg-slate-50 shadow-sm hover:shadow-md text-slate-600"
                    >
                      {isLoading || isGoogleLoading ? (
                        <div className="flex items-center gap-2">
                          <svg className="animate-spin h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.162 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>กำลังเข้าสู่ระบบ...</span>
                        </div>
                      ) : (
                        <>
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.26H17.92C17.67 15.63 16.89 16.8 15.73 17.58V20.35H19.3C21.39 18.43 22.56 15.6 22.56 12.25Z" fill="#4285F4"/>
                            <path d="M12 23C14.97 23 17.46 22.02 19.3 20.35L15.73 17.58C14.74 18.25 13.48 18.65 12 18.65C9.13 18.65 6.69 16.71 5.81 14.12H2.14V16.96C3.96 20.57 7.69 23 12 23Z" fill="#34A853"/>
                            <path d="M5.81 14.12C5.58 13.45 5.46 12.74 5.46 12C5.46 11.26 5.58 10.55 5.81 9.88V7.04H2.14C1.39 8.53 0.98 10.22 0.98 12C0.98 13.78 1.39 15.47 2.14 16.96L5.81 14.12Z" fill="#FBBC05"/>
                            <path d="M12 5.35C13.62 5.35 15.07 5.91 16.21 7.01L19.38 3.84C17.45 2.05 14.97 1 12 1C7.69 1 3.96 3.43 2.14 7.04L5.81 9.88C6.69 7.29 9.13 5.35 12 5.35Z" fill="#EA4335"/>
                          </svg>
                          <span>ล็อกอินด้วย Google Account (ที่แอดมินอนุญาตแล้ว)</span>
                        </>
                      )}
                    </motion.button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitSupervisor} className="space-y-4">
                    <div>
                      <label className="block text-[13px] font-bold text-slate-700 mb-2 flex items-center gap-1.5 ml-2">
                        <Lock className="h-4 w-4 text-indigo-400" /> รหัสผ่านเข้าถึงข้อมูล (PIN/Access Code)
                      </label>
                      <input
                        type="password"
                        value={supervisorPasscode}
                        onChange={(e) => setSupervisorPasscode(e.target.value)}
                        placeholder="กรอกรหัส Access Code 6 หลัก"
                        className="w-full text-[15px] rounded-full border border-slate-200 px-6 py-3.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none font-semibold text-slate-700 placeholder:text-slate-400 shadow-sm"
                      />
                    </div>

                    {(error || externalError) && (
                      <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} className="rounded-3xl bg-rose-50 p-4 px-6 border border-rose-100/50 text-[13px] font-bold text-rose-600 font-sans leading-relaxed">
                        ⚠️ {error || externalError}
                      </motion.div>
                    )}

                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={isLoading}
                      className="w-full mt-4 inline-flex items-center justify-center gap-2 rounded-full font-bold text-[15px] h-14 transition-all focus:outline-none disabled:opacity-50 cursor-pointer bg-indigo-500 hover:bg-indigo-600 text-white shadow-md hover:shadow-lg hover:shadow-indigo-500/25"
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.162 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>กำลังเช็คสิทธิ์คลาวด์...</span>
                        </div>
                      ) : (
                        <span>เข้าสู่ระบบในฐานะผู้นิเทศ (อ่านอย่างเดียว)</span>
                      )}
                    </motion.button>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
