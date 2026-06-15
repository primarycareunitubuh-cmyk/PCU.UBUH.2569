# คู่มือการติดตั้งและรัน Frontend บน Cloudflare Pages (วิธีอัตโนมัติผ่าน GitHub)

เนื่องจากระบบของแอปพลิเคชันนี้ใช้งานการเชื่อมต่อ Firebase ผ่านไฟล์การตั้งค่าภายใน (`firebase-applet-config.json`) ที่ถูกเรียกใช้งานโดยตรงในโค้ด `src/firebase.ts` ทำให้คุณ**ไม่จำเป็นต้องตั้งค่า Environment Variables (Variables/Secrets) ใด ๆ เพิ่มเติมบนหน้าแดชบอร์ดของ Cloudflare Pages!**

เมื่อคุณ Build โปรเจกต์ ตัวแปลภาษา (Vite) จะดึงข้อมูลการตั้งค่าเหล่านี้ไป Bundle รวบรวมเข้าเป็นไฟล์ Frontend ผลลัพธ์โดยอัตโนมัติทันที

---

## 📋 ขั้นตอนการทำงาน

### ขั้นตอนที่ 1: ตรวจสอบและ Push ไฟล์ขึ้น GitHub
1. ไฟล์ `.gitignore` ของคุณ**ไม่ได้ทำการยกเว้น (exclude)** ไฟล์ `firebase-applet-config.json` เอาไว้ ดังนั้นเมื่อคุณ Commit และ Push โค้ดขึ้น Repository บน GitHub ไฟล์นี้จะถูกอัปโหลดขึ้นไปอย่างถูกต้องและปลอดภัย
2. ตรวจสอบให้มั่นใจว่าทำการ Push โค้ดทั้งหมด (รวมถึงไฟล์ `firebase-applet-config.json`) ไปยัง Repository บน GitHub แล้ว

---

### ขั้นตอนที่ 2: ตั้งค่าบน Cloudflare Pages
1. ไปที่หน้าแดชบอร์ดของ **[Cloudflare Dashboard](https://dash.cloudflare.com/)**
2. เลือกเมนู **Workers & Pages** จากแถบเมนูด้านซ้าย
3. คลิกปุ่ม **Create** จากนั้นเลือกแท็บ **Pages**
4. คลิกปุ่ม **Connect to Git**
5. เลือกผู้ให้บริการเป็น **GitHub** (เข้าสู่ระบบและให้สิทธิ์เข้าถึงบัญชีหากทำเป็นครั้งแรก)
6. ค้นหาและเลือก **Repository** ของโปรเจกต์นี้ จากนั้นคลิก **Begin setup**

---

### ขั้นตอนที่ 3: ระบุค่ากำหนดการ Build (Build Settings)
ในหน้าจอ **Configure build and deployment** ให้ตั้งค่าตามรายละเอียดดังนี้:

* 🏷️ **Project name:** ตั้งชื่อตามที่คุณต้องการ (จะใช้เป็นส่วนหนึ่งของ Subdomain)
* 🌿 **Production branch:** เลือกกิ่งหลักของคุณ เช่น `main` หรือ `master`
* 🛠️ **Framework preset:** เลือกเป็น **Vite**  
  *(หากไม่มีในตัวเลือก ให้เลือกเป็น `None` หรือ `Create React App` ก็ได้)*
* 💻 **Build command:**  
  ```bash
  npm run build
  ```
* 📂 **Build output directory:**  
  ```text
  dist
  ```

> ⚠️ **หมายเหตุ:** ในหัวข้อ **Environment variables** คุณสามารถปล่อยว่างไว้ได้เลย ไม่จำเป็นต้องระบุค่าใด ๆ เนื่องจากแอปพลิเคชันจะอ่านค่าคอนฟิกจาก `firebase-applet-config.json` โดยตรงในขั้นตอน Build แล้ว!

---

### ขั้นตอนที่ 4: เริ่มการติดตั้ง (Deploy)
1. คลิกปุ่ม **Save and Deploy** ด้านล่างสุด
2. Cloudflare Pages จะเริ่มต้นโคลนโค้ดจาก GitHub ติดตั้ง Dependencies และทำการ Build แอปพลิเคชัน
3. เมื่อสถานะเปลี่ยนเป็น **Success** (สำเร็จ) คุณจะได้รับลิงก์ URL สรุปผล เช่น `https://your-project.pages.dev` เพื่อเข้าใช้งานแอปพลิเคชันของคุณทันที!

เมื่อคุณมีการอัปเดตโค้ดหรือเปลี่ยนค่าเชื่อมต่อบน GitHub ในอนาคต Cloudflare Pages จะทำการรันสคริปต์แก้ไขและอัปเดตเว็บให้คุณแบบอัตโนมัติ (Continuous Integration/Continuous Deployment)
