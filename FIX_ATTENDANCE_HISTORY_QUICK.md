# 🆘 Fix Attendance History Error - Quick Solution

## ❌ Error: "User profile not found"

Jika mendapat error ini saat buka Attendance History, ikuti langkah ini:

---

## ⚡ 3 Langkah Cepat untuk Fix

### Step 1: Update Firestore Security Rules

1. Buka: https://console.firebase.google.com/
2. Project → Firestore Database → Rules
3. Replace dengan ini:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

4. Klik **Publish**
5. Tunggu 1-2 menit

### Step 2: Jalankan Script Fix User Profiles

Jika user sudah registrasi tapi data incomplete, jalankan:

```bash
npm run fix-user-profiles
```

Script ini akan:
- ✅ Scan semua user profiles
- ✅ Check yang kurang employeeId
- ✅ Otomatis link ke employee yang benar
- ✅ Report hasilnya

### Step 3: Test Attendance History

1. Login dengan akun employee
2. Buka Attendance History (sidebar menu)
3. Seharusnya sudah bisa lihat data

---

## ✨ Jika Masih Error

Jika masih error setelah step 1-2:

1. **Clear browser cache**
   ```
   Ctrl+Shift+Delete (Windows)
   Cmd+Shift+Delete (Mac)
   ```

2. **Restart aplikasi**
   ```bash
   # Terminal 1
   npm run dev

   # Terminal 2
   npm run dev:client
   ```

3. **Try incognito/private mode**
   - Ctrl+Shift+P (Chrome)
   - Cmd+Shift+P (Safari)

---

## 🔍 Manual Check (Jika Masih Error)

Buka Firestore Console check manual:

1. https://console.firebase.google.com/
2. Firestore Database → users collection
3. Cari user document
4. Pastikan field ada:
   ```
   email: ✓
   role: "employee" ✓
   employeeId: "EMP001" ✓ ← PALING PENTING!
   ```

Jika `employeeId` kosong, edit manual dan set ke employee ID yang benar.

---

## 📞 Need Help?

Lihat file lengkap: `TROUBLESHOOTING_ATTENDANCE_HISTORY.md`

---

**Selesai!** Attendance History seharusnya sudah berfungsi ✅
