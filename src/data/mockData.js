// بيانات الدخول الافتراضية
export const INITIAL_USERS = [
  { id: 'u_admin', username: 'admin', password: 'admin123', name: 'سوبر أدمن الكنيسة', role: 'admin', sector: 'إدارة الكنيسة العامة', phone: '01000000000' },
  { id: 'u_priest', username: 'abouna.mina', password: '123', name: 'القمص مينا جرجس', role: 'priest', sector: 'قطاع المحطة', phone: '01220000001' },
  { id: 'u_servant', username: 'peter.servant', password: '123', name: 'الخادم بيتر عماد', role: 'servant', serviceStage: 'ثانوي', sector: 'خدمة ثانوي بنين', phone: '01120000002' },
  { id: 'u_member', username: 'kirollos', password: '123', name: 'كيرلس عادل توفيق', role: 'member', serviceStage: 'ثانوي', sector: 'قطاع المحطة', phone: '01230000003' }
];

// جدول طقوس وأسرار الأب الكاهن
export const INITIAL_SCHEDULE = [
  { id: 'sch_1', priestId: 'u_priest', type: 'قداس إلهي', churchName: 'كنيسة الشهيد مارمينا', title: 'قداس الجمعة الرئيسي', date: new Date().toISOString().split('T')[0], time: '07:00 ص', notes: 'مناولة مرضى بعد القداس' },
  { id: 'sch_2', priestId: 'u_priest', type: 'إكليل (فرح)', churchName: 'كنيسة السيدة العذراء', title: 'إكليل الشماس مايكل والعروس مارينا', date: '2025-05-15', time: '06:30 م', notes: 'توثيق العقد' },
  { id: 'sch_3', priestId: 'u_priest', type: 'صلاة أربعين', churchName: 'كنيسة مارمرقس', title: 'صلاة أربعين المرحوم حبيب', date: '2025-05-18', time: '04:00 م', notes: 'عزاء بالمنزل' },
  { id: 'sch_4', priestId: 'u_priest', type: 'تذكار سنوي', churchName: 'كنيسة الشهيد مارمينا', title: 'الذكرى السنوية للمرحومة تاسوني مريم', date: '2025-05-22', time: '08:30 ص', notes: 'قداس تذكار' }
];

// داتابيز المنطقة وبحث حالة إخوة الرب
export const INITIAL_FAMILIES = [
  {
    id: 'fam_1',
    priestId: 'u_priest',
    name: 'عادل توفيق إبراهيم',
    phone: '01221122334',
    dob: '1976-04-14',
    area: 'المحطة - شارع السلام',
    areaType: 'منطقة شعبية',
    job: 'عامل باليومية',
    povertyLevel: 'مفتقرة جداً ومعدمة',
    needsMonthlyAid: true,
    monthlyAmount: 1800,
    housing: 'إيجار جديد',
    healthCondition: 'انزلاق غضروفي حاد',
    notes: 'تحتاج مساعدة إيجار شهري وكرتونة بركة وعلاج شهري',
    children: [
      { id: 'ch_1', name: 'كيرلس', stage: 'أولى ثانوي', dob: '2008-03-20' },
      { id: 'ch_2', name: 'مارينا', stage: 'خامسة ابتدائي', dob: `${new Date().getFullYear() - 11}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate() + 2).padStart(2, '0')}` }
    ]
  },
  {
    id: 'fam_2',
    priestId: 'u_priest',
    name: 'سامي عزيز فرج',
    phone: '01011223344',
    dob: '1980-01-10',
    area: 'المحطة - شارع النصر',
    areaType: 'منطقة متوسطة',
    job: 'محاسب بشركة مقاولات',
    povertyLevel: 'مستقرة',
    needsMonthlyAid: false,
    monthlyAmount: 0,
    housing: 'تمليك',
    healthCondition: 'جيدة بحمد الله',
    notes: 'أسرة متعاونة وتشارك بالخدمة',
    children: [
      { id: 'ch_3', name: 'مارتن', stage: 'أولى هندسة', dob: '2005-01-12' }
    ]
  }
];

// جدول مواعيد الكنيسة العامة
export const CHURCH_EVENTS = [
  { id: 'ev_1', title: 'قداس الجمعة الصباحي', time: 'الجمعة 07:00 ص', place: 'الكنيسة الكبرى' },
  { id: 'ev_2', title: 'اجتماع ثانوي للشباب', time: 'الجمعة 06:00 م', place: 'قاعة البابا كيرلس' },
  { id: 'ev_3', title: 'مدارس أحد ابتدائي', time: 'الجمعة 09:30 ص', place: 'مبنى الخدمات' }
];