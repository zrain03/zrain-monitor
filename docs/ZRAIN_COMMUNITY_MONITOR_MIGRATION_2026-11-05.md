<!--
Pembangun / Developer: Zrain
Dicipta / Created: 2026-11-05
Dikemas kini / Last updated: 2026-11-05
Fail / File: docs/ZRAIN_COMMUNITY_MONITOR_MIGRATION_2026-11-05.md
BM: Catatan penyatuan Zrain Community bagi Monitor.
EN: Record of Zrain Community integration replacing Monitor GitHub Feedback.
-->
# Zrain Monitor public feedback migration / Migrasi maklum balas awam Zrain Monitor

## BM

Perubahan frontend sahaja pada tiga halaman awam. Widget dan CSS `feedback-embed.js`/`feedback.css` berasaskan GitHub Issues dibuang sepenuhnya. Ketiga-tiga halaman menggunakan skrip rasmi Zrain Community dengan `data-product="zrain-monitor"` dan target `#zrain-community` sebelum footer. CSP Firebase membuang domain GitHub API/avatar dan menambah host rasmi pada `script-src` serta `frame-src`. Backend monitoring, D1, Cron, Telegram dan Firebase Auth tidak diubah.

Rujukan asal GitHub issue #17 dan kod lama kekal hanya dalam sejarah Git, bukan frontend awam. Tidak ada migrasi komen lama yang dilakukan. Pengesahan fail, ujian source dan lint bukan bukti pengguna benar-benar boleh menghantar komen. Selepas deployment, semak iframe, komen, admin delete, paparan responsive, dan status API Zrain Community secara manual.

## EN

Frontend-only migration across the three public Monitor pages. The GitHub Issues-based `feedback-embed.js` and `feedback.css` are removed. Each page loads the official Zrain Community script using `data-product="zrain-monitor"` and the `#zrain-community` target before its footer. Firebase CSP removes GitHub API/avatar origins and adds the official Community origin to `script-src` and `frame-src`. Monitoring backend, D1, Cron, Telegram and Firebase Auth are untouched.

Legacy issue #17 and original code remain in Git history only, not in public pages. No old-comment data migration was performed. Source tests alone cannot prove live posting. After deployment, manually check iframe rendering, comment submission, admin deletion, mobile responsiveness and Zrain Community API status.
