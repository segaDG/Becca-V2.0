/* ============================================
   BECCA V2.0 — Order Module
   Fix: search partial re-render, dropdown customer,
        format tabel sesuai Excel, timestamp & pelapor
============================================ */

const OrderModule = (() => {
  let _data = [];
  let _search = '';
  let _filterDate = '';
  let _filterCustomer = '';
  let _sortCol = 'tglOrder';
  let _sortDir = -1; // terbaru dulu

  /* ─── DEFAULT DATA (16–22 Mar 2026) ─── */
  const _defaultData = [{"id":"ord_00200","timestamp":"2026-03-13 20:14:28","pelapor":"Siti Rohimah ~ Iim","tglOrder":"2026-03-16","namaPerusahaan":"PT. IFF KRW","breakfast":0,"shift1":24,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":65,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00201","timestamp":"2026-03-13 20:15:36","pelapor":"Siti Rohimah ~ Iim","tglOrder":"2026-03-17","namaPerusahaan":"PT. IFF KRW","breakfast":0,"shift1":24,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":65,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00202","timestamp":"2026-03-13 20:15:36","pelapor":"Siti Rohimah ~ Iim","tglOrder":"2026-03-18","namaPerusahaan":"PT. IFF KRW","breakfast":0,"shift1":24,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":65,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00203","timestamp":"2026-03-13 20:16:28","pelapor":"Siti Rohimah ~ Iim","tglOrder":"2026-03-19","namaPerusahaan":"PT. IFF KRW","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00204","timestamp":"2026-03-13 20:16:42","pelapor":"Siti Rohimah ~ Iim","tglOrder":"2026-03-20","namaPerusahaan":"PT. IFF KRW","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00205","timestamp":"2026-03-13 20:16:58","pelapor":"Siti Rohimah ~ Iim","tglOrder":"2026-03-21","namaPerusahaan":"PT. IFF KRW","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00206","timestamp":"2026-03-13 20:17:05","pelapor":"Siti Rohimah ~ Iim","tglOrder":"2026-03-22","namaPerusahaan":"PT. IFF KRW","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00207","timestamp":"2026-03-13 20:21:49","pelapor":"Siti Rohimah ~ Iim","tglOrder":"2026-03-16","namaPerusahaan":"PT. RESONAC","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":60,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00208","timestamp":"2026-03-13 20:22:14","pelapor":"Siti Rohimah ~ Iim","tglOrder":"2026-03-17","namaPerusahaan":"PT. RESONAC","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":60,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00209","timestamp":"2026-03-13 20:22:14","pelapor":"Siti Rohimah ~ Iim","tglOrder":"2026-03-18","namaPerusahaan":"PT. RESONAC","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":60,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00210","timestamp":"2026-03-13 20:22:42","pelapor":"Siti Rohimah ~ Iim","tglOrder":"2026-03-19","namaPerusahaan":"PT. RESONAC","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00211","timestamp":"2026-03-13 20:22:56","pelapor":"Siti Rohimah ~ Iim","tglOrder":"2026-03-20","namaPerusahaan":"PT. RESONAC","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00212","timestamp":"2026-03-13 20:23:05","pelapor":"Siti Rohimah ~ Iim","tglOrder":"2026-03-21","namaPerusahaan":"PT. RESONAC","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00213","timestamp":"2026-03-13 20:23:14","pelapor":"Siti Rohimah ~ Iim","tglOrder":"2026-03-22","namaPerusahaan":"PT. RESONAC","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00214","timestamp":"2026-03-14 08:36:12","pelapor":"Wiwit ~ Niim","tglOrder":"2026-03-16","namaPerusahaan":"PT. NICI","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":45,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00215","timestamp":"2026-03-14 08:36:12","pelapor":"Wiwit ~ Niim","tglOrder":"2026-03-17","namaPerusahaan":"PT. NICI","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":45,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00216","timestamp":"2026-03-14 08:36:45","pelapor":"Wiwit ~ Niim","tglOrder":"2026-03-16","namaPerusahaan":"PT. NICI","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":110,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00217","timestamp":"2026-03-14 08:37:20","pelapor":"Wiwit ~ Niim","tglOrder":"2026-03-17","namaPerusahaan":"PT. NICI","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":110,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00218","timestamp":"2026-03-14 08:37:20","pelapor":"Wiwit ~ Niim","tglOrder":"2026-03-18","namaPerusahaan":"PT. NICI","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":110,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00219","timestamp":"2026-03-14 08:38:01","pelapor":"Wiwit ~ Niim","tglOrder":"2026-03-19","namaPerusahaan":"PT. NICI","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":110,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00220","timestamp":"2026-03-14 08:38:29","pelapor":"Wiwit ~ Niim","tglOrder":"2026-03-20","namaPerusahaan":"PT. NICI","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00221","timestamp":"2026-03-14 08:38:40","pelapor":"Wiwit ~ Niim","tglOrder":"2026-03-21","namaPerusahaan":"PT. NICI","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00222","timestamp":"2026-03-16 16:24:09","pelapor":"Nda ~ Teh Nadya","tglOrder":"2026-03-19","namaPerusahaan":"PT. IFF KRW","breakfast":0,"shift1":24,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"real orderan"},{"id":"ord_00223","timestamp":"2026-03-16 10:32:18","pelapor":"Agus ~ Pak Agus","tglOrder":"2026-03-16","namaPerusahaan":"PT. NBC","breakfast":0,"shift1":22,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":5,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"real orderan"},{"id":"ord_00224","timestamp":"2026-03-16 10:32:18","pelapor":"Agus ~ Pak Agus","tglOrder":"2026-03-17","namaPerusahaan":"PT. NBC","breakfast":0,"shift1":22,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":5,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00225","timestamp":"2026-03-16 10:32:18","pelapor":"Agus ~ Pak Agus","tglOrder":"2026-03-18","namaPerusahaan":"PT. NBC","breakfast":0,"shift1":22,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":5,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00226","timestamp":"2026-03-16 10:33:05","pelapor":"Agus ~ Pak Agus","tglOrder":"2026-03-19","namaPerusahaan":"PT. NBC","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00227","timestamp":"2026-03-16 10:33:05","pelapor":"Agus ~ Pak Agus","tglOrder":"2026-03-20","namaPerusahaan":"PT. NBC","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00228","timestamp":"2026-03-16 10:33:17","pelapor":"Agus ~ Pak Agus","tglOrder":"2026-03-21","namaPerusahaan":"PT. NBC","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00229","timestamp":"2026-03-13 20:45:22","pelapor":"Siti Rohimah ~ Iim","tglOrder":"2026-03-18","namaPerusahaan":"PT. RESONAC","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":40,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"real orderan"},{"id":"ord_00230","timestamp":"2026-03-14 09:10:05","pelapor":"Zia ~ Admin","tglOrder":"2026-03-16","namaPerusahaan":"PT. DDMI","breakfast":0,"shift1":32,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00231","timestamp":"2026-03-14 09:10:05","pelapor":"Zia ~ Admin","tglOrder":"2026-03-17","namaPerusahaan":"PT. DDMI","breakfast":0,"shift1":32,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00232","timestamp":"2026-03-14 09:10:05","pelapor":"Zia ~ Admin","tglOrder":"2026-03-18","namaPerusahaan":"PT. DDMI","breakfast":0,"shift1":32,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00233","timestamp":"2026-03-14 09:10:47","pelapor":"Zia ~ Admin","tglOrder":"2026-03-19","namaPerusahaan":"PT. DDMI","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00234","timestamp":"2026-03-14 09:10:47","pelapor":"Zia ~ Admin","tglOrder":"2026-03-20","namaPerusahaan":"PT. DDMI","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00235","timestamp":"2026-03-14 09:10:47","pelapor":"Zia ~ Admin","tglOrder":"2026-03-21","namaPerusahaan":"PT. DDMI","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00236","timestamp":"2026-03-14 07:45:33","pelapor":"Hendra ~ Mas Hendra","tglOrder":"2026-03-16","namaPerusahaan":"PT. DAIKI","breakfast":0,"shift1":25,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":45,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00237","timestamp":"2026-03-14 07:45:33","pelapor":"Hendra ~ Mas Hendra","tglOrder":"2026-03-17","namaPerusahaan":"PT. DAIKI","breakfast":0,"shift1":25,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":45,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00238","timestamp":"2026-03-14 07:46:02","pelapor":"Hendra ~ Mas Hendra","tglOrder":"2026-03-18","namaPerusahaan":"PT. DAIKI","breakfast":0,"shift1":25,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":45,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00239","timestamp":"2026-03-15 09:30:00","pelapor":"Admin BPS","tglOrder":"2026-03-16","namaPerusahaan":"PT. SSK","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00240","timestamp":"2026-03-15 09:30:00","pelapor":"Admin BPS","tglOrder":"2026-03-17","namaPerusahaan":"PT. SSK","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00241","timestamp":"2026-03-15 09:30:14","pelapor":"Admin BPS","tglOrder":"2026-03-18","namaPerusahaan":"PT. SSK","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00242","timestamp":"2026-03-15 09:30:14","pelapor":"Admin BPS","tglOrder":"2026-03-19","namaPerusahaan":"PT. SSK","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00243","timestamp":"2026-03-15 09:30:22","pelapor":"Admin BPS","tglOrder":"2026-03-20","namaPerusahaan":"PT. SSK","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00244","timestamp":"2026-03-15 09:30:32","pelapor":"Admin BPS","tglOrder":"2026-03-21","namaPerusahaan":"PT. SSK","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00245","timestamp":"2026-03-14 16:05:11","pelapor":"Rona ~ Kak Rona","tglOrder":"2026-03-16","namaPerusahaan":"PT. Shinto Kogyo","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":145,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"real orderan"},{"id":"ord_00246","timestamp":"2026-03-14 16:05:47","pelapor":"Rona ~ Kak Rona","tglOrder":"2026-03-17","namaPerusahaan":"PT. Shinto Kogyo","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00247","timestamp":"2026-03-14 16:06:00","pelapor":"Rona ~ Kak Rona","tglOrder":"2026-03-18","namaPerusahaan":"PT. Shinto Kogyo","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00248","timestamp":"2026-03-14 16:06:12","pelapor":"Rona ~ Kak Rona","tglOrder":"2026-03-19","namaPerusahaan":"PT. Shinto Kogyo","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00249","timestamp":"2026-03-14 16:06:22","pelapor":"Rona ~ Kak Rona","tglOrder":"2026-03-20","namaPerusahaan":"PT. Shinto Kogyo","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00250","timestamp":"2026-03-14 16:06:30","pelapor":"Rona ~ Kak Rona","tglOrder":"2026-03-21","namaPerusahaan":"PT. Shinto Kogyo","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00251","timestamp":"2026-03-14 08:38:55","pelapor":"Wiwit ~ Niim","tglOrder":"2026-03-18","namaPerusahaan":"PT. NICI","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00252","timestamp":"2026-03-14 08:39:05","pelapor":"Wiwit ~ Niim","tglOrder":"2026-03-19","namaPerusahaan":"PT. NICI","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00253","timestamp":"2026-03-14 08:39:15","pelapor":"Wiwit ~ Niim","tglOrder":"2026-03-17","namaPerusahaan":"PT. NICI","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00254","timestamp":"2026-03-19 11:08:22","pelapor":"Agus ~ Pak Agus","tglOrder":"2026-03-19","namaPerusahaan":"PT. NBC","breakfast":0,"shift1":10,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":5,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"real orderan"},{"id":"ord_00255","timestamp":"2026-03-14 16:10:05","pelapor":"Rona ~ Kak Rona","tglOrder":"2026-03-16","namaPerusahaan":"PT. Shinto Kogyo","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":120,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"real orderan"},{"id":"ord_00256","timestamp":"2026-03-16 10:35:40","pelapor":"Agus ~ Pak Agus","tglOrder":"2026-03-16","namaPerusahaan":"PT. NBC","breakfast":0,"shift1":17,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":7,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"real orderan"},{"id":"ord_00257","timestamp":"2026-03-16 16:22:10","pelapor":"Nda ~ Teh Nadya","tglOrder":"2026-03-19","namaPerusahaan":"PT. IFF KRW","breakfast":0,"shift1":9,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"real orderan"},{"id":"ord_00258","timestamp":"2026-03-13 20:17:22","pelapor":"Siti Rohimah ~ Iim","tglOrder":"2026-03-16","namaPerusahaan":"PT. IFF KRW","breakfast":0,"shift1":24,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":65,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"real orderan"},{"id":"ord_00259","timestamp":"2026-03-13 20:28:15","pelapor":"Siti Rohimah ~ Iim","tglOrder":"2026-03-16","namaPerusahaan":"PT. RESONAC","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":63,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"real orderan"},{"id":"ord_00260","timestamp":"2026-03-14 08:45:10","pelapor":"Wiwit ~ Niim","tglOrder":"2026-03-17","namaPerusahaan":"PT. NICI","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":86,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"real orderan"},{"id":"ord_00261","timestamp":"2026-03-14 07:48:30","pelapor":"Hendra ~ Mas Hendra","tglOrder":"2026-03-16","namaPerusahaan":"PT. DAIKI","breakfast":0,"shift1":28,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":40,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"real orderan"},{"id":"ord_00262","timestamp":"2026-03-14 07:49:05","pelapor":"Hendra ~ Mas Hendra","tglOrder":"2026-03-17","namaPerusahaan":"PT. DAIKI","breakfast":0,"shift1":26,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":20,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"real orderan"},{"id":"ord_00263","timestamp":"2026-03-14 07:50:15","pelapor":"Hendra ~ Mas Hendra","tglOrder":"2026-03-18","namaPerusahaan":"PT. DAIKI","breakfast":0,"shift1":27,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":7,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"real orderan"},{"id":"ord_00264","timestamp":"2026-03-15 09:31:10","pelapor":"Admin BPS","tglOrder":"2026-03-17","namaPerusahaan":"PT. SSK","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00265","timestamp":"2026-03-17 10:15:33","pelapor":"Agus ~ Pak Agus","tglOrder":"2026-03-17","namaPerusahaan":"PT. NBC","breakfast":0,"shift1":15,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":6,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"real orderan"},{"id":"ord_00266","timestamp":"2026-03-17 10:17:22","pelapor":"Nda ~ Teh Nadya","tglOrder":"2026-03-17","namaPerusahaan":"PT. IFF KRW","breakfast":0,"shift1":24,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":60,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"real orderan"},{"id":"ord_00267","timestamp":"2026-03-17 10:18:00","pelapor":"Nda ~ Teh Nadya","tglOrder":"2026-03-17","namaPerusahaan":"PT. IFF KRW","breakfast":0,"shift1":24,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":60,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"real orderan"},{"id":"ord_00268","timestamp":"2026-03-14 08:47:05","pelapor":"Wiwit ~ Niim","tglOrder":"2026-03-17","namaPerusahaan":"PT. NICI","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":84,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"real orderan"},{"id":"ord_00269","timestamp":"2026-03-13 20:32:11","pelapor":"Siti Rohimah ~ Iim","tglOrder":"2026-03-17","namaPerusahaan":"PT. RESONAC","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":66,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"real orderan"},{"id":"ord_00270","timestamp":"2026-03-15 09:32:20","pelapor":"Admin BPS","tglOrder":"2026-03-18","namaPerusahaan":"PT. SSK","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"estimasi orderan"},{"id":"ord_00271","timestamp":"2026-03-14 09:12:15","pelapor":"Zia ~ Admin","tglOrder":"2026-03-17","namaPerusahaan":"PT. DDMI","breakfast":0,"shift1":28,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":0,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"real orderan"},{"id":"ord_00272","timestamp":"2026-03-18 09:45:11","pelapor":"Agus ~ Pak Agus","tglOrder":"2026-03-18","namaPerusahaan":"PT. NBC","breakfast":0,"shift1":15,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":8,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"real orderan"},{"id":"ord_00273","timestamp":"2026-03-18 09:47:02","pelapor":"Nda ~ Teh Nadya","tglOrder":"2026-03-18","namaPerusahaan":"PT. IFF KRW","breakfast":0,"shift1":16,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":45,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"real orderan"},{"id":"ord_00274","timestamp":"2026-03-13 20:40:30","pelapor":"Siti Rohimah ~ Iim","tglOrder":"2026-03-18","namaPerusahaan":"PT. RESONAC","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":57,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"real orderan"},{"id":"ord_00275","timestamp":"2026-03-14 08:50:22","pelapor":"Wiwit ~ Niim","tglOrder":"2026-03-18","namaPerusahaan":"PT. NICI","breakfast":0,"shift1":0,"spare1":0,"ot1":0,"snack1":0,"shift2":0,"spare2":0,"ot2":0,"snack2":0,"shift3":1,"spare3":0,"ot3":0,"snack3":0,"snackBerat":0,"catatan":"real orderan"}];

  /* ─── HELPERS ─── */
  function _fmtDate(s) {
    if (!s) return '-';
    try {
      const d = new Date(s);
      return d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});
    } catch(e) { return s; }
  }
  function _fmtTs(s) {
    if (!s) return '-';
    try {
      const [d,t] = s.split(' ');
      const dd = new Date(d);
      return dd.toLocaleDateString('id-ID',{day:'2-digit',month:'short'}) + (t?' '+t.slice(0,5):'');
    } catch(e) { return s; }
  }
  function _n(v) { return v || 0; }
  function _c(v) { return (v && v>0) ? `<span style="font-weight:600;color:var(--text)">${v}</span>` : `<span style="color:var(--border2)">-</span>`; }
  function _jenisBadge(cat) {
    if (!cat) return '';
    return cat.toLowerCase().includes('real')
      ? `<span style="font-size:9px;background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.3);padding:1px 6px;border-radius:10px;font-weight:700">REAL</span>`
      : `<span style="font-size:9px;background:rgba(99,102,241,.12);color:#6366f1;border:1px solid rgba(99,102,241,.25);padding:1px 6px;border-radius:10px;font-weight:700">EST</span>`;
  }

  /* ─── INIT ─── */
  async function init() {
    const page = document.getElementById('page-order');
    if (!page) return;
    try {
      const saved = localStorage.getItem('becca_orders');
      _data = saved ? JSON.parse(saved) : [];
      if (!_data.length) {
        _data = JSON.parse(JSON.stringify(_defaultData));
        localStorage.setItem('becca_orders', JSON.stringify(_data));
      }
    } catch(e) {
      _data = JSON.parse(JSON.stringify(_defaultData));
    }
    _renderFull(page);
  }

  /* ─── FULL RENDER — hanya dipanggil saat init atau setelah add/edit ─── */
  function _renderFull(page) {
    if (!page) page = document.getElementById('page-order');
    if (!page) return;

    // Ambil daftar customer unik dari localStorage
    const customers = _getCustomers();
    const custNames = [...new Set(_data.map(o => o.namaPerusahaan).filter(Boolean))].sort();

    const totalOrders = _data.length;
    const totalReal = _data.filter(o => (o.catatan||'').toLowerCase().includes('real')).length;
    const totalEst  = totalOrders - totalReal;
    const uniqueCustomers = new Set(_data.map(o => o.namaPerusahaan)).size;

    page.innerHTML = `
    <style>
      .ord-th { padding:9px 8px; font-size:10px; font-weight:700; text-transform:uppercase; color:#fff; white-space:nowrap; text-align:center }
      .ord-td { padding:7px 8px; border-bottom:1px solid var(--border); font-size:11px; text-align:center }
      .ord-scroll { overflow-x:auto; -webkit-overflow-scrolling:touch }
    </style>

    <div class="page-header">
      <div class="page-header-left">
        <h2>Data Orderan Catering</h2>
        <p>Rekapitulasi order masuk dari BECCAbot — 16 s/d 22 Maret 2026</p>
      </div>
      <div class="page-header-right">
        <button class="btn btn-primary" onclick="OrderModule.openModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 5v14M5 12h14"/></svg>
          Tambah Order
        </button>
      </div>
    </div>

    <!-- STAT CARDS -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
      ${[
        {l:'Total Order',v:totalOrders,c:'#6366f1',s:'entri'},
        {l:'Real Order',v:totalReal,c:'#10b981',s:'terkonfirmasi'},
        {l:'Estimasi',v:totalEst,c:'#f59e0b',s:'perkiraan'},
        {l:'Customer',v:uniqueCustomers,c:'#ec4899',s:'perusahaan'},
      ].map(s=>`<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 18px;position:relative;overflow:hidden">
        <div style="position:absolute;top:0;left:0;width:4px;height:100%;background:${s.c}"></div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:4px">${s.l}</div>
        <div style="font-size:22px;font-weight:900;color:${s.c};font-family:var(--font-mono)">${s.v} <span style="font-size:12px;font-weight:400;color:var(--text-3)">${s.s}</span></div>
      </div>`).join('')}
    </div>

    <!-- TABLE CARD -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden">

      <!-- TOOLBAR — TIDAK DI-RE-RENDER SAAT SEARCH -->
      <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <!-- Search -->
        <div style="position:relative;flex:1;max-width:260px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"
            style="position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--text-3)">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input id="ord-search" placeholder="Cari customer / pelapor..." value="${_search}"
            style="width:100%;padding:6px 8px 6px 28px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);font-size:12px;color:var(--text);outline:none;box-sizing:border-box"
            oninput="OrderModule.setSearch(this.value)">
        </div>
        <!-- Filter Customer -->
        <select id="ord-filter-cust" onchange="OrderModule.setFilterCustomer(this.value)"
          style="padding:6px 10px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);font-size:12px;color:var(--text);cursor:pointer;max-width:180px">
          <option value="">Semua Customer</option>
          ${custNames.map(n=>`<option value="${n}" ${_filterCustomer===n?'selected':''}>${n}</option>`).join('')}
        </select>
        <!-- Filter Tanggal -->
        <input id="ord-filter-date" type="date" value="${_filterDate}"
          onchange="OrderModule.setFilterDate(this.value)"
          style="padding:6px 10px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);font-size:12px;color:var(--text);cursor:pointer">
        <!-- Count label -->
        <span id="ord-count-label" style="font-size:11px;color:var(--text-3);margin-left:auto"></span>
      </div>

      <!-- TABLE -->
      <div class="ord-scroll">
        <table style="width:100%;border-collapse:collapse;min-width:1300px;font-size:11px">
          <thead>
            <!-- GROUP HEADER -->
            <tr style="background:#1e1e2e">
              <th colspan="3" style="padding:5px 8px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9ca3af;text-align:center">INPUT</th>
              <th colspan="2" style="padding:5px 8px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9ca3af;text-align:center">ORDER</th>
              <th colspan="5" style="padding:5px 8px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6366f1;text-align:center;background:rgba(99,102,241,.15)">SHIFT 1</th>
              <th colspan="4" style="padding:5px 8px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#10b981;text-align:center;background:rgba(16,185,129,.1)">SHIFT 2</th>
              <th colspan="4" style="padding:5px 8px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#f59e0b;text-align:center;background:rgba(245,158,11,.1)">SHIFT 3</th>
              <th colspan="1" style="padding:5px 8px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#ec4899;text-align:center;background:rgba(236,72,153,.1)">SNACK</th>
              <th colspan="1" style="padding:5px 8px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9ca3af;text-align:center">NOTE</th>
            </tr>
            <!-- KOLOM HEADER -->
            <tr style="background:var(--primary-h)">
              <th class="ord-th" style="width:36px">#</th>
              <th class="ord-th" style="text-align:left">Timestamp Input</th>
              <th class="ord-th" style="text-align:left">Pelapor</th>
              <th class="ord-th">Tgl Order</th>
              <th class="ord-th" style="text-align:left;min-width:140px">Customer</th>
              <th class="ord-th" style="background:rgba(99,102,241,.12)">BF</th>
              <th class="ord-th" style="background:rgba(99,102,241,.12)">S1</th>
              <th class="ord-th" style="background:rgba(99,102,241,.12)">Sp1</th>
              <th class="ord-th" style="background:rgba(99,102,241,.12)">OT1</th>
              <th class="ord-th" style="background:rgba(99,102,241,.12)">Snk1</th>
              <th class="ord-th" style="background:rgba(16,185,129,.08)">S2</th>
              <th class="ord-th" style="background:rgba(16,185,129,.08)">Sp2</th>
              <th class="ord-th" style="background:rgba(16,185,129,.08)">OT2</th>
              <th class="ord-th" style="background:rgba(16,185,129,.08)">Snk2</th>
              <th class="ord-th" style="background:rgba(245,158,11,.08)">S3</th>
              <th class="ord-th" style="background:rgba(245,158,11,.08)">Sp3</th>
              <th class="ord-th" style="background:rgba(245,158,11,.08)">OT3</th>
              <th class="ord-th" style="background:rgba(245,158,11,.08)">Snk3</th>
              <th class="ord-th" style="background:rgba(236,72,153,.08)">SnkBrt</th>
              <th class="ord-th">Jenis</th>
            </tr>
          </thead>
          <tbody id="ord-tbody"></tbody>
        </table>
      </div>
    </div>`;

    _renderTbody();
  }

  /* ─── PARTIAL RENDER — hanya tbody ─── */
  function _renderTbody() {
    let list = [..._data];

    // Sort terbaru dulu (tglOrder desc, lalu timestamp desc)
    list.sort((a,b) => {
      const dc = (b.tglOrder||'').localeCompare(a.tglOrder||'');
      if (dc !== 0) return dc;
      return (b.timestamp||'').localeCompare(a.timestamp||'');
    });

    // Filter
    if (_search) {
      const q = _search.toLowerCase();
      list = list.filter(o =>
        (o.namaPerusahaan||'').toLowerCase().includes(q) ||
        (o.pelapor||'').toLowerCase().includes(q) ||
        (o.invoiceNum||'').toLowerCase().includes(q)
      );
    }
    if (_filterCustomer) list = list.filter(o => o.namaPerusahaan === _filterCustomer);
    if (_filterDate)     list = list.filter(o => o.tglOrder === _filterDate);

    // Update counter
    const countEl = document.getElementById('ord-count-label');
    if (countEl) countEl.textContent = list.length + ' order ditampilkan';

    const tbody = document.getElementById('ord-tbody');
    if (!tbody) { _renderFull(); return; }

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="20" style="text-align:center;padding:48px;color:var(--text-3)">Tidak ada data order.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map((o, i) => {
      const bg = i%2===0 ? 'var(--surface)' : 'var(--surface2)';
      return `<tr
        onmouseenter="this.querySelectorAll('td').forEach(function(t){t.dataset.ori=t.style.background;t.style.background='rgba(99,102,241,.07)'})"
        onmouseleave="this.querySelectorAll('td').forEach(function(t){t.style.background=t.dataset.ori})"
        style="border-bottom:1px solid var(--border)">
        <td class="ord-td" style="font-size:10px;color:var(--text-3);background:${bg}">${i+1}</td>
        <td class="ord-td" style="text-align:left;font-size:10px;font-family:var(--font-mono);color:var(--text-2);background:${bg};white-space:nowrap">${_fmtTs(o.timestamp)}</td>
        <td class="ord-td" style="text-align:left;font-size:10px;color:var(--text-2);background:${bg};white-space:nowrap">${o.pelapor||'-'}</td>
        <td class="ord-td" style="font-size:10px;font-weight:600;background:${bg};white-space:nowrap">${_fmtDate(o.tglOrder)}</td>
        <td class="ord-td" style="text-align:left;font-weight:600;background:${bg}">${o.namaPerusahaan||'-'}</td>
        <td class="ord-td" style="background:rgba(99,102,241,.06)">${_c(o.breakfast)}</td>
        <td class="ord-td" style="background:rgba(99,102,241,.06)">${_c(o.shift1)}</td>
        <td class="ord-td" style="background:rgba(99,102,241,.06)">${_c(o.spare1)}</td>
        <td class="ord-td" style="background:rgba(99,102,241,.06)">${_c(o.ot1)}</td>
        <td class="ord-td" style="background:rgba(99,102,241,.06)">${_c(o.snack1)}</td>
        <td class="ord-td" style="background:rgba(16,185,129,.05)">${_c(o.shift2)}</td>
        <td class="ord-td" style="background:rgba(16,185,129,.05)">${_c(o.spare2)}</td>
        <td class="ord-td" style="background:rgba(16,185,129,.05)">${_c(o.ot2)}</td>
        <td class="ord-td" style="background:rgba(16,185,129,.05)">${_c(o.snack2)}</td>
        <td class="ord-td" style="background:rgba(245,158,11,.06)">${_c(o.shift3)}</td>
        <td class="ord-td" style="background:rgba(245,158,11,.06)">${_c(o.spare3)}</td>
        <td class="ord-td" style="background:rgba(245,158,11,.06)">${_c(o.ot3)}</td>
        <td class="ord-td" style="background:rgba(245,158,11,.06)">${_c(o.snack3)}</td>
        <td class="ord-td" style="background:rgba(236,72,153,.06)">${_c(o.snackBerat)}</td>
        <td class="ord-td" style="background:${bg}">${_jenisBadge(o.catatan)}</td>
      </tr>`;
    }).join('');
  }

  /* ─── AMBIL CUSTOMER DARI localStorage ─── */
  function _getCustomers() {
    try {
      return JSON.parse(localStorage.getItem('becca_customers') || '[]');
    } catch(e) { return []; }
  }

  /* ─── MODAL TAMBAH ORDER ─── */
  function openModal(id) {
    const customers = _getCustomers();
    const custOptions = customers.length
      ? customers.map(c => `<option value="${c.nama}">${c.nama}</option>`).join('')
      : _getCustomers().map(n => `<option value="${n}">${n}</option>`).join('');

    const today = new Date().toISOString().slice(0,10);

    Modal.open({
      title: 'Tambah Order Catering',
      size: 'modal-lg',
      body: `
        <style>
          .ord-form-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:8px }
          .ord-shift-label { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; padding:6px 0 4px; border-top:1px solid var(--border); margin-top:6px; grid-column:1/-1 }
        </style>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s3);margin-bottom:var(--s3)">
          <div class="form-group">
            <label class="form-label">Tanggal Order <span style="color:var(--danger)">*</span></label>
            <input class="form-control" id="of-tglOrder" type="date" value="${today}">
          </div>
          <div class="form-group">
            <label class="form-label">Jenis Orderan</label>
            <select class="form-control" id="of-jenis">
              <option value="real orderan">Real Orderan</option>
              <option value="estimasi orderan">Estimasi Orderan</option>
            </select>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:2fr 1fr;gap:var(--s3);margin-bottom:var(--s3)">
          <div class="form-group">
            <label class="form-label">Nama Perusahaan (Customer) <span style="color:var(--danger)">*</span></label>
            <select class="form-control" id="of-customer" style="width:100%">
              <option value="">— Pilih Customer —</option>
              ${custOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Pelapor</label>
            <input class="form-control" id="of-pelapor" placeholder="Nama pelapor...">
          </div>
        </div>

        <!-- BREAKFAST -->
        <div class="ord-form-grid">
          <div class="ord-shift-label" style="color:var(--warning)">☀️ Breakfast</div>
          <div class="form-group"><label class="form-label">Breakfast</label><input class="form-control" id="of-breakfast" type="number" min="0" value="0" style="text-align:center;font-family:var(--font-mono)"></div>
        </div>

        <!-- SHIFT 1 -->
        <div class="ord-form-grid">
          <div class="ord-shift-label" style="color:#6366f1">🔵 Shift 1</div>
          <div class="form-group"><label class="form-label">Shift 1</label><input class="form-control" id="of-shift1" type="number" min="0" value="0" style="text-align:center;font-family:var(--font-mono)"></div>
          <div class="form-group"><label class="form-label">Spare 1</label><input class="form-control" id="of-spare1" type="number" min="0" value="0" style="text-align:center;font-family:var(--font-mono)"></div>
          <div class="form-group"><label class="form-label">OT 1</label><input class="form-control" id="of-ot1" type="number" min="0" value="0" style="text-align:center;font-family:var(--font-mono)"></div>
          <div class="form-group"><label class="form-label">Snack 1</label><input class="form-control" id="of-snack1" type="number" min="0" value="0" style="text-align:center;font-family:var(--font-mono)"></div>
        </div>

        <!-- SHIFT 2 -->
        <div class="ord-form-grid">
          <div class="ord-shift-label" style="color:#10b981">🟢 Shift 2</div>
          <div class="form-group"><label class="form-label">Shift 2</label><input class="form-control" id="of-shift2" type="number" min="0" value="0" style="text-align:center;font-family:var(--font-mono)"></div>
          <div class="form-group"><label class="form-label">Spare 2</label><input class="form-control" id="of-spare2" type="number" min="0" value="0" style="text-align:center;font-family:var(--font-mono)"></div>
          <div class="form-group"><label class="form-label">OT 2</label><input class="form-control" id="of-ot2" type="number" min="0" value="0" style="text-align:center;font-family:var(--font-mono)"></div>
          <div class="form-group"><label class="form-label">Snack 2</label><input class="form-control" id="of-snack2" type="number" min="0" value="0" style="text-align:center;font-family:var(--font-mono)"></div>
        </div>

        <!-- SHIFT 3 -->
        <div class="ord-form-grid">
          <div class="ord-shift-label" style="color:#f59e0b">🟡 Shift 3</div>
          <div class="form-group"><label class="form-label">Shift 3</label><input class="form-control" id="of-shift3" type="number" min="0" value="0" style="text-align:center;font-family:var(--font-mono)"></div>
          <div class="form-group"><label class="form-label">Spare 3</label><input class="form-control" id="of-spare3" type="number" min="0" value="0" style="text-align:center;font-family:var(--font-mono)"></div>
          <div class="form-group"><label class="form-label">OT 3</label><input class="form-control" id="of-ot3" type="number" min="0" value="0" style="text-align:center;font-family:var(--font-mono)"></div>
          <div class="form-group"><label class="form-label">Snack 3</label><input class="form-control" id="of-snack3" type="number" min="0" value="0" style="text-align:center;font-family:var(--font-mono)"></div>
        </div>

        <!-- SNACK BERAT -->
        <div class="ord-form-grid">
          <div class="ord-shift-label" style="color:#ec4899">🍱 Snack Berat</div>
          <div class="form-group"><label class="form-label">Snack Berat</label><input class="form-control" id="of-snackBerat" type="number" min="0" value="0" style="text-align:center;font-family:var(--font-mono)"></div>
        </div>`,
      buttons: [
        {label:'Batal', class:'btn-ghost', onclick:'Modal.close()'},
        {label:'Simpan Order', class:'btn-primary', onclick:'OrderModule._submit()'}
      ]
    });
  }

  /* ─── SUBMIT ─── */
  function _submit() {
    const g = sel => document.getElementById(sel)?.value?.trim() || '';
    const n = sel => parseInt(document.getElementById(sel)?.value) || 0;

    const tglOrder = g('of-tglOrder');
    const customer = g('of-customer');
    if (!tglOrder) { Notify.warning('Tanggal order wajib diisi'); return; }
    if (!customer) { Notify.warning('Pilih nama perusahaan'); return; }

    const now = new Date();
    const ts  = now.toISOString().slice(0,10) + ' ' + now.toTimeString().slice(0,8);
    const user = (typeof Auth !== 'undefined' && Auth.user) ? (Auth.user.name || Auth.user.username || '') : '';

    const obj = {
      id: 'ord_' + Date.now(),
      timestamp: ts,
      pelapor: g('of-pelapor') || user,
      tglOrder,
      namaPerusahaan: customer,
      breakfast: n('of-breakfast'),
      shift1:    n('of-shift1'),
      spare1:    n('of-spare1'),
      ot1:       n('of-ot1'),
      snack1:    n('of-snack1'),
      shift2:    n('of-shift2'),
      spare2:    n('of-spare2'),
      ot2:       n('of-ot2'),
      snack2:    n('of-snack2'),
      shift3:    n('of-shift3'),
      spare3:    n('of-spare3'),
      ot3:       n('of-ot3'),
      snack3:    n('of-snack3'),
      snackBerat: n('of-snackBerat'),
      catatan: g('of-jenis'),
    };

    _data.push(obj);
    localStorage.setItem('becca_orders', JSON.stringify(_data));
    Modal.close();
    Notify.success('Order berhasil ditambahkan');
    _renderFull();
  }

  /* ─── CONTROLS (partial re-render — search tidak reset focus) ─── */
  function setSearch(val) {
    _search = (val||'').toLowerCase().trim();
    _renderTbody(); // Hanya tbody, bukan seluruh halaman
  }
  function setFilterCustomer(val) {
    _filterCustomer = val;
    _renderTbody();
  }
  function setFilterDate(val) {
    _filterDate = val;
    _renderTbody();
  }

  return { init, openModal, _submit, setSearch, setFilterCustomer, setFilterDate };
})();

window.OrderModule = OrderModule;
