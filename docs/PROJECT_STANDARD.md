# Tirak Chat — Project Standard

> เอกสารมาตรฐานการพัฒนาและออกแบบระบบ Tirak Chat
> ทุกการแก้ไขโค้ดต้องปฏิบัติตามเอกสารนี้อย่างเคร่งครัด

---

## 1. GENERAL RULES

ก่อนเขียนโค้ดใด ๆ

1. อ่านโค้ดที่มีอยู่
2. เข้าใจสถาปัตยกรรมปัจจุบัน
3. ห้ามเขียนระบบใหม่ทับระบบเดิม
4. ห้ามออกแบบ UI ใหม่โดยไม่ได้รับคำสั่ง
5. ห้ามเปลี่ยนชื่อไฟล์โดยไม่มีเหตุผล
6. ห้ามสร้างฟีเจอร์ซ้ำซ้อน
7. ใช้โค้ดเดิมให้มากที่สุด

สิ่งที่ต้องรักษาไว้เสมอ

- UI
- UX
- Project Structure
- Firebase Schema
- Existing Components
- Design System

---

## 2. ROLE DEFINITION

ผู้พัฒนาทำหน้าที่เป็น

- Lead Software Architect
- Senior Full Stack Engineer
- UI/UX Designer
- Security Engineer
- Production Reviewer

ภารกิจหลักคือ **รักษาเสถียรภาพของโปรเจค** ไม่ใช่เขียนใหม่

---

## 3. WORKFLOW

```
Read → Analyze → Plan → Approve → Code → Verify → Report
```

1. อ่านโค้ดที่มีอยู่
2. วิเคราะห์สถาปัตยกรรม
3. หา Component ที่ใช้ซ้ำได้
4. ระบุไฟล์ที่ได้รับผลกระทบ
5. อธิบายแผนการพัฒนา
6. รอคำสั่งหากต้องการความชัดเจน
7. ดำเนินการแก้ไข
8. ตรวจสอบผลลัพธ์
9. รายงานสรุป

---

## 4. BUG FIX RULE

- แก้เฉพาะโค้ดที่มีปัญหา
- ห้ามแก้ไขไฟล์ที่ไม่เกี่ยวข้อง
- หลังแก้ไขต้องอธิบาย
  - สาเหตุของปัญหา (Root Cause)
  - สิ่งที่เปลี่ยนแปลง (What Changed)
  - เหตุผลที่แก้ไขวิธีนี้ (Why)

---

## 5. FEATURE RULE

ก่อนสร้างฟีเจอร์ใหม่

1. ค้นหาว่ามีฟีเจอร์นี้อยู่แล้วหรือไม่
2. หากมีอยู่แล้ว → **ต่อยอดจากของเดิม**
3. ห้ามสร้างเวอร์ชันใหม่ซ้ำซ้อน

---

## 6. BRAND IDENTITY

### ห้ามเปลี่ยน

- Brand Identity
- Color Palette
- Typography
- Design Language
- Component Style
- Design System
- Theme
- Mood & Tone
- เอกลักษณ์ของแอป

### Design Tokens (จาก index.css)

```css
/* Brand Colors */
--navy: 224 47% 19%;          /* #1A2648 Deep Navy */
--coral: 359 100% 70%;        /* #FF686B Coral Orange */
--coral-deep: 358 78% 60%;
--coral-soft: 359 100% 95%;
--offwhite: 240 11% 96%;      /* #F5F5F7 Off-White */
--charcoal: 0 0% 20%;         /* #333333 Charcoal Gray */

/* Typography */
font-family: 'Prompt', 'Inter', ui-sans-serif, system-ui, sans-serif;
.font-display: 'Prompt', 'Poppins', 'Inter', ui-sans-serif;

/* Background Patterns */
.gradient-navy: linear-gradient(160deg, #1A2648, hsl(227 51% 10%));
.gradient-brand: linear-gradient(135deg, coral, pink);

/* Corner Radius */
--radius: 0.875rem;  /* rounded-xl = 12px, rounded-2xl = 16px */
```

### ทุกหน้าที่สร้างใหม่ต้อง

- มองแล้วรู้ทันทีว่าเป็น Tirak Chat
- อยู่ร่วมกับหน้าเดิมได้อย่างกลมกลืน
- ห้ามดูเหมือนคนละแอป
- ใช้ Design Token เดิมของโปรเจค

---

## 7. ICON & VISUAL STANDARD (ICON POLICY)

### กฎสำคัญ: ใช้เฉพาะ Lucide Icons เท่านั้น
ทุก Icon ในระบบต้องเป็น Component จาก **Lucide React (`lucide-react`)** เท่านั้น ห้ามใช้ชุดไอคอนอื่นผสมโดยไม่ได้รับอนุญาต

### ห้ามใช้ Emoji ใน UI ทุกกรณี
ห้ามใช้ Emoji หรือ Unicode Emoji / Symbols ในองค์ประกอบ UI ทุกประเภท ได้แก่:
- Buttons (ปุ่มกด)
- Navigation (เมนูนำทาง)
- Badge (ป้ายสถานะ)
- Status (สถานะการทำงาน)
- Empty State (หน้าจอว่างเปล่า)
- Settings (เมนูการตั้งค่า)
- Theme (การสลับโหมดสี)
- Notification / Push Notification (การแจ้งเตือน)
- Dialog / Modal (กล่องโต้ตอบ)
- Toast (ข้อความแจ้งเตือนชั่วคราว)
- Error / Success / Warning / Information (กล่องข้อความสถานะต่างๆ)
- Loading / Spinner

### ห้ามใช้
- Emoji
- Unicode symbols
- ASCII icons
- กราฟิกตกแต่ง
- ภาพการ์ตูน
- สติกเกอร์
- ไอคอนสีสดแบบสุ่ม

### กฎการใช้ไอคอน
- ใช้ชุดไอคอนเดียวกันทั้งแอป (Lucide React)
- ห้ามผสมชุดไอคอนโดยไม่จำเป็น
- Stroke Width สม่ำเสมอ (แนะนำ strokeWidth={2} หรือ 1.5)
- Visual Style สม่ำเสมอ
- ขนาดมาตรฐาน: 16 / 18 / 20 / 24 px
- ไอคอนต้องมีความหมาย (Semantic)
- ไอคอนต้องรองรับ Accessibility

---

## 8. UI RULES

### ห้าม

- Redesign หน้าจอเดิม
- เปลี่ยน Spacing
- เปลี่ยน Typography
- เปลี่ยน Colors
- เปลี่ยน Icon Style
- สร้าง Design Language ใหม่

### สิ่งที่ปรับปรุงได้

- Layout
- Alignment
- Spacing (ปรับปรุง ไม่ใช่เปลี่ยน)
- Padding / Margin
- Visual Hierarchy
- White Space
- Grid
- Responsive
- Accessibility
- Typography Scale
- Component Arrangement

### ใช้ Component เดิมให้มากที่สุด

- Buttons
- Typography
- Spacing
- Cards
- Dialogs
- Colors
- Icon Style

---

## 9. UI QUALITY REQUIREMENT

ทุกหน้าที่สร้างใหม่ต้องมีคุณภาพระดับ **Commercial Product**

### ห้าม

- UI แบบ Prototype
- UI แบบ Admin Dashboard
- Card ซ้อนกันโดยไม่จำเป็น
- เส้นแบ่งจำนวนมาก

### ต้อง

- ใช้ White Space เป็นตัวแบ่งข้อมูล
- ผ่านหลัก Visual Hierarchy
- ผ่านหลัก Grid
- ผ่านหลัก Spacing
- ผ่านหลัก Typography
- ผ่านหลัก Accessibility
- ผ่านหลัก Responsive

### ก่อนเขียนโค้ด UI ต้อง

1. วิเคราะห์ UX
2. วิเคราะห์ปัญหา
3. อธิบาย Layout
4. อธิบายเหตุผล
5. เปรียบเทียบข้อดีข้อเสีย
6. **รอผู้ดูแลอนุมัติก่อน**

### มาตรฐานอ้างอิง (เป็นแนวทาง ไม่ใช่ลอก)

- Apple HIG
- Material Design 3
- Microsoft Fluent
- Notion
- Linear
- Discord
- Telegram
- Signal
- Slack
- Google Chat
- Microsoft Teams

---

## 10. PLACEHOLDER POLICY

ห้ามทิ้ง Placeholder ใน Production

### ไม่อนุญาต

- Lorem Ipsum
- Sample User / Test User
- Example Text
- Fake Avatar
- Emoji Icons (ในปุ่ม/เมนู)
- Dummy Images
- Placeholder URLs
- Mock Notifications
- Fake Status

### ทุกหน้าจอต้อง

- ใช้ข้อมูลจริง (Real Assets)
- หรือระบุชัดเจนว่า **NOT IMPLEMENTED**
- ห้ามจำลองฟังก์ชันที่ยังไม่พร้อม

---

## 11. PRODUCTION RULES

### ห้ามใช้

- Fake Data
- Mock Upload
- Random Delay
- setTimeout Simulation
- Placeholder URLs
- Fake Loading
- Dummy Waveform
- Fake Message Status

### หากสิ่งใดยังไม่เสร็จ

ระบุชัดเจนว่า **NOT IMPLEMENTED**

ห้ามจำลองการทำงานที่ยังไม่มีจริง

---

## 12. CODE QUALITY

ทุกโค้ดที่เขียนต้องเป็น

- Reusable
- Typed (TypeScript)
- Modular
- Maintainable
- Scalable
- Production Ready

---

## 13. SECURITY

### ต้องตรวจสอบเสมอ

- Authentication
- Authorization
- Firestore Rules
- Firebase Storage Rules
- Session Management
- Trusted Device
- PIN Lock
- TOTP
- Input Validation
- Rate Limit
- XSS

### ห้าม

- อ้างว่ามี E2E Encryption หากยังไม่ได้ Implement จริง

---

## 14. FIREBASE

### ห้ามเก็บใน Firestore

- Base64 images
- Large blobs
- Audio binary
- Video binary

### ต้องใช้ Firebase Storage สำหรับ

- Images
- Voice
- Files
- Avatar
- Story
- Video

เก็บเฉพาะ **Download URL** ใน Firestore

---

## 15. CALL SYSTEM

ใช้ **Jitsi Integration** ที่มีอยู่

- ห้ามสร้างระบบโทรใหม่
- ห้ามแทนที่ระบบเดิม

รองรับ

- Voice Call
- Video Call
- Conference
- Screen Share

---

## 16. PRODUCTION VERIFICATION

หลังจากทำงานเสร็จทุกครั้ง ต้องตรวจสอบ

```
✓ npm run build
✓ TypeScript
✓ Runtime Errors
✓ Console Errors
✓ Firebase
✓ Firestore
✓ Storage
✓ Authentication
✓ Voice Message
✓ File Upload
✓ Image Upload
✓ Story
✓ Video Call
✓ Voice Call
✓ Conference
✓ Push Notification
✓ Responsive
✓ Memory Leak
✓ Performance
✓ Security
```

หากพบปัญหา → หยุด → แก้ไข → ตรวจสอบใหม่

ห้ามเพิกเฉยต่อ Warning

---

## 17. PRODUCTION AUDIT

หลังทำงานเสร็จทุกครั้ง ต้องรายงาน

### ระดับความรุนแรง

- **Critical** — ต้องแก้ทันที
- **Warning** — ควรแก้ไข
- **Working** — ทำงานได้ปกติ
- **Not Implemented** — ยังไม่มี
- **Not Verified** — ยังไม่ได้ตรวจสอบ

### ห้าม

- ซ่อนปัญหา
- อ้างว่าฟีเจอร์ที่ยังไม่เสร็จเสร็จแล้ว

---

## 18. FINAL REPORT

ทุกงานต้องสรุป

- Implementation Summary
- Files Changed
- Reason
- Risk
- Migration Required
- Testing Checklist
- Remaining Issues
- Production Readiness Score

---

## 19. REGISTRATION FLOW

Flow การสมัครสมาชิกมาตรฐาน

```
Registration
    ↓
Phone Verification
    ↓
Google Authenticator
    ↓
TOTP Verification
    ↓
Profile Setup
    ↓
PIN Setup
    ↓
Trusted Device Registration
    ↓
Permission Request (Camera / Microphone / Notification)
    ↓
Home
    ↓
Chat
```

---

## 20. WORKING PRINCIPLE

```
Read first.
Analyze second.
Code third.
Verify fourth.
Report last.
```

**Always protect the existing Tirak Chat project.**
