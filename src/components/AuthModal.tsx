import React, { useState } from 'react';
import { Database, ShieldCheck, Mail, Building, MapPin, Eye, Users, Lock } from 'lucide-react';
import { motion } from 'motion/react';

interface AuthModalProps {
  onConfirm: (info: {
    email: string;
    name: string;
    district: string;
    province: string;
    role: 'editor' | 'supervisor';
  }) => void;
  isLoading: boolean;
  externalError?: string;
}

export default function AuthModal({ onConfirm, isLoading, externalError }: AuthModalProps) {
  // Tabs: 'editor' (ผู้รับการประเมิน) or 'supervisor' (ผู้นิเทศ)
  const [activeTab, setActiveTab] = useState<'editor' | 'supervisor'>('editor');
  
  // Self-Evaluator state fields
  const [email, setEmail] = useState('primarycareunit.ubuh@ubu.ac.th');
  const [name, setName] = useState('โรงพยาบาลมหาวิทยาลัยอุบลราชธานี');
  const [district, setDistrict] = useState('วารินชำราบ');
  const [province, setProvince] = useState('อุบลราชธานี');
  const [passcode, setPasscode] = useState('');

  // Supervisor state fields
  const [supervisorEmail, setSupervisorEmail] = useState('guest');
  const [supervisorName, setSupervisorName] = useState('ผู้นิเทศภายนอก (Guest)');
  const [supervisorPasscode, setSupervisorPasscode] = useState('guest');

  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (activeTab === 'editor') {
      if (!email || !name || !district || !province) {
        setError('กรุณากรอกข้อมูลหน่วยบริการให้ครบถ้วนทุกช่อง');
        return;
      }
      if (!email.trim().toLowerCase().endsWith('@ubu.ac.th')) {
        setError('สิทธิ์ผู้ใช้งานเฉพาะอีเมลสถาบันอุดมศึกษาที่ต่อท้ายด้วย @ubu.ac.th เท่านั้น');
        return;
      }
      if (passcode.trim() !== 'ubuh') {
        setError('รหัสผ่านผู้รับการประเมินไม่ถูกต้อง (ต้องใช้รหัส "ubuh" เท่านั้น)');
        return;
      }
      
      onConfirm({ 
        email: email.trim(), 
        name: name.trim(), 
        district: district.trim(), 
        province: province.trim(),
        role: 'editor'
      });
    } else {
      const username = supervisorEmail.trim().toLowerCase();
      const code = supervisorPasscode.trim().toLowerCase();

      if (username !== 'guest') {
        setError('ชื่อผู้ใช้งานผู้นิเทศไม่ถูกต้อง (ระบุ "guest" เท่านั้น)');
        return;
      }

      if (code !== 'guest') {
        setError('รหัสผ่านไม่ถูกต้อง (ระบุรหัส "guest" เท่านั้น)');
        return;
      }

      onConfirm({
        email: 'guest@ubu.ac.th',
        name: 'ผู้นิเทศภายนอก (Guest)',
        district: 'ส่วนกลาง',
        province: 'อุบลราชธานี',
        role: 'supervisor'
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
      >
        {/* Core Hospital Header Banner */}
        <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-indigo-900 p-6 text-white text-center relative">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/25">
            <Database className="h-7 w-7 text-emerald-300" />
          </div>
          <p className="text-[11px] uppercase tracking-wider text-teal-200 font-bold">โรงพยาบาลมหาวิทยาลัยอุบลราชธานี</p>
          <h2 className="text-lg md:text-xl font-bold tracking-tight mt-1">ระบบประเมินมาตรฐานระบบสุขภาพปฐมภูมิ</h2>
          <p className="mt-1 text-xs text-slate-300 font-light">เกณฑ์รอบปี พ.ศ. 2568 - 2570 (บันทึกและซิงค์คลาวด์แบบเรียลไทม์)</p>
          
          {/* Subtle decoration lines */}
          <div className="absolute top-2 right-2 border-r-2 border-t-2 border-teal-500/20 h-8 w-8" />
          <div className="absolute bottom-2 left-2 border-l-2 border-b-2 border-teal-500/20 h-8 w-8" />
        </div>

        {/* Role Segmented Controller (Tab Control) */}
        <div className="flex border-b border-slate-100 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => { setActiveTab('editor'); setError(''); }}
            className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'editor' 
                ? 'bg-white text-teal-800 shadow-xs border border-slate-100' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>1. สำหรับผู้รับการประเมิน (สหสาขา)</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('supervisor'); setError(''); }}
            className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'supervisor' 
                ? 'bg-white text-indigo-800 shadow-xs border border-slate-100' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Eye className="h-4 w-4" />
            <span>2. สำหรับผู้นิเทศ (เห็นข้อมูลอย่างเดียว)</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-4">
          
          {/* Informative Guidance Panel based on active tab */}
          {activeTab === 'editor' ? (
            <div className="rounded-xl bg-teal-50/50 p-4 border border-teal-100/50">
              <div className="flex gap-3">
                <ShieldCheck className="h-5 w-5 text-teal-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-teal-950">สิทธิ์ประเมินตนเองและการแนบเอกสารอ้างอิง</h4>
                  <p className="text-[11px] text-teal-800 mt-0.5 leading-relaxed">
                    อนุญาตให้กรอกคะแนน แนบรายงาน หรืออัปโหลดไฟล์หลักฐาน (Word / PDF / รูปภาพ) ได้หลายไฟล์เพื่อประกอบการประเมิน
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-indigo-50/50 p-4 border border-indigo-100/50">
              <div className="flex gap-3">
                <Lock className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-indigo-950">สิทธิ์ผู้นิเทศ (ภายนอกตรวจประเมิน)</h4>
                  <p className="text-[11px] text-indigo-800 mt-0.5 leading-relaxed">
                    สามารถเรียกดูคะแนน ประวัติบันทึก และกดดูรูปพรีวิวความปลอดภัยได้ทันที **แต่ระบบจะจำกัดการดาวน์โหลดไฟล์ตามนโยบาย PDPA**
                  </p>
                </div>
              </div>
            </div>
          )}

          {(error || externalError) && (
            <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-600 font-semibold border border-rose-100 whitespace-pre-line leading-relaxed">
              {error || externalError}
            </div>
          )}

          {activeTab === 'editor' ? (
            /* User / Staff Form Fields */
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-slate-400" /> อีเมลผู้รับการประเมิน (UBU Mail)</span>
                  <span className="text-[10px] text-teal-600 bg-teal-50 px-1.5 py-0.2 rounded font-bold">ลงท้ายด้วย @ubu.ac.th เท่านั้น</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="เช่น example@ubu.ac.th"
                  className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5 text-slate-400" /> ชื่อหน่วยงาน / เครือข่ายปฐมภูมิ
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ระบุชื่อรพ.สต. หรือหน่วยงานสุขภาพปฐมภูมิ"
                  className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition outline-none font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" /> อำเภอ
                  </label>
                  <input
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" /> จังหวัด
                  </label>
                  <input
                    type="text"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition outline-none font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-amber-500" /> รหัสผ่านเข้าระบบ (Password)
                </label>
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="ป้อนรหัสผ่านเข้าใช้งาน"
                  className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition outline-none font-medium"
                />
              </div>
            </div>
          ) : (
            /* Supervisor Form Fields */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-slate-400" /> ชื่อผู้ใช้งาน (Username)</span>
                  <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded font-bold">ระบุ "guest"</span>
                </label>
                <input
                  type="text"
                  value={supervisorEmail}
                  onChange={(e) => setSupervisorEmail(e.target.value)}
                  placeholder="กรอกชื่อผู้ใช้นิเทศก์ระบบ"
                  className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-amber-500" /> รหัสผ่านภายนอก (Password)
                </label>
                <input
                  type="password"
                  value={supervisorPasscode}
                  onChange={(e) => setSupervisorPasscode(e.target.value)}
                  placeholder="กรอกรหัสผู้ใช้นิเทศก์ระบบ"
                  className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition outline-none font-medium"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full mt-2 inline-flex items-center justify-center rounded-xl font-semibold text-sm h-11 transition shadow-md focus:outline-none disabled:opacity-50 cursor-pointer ${
              activeTab === 'editor' 
                ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-700/10' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-700/10'
            }`}
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
              <span>เข้าใช้งานระบบ & มุ่งเสนอข้อมูลขึ้นคลาวด์</span>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
