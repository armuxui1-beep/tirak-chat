# AI_RULES.md — Tirak Chat AI Constitution

> AI ทุกตัวต้องอ่านไฟล์นี้ก่อนเริ่มงานทุกครั้ง

## 1. WORKFLOW
Read → Analyze → Plan → Approve → Code → Verify → Report
ห้ามข้ามขั้นตอน ห้ามเดา ห้ามสร้างข้อมูลจำลอง

## 2. AUDIT SEPARATION RULE
ห้ามรวมผล Audit ต่างประเภทเข้าด้วยกัน ต้องแยกรายงานเป็น 7 Phase:

| Phase | Name | Scope |
|---|---|---|
| 1 | Architecture | Project structure, dead code, duplicate code, module separation |
| 2 | Security | Auth, Firestore Rules, Storage Rules, API keys, session, rate limit |
| 3 | Functional | Login, Register, OTP, Chat, Call, Story, Notification, Settings — ทุกฟังก์ชัน |
| 4 | Performance | Bundle size, lazy load, memory, render, cache, network, offline |
| 5 | Design System | Typography, spacing, radius, color, components, icons — ดู DESIGN_SYSTEM.md |
| 6 | Accessibility | ARIA, contrast, keyboard, screen reader, focus, reduced motion, touch target |
| 7 | Production Deployment | Build, Firebase, Vercel, HTTPS, monitoring, error tracking |

แต่ละ Phase ต้องมี PASS / WARNING / FAIL แยกของตัวเอง
ห้ามนำ FAIL ของ Design System มาปนกับ Functional
ห้ามสรุปรวมทั้งหมดเป็น FAIL จนกว่าจะรายงานครบทุก Phase

## 3. PRE-RELEASE CHECKLIST
ก่อน Deploy ทุกครั้ง ตรวจ:
1. UI Audit | 2. UX Audit | 3. Layout Audit | 4. Responsive Audit
5. Apple HIG Audit | 6. Material Design Audit | 7. Typography Audit
8. Accessibility Audit | 9. Performance Audit | 10. Security Audit
11. Firebase Audit | 12. API Audit | 13. Database Audit | 14. Storage Audit
15. Permission Audit | 16. PWA Audit | 17. Install Flow Audit
18. Offline Audit | 19. Push Notification Audit | 20. Error Handling Audit
21. Loading State Audit | 22. Animation Audit | 23. Production Audit
24. Zero Mock Audit | 25. End-to-End Functional Test

ห้าม Deploy จนกว่าทุกหัวข้อ PASS
หากพบ FAIL → หยุด → เปิด BUG_REPORT.md + FIX_PLAN.md → แก้ไข

## 4. DESIGN TOKEN RULE
ห้ามใช้ arbitrary Tailwind values (`text-[13px]`, `rounded-[22px]`, `h-[...]`, `w-[...]`)
ทุกค่าต้องมาจาก Design Token ใน DESIGN_SYSTEM.md
ยกเว้น: ค่าที่ dynamic จริง (เช่น progress bar, avatar size ที่ props ส่งมา)

## 5. ICON RULE
ใช้เฉพาะ `lucide-react` เท่านั้น
ห้ามใช้ `iconoir-react`, emoji ใน UI, unicode symbols, ASCII icons

## 6. PLACEHOLDER RULE
ห้ามทิ้ง Placeholder ใน Production — Lorem Ipsum, test user, fake avatar, mock data
ทุกหน้าจอต้องใช้ข้อมูลจริง หรือระบุ NOT IMPLEMENTED

## 7. PRODUCTION RULE
ห้าม Fake Data, Mock Upload, Random Delay, setTimeout Simulation, Placeholder URLs

## 8. REFERENCE RULE
ก่อนเขียนโค้ด ต้องอ้างอิง:
- โค้ดที่มีอยู่
- DESIGN_SYSTEM.md (สำหรับ UI)
- PROJECT_STANDARD.md (สำหรับมาตรฐาน)
- Apple HIG (สำหรับ UX)

## 9. PWA INSTALLATION RULES
Application must detect:
- `beforeinstallprompt`
- `appinstalled`
- `display-mode: standalone`
- `navigator.standalone`

ทุกครั้งที่เปิดแอป ถ้ายังไม่ได้ติดตั้ง ต้องแสดง Install Card
ห้ามซ่อนจนกว่าจะติดตั้งสำเร็จ

หลังติดตั้ง ต้อง:
- แสดง Success Dialog / Toast
- Welcome Message
- Save Install State (localStorage/IndexedDB)
- Hide Install Card

ตรวจสอบ Desktop, Android, iOS Safari, Chrome, Edge ทุก Platform

## 10. MANDATORY PRE-RELEASE CHECKLIST
ก่อน Deploy ทุกครั้ง AI ต้องตรวจสอบทุกหัวข้อในข้อ 3
ห้าม Deploy จนกว่าทุกหัวข้อจะเป็น PASS
หากพบ FAIL ให้หยุด Deploy
สร้างรายงานพร้อมไฟล์ BUG_REPORT.md และ FIX_PLAN.md ก่อนดำเนินการแก้ไข
