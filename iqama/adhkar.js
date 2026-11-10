// Duas and adhkar for the Today tab and full screen, chosen by the time of day.
// Arabic is from the Quran and hadith with the reference given; the English is a plain meaning written for this app.
// Please have this list checked before relying on it. n is the number of repetitions (0: no counter).

const KURSI = 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۗ مَن ذَا الَّذِي يَشْفَعُ عِندَهُ إِلَّا بِإِذْنِهِ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِ إِلَّا بِمَا شَاءَ ۚ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ ۖ وَلَا يَئُودُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْعَظِيمُ';
const KURSI_EN = 'Allah: there is no god but Him, the Ever-Living, the Sustainer of all. Neither drowsiness nor sleep overtakes Him. To Him belongs whatever is in the heavens and on the earth. Who could intercede with Him except by His permission? He knows what is before them and what is behind them, and they grasp nothing of His knowledge except what He wills. His Kursi extends over the heavens and the earth, and guarding them does not tire Him. He is the Most High, the Most Great.';

const D = {
  afterAdhan: { ar: 'اللَّهُمَّ رَبَّ هَذِهِ الدَّعْوَةِ التَّامَّةِ، وَالصَّلَاةِ الْقَائِمَةِ، آتِ مُحَمَّدًا الْوَسِيلَةَ وَالْفَضِيلَةَ، وَابْعَثْهُ مَقَامًا مَحْمُودًا الَّذِي وَعَدْتَهُ', tr: 'Allāhumma rabba hādhihid-daʿwatit-tāmmah, waṣ-ṣalātil-qāʾimah, āti Muḥammadanil-wasīlata wal-faḍīlah, wabʿath-hu maqāman maḥmūdanil-ladhī waʿadtah.', en: 'O Allah, Lord of this perfect call and of the prayer about to be established, grant Muhammad the place of intercession and distinction, and raise him to the praised station You promised him.', src: 'Bukhari 614', n: 1 },
  notRejected: { ar: 'الدُّعَاءُ لَا يُرَدُّ بَيْنَ الْأَذَانِ وَالْإِقَامَةِ', tr: 'Ad-duʿāʾu lā yuraddu baynal-adhāni wal-iqāmah.', en: 'The supplication made between the adhan and the iqama is not rejected. Make your own dua now.', src: 'Abu Dawud 521, Tirmidhi 212', n: 0 },
  istighfar: { ar: 'أَسْتَغْفِرُ اللَّهَ', tr: 'Astaghfirullāh.', en: 'I seek the forgiveness of Allah.', src: 'Muslim 591', n: 3 },
  salam: { ar: 'اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ، تَبَارَكْتَ يَا ذَا الْجَلَالِ وَالْإِكْرَامِ', tr: 'Allāhumma antas-salām wa minkas-salām, tabārakta yā dhal-jalāli wal-ikrām.', en: 'O Allah, You are Peace and from You comes peace. Blessed are You, Owner of majesty and honour.', src: 'Muslim 591', n: 1 },
  kursi: { ar: KURSI, tr: '', en: KURSI_EN, src: 'Quran 2:255', n: 1 },
  subhanallah: { ar: 'سُبْحَانَ اللَّهِ', tr: 'Subḥānallāh.', en: 'Glory be to Allah.', src: 'Muslim 596', n: 33 },
  alhamdulillah: { ar: 'الْحَمْدُ لِلَّهِ', tr: 'Al-ḥamdu lillāh.', en: 'All praise is for Allah.', src: 'Muslim 596', n: 33 },
  allahuakbar: { ar: 'اللَّهُ أَكْبَرُ', tr: 'Allāhu akbar.', en: 'Allah is the Greatest.', src: 'Muslim 596', n: 34 },
  bismillah: { ar: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ', tr: 'Bismillāhil-ladhī lā yaḍurru maʿa-smihi shayʾun fil-arḍi wa lā fis-samāʾi, wa huwas-samīʿul-ʿalīm.', en: 'In the name of Allah, with whose name nothing on earth or in the heavens can cause harm. He is the All-Hearing, the All-Knowing.', src: 'Abu Dawud 5088, Tirmidhi 3388', n: 3 },
  bihamdihi: { ar: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', tr: 'Subḥānallāhi wa biḥamdih.', en: 'Glory be to Allah, and praise be to Him.', src: 'Muslim 2692', n: 100 },
  tahlil: { ar: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ', tr: 'Lā ilāha illallāhu waḥdahu lā sharīka lah, lahul-mulku wa lahul-ḥamd, wa huwa ʿalā kulli shayʾin qadīr.', en: 'There is no god but Allah alone, with no partner. His is the dominion and His is the praise, and He has power over all things.', src: 'Bukhari 3293, Muslim 2691', n: 100 },
  morningBika: { ar: 'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ', tr: 'Allāhumma bika aṣbaḥnā, wa bika amsaynā, wa bika naḥyā, wa bika namūtu, wa ilaykan-nushūr.', en: 'O Allah, by You we enter the morning and by You we enter the evening, by You we live and by You we die, and to You is the resurrection.', src: 'Tirmidhi 3391', n: 1 },
  eveningBika: { ar: 'اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ الْمَصِيرُ', tr: 'Allāhumma bika amsaynā, wa bika aṣbaḥnā, wa bika naḥyā, wa bika namūtu, wa ilaykal-maṣīr.', en: 'O Allah, by You we enter the evening and by You we enter the morning, by You we live and by You we die, and to You is the return.', src: 'Tirmidhi 3391', n: 1 },
  aoodhu: { ar: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ', tr: 'Aʿūdhu bi-kalimātil-lāhit-tāmmāti min sharri mā khalaq.', en: 'I seek refuge in the perfect words of Allah from the evil of what He has created.', src: 'Muslim 2709', n: 3 },
  sleepName: { ar: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا', tr: 'Bismika Allāhumma amūtu wa aḥyā.', en: 'In Your name, O Allah, I die and I live.', src: 'Bukhari 6324', n: 1 },
  salawat: { ar: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ', tr: 'Allāhumma ṣalli ʿalā Muḥammadin wa ʿalā āli Muḥammad.', en: 'O Allah, send Your blessings upon Muhammad and the family of Muhammad. Send many blessings on the Prophet on Fridays.', src: 'Abu Dawud 1047', n: 0 },
  kahf: { ar: '', tr: '', en: 'Read Surah Al-Kahf today, the 18th chapter of the Quran.', src: 'Reported by al-Hakim and al-Bayhaqi', n: 0 },
  hasanah: { ar: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ', tr: 'Rabbanā ātinā fid-dunyā ḥasanatan wa fil-ākhirati ḥasanatan wa qinā ʿadhāban-nār.', en: 'Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of the Fire.', src: 'Quran 2:201, Bukhari 6389', n: 0 },
  ilm: { ar: 'رَبِّ زِدْنِي عِلْمًا', tr: 'Rabbi zidnī ʿilmā.', en: 'My Lord, increase me in knowledge.', src: 'Quran 20:114', n: 0 },
  afiyah: { ar: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ', tr: 'Allāhumma innī asʾalukal-ʿafwa wal-ʿāfiyata fid-dunyā wal-ākhirah.', en: 'O Allah, I ask You for pardon and wellbeing in this world and the Hereafter.', src: 'Ibn Majah 3871', n: 0 },
  thabbit: { ar: 'يَا مُقَلِّبَ الْقُلُوبِ ثَبِّتْ قَلْبِي عَلَى دِينِكَ', tr: 'Yā muqallibal-qulūb, thabbit qalbī ʿalā dīnik.', en: 'O Turner of hearts, keep my heart firm upon Your religion.', src: 'Tirmidhi 2140', n: 0 },
  azim: { ar: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ', tr: 'Subḥānallāhi wa biḥamdih, subḥānallāhil-ʿaẓīm.', en: 'Glory be to Allah, and praise be to Him. Glory be to Allah, the Most Great.', src: 'Bukhari 6406, Muslim 2694', n: 0 },
};

export const SETS = {
  adhan: { title: 'Between adhan and iqama', when: 'Dua after the adhan', items: [D.afterAdhan, D.notRejected] },
  prayer: { title: 'After the prayer', when: 'Adhkar after salah', items: [D.istighfar, D.salam, D.kursi, D.subhanallah, D.alhamdulillah, D.allahuakbar] },
  morning: { title: 'Morning adhkar', when: 'From Fajr until sunrise', items: [D.morningBika, D.bismillah, D.bihamdihi, D.tahlil] },
  evening: { title: 'Evening adhkar', when: 'From Asr until Maghrib', items: [D.bismillah, D.aoodhu, D.bihamdihi, D.eveningBika] },
  sleep: { title: 'Before sleep', when: 'After Isha', items: [D.sleepName, { ...D.kursi, src: 'Quran 2:255, Bukhari 2311' }, { ...D.subhanallah, src: 'Bukhari 3705, Muslim 2727' }, { ...D.alhamdulillah, src: 'Bukhari 3705, Muslim 2727' }, { ...D.allahuakbar, src: 'Bukhari 3705, Muslim 2727' }] },
  friday: { title: 'Jumu’ah', when: 'Friday', items: [D.salawat, D.kahf] },
  general: { title: 'Dua for today', when: 'A new one each day', items: [D.hasanah, D.ilm, D.afiyah, D.thabbit, D.azim] },
};

// Which set fits the moment. rows: today's [{ adhan, iqama }] for Fajr to Isha, in minutes after midnight.
export function pickSet(nowMin, rows, sunrise, weekday) {
  for (const r of rows) {
    const done = r.iqama ?? r.adhan;
    if (r.iqama != null && r.iqama > r.adhan && nowMin >= r.adhan && nowMin < r.iqama) return { key: 'adhan', until: r.iqama };
    if (nowMin >= done && nowMin < done + 20) return { key: 'prayer', until: done + 20 };
  }
  const [fajr, , asr, maghrib, isha] = rows;
  if (nowMin >= fajr.adhan && nowMin < sunrise) return { key: 'morning', until: sunrise };
  if (nowMin >= asr.adhan && nowMin < maghrib.adhan) return { key: 'evening', until: maghrib.adhan };
  if (nowMin >= (isha.iqama ?? isha.adhan) + 20 || nowMin < fajr.adhan) return { key: 'sleep', until: null };
  return { key: weekday === 'Fri' ? 'friday' : 'general', until: null };
}
