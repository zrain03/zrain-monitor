<!--
Pembangun / Developer: Zrain
Dicipta / Created: 2026-11-05
Dikemas kini / Last updated: 2026-11-05
Fail / File: docs/ZRAIN_COMMUNITY_CANONICAL_POLICY_2026-11-05.md
BM: Cadangan addendum rasmi kepada Zrain Engineering Persona untuk sistem maklum balas.
EN: Proposed official addendum to Zrain Engineering Persona for feedback integration.
-->
# Zrain Community as the canonical feedback platform / Zrain Community sebagai platform maklum balas kanonik

## BM

1. **Sumber tunggal:** Semua laman web, aplikasi dan alat awam Zrain **MESTI** menyediakan seksyen Zrain Community sebagai sistem maklum balas rasmi bagi komen, cadangan dan laporan pepijat, termasuk produk baharu dan sedia ada, kecuali pengecualian yang diluluskan secara jelas. GitHub Issues, GitHub Discussions, Disqus, Giscus dan mana-mana platform pihak ketiga **TIDAK BOLEH** digunakan sebagai widget maklum balas pengguna.
2. **Pemisahan tanggungjawab:** GitHub dibenarkan untuk source control, pull request, CI/CD dan isu pembangunan dalaman; bukan sebagai portal komen pengguna di laman produk.
3. **Pengasingan produk:** Setiap produk atau tool mempunyai `data-product` yang didaftarkan dan unik. Jangan berkongsi satu ID antara produk berbeza atau mencampurkan komen merentas tool.
4. **Integrasi rasmi:** Utamakan `https://zrain-community.web.app/embed.js` bersama `data-product` yang tepat dan komponen widget rasmi. Jangan membina sistem komen setempat atau menggunakan API key peribadi dalam frontend.
5. **Keselamatan:** Kekalkan domain allowlist, CSP minimum, anti-spam, moderasi, perlindungan privasi, dan had kos operasi sifar yang sebenar. Status backend dan penghantaran komen mesti diuji, bukan diandaikan daripada kewujudan skrip embed. Jangan mengenakan had posting harian; perlindungan keselamatan terhadap spam dan penyalahgunaan tetap wajib.
6. **Migration dan removal:** Apabila menukar sistem lama, buang aset, butang, pautan, CSP dan ujian yang mengikat GitHub Feedback. Simpan sejarah Git untuk tujuan audit; jangan padam rekod sejarah secara tidak sah. Jangan dakwa komen lama telah dipindahkan melainkan migrasi data diuji.
7. **Pengecualian sedia ada:** Guess the Flag dan Memory Rush dibenarkan mengekalkan sistem feedback dalam permainan yang telah dibina sendiri, berdasarkan keputusan pengguna terdahulu. Pengecualian tambahan memerlukan persetujuan pengguna secara jelas. Tiada pengecualian membenarkan pemasangan GitHub Feedback baharu.
8. **Kriteria siap:** Setiap laman produk yang relevan mesti mempunyai embed rasmi, ID betul, paparan desktop/mobile, ujian komen dan moderasi, ujian regresi, dokumentasi dan rekod provenance. Kehadiran widget sahaja tidak membuktikan integrasi siap.

## EN

1. **Single source:** Every public Zrain website, app, and tool **MUST** offer a Zrain Community section as its official feedback system for comments, suggestions and bug reports, including existing and future products, except explicitly approved exceptions. GitHub Issues, GitHub Discussions, Disqus, Giscus or third-party platforms **MUST NOT** serve as customer feedback widgets.
2. **Separation of concerns:** GitHub is allowed for source control, pull requests, CI/CD and internal development issue tracking, never as the public product comment portal.
3. **Per-product isolation:** Every product or tool has its own unique registered `data-product`. Do not reuse one ID across distinct products or merge conversations between tools.
4. **Official integration:** Prefer `https://zrain-community.web.app/embed.js` with the exact `data-product` and official widget. Never build a parallel local comment system or put private API keys in the frontend.
5. **Security:** Retain strict domain allowlists, least-privilege CSP, anti-abuse, moderation, privacy protections and truly zero-cost operating limits. Verify backend health and comment submission, not merely script presence. Do not impose a daily posting limit; abuse-prevention protections remain mandatory.
6. **Migration and cleanup:** Remove legacy GitHub Feedback assets, buttons, links, CSP permissions and tests when switching platforms. Preserve Git history for audit; do not falsely claim old comments were migrated unless migration is independently validated.
7. **Existing exceptions:** Guess the Flag and Memory Rush may keep their established in-game feedback systems per the user's prior decision. Additional exceptions require explicit user approval. No exception authorizes reintroducing GitHub Feedback.
8. **Done criteria:** Every relevant site requires the official embed, correct ID, responsive rendering, comment and moderation tests, regression coverage, documentation and provenance. An embedded script alone is not evidence of complete integration.
