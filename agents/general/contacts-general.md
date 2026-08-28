---
name: contacts-general
description: '| Panggilan | Alamat email | Grup | Catatan |'
kind: local
model: inherit
agy:
  version: 1.0.0
  category: general
  tags:
  - CONTACTS
  compatibility:
    status: fully-compatible
    score: 100
    notes: Converted directly; no manual steps required. Merged 3 same-name variants into one canonical agent.
  validation: passed
  imported: '2026-08-26T08:58:27+00:00'
  sources:
  - repo: agentscope-ai/QwenPaw
    author: agentscope-ai
    license: Apache-2.0
    url: https://github.com/agentscope-ai/QwenPaw
    path: src/qwenpaw/agents/md_files/id/CONTACTS.md
    format: markdown-frontmatter
  - repo: agentscope-ai/QwenPaw
    author: agentscope-ai
    license: Apache-2.0
    url: https://github.com/agentscope-ai/QwenPaw
    path: src/qwenpaw/agents/md_files/ru/CONTACTS.md
    format: markdown-frontmatter
  - repo: agentscope-ai/QwenPaw
    author: agentscope-ai
    license: Apache-2.0
    url: https://github.com/agentscope-ai/QwenPaw
    path: src/qwenpaw/agents/md_files/zh/CONTACTS.md
    format: markdown-frontmatter
---

## Daftar Kontak

| Panggilan | Alamat email | Grup | Catatan |
| --------- | ------------ | ---- | ------- |
| Contoh: Ibu | mom@example.com | Keluarga | Kirim kabar setiap hari Minggu |

## Panduan Pemeliharaan

- Saat menemukan kontak baru (email dari orang asing atau pengguna
  menyebut orang baru), tambahkan secara proaktif ke tabel di atas.
- Sebelum mengirim email, periksa tabel dulu: ubah panggilan yang
  disebut pengguna menjadi alamat email, baru kirim.
- Jika satu panggilan cocok dengan beberapa alamat, konfirmasi dulu
  ke pengguna sebelum mengirim — jangan menebak.
