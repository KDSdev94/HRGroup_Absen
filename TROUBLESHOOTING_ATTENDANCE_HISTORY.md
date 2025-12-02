# 🐛 Troubleshooting: Attendance History Error

## ❌ Error: "User profile not found"

Jika Anda mendapatkan error ini di halaman Attendance History, ini berarti data user di Firestore tidak lengkap atau belum tersinkronisasi dengan baik.

---

## 🔍 Penyebab Error

Error ini terjadi ketika:

1. **User belum punya profile di collection `users`**
   - User registrasi tapi data tidak tersimpan ke Firestore users
   - Atau Firestore rules terlalu ketat

2. **Field `employeeId` tidak ada atau kosong**
   - User profile ada tapi tidak link ke employee ID
   - Terjadi jika register sebelum ada data karyawan

3. **Firestore Security Rules terlalu ketat**
   - User tidak bisa baca/write data mereka sendiri

---

## ✅ Solusi

### Solusi 1: Perbaiki Security Rules (PENTING!)

Buka Firebase Console:
1. Go to: https://console.firebase.google.com/
2. Select project: `absensi-app-b623f`
3. Firestore Database → Rules

**Ubah rules menjadi:**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow all reads and writes for now (development)
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**Klik "Publish"**

Ini akan memungkinkan aplikasi untuk membaca/write data. Untuk production, ganti dengan rules yang lebih ketat.

---

### Solusi 2: Perbaiki Data User Existing (Jika Diperlukan)

Jika user sudah registrasi tapi data incomplete, perbaiki manual di Firebase Console:

1. **Buka Firebase Console**
   - https://console.firebase.google.com/
   - Project: `absensi-app-b623f`

2. **Buka Firestore Database**
   - Go to: Firestore Database

3. **Cari Collection `users`**
   - Lihat document dengan UID user
   - Edit document tersebut

4. **Pastikan field ada:**
   ```json
   {
     "email": "user@example.com",
     "displayName": "User Name",
     "role": "employee",
     "employeeId": "EMP001",  ← HARUS ADA INI!
     "createdAt": "timestamp"
   }
   ```

5. **Jika `employeeId` kosong/tidak ada:**
   - Tambahkan field: `employeeId`
   - Set value ke ID karyawan (contoh: `EMP001`)
   - Save

---

### Solusi 3: Reset User (Jika Masih Error)

Jika masih error setelah perbaikan data, reset user:

1. **Hapus user dari Firebase Auth**
   - Console → Authentication → Users
   - Cari user
   - Klik "..." → Delete

2. **Hapus user profile dari Firestore**
   - Firestore → users collection
   - Cari document user
   - Delete document

3. **User registrasi ulang**
   - Buka `/register`
   - Pastikan ada data karyawan di employees collection
   - Register dengan akun baru
   - Selesai!

---

## 🔧 Diagnostik

Untuk melihat apa masalahnya, check Firestore data:

### 1. Collection `users`
```
Pastikan ada field:
- email: ✓
- role: ✓ ("employee")
- employeeId: ✓ (PALING PENTING!)
- displayName: ✓
- createdAt: ✓
```

### 2. Collection `employees`
```
Pastikan ada data:
- id: ✓
- name: ✓
- division: ✓
- uid: ✓ (setelah user registrasi)
- email: ✓ (setelah user registrasi)
```

### 3. Collection `attendance`
```
Pastikan ada record dengan:
- employeeId: ✓ (harus match employee ID)
- employeeName: ✓
- timestamp: ✓
- date: ✓
- location: ✓ (bisa kosong jika browser tidak support GPS)
```

---

## 📋 Checklist Perbaikan

Sebelum testing Attendance History, pastikan:

- [ ] Firestore Security Rules sudah updated (allow read, write: if true)
- [ ] Collection `users` ada
- [ ] Collection `employees` ada dengan data
- [ ] Collection `attendance` ada dengan data
- [ ] User sudah registrasi
- [ ] User profile punya field `employeeId`
- [ ] User sudah scan absensi minimal 1x

---

## 🧪 Testing Attendance History

Setelah perbaikan:

1. **Login sebagai employee**
   - Email: [user email]
   - Password: [user password]

2. **Buka Attendance History**
   - Menu → "Attendance History"
   - Atau langsung ke: `/attendance-history`

3. **Seharusnya melihat:**
   - Filter & search form
   - Tabel dengan attendance records
   - Tanggal, waktu, lokasi GPS

---

## 🐞 Debug Mode

Untuk melihat error detail di console:

1. **Buka Developer Tools**
   - F12 atau Right-click → Inspect

2. **Go to Console tab**
   - Lihat error message lengkap

3. **Share error message jika masih error**

---

## 📞 Jika Masih Error

Jika masih error setelah semua perbaikan:

1. **Clear browser cache**
   - Ctrl+Shift+Delete
   - Delete all

2. **Try private/incognito mode**
   - Ctrl+Shift+P (Chrome)
   - Cmd+Shift+P (Safari)

3. **Check Firestore Rules**
   - Pastikan sudah published
   - Tunggu 1-2 menit untuk sync

4. **Restart aplikasi**
   - Ctrl+C pada terminal
   - npm run dev (backend)
   - npm run dev:client (frontend)

---

## ✅ Berhasil!

Jika Attendance History sudah bisa diakses, Anda seharusnya melihat:

```
📋 Attendance Records (X)

| Date | Time | Type | Location | Action |
|------|------|------|----------|--------|
| 2025-12-02 | 09:30:00 | Check In | 37.4221, -122.0841 | View Map |
```

---

## 📝 Catatan Penting

- Attendance History hanya bisa diakses oleh role `employee`
- Admin/Superadmin lihat data di halaman "Reports"
- GPS location bisa kosong jika browser tidak support Geolocation
- Data tersimpan dengan realtime Firestore

---

**Last Updated**: 2025-12-02  
**Status**: ✅ Updated dengan error handling lebih baik
