# Fitur Kelola User Karyawan

## Deskripsi

Halaman ini memungkinkan Super Admin untuk mengelola akun user karyawan yang sudah terdaftar dalam sistem.

## Fitur Utama

### 1. Melihat Daftar User Karyawan

- Menampilkan semua karyawan yang sudah memiliki akun (sudah register)
- Informasi yang ditampilkan:
  - Nama lengkap
  - Email
  - ID Karyawan
  - Divisi
  - Tanggal terdaftar

### 2. Pencarian

- Cari user berdasarkan:
  - Nama
  - Email
  - ID Karyawan
  - Divisi

### 3. Hapus Akun User

- Menghapus akun user dari sistem
- **Penting**: Ketika akun dihapus:
  1. User dihapus dari collection `users` di Firestore
  2. Field `uid`, `email`, `isActive`, dan `lastLogin` di document `employees` direset
  3. Karyawan tersebut akan muncul kembali di dropdown register
  4. Karyawan dapat mendaftar ulang dengan email yang sama atau berbeda

## Akses

- **Role**: Super Admin only
- **Path**: `/employee-users`
- **Menu**: "User Karyawan" di sidebar

## Use Case

Fitur ini berguna ketika:

- Admin tidak sengaja menghapus akun karyawan
- Karyawan lupa password dan ingin membuat akun baru
- Karyawan ingin mengganti email yang digunakan untuk login
- Perlu reset akun karyawan karena masalah teknis

## Cara Penggunaan

### Menghapus Akun User Karyawan

1. Login sebagai Super Admin
2. Buka menu "User Karyawan" di sidebar
3. Cari karyawan yang ingin dihapus akunnya
4. Klik tombol "Hapus Akun"
5. Konfirmasi penghapusan
6. Akun user akan dihapus dan karyawan dapat mendaftar ulang

### Setelah Penghapusan

- Karyawan akan muncul kembali di halaman `/register` pada dropdown "Nama"
- Karyawan dapat mendaftar ulang dengan:
  - Email yang sama
  - Email yang berbeda
  - Password baru

## Technical Details

### Database Changes

Ketika akun dihapus:

```javascript
// 1. Delete user document
await deleteDoc(doc(db, "users", userId));

// 2. Reset employee document fields
await updateDoc(doc(db, "employees", employeeId), {
  uid: null,
  email: null,
  isActive: false,
  lastLogin: null,
});
```

### Filter di Register Page

```javascript
const unregisteredEmployees = employeesData.filter(
  (emp) => !emp.uid && !emp.email
);
```

Karyawan hanya muncul di dropdown register jika:

- `uid` adalah `null` atau tidak ada
- `email` adalah `null` atau tidak ada
