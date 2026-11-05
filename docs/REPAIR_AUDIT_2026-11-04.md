<!--
Pembangun / Developer: Zrain
Dicipta / Created: 2026-11-04
Dikemas kini / Last updated: 2026-11-04
Fail / File: docs/REPAIR_AUDIT_2026-11-04.md
BM: Audit perubahan, had pengesahan, risiko dan cara menerapkan pembaikan Monitor.
EN: Monitor repair audit, verification limits, risks and safe application instructions.
-->

# Zrain Monitor | Engineering repair and handoff, 2026-11-04

**Status / Status:** Partially verified source release. No production deployment, D1 migration, Telegram delivery or authenticated live browser flow has been performed by this offline repair.

## 1. Scope / Skop

**BM:** Source dipulihkan menggunakan ZIP Zrain Monitor v1.0.21 dan ZIP Zrain UI yang dimuat naik. Perubahan kekal kepada penjajaran identiti, dokumentasi, metadata, komen pembelajaran dan ujian regresi. Worker API, cron schedule, D1 migrations, Firebase authentication, Telegram delivery, owner authorization, per-user/global quotas dan monitoring state-machine tidak diubah dari sudut executable behavior.

**EN:** This source release is based on the uploaded Zrain Monitor v1.0.21 and Zrain UI archives. Changes are limited to identity alignment, documentation, provenance metadata, educational comments and regression tests. Worker APIs, cron schedule, D1 migrations, Firebase authentication, Telegram delivery, owner authorization, per-user/global quotas and monitoring state-machine retain their original executable behavior.

## 2. Confirmed findings / Penemuan yang disahkan

| Severity | Finding / Penemuan | Resolution / Tindakan |
| --- | --- | --- |
| Medium | Zrain Monitor still pinned `@zrain/ui` to `fec7b1fe5deab157bdadf0af19d9384b1dc418f0`, not uploaded Golden Reference `a109401fa591afa9f66479fa8d86f1ed1679d70b` | Pin exact new commit in `package.json` and `package-lock.json`; mirror all three shared assets in `public/` |
| Medium | Shared UI module was only loaded on the main page, not guide/privacy | Load same `zrain-ui-config.js` on all three pages without enabling library-managed navigation |
| Low | Legacy app CSS overrode the approved Discover active nav presentation | Add narrowly scoped `public/monitor-brand-alignment.css` after page styles; preserve Monitor's existing ScrollSpy and admin tab visibility |
| Medium | Numerous code files lacked bilingual Developer/Created/Last-updated headers | Add safe BM-above-EN source headers, selected behavioral documentation and `FILE_PROVENANCE.json` |
| Low | Uploaded workspace included many untracked historical backup snapshots, a `.git` directory and 14 tracked modifications not yet committed | Exclude only history/backups and `.git` from the clean-source ZIP. Retain original uploaded ZIP as preservation baseline. Preserve both untracked manual E2E scripts in clean source, but do not run them against live services |

**BM:** Fail Google domain verification dalam `public/`, migrations SQL bernombor, data konfigurasi public Firebase dan pengenal D1 tidak dipadam atau dijana semula. Metadata untuk format JSON, aset binari dan fail pengesahan sensitif disimpan dalam registry, bukan diselitkan sebagai komen tidak sah.

**EN:** The Google verification file, numbered SQL migrations, public Firebase configuration and D1 identifier were not deleted or regenerated. Metadata for JSON, binary assets and sensitive verification formats lives in the registry rather than invalid inline comments.

## 3. Architecture and immutable contracts / Seni bina dan kontrak

- **Frontend:** Firebase Hosting (`public/`). Firebase Auth remains product-specific. Static HTML uses `public/zrain-ui-config.js` solely for visual identity, and `public/monitor-scrollspy.js` retains owner-controlled navigation.
- **Backend:** Cloudflare Worker (`src/worker.js`, `src/api.js`), with user ownership checks, token validation, admin-only diagnostics and D1 storage. Cron and email/Telegram outbox are separate operational concerns.
- **Database:** `migrations/0001_init.sql` through `0004_reliability.sql` stay in their original order. Never deploy schema changes by replacing the live database.
- **Capacity:** Configuration retains 5 monitors per user and 30 globally. Monitor checks target a roughly five-minute interval, with Cloudflare Cron scheduled every minute to service bounded batches.
- **Cost:** Preserve the RM0 Free-tier operating model. Do not enable paid tiers or automatic billing. Hosting, Workers and D1 continue to have provider-specific service limits.
- **Security:** Do not expose real tokens, private keys, Telegram secrets or `.env` files. Public Firebase Web configuration does not grant database administrator rights.

## 4. Verification / Pengesahan

**BM:** Pengesahan dijalankan terhadap source tempatan dan snapshot CSS/DOM, bukan production. Bilangan ujian sebenar dan hasil akhir dinyatakan dalam laporan serahan; jangan menganggap ujian frontend tanpa authentication bermakna keseluruhan perkhidmatan telah diuji.

**EN:** Verification used local source and CSS/DOM snapshots, not production. Actual final test totals are listed in the accompanying delivery report; unauthenticated frontend inspection does not mean the entire service was exercised.

Commands on Windows PowerShell from `Zrain\Projects\zrain-monitor`:

```powershell
npm ci
npm run ui:check
npm run test:release
```

Optional shared-package review in a separate `Zrain\Projects\zrain-ui` folder:

```powershell
npm test
```

**BM:** `npm run ui:check` memerlukan `node_modules/@zrain/ui` daripada commit yang telah dipin. Jika tidak sepadan, jalankan `npm ci` atau `npm run ui:sync` selepas pemasangan berjaya. Jangan memindahkan symlink ujian tempatan atau `node_modules` ke Git.

**EN:** `npm run ui:check` requires `node_modules/@zrain/ui` from the pinned commit. If assets do not match, run `npm ci` or `npm run ui:sync` after successful installation. Do not commit temporary test symlinks or `node_modules`.

## 5. Safe application / Cara memasang dengan selamat

1. **BM:** Pastikan semua perubahan Git tempatan telah disemak. Buat backup keseluruhan folder projek termasuk `.git`, bukan source sahaja. **EN:** Review uncommitted work and back up the entire folder including `.git`.
2. **BM:** Ekstrak clean-source ZIP ke folder sementara. Semak fail dan salin *kandungan* `zrain-monitor/` ke `Zrain/Projects/zrain-monitor/` menggunakan overwrite, tanpa memadam fail lain. **EN:** Extract to a temporary directory and overlay the contents onto the existing project without deleting unrelated files.
3. **BM:** Semak `git status`, `git diff` dan `git diff --check` terlebih dahulu. **EN:** Review status and diff before proceeding.
4. **BM:** Jalankan `npm ci`, `npm run ui:check`, `npm run test:release`. Semak UI desktop/mobile dan Firebase login secara manual. **EN:** Run installation and release checks; manually verify desktop/mobile UI and Firebase sign-in.
5. **BM:** Hanya selepas lulus, lakukan commit dan push terkawal. Deployment dilakukan secara berasingan, bukan automatik oleh ZIP. **EN:** Commit/push only after verification. Deployment is a separate action, not performed by this ZIP.

## 6. Rollback / Pemulihan

**BM:** Simpan ZIP yang dimuat naik dan salinan folder Git semasa sebelum overlay. Jika perubahan tidak sesuai, pulihkan fail daripada backup tersebut; jangan gunakan `git reset --hard` atau `git push --force` pada repository yang mempunyai perubahan pengguna yang belum diaudit.

**EN:** Preserve the original uploaded ZIP and a local backup of the current Git folder before overlay. Restore from that backup when necessary; never use `git reset --hard` or `git push --force` on a repository with unreviewed user modifications.

## 7. Remaining limitations / Had berbaki

**BM:** Ujian terhadap live Worker, D1 remote, cron, Firebase sign-in, penghantaran e-mel/Telegram sebenar, beban global, E2E skrip manual dan deployment belum dilaksanakan. Dokumentasi komen semakin meluas tetapi belum diaudit baris demi baris bagi setiap kondisi dan setiap fungsi UI besar; jangan labelkan keseluruhan persona sebagai 100% complete. ZIP tidak mengandungi `.git`, folder backup sejarah atau `node_modules` untuk mengelakkan pergantungan dan duplikasi yang tidak perlu.

**EN:** Live Worker, remote D1, cron, Firebase sign-in, actual email/Telegram delivery, global-scale load, manual E2E scripts and deployment were not exercised. Comment coverage is substantially improved but has not been line-by-line audited for every condition and every large UI function; do not label full persona compliance as 100% complete. The ZIP omits `.git`, historical backup folders and `node_modules` to avoid needless duplication and hidden dependencies.

## 8. Final offline evidence / Bukti pengesahan akhir

- **BM:** `npm test` dan `npm run test:release` menggunakan shared UI yang dipautkan secara setempat daripada ZIP `zrain-ui` yang dibekalkan. **73/73 ujian Monitor lulus**, termasuk lima ujian kontrak baharu. **EN:** Monitor release checks passed 73/73 tests, including five newly added contract tests, with the supplied `zrain-ui` mounted locally.
- **BM:** `npm test` untuk ZIP `zrain-ui` asal lulus **13/13**. **EN:** The supplied shared UI archive passed 13/13 tests.
- **BM:** Ujian gaya Chromium tidak menggunakan server sebenar kerana polisi browser menghalang navigasi localhost/file. Kandungan HTML, CSS dan modul Zrain UI yang sama dimuatkan melalui snapshot `set_content`. **9/9 kombinasi** (Dashboard/Guide/Privacy × 1440/390/320px) menunjukkan active tab yang betul, footer tagline dan tiada body-level horizontal overflow. **EN:** Browser policy blocked localhost/file navigation. Using inline source snapshots and the supplied UI code, all nine page/viewport combinations displayed correct active tabs, footer branding and no page-level horizontal overflow.
- **BM:** `npm ci`, API production, Firebase login sebenar, cron dan penghantaran notifikasi belum disahkan. **EN:** Actual `npm ci`, production APIs, Firebase login, Cron and notification delivery remain unverified in this environment.

## Update / Kemas kini selepas audit asal (2026-11-04)

**BM:** Dokumen ini merekod pengesahan **offline** release awal dan ditulis sebelum pengguna berjaya membuat deployment Worker/Firebase serta health checks. Selepas itu, Community Feedback yang terdapat pada commit GitHub `e716227` dikenal pasti tertinggal daripada ZIP awal. Sila gunakan `docs/COMPLETION_AUDIT_2026-11-04.md` untuk status terkini, penyatuan GitHub, batasan E2E dan prosedur push selamat.

**EN:** This document describes the **earlier offline** release, before the user successfully deployed Worker/Firebase and ran production health checks. Community Feedback from GitHub commit `e716227` was later found missing in that source ZIP. See `docs/COMPLETION_AUDIT_2026-11-04.md` for the current reconciliation status, E2E limits and safe push instructions.
