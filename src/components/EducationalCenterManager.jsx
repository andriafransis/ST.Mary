import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLogger';
import {
  GraduationCap, BookOpen, Plus, Trash2, Edit3,
  Printer, X, BookmarkCheck, Clock, DollarSign, UserCheck, Lock
} from 'lucide-react';

const MAIN_STAGES = [
  { key: 'KG', label: 'KG (رياض أطفال)' },
  { key: 'ابتدائي', label: 'المرحلة الابتدائية (6 سنوات - ترمين)' },
  { key: 'إعدادي', label: 'المرحلة الإعدادية (3 سنوات - ترمين)' },
  { key: 'ثانوي عام', label: 'الثانوية العامة (3 سنوات)' },
  { key: 'ثانوي تجاري', label: 'الثانوي التجاري (3 سنوات)' },
  { key: 'ثانوي صنايع', label: 'الثانوي الصنايع / صناعي (3 سنوات)' },
  { key: 'جامعة', label: 'جامعة' },
  { key: 'لغات وكمبيوتر', label: 'لغات وكمبيوتر' },
  { key: 'أخرى', label: 'أخرى' }
];

const GRADES_BY_MAIN = {
  KG: ['KG1', 'KG2'],
  ابتدائي: ['أولى ابتدائي', 'ثانية ابتدائي', 'ثالثة ابتدائي', 'رابعة ابتدائي', 'خامسة ابتدائي', 'سادسة ابتدائي'],
  إعدادي: ['أولى إعدادي', 'ثانية إعدادي', 'ثالثة إعدادي'],
  'ثانوي عام': ['أولى ثانوي', 'ثانية ثانوي', 'ثالثة ثانوي'],
  'ثانوي تجاري': ['أولى ثانوي تجاري', 'ثانية ثانوي تجاري', 'ثالثة ثانوي تجاري'],
  'ثانوي صنايع': ['أولى ثانوي صنايع', 'ثانية ثانوي صنايع', 'ثالثة ثانوي صنايع']
};

const TRACKS_2ND_SEC = ['علمي علوم', 'علمي رياضة', 'علمي', 'أدبي', 'مشترك'];
const TRACKS_3RD_SEC = ['علمي علوم', 'علمي رياضة', 'أدبي', 'مشترك'];
const TRACKS_COMMERCE = ['عام', 'شعبة إدارة', 'شعبة تسويق وسوق مال', 'شعبة تأمينات', 'شعبة قانونية'];
const TRACKS_INDUSTRIAL = ['عام', 'كهرباء', 'ميكانيكا', 'إلكترونيات / كمبيوتر', 'تبريد وتكييف', 'سيارات', 'نجارة وزخرفة', 'ملابس جاهزة'];

const TWO_TERMS = ['ترم أول', 'ترم تاني'];
const TECH_3RD_TERMS = ['ترم واحد', 'ترم أول', 'ترم تاني'];
const DAYS_AR = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

function parseStageString(stageStr = 'أولى إعدادي - ترم أول') {
  const s = (stageStr || '').trim();
  if (!s) return { main: 'إعدادي', grade: 'أولى إعدادي', track: '', term: 'ترم أول' };

  if (s.includes('KG1') || s.includes('KG2') || s.includes('KG')) {
    const grade = s.includes('KG2') ? 'KG2' : 'KG1';
    const term = s.includes('ترم تاني') ? 'ترم تاني' : 'ترم أول';
    return { main: 'KG', grade, track: '', term };
  }

  for (const g of GRADES_BY_MAIN.ابتدائي) {
    if (s.includes(g)) {
      const term = s.includes('ترم تاني') ? 'ترم تاني' : 'ترم أول';
      return { main: 'ابتدائي', grade: g, track: '', term };
    }
  }
  if (s === 'ابتدائي') return { main: 'ابتدائي', grade: 'أولى ابتدائي', track: '', term: 'ترم أول' };

  for (const g of GRADES_BY_MAIN.إعدادي) {
    if (s.includes(g)) {
      const term = s.includes('ترم تاني') ? 'ترم تاني' : 'ترم أول';
      return { main: 'إعدادي', grade: g, track: '', term };
    }
  }
  if (s === 'إعدادي') return { main: 'إعدادي', grade: 'أولى إعدادي', track: '', term: 'ترم أول' };

  // الثانوي التجاري
  for (const g of GRADES_BY_MAIN['ثانوي تجاري']) {
    if (s.includes(g)) {
      const matchedTrack = TRACKS_COMMERCE.find(tr => tr !== 'عام' && s.includes(tr)) || 'عام';
      const term = s.includes('ترم واحد') ? 'ترم واحد' : s.includes('ترم تاني') ? 'ترم تاني' : 'ترم أول';
      return { main: 'ثانوي تجاري', grade: g, track: matchedTrack, term };
    }
  }
  if (s === 'ثانوي تجاري') return { main: 'ثانوي تجاري', grade: 'أولى ثانوي تجاري', track: 'عام', term: 'ترم أول' };

  // الثانوي الصنايع
  for (const g of GRADES_BY_MAIN['ثانوي صنايع']) {
    if (s.includes(g)) {
      const matchedTrack = TRACKS_INDUSTRIAL.find(tr => tr !== 'عام' && s.includes(tr)) || 'عام';
      const term = s.includes('ترم واحد') ? 'ترم واحد' : s.includes('ترم تاني') ? 'ترم تاني' : 'ترم أول';
      return { main: 'ثانوي صنايع', grade: g, track: matchedTrack, term };
    }
  }
  if (s === 'ثانوي صنايع') return { main: 'ثانوي صنايع', grade: 'أولى ثانوي صنايع', track: 'عام', term: 'ترم أول' };

  // الثانوي العام
  if (s.includes('ثالثة ثانوي')) {
    let track = 'علمي علوم';
    if (s.includes('علمي رياضة')) track = 'علمي رياضة';
    else if (s.includes('أدبي')) track = 'أدبي';
    else if (s.includes('مشترك')) track = 'مشترك';
    return { main: 'ثانوي عام', grade: 'ثالثة ثانوي', track, term: 'ترم واحد' };
  }

  if (s.includes('ثانية ثانوي')) {
    let track = 'علمي علوم';
    if (s.includes('علمي رياضة')) track = 'علمي رياضة';
    else if (s.includes('علمي علوم')) track = 'علمي علوم';
    else if (s.includes('أدبي')) track = 'أدبي';
    else if (s.includes('مشترك')) track = 'مشترك';
    else if (s.includes('علمي')) track = 'علمي';
    const term = s.includes('ترم تاني') ? 'ترم تاني' : 'ترم أول';
    return { main: 'ثانوي عام', grade: 'ثانية ثانوي', track, term };
  }

  if (s.includes('أولى ثانوي') || s === 'ثانوي' || s === 'ثانوي عام') {
    const term = s.includes('ترم تاني') ? 'ترم تاني' : 'ترم أول';
    return { main: 'ثانوي عام', grade: 'أولى ثانوي', track: '', term };
  }

  if (s === 'جامعة' || s === 'لغات وكمبيوتر' || s === 'أخرى') {
    return { main: s, grade: '', track: '', term: '' };
  }

  return { main: 'أخرى', grade: '', track: '', term: '' };
}

function formatStageString({ main, grade, track, term }) {
  if (main === 'جامعة' || main === 'لغات وكمبيوتر' || main === 'أخرى') return main;

  if (main === 'ثانوي عام') {
    if (grade === 'ثالثة ثانوي') {
      return `ثالثة ثانوي (${track || 'علمي علوم'}) - ترم واحد`;
    }
    if (grade === 'ثانية ثانوي') {
      return `ثانية ثانوي (${track || 'علمي علوم'}) - ${term || 'ترم أول'}`;
    }
    return `أولى ثانوي - ${term || 'ترم أول'}`;
  }

  if (main === 'ثانوي تجاري' || main === 'ثانوي صنايع') {
    const g = grade || GRADES_BY_MAIN[main][0];
    const tLabel = track && track !== 'عام' ? ` (${track})` : '';
    const defaultTerm = g.startsWith('ثالثة') ? 'ترم واحد' : 'ترم أول';
    return `${g}${tLabel} - ${term || defaultTerm}`;
  }

  const g = grade || (GRADES_BY_MAIN[main]?.[0] || main);
  return `${g} - ${term || 'ترم أول'}`;
}

function StageHierarchyPicker({ value, onChange, labelPrefix = '' }) {
  const parsed = parseStageString(value);

  const handleMainChange = (newMain) => {
    if (newMain === 'جامعة' || newMain === 'لغات وكمبيوتر' || newMain === 'أخرى') {
      onChange(newMain);
      return;
    }
    const defaultGrade = GRADES_BY_MAIN[newMain]?.[0] || '';
    const defaultTrack = (newMain === 'ثانوي تجاري' || newMain === 'ثانوي صنايع') ? 'عام' : '';
    onChange(formatStageString({ main: newMain, grade: defaultGrade, track: defaultTrack, term: 'ترم أول' }));
  };

  const handleGradeChange = (newGrade) => {
    if (parsed.main === 'ثانوي عام') {
      if (newGrade === 'ثالثة ثانوي') {
        onChange(formatStageString({ main: 'ثانوي عام', grade: 'ثالثة ثانوي', track: 'علمي علوم', term: 'ترم واحد' }));
      } else if (newGrade === 'ثانية ثانوي') {
        onChange(formatStageString({ main: 'ثانوي عام', grade: 'ثانية ثانوي', track: 'علمي علوم', term: parsed.term === 'ترم تاني' ? 'ترم تاني' : 'ترم أول' }));
      } else {
        onChange(formatStageString({ main: 'ثانوي عام', grade: 'أولى ثانوي', track: '', term: parsed.term === 'ترم تاني' ? 'ترم تاني' : 'ترم أول' }));
      }
      return;
    }

    if (parsed.main === 'ثانوي تجاري' || parsed.main === 'ثانوي صنايع') {
      const nextTerm = newGrade.startsWith('ثالثة') ? 'ترم واحد' : (parsed.term === 'ترم تاني' ? 'ترم تاني' : 'ترم أول');
      onChange(formatStageString({ ...parsed, grade: newGrade, term: nextTerm }));
      return;
    }

    onChange(formatStageString({ ...parsed, grade: newGrade, term: parsed.term === 'ترم تاني' ? 'ترم تاني' : 'ترم أول' }));
  };

  const handleTrackChange = (newTrack) => {
    onChange(formatStageString({ ...parsed, track: newTrack }));
  };

  const handleTermChange = (newTerm) => {
    onChange(formatStageString({ ...parsed, term: newTerm }));
  };

  const gradeOptions = GRADES_BY_MAIN[parsed.main] || [];
  const isSecWithTrack = parsed.main === 'ثانوي عام' && (parsed.grade === 'ثانية ثانوي' || parsed.grade === 'ثالثة ثانوي');
  const isTechStage = parsed.main === 'ثانوي تجاري' || parsed.main === 'ثانوي صنايع';
  const showTrack = isSecWithTrack || isTechStage;

  const trackOptions =
    parsed.main === 'ثانوي تجاري' ? TRACKS_COMMERCE :
    parsed.main === 'ثانوي صنايع' ? TRACKS_INDUSTRIAL :
    parsed.grade === 'ثالثة ثانوي' ? TRACKS_3RD_SEC : TRACKS_2ND_SEC;

  const isSingleTermSec = parsed.main === 'ثانوي عام' && parsed.grade === 'ثالثة ثانوي';
  const isTech3rdYear = isTechStage && parsed.grade.startsWith('ثالثة');
  const showTerm = gradeOptions.length > 0;

  return (
    <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-200 space-y-2">
      <div className="flex flex-wrap justify-between items-center gap-1">
        <span className="text-[11px] font-black text-blue-950">{labelPrefix || '🎓 تحديد المرحلة والصف والترم والشعبة:'}</span>
        <span className="px-2.5 py-0.5 bg-white border border-blue-200 rounded-lg text-[11px] font-black text-[#7a1c24]">
          {value}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <div>
          <label className="block text-[10px] text-gray-600 mb-0.5">المرحلة الرئيسية</label>
          <select className="w-full p-2 border rounded-xl bg-white text-xs font-bold" value={parsed.main} onChange={e => handleMainChange(e.target.value)}>
            {MAIN_STAGES.map(ms => <option key={ms.key} value={ms.key}>{ms.label}</option>)}
          </select>
        </div>

        {gradeOptions.length > 0 && (
          <div>
            <label className="block text-[10px] text-gray-600 mb-0.5">الصف الدراسي</label>
            <select className="w-full p-2 border rounded-xl bg-white text-xs font-bold" value={parsed.grade} onChange={e => handleGradeChange(e.target.value)}>
              {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        )}

        {showTrack && (
          <div>
            <label className="block text-[10px] text-gray-600 mb-0.5">
              {isTechStage ? 'التخصص / الشعبة' : 'الشعبة (علمي علوم / رياضة / أدبي)'}
            </label>
            <select className="w-full p-2 border rounded-xl bg-amber-50 text-xs font-bold" value={parsed.track} onChange={e => handleTrackChange(e.target.value)}>
              {trackOptions.map(tr => <option key={tr} value={tr}>{tr}</option>)}
            </select>
          </div>
        )}

        {showTerm && (
          <div>
            <label className="block text-[10px] text-gray-600 mb-0.5">الترم</label>
            {isSingleTermSec ? (
              <div className="w-full p-2 border rounded-xl bg-purple-100 text-purple-950 text-xs font-black text-center">
                ترم واحد (سنة كاملة)
              </div>
            ) : (
              <select className="w-full p-2 border rounded-xl bg-white text-xs font-bold" value={parsed.term} onChange={e => handleTermChange(e.target.value)}>
                {(isTech3rdYear ? TECH_3RD_TERMS : TWO_TERMS).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function EducationalCenterManager({ currentUser, todayISO }) {
  const p = currentUser?.permissions || {};
  const isPriestOrAdmin = Boolean(currentUser && (currentUser.role === 'admin' || currentUser.role === 'priest'));
  const isFullEduManager = Boolean(
    currentUser && (isPriestOrAdmin || currentUser.role === 'edu_manager' || Boolean(p.manage_edu_center))
  );
  const isEduTeacher = Boolean(currentUser && p.is_edu_teacher);

  const canEditEdu = Boolean(
    isPriestOrAdmin ||
    p.edu_edit === true ||
    (p.edu_edit === undefined && (isFullEduManager || isEduTeacher))
  );

  const canViewSchedule = p.edu_view_schedule !== false;
  const canViewStudentAtt = Boolean(
    isPriestOrAdmin ||
    p.edu_view_students_attendance === true ||
    (p.edu_view_students_attendance === undefined && (isFullEduManager || isEduTeacher))
  );
  const canViewPrices = Boolean(
    isPriestOrAdmin ||
    !currentUser ||
    p.edu_view_prices === true ||
    (p.edu_view_prices === undefined && isFullEduManager)
  );
  const canViewTeacherAtt = Boolean(
    isPriestOrAdmin ||
    p.edu_view_teachers_attendance === true ||
    (p.edu_view_teachers_attendance === undefined && isFullEduManager)
  );
  const canViewRevenue = Boolean(
    isPriestOrAdmin ||
    p.edu_view_revenue === true
  );
  const canViewBookings = Boolean(
    isPriestOrAdmin ||
    canEditEdu ||
    p.edu_view_bookings === true
  );

  const canManageEdu = Boolean(canEditEdu || canViewStudentAtt || canViewTeacherAtt || canViewRevenue);

  const defaultTab = canViewSchedule ? 'schedule' : canViewStudentAtt ? 'student_att' : canViewTeacherAtt ? 'teacher_att' : 'schedule';
  const [tab, setTab] = useState(defaultTab);
  const [subjects, setSubjects] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [studentAtt, setStudentAtt] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [teacherAtt, setTeacherAtt] = useState([]);
  const [teacherPayouts, setTeacherPayouts] = useState([]);

  const [mainStageFilter, setMainStageFilter] = useState('الكل');
  const [subStageFilter, setSubStageFilter] = useState('الكل');

  const emptySubject = { subject_name: '', stage_name: 'أولى إعدادي - ترم أول', default_price: 50, teacher_name: '' };
  const [subForm, setSubForm] = useState(emptySubject);
  const [editingSubId, setEditingSubId] = useState(null);

  const emptyLesson = {
    subject_id: '', subject_name: '', stage_name: 'أولى إعدادي - ترم أول',
    day_of_week: 'السبت', start_time: '16:00', end_time: '18:00',
    room_name: 'قاعة 1', teacher_name: '', lesson_price: 50
  };
  const [lessonForm, setLessonForm] = useState(emptyLesson);
  const [editingLessonId, setEditingLessonId] = useState(null);

  const [bookModalLesson, setBookModalLesson] = useState(null);
  const [bookForm, setBookForm] = useState({
    student_name: currentUser?.full_name || '',
    student_phone: currentUser?.phone || '',
    stage_name: currentUser?.detailed_stage || '',
    notes: ''
  });
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState('');

  const nowTime = new Date().toTimeString().slice(0, 5);
  const [stuAttForm, setStuAttForm] = useState({
    lesson_id: '', lesson_date: todayISO, student_name: '', student_phone: '',
    status: 'حاضر', arrival_time: nowTime, departure_time: '', paid_amount: 0, notes: ''
  });

  const [tAttForm, setTAttForm] = useState({
    teacher_id: '', teacher_name: '', lesson_id: '', lesson_date: todayISO,
    scheduled_time: '16:00', actual_arrival_time: nowTime, departure_time: '',
    status: 'في الموعد', late_minutes: 0, bonus_amount: 0, deduction_amount: 0, notes: ''
  });

  const [teacherForm, setTeacherForm] = useState({
    id: null, teacher_name: '', phone: '', subject_name: '',
    pay_cycle: 'شهري', pay_mode: 'نسبة %', pay_rate: 50, notes: ''
  });
  const [payoutModalTeacher, setPayoutModalTeacher] = useState(null);
  const [payoutForm, setPayoutForm] = useState({ payout_date: todayISO, amount: '', notes: '' });

  const loadEduData = async () => {
    const [sb, ls] = await Promise.all([
      supabase.from('edu_subjects').select('*').order('stage_name', { ascending: true }),
      supabase.from('edu_lessons').select('*').order('created_at', { ascending: false })
    ]);
    if (sb.data) setSubjects(sb.data);
    if (ls.data) setLessons(ls.data);

    if (canViewBookings) {
      const bk = await supabase.from('edu_bookings').select('*').order('created_at', { ascending: false }).limit(250);
      if (bk.data) setBookings(bk.data);
    }

    if (canViewStudentAtt || canViewRevenue) {
      const sa = await supabase.from('edu_student_attendance').select('*').order('lesson_date', { ascending: false }).order('created_at', { ascending: false }).limit(300);
      if (sa.data) setStudentAtt(sa.data);
    }

    if (canViewTeacherAtt || canViewRevenue) {
      const [tc, ta] = await Promise.all([
        supabase.from('edu_teachers').select('*').order('teacher_name', { ascending: true }),
        supabase.from('edu_teacher_attendance').select('*').order('lesson_date', { ascending: false }).order('created_at', { ascending: false }).limit(250)
      ]);
      if (tc.data) setTeachers(tc.data);
      if (ta.data) setTeacherAtt(ta.data);
    }

    if (canViewRevenue) {
      const po = await supabase.from('edu_teacher_payouts').select('*').order('payout_date', { ascending: false });
      if (po.data) setTeacherPayouts(po.data);
    }
  };

  useEffect(() => {
    loadEduData();
  }, [currentUser?.id, canViewBookings, canViewStudentAtt, canViewTeacherAtt, canViewRevenue]);

  const handleSaveSubject = async (e) => {
    e.preventDefault();
    if (!canEditEdu) return alert('🔒 وضع مشاهدة فقط — لا تملك صلاحية الإضافة أو التعديل.');
    const payload = {
      subject_name: subForm.subject_name.trim(),
      stage_name: subForm.stage_name,
      teacher_name: subForm.teacher_name.trim(),
      default_price: Number(subForm.default_price || 0)
    };

    if (editingSubId) {
      const { data, error } = await supabase.from('edu_subjects').update(payload).eq('id', editingSubId).select().single();
      if (error) return alert(error.message);
      if (data) {
        setSubjects(subjects.map(s => (s.id === editingSubId ? data : s)));
        setEditingSubId(null);
        setSubForm(emptySubject);
      }
    } else {
      const { data, error } = await supabase
        .from('edu_subjects')
        .insert([{ ...payload, created_by: currentUser?.id }])
        .select().single();
      if (error) return alert(error.message);
      if (data) {
        setSubjects([...subjects, data]);
        setSubForm(emptySubject);
        logActivity({ user: currentUser, actionType: 'إضافة_مادة_تعليمية', targetTable: 'edu_subjects', targetId: data.id, description: `أضاف مادة (${data.subject_name} - ${data.stage_name})` });
      }
    }
  };

  const handleSaveLesson = async (e) => {
    e.preventDefault();
    if (!canEditEdu) return alert('🔒 وضع مشاهدة فقط — لا تملك صلاحية الإضافة أو التعديل.');
    const payload = {
      ...lessonForm,
      subject_id: lessonForm.subject_id || null,
      lesson_price: Number(lessonForm.lesson_price || 0),
      created_by: currentUser?.id
    };
    if (editingLessonId) {
      const { id, created_at, created_by, ...clean } = payload;
      const { data, error } = await supabase.from('edu_lessons').update(clean).eq('id', editingLessonId).select().single();
      if (error) return alert(error.message);
      setLessons(lessons.map(l => (l.id === editingLessonId ? data : l)));
      setEditingLessonId(null);
      setLessonForm(emptyLesson);
    } else {
      const { data, error } = await supabase.from('edu_lessons').insert([payload]).select().single();
      if (error) return alert(error.message);
      setLessons([data, ...lessons]);
      setLessonForm(emptyLesson);
      logActivity({ user: currentUser, actionType: 'إضافة_درس_مركز_تعليمي', targetTable: 'edu_lessons', targetId: data.id, description: `أضاف درس (${data.subject_name} - ${data.stage_name})` });
    }
  };

  const handleBookLessonSeat = async (e) => {
    e.preventDefault();
    if (!bookModalLesson) return;
    const { error } = await supabase.from('edu_bookings').insert([{
      lesson_id: bookModalLesson.id,
      student_name: bookForm.student_name.trim(),
      student_phone: bookForm.student_phone.trim(),
      stage_name: bookForm.stage_name || bookModalLesson.stage_name,
      notes: bookForm.notes.trim(),
      user_id: currentUser?.id || null,
      status: 'محجوز'
    }]);
    if (error) return alert('تعذر إتمام الحجز: ' + error.message);
    setBookingSuccessMsg(`✅ تم حجز مكانك بنجاح في درس (${bookModalLesson.subject_name} - ${bookModalLesson.day_of_week} الساعة ${bookModalLesson.start_time})`);
    setBookModalLesson(null);
    if (canManageEdu) loadEduData();
  };

  const handleSaveStudentAttendance = async (e) => {
    e.preventDefault();
    if (!canEditEdu) return alert('🔒 وضع مشاهدة فقط — لا تملك صلاحية التسجيل أو التعديل.');
    const { data, error } = await supabase.from('edu_student_attendance').insert([{
      ...stuAttForm,
      lesson_id: stuAttForm.lesson_id || null,
      paid_amount: Number(stuAttForm.paid_amount || 0),
      recorded_by: currentUser?.id
    }]).select().single();
    if (error) return alert(error.message);
    setStudentAtt([data, ...studentAtt]);
    setStuAttForm(prev => ({ ...prev, student_name: '', student_phone: '', notes: '' }));
  };

  const markStudentDeparture = async (row) => {
    if (!canEditEdu) return;
    const depTime = new Date().toTimeString().slice(0, 5);
    const { data } = await supabase
      .from('edu_student_attendance')
      .update({ status: 'انصراف', departure_time: depTime })
      .eq('id', row.id)
      .select().single();
    if (data) setStudentAtt(studentAtt.map(r => (r.id === row.id ? data : r)));
  };

  const handleSaveTeacherAttendance = async (e) => {
    e.preventDefault();
    if (!canEditEdu) return alert('🔒 وضع مشاهدة فقط — لا تملك صلاحية التسجيل أو التعديل.');
    const { data, error } = await supabase.from('edu_teacher_attendance').insert([{
      ...tAttForm,
      teacher_id: tAttForm.teacher_id || null,
      lesson_id: tAttForm.lesson_id || null,
      late_minutes: Number(tAttForm.late_minutes || 0),
      bonus_amount: Number(tAttForm.bonus_amount || 0),
      deduction_amount: Number(tAttForm.deduction_amount || 0),
      recorded_by: currentUser?.id
    }]).select().single();
    if (error) return alert(error.message);
    setTeacherAtt([data, ...teacherAtt]);
    setTAttForm(prev => ({ ...prev, late_minutes: 0, bonus_amount: 0, deduction_amount: 0, notes: '' }));
  };

  const markTeacherDeparture = async (row) => {
    if (!canEditEdu) return;
    const depTime = new Date().toTimeString().slice(0, 5);
    const { data } = await supabase
      .from('edu_teacher_attendance')
      .update({ departure_time: depTime })
      .eq('id', row.id)
      .select().single();
    if (data) setTeacherAtt(teacherAtt.map(r => (r.id === row.id ? data : r)));
  };

  const handleSaveTeacher = async (e) => {
    e.preventDefault();
    if (!canViewRevenue || !canEditEdu) return;
    const payload = {
      teacher_name: teacherForm.teacher_name.trim(),
      phone: teacherForm.phone.trim(),
      subject_name: teacherForm.subject_name.trim(),
      pay_cycle: teacherForm.pay_cycle,
      pay_mode: teacherForm.pay_mode,
      pay_rate: Number(teacherForm.pay_rate || 0),
      notes: teacherForm.notes
    };
    if (teacherForm.id) {
      const { data, error } = await supabase.from('edu_teachers').update(payload).eq('id', teacherForm.id).select().single();
      if (error) return alert(error.message);
      setTeachers(teachers.map(t => (t.id === teacherForm.id ? data : t)));
    } else {
      const { data, error } = await supabase.from('edu_teachers').insert([payload]).select().single();
      if (error) return alert(error.message);
      setTeachers([...teachers, data]);
    }
    setTeacherForm({ id: null, teacher_name: '', phone: '', subject_name: '', pay_cycle: 'شهري', pay_mode: 'نسبة %', pay_rate: 50, notes: '' });
  };

  const handleSavePayout = async (e) => {
    e.preventDefault();
    if (!canViewRevenue || !canEditEdu || !payoutModalTeacher) return;
    const { data, error } = await supabase.from('edu_teacher_payouts').insert([{
      teacher_id: payoutModalTeacher.id,
      payout_date: payoutForm.payout_date || todayISO,
      amount: Number(payoutForm.amount || 0),
      notes: payoutForm.notes,
      paid_by: currentUser?.id
    }]).select().single();
    if (error) return alert(error.message);
    setTeacherPayouts([data, ...teacherPayouts]);
    setPayoutModalTeacher(null);
    setPayoutForm({ payout_date: todayISO, amount: '', notes: '' });
  };

  const matchesStageFilters = (stageName = '') => {
    if (mainStageFilter !== 'الكل') {
      if (mainStageFilter === 'ثانوي عام') {
        if (!stageName.includes('ثانوي') || stageName.includes('تجاري') || stageName.includes('صنايع')) return false;
      } else {
        if (!stageName.includes(mainStageFilter)) return false;
      }
    }
    if (subStageFilter !== 'الكل' && !stageName.includes(subStageFilter)) return false;
    return true;
  };

  const filteredLessons = lessons.filter(l => matchesStageFilters(l.stage_name));
  const filteredSubjects = subjects.filter(s => matchesStageFilters(s.stage_name));

  const subFilterOptions =
    mainStageFilter === 'KG' ? ['KG1', 'KG2'] :
    mainStageFilter === 'ابتدائي' ? GRADES_BY_MAIN.ابتدائي :
    mainStageFilter === 'إعدادي' ? GRADES_BY_MAIN.إعدادي :
    mainStageFilter === 'ثانوي عام' ? ['أولى ثانوي', 'ثانية ثانوي', 'ثالثة ثانوي', 'علمي علوم', 'علمي رياضة', 'أدبي'] :
    mainStageFilter === 'ثانوي تجاري' ? GRADES_BY_MAIN['ثانوي تجاري'] :
    mainStageFilter === 'ثانوي صنايع' ? GRADES_BY_MAIN['ثانوي صنايع'] :
    [];

  const renderStageFilters = () => (
    <div className="bg-white p-3 rounded-2xl border space-y-2 print:hidden">
      <div className="flex flex-wrap gap-1.5">
        {['الكل', 'KG', 'ابتدائي', 'إعدادي', 'ثانوي عام', 'ثانوي تجاري', 'ثانوي صنايع', 'جامعة', 'لغات وكمبيوتر', 'أخرى'].map(st => (
          <button
            key={st}
            type="button"
            onClick={() => { setMainStageFilter(st); setSubStageFilter('الكل'); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${mainStageFilter === st ? 'bg-[#7a1c24] text-white border-[#7a1c24]' : 'bg-gray-50 hover:bg-gray-100'}`}
          >
            {st}
          </button>
        ))}
      </div>
      {subFilterOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t">
          <button
            type="button"
            onClick={() => setSubStageFilter('الكل')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${subStageFilter === 'الكل' ? 'bg-amber-500 text-white border-amber-600' : 'bg-amber-50 text-amber-950'}`}
          >
            كل {mainStageFilter}
          </button>
          {subFilterOptions.map(sf => (
            <button
              key={sf}
              type="button"
              onClick={() => setSubStageFilter(sf)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${subStageFilter === sf ? 'bg-amber-500 text-white border-amber-600' : 'bg-amber-50 text-amber-950 hover:bg-amber-100'}`}
            >
              {sf}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const computeTeacherFinance = (t) => {
    const tLessons = lessons.filter(l => (l.teacher_name || '').trim() === (t.teacher_name || '').trim());
    const tLessonIds = tLessons.map(l => l.id);
    const tStudentFees = studentAtt
      .filter(s => s.status !== 'غائب' && tLessonIds.includes(s.lesson_id))
      .reduce((sum, s) => sum + Number(s.paid_amount || 0), 0);

    const tAttRows = teacherAtt.filter(a => a.teacher_id === t.id || (a.teacher_name || '').trim() === (t.teacher_name || '').trim());
    const presentSessions = tAttRows.filter(a => a.status !== 'غائب').length;
    const absentSessions = tAttRows.filter(a => a.status === 'غائب').length;
    const lateCount = tAttRows.filter(a => a.status === 'متأخر').length;
    const totalBonus = tAttRows.reduce((sum, a) => sum + Number(a.bonus_amount || 0), 0);
    const totalDeduction = tAttRows.reduce((sum, a) => sum + Number(a.deduction_amount || 0), 0);

    const baseEarned =
      t.pay_mode === 'نسبة %'
        ? Math.round((tStudentFees * Number(t.pay_rate || 0)) / 100)
        : presentSessions * Number(t.pay_rate || 0);

    const totalDue = Math.max(0, baseEarned + totalBonus - totalDeduction);
    const totalPaid = teacherPayouts.filter(p => p.teacher_id === t.id).reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const remaining = Math.max(0, totalDue - totalPaid);

    return { tStudentFees, presentSessions, absentSessions, lateCount, totalBonus, totalDeduction, baseEarned, totalDue, totalPaid, remaining };
  };

  const totalCollectedStudents = studentAtt.reduce((s, r) => s + Number(r.paid_amount || 0), 0);

  return (
    <div className="space-y-4 text-sm md:text-base" dir="rtl">
      <div className="bg-white p-4 rounded-3xl border shadow-2xs flex flex-wrap justify-between items-center gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <span className="p-2.5 bg-indigo-100 text-indigo-900 rounded-2xl"><GraduationCap size={22} /></span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base md:text-lg font-black text-[#7a1c24]">المركز التعليمي الكنسي</h3>
              {currentUser && !canEditEdu && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full text-[10px] font-black flex items-center gap-1">
                  <Lock size={10} /> مشاهدة فقط
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600">
              الدروس المتاحة: <strong>{lessons.length}</strong> • المواد: <strong>{subjects.length}</strong>
              {canViewBookings && <> • الحجوزات: <strong>{bookings.length}</strong></>}
              {canViewRevenue && <> • إجمالي الإيراد المحصل: <strong className="text-emerald-700">{totalCollectedStudents} ج.م</strong></>}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {canViewSchedule && (
            <button type="button" onClick={() => setTab('schedule')} className={`px-3 py-2 rounded-xl text-xs font-black cursor-pointer ${tab === 'schedule' ? 'bg-[#7a1c24] text-white' : 'bg-gray-100'}`}>📅 جدول الدروس</button>
          )}
          {(canViewSchedule || canViewPrices || canEditEdu) && (
            <button type="button" onClick={() => setTab('subjects')} className={`px-3 py-2 rounded-xl text-xs font-black cursor-pointer ${tab === 'subjects' ? 'bg-[#7a1c24] text-white' : 'bg-gray-100'}`}>
              {canViewPrices ? '📚 المواد والأسعار' : '📚 المواد'}
            </button>
          )}
          {canViewBookings && (
            <button type="button" onClick={() => setTab('bookings')} className={`px-3 py-2 rounded-xl text-xs font-black cursor-pointer ${tab === 'bookings' ? 'bg-[#7a1c24] text-white' : 'bg-gray-100'}`}>📌 الحجوزات ({bookings.length})</button>
          )}
          {canViewStudentAtt && (
            <button type="button" onClick={() => setTab('student_att')} className={`px-3 py-2 rounded-xl text-xs font-black cursor-pointer ${tab === 'student_att' ? 'bg-[#7a1c24] text-white' : 'bg-gray-100'}`}>👥 حضور وانصراف الطلاب</button>
          )}
          {canViewTeacherAtt && (
            <button type="button" onClick={() => setTab('teacher_att')} className={`px-3 py-2 rounded-xl text-xs font-black cursor-pointer ${tab === 'teacher_att' ? 'bg-[#7a1c24] text-white' : 'bg-gray-100'}`}>👨‍🏫 حضور وانصراف المدرسين</button>
          )}
          {canViewRevenue && (
            <button type="button" onClick={() => setTab('revenue_sheet')} className={`px-3 py-2 rounded-xl text-xs font-black cursor-pointer ${tab === 'revenue_sheet' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-900 border border-emerald-200'}`}>
              💰 إيراد ومحاسبة المدرسين
            </button>
          )}
        </div>
      </div>

      {bookingSuccessMsg && (
        <div className="bg-emerald-50 border-2 border-emerald-400 text-emerald-950 p-4 rounded-2xl text-xs md:text-sm font-black flex justify-between items-center gap-2">
          <span>{bookingSuccessMsg}</span>
          <button type="button" onClick={() => setBookingSuccessMsg('')} className="p-1"><X size={16} /></button>
        </div>
      )}

      {/* 1. جدول الدروس المتاحة */}
      {tab === 'schedule' && canViewSchedule && (
        <div className="space-y-4">
          {canEditEdu && (
            <form onSubmit={handleSaveLesson} className="bg-white p-5 rounded-3xl border space-y-3 font-bold print:hidden">
              <h4 className="font-black text-[#7a1c24] flex items-center gap-1.5"><Plus size={17} /> {editingLessonId ? 'تعديل موعد درس' : 'إضافة درس في جدول المركز التعليمي'}</h4>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                <select
                  className="p-2.5 border rounded-xl bg-blue-50 w-full min-w-0"
                  value={lessonForm.subject_id}
                  onChange={e => {
                    const sub = subjects.find(x => x.id === e.target.value);
                    if (!sub) return setLessonForm({ ...lessonForm, subject_id: '' });
                    setLessonForm({
                      ...lessonForm, subject_id: sub.id, subject_name: sub.subject_name,
                      stage_name: sub.stage_name, teacher_name: sub.teacher_name || lessonForm.teacher_name,
                      lesson_price: sub.default_price ?? lessonForm.lesson_price
                    });
                  }}
                >
                  <option value="">-- اختر من المواد المسجلة --</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name} ({s.stage_name}){canViewPrices ? ` - ${s.default_price}ج` : ''}</option>)}
                </select>
                <input required placeholder="اسم المادة *" className="p-2.5 border rounded-xl w-full min-w-0" value={lessonForm.subject_name} onChange={e => setLessonForm({ ...lessonForm, subject_name: e.target.value })} />
                <select className="p-2.5 border rounded-xl bg-white w-full min-w-0" value={lessonForm.day_of_week} onChange={e => setLessonForm({ ...lessonForm, day_of_week: e.target.value })}>
                  {DAYS_AR.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <StageHierarchyPicker
                labelPrefix="🎓 المرحلة والصف والترم والشعبة للدرس:"
                value={lessonForm.stage_name}
                onChange={newStage => setLessonForm({ ...lessonForm, stage_name: newStage })}
              />

              <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-2.5">
                <input required type="time" className="p-2.5 border rounded-xl w-full min-w-0" value={lessonForm.start_time} onChange={e => setLessonForm({ ...lessonForm, start_time: e.target.value })} />
                <input type="time" className="p-2.5 border rounded-xl w-full min-w-0" value={lessonForm.end_time} onChange={e => setLessonForm({ ...lessonForm, end_time: e.target.value })} />
                <input placeholder="القاعة / الفصل" className="p-2.5 border rounded-xl w-full min-w-0" value={lessonForm.room_name} onChange={e => setLessonForm({ ...lessonForm, room_name: e.target.value })} />
                <input placeholder="اسم المدرس" className="p-2.5 border rounded-xl w-full min-w-0" value={lessonForm.teacher_name} onChange={e => setLessonForm({ ...lessonForm, teacher_name: e.target.value })} />
                {canViewPrices && (
                  <input type="number" min="0" placeholder="سعر الدرس (ج.م)" className="p-2.5 border rounded-xl w-full min-w-0" value={lessonForm.lesson_price} onChange={e => setLessonForm({ ...lessonForm, lesson_price: e.target.value })} />
                )}
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-6 py-2.5 bg-[#7a1c24] text-white rounded-xl cursor-pointer">{editingLessonId ? 'حفظ التعديل' : '+ إضافة للجدول'}</button>
                {editingLessonId && <button type="button" onClick={() => { setEditingLessonId(null); setLessonForm(emptyLesson); }} className="px-4 py-2 border rounded-xl">إلغاء</button>}
              </div>
            </form>
          )}

          {renderStageFilters()}

          {filteredLessons.length === 0 ? (
            <div className="bg-white p-8 rounded-3xl border text-center text-gray-500">لا توجد دروس معلنة لهذه المرحلة حالياً.</div>
          ) : (
            <div className="grid gap-3">
              {filteredLessons.map(l => {
                const priceNum = Number(l.lesson_price || 0);
                return (
                  <div key={l.id} className="bg-white p-4 rounded-2xl border flex flex-wrap justify-between items-center gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 bg-amber-100 text-amber-950 rounded text-xs font-black">{l.day_of_week}</span>
                        <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-900 rounded text-xs font-bold">{l.stage_name}</span>
                        <strong className="text-base">{l.subject_name}</strong>
                        {canViewPrices && (
                          <span className={`px-2.5 py-0.5 rounded text-xs font-black ${priceNum === 0 ? 'bg-green-100 text-green-800' : 'bg-emerald-100 text-emerald-900'}`}>
                            {priceNum === 0 ? '🎁 مجاني' : `💰 ${priceNum} ج.م`}
                          </span>
                        )}
                      </div>
                      <p className="text-xs md:text-sm text-gray-600">⏰ {l.start_time} {l.end_time && `- ${l.end_time}`} • 🏫 {l.room_name || '—'} • 👨‍🏫 {l.teacher_name || '—'}</p>
                    </div>

                    <div className="flex flex-wrap gap-1.5 print:hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setBookForm({ student_name: currentUser?.full_name || '', student_phone: currentUser?.phone || '', stage_name: l.stage_name, notes: '' });
                          setBookModalLesson(l);
                        }}
                        className="px-3.5 py-2 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
                      >
                        <BookmarkCheck size={14} /> احجز مكانك في الدرس
                      </button>

                      {canEditEdu && (
                        <>
                          {canViewStudentAtt && (
                            <button
                              type="button"
                              onClick={() => {
                                setStuAttForm(prev => ({ ...prev, lesson_id: l.id, paid_amount: priceNum }));
                                setTab('student_att');
                              }}
                              className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                            >
                              + حضور الطلاب
                            </button>
                          )}
                          <button type="button" onClick={() => { setEditingLessonId(l.id); setLessonForm({ ...l }); }} className="p-2 bg-gray-100 rounded-xl cursor-pointer"><Edit3 size={15} /></button>
                          <button type="button" onClick={async () => { if (!confirm('حذف الدرس؟')) return; await supabase.from('edu_lessons').delete().eq('id', l.id); setLessons(lessons.filter(x => x.id !== l.id)); }} className="p-2 bg-red-50 text-red-700 rounded-xl cursor-pointer"><Trash2 size={15} /></button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. المواد والأسعار */}
      {tab === 'subjects' && (
        <div className="space-y-4">
          {canEditEdu && (
            <form onSubmit={handleSaveSubject} className="bg-white p-5 rounded-3xl border space-y-3 font-bold">
              <h4 className="font-black text-[#7a1c24] flex items-center gap-1.5">
                <BookOpen size={17} /> {editingSubId ? 'تعديل مادة دراسية' : 'إضافة مادة دراسية جديدة للمركز'}
              </h4>

              <StageHierarchyPicker
                labelPrefix="🎓 اختر المرحلة (ابتدائي 6 سنوات ترمين / إعدادي 3 سنوات ترمين / ثانوي عام + تجاري + صنايع):"
                value={subForm.stage_name}
                onChange={newStage => setSubForm({ ...subForm, stage_name: newStage })}
              />

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5 items-center">
                <input required placeholder="اسم المادة *" className="w-full min-w-0 p-2.5 border rounded-xl" value={subForm.subject_name} onChange={e => setSubForm({ ...subForm, subject_name: e.target.value })} />
                <input placeholder="اسم المدرس" className="w-full min-w-0 p-2.5 border rounded-xl" value={subForm.teacher_name} onChange={e => setSubForm({ ...subForm, teacher_name: e.target.value })} />
                {canViewPrices && (
                  <input type="number" min="0" placeholder="سعر الدرس (ج.م)" className="w-full min-w-0 p-2.5 border rounded-xl" value={subForm.default_price} onChange={e => setSubForm({ ...subForm, default_price: e.target.value })} />
                )}
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 px-4 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl cursor-pointer">
                    {editingSubId ? 'حفظ التعديل ✅' : '+ إضافة المادة'}
                  </button>
                  {editingSubId && (
                    <button type="button" onClick={() => { setEditingSubId(null); setSubForm(emptySubject); }} className="px-3 py-2.5 border rounded-xl cursor-pointer shrink-0">
                      إلغاء
                    </button>
                  )}
                </div>
              </div>
            </form>
          )}

          {renderStageFilters()}

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {filteredSubjects.map(s => (
              <div key={s.id} className="bg-white p-4 rounded-2xl border flex justify-between items-center gap-2">
                <div>
                  <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-900 rounded text-xs font-bold inline-block">{s.stage_name}</span>
                  <strong className="block text-base mt-1">{s.subject_name}</strong>
                  <span className="text-xs text-gray-600">
                    👨‍🏫 {s.teacher_name || '—'}
                    {canViewPrices && ` • 💰 ${Number(s.default_price || 0) === 0 ? 'مجاني' : `${s.default_price} ج.م`}`}
                  </span>
                </div>
                {canEditEdu && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSubId(s.id);
                        setSubForm({
                          subject_name: s.subject_name || '',
                          stage_name: s.stage_name || 'أولى إعدادي - ترم أول',
                          default_price: s.default_price ?? 50,
                          teacher_name: s.teacher_name || ''
                        });
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="p-2 bg-gray-100 hover:bg-amber-100 rounded-xl cursor-pointer"
                      title="تعديل المادة"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm('حذف هذه المادة؟')) return;
                        await supabase.from('edu_subjects').delete().eq('id', s.id);
                        setSubjects(subjects.filter(x => x.id !== s.id));
                      }}
                      className="p-2 bg-red-50 text-red-700 rounded-xl cursor-pointer"
                      title="حذف المادة"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. حجوزات الطلاب */}
      {tab === 'bookings' && canViewBookings && (
        <div className="bg-white p-4 rounded-3xl border overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs md:text-sm">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="p-2.5">الاسم</th>
                <th className="p-2.5">التليفون</th>
                <th className="p-2.5">الدرس / المرحلة</th>
                <th className="p-2.5">ملاحظات</th>
                {canEditEdu && <th className="p-2.5">تسجيل حضور</th>}
              </tr>
            </thead>
            <tbody>
              {bookings.map(bk => {
                const lsn = lessons.find(x => x.id === bk.lesson_id);
                return (
                  <tr key={bk.id} className="border-b">
                    <td className="p-2.5 font-bold">{bk.student_name}</td>
                    <td className="p-2.5">{bk.student_phone}</td>
                    <td className="p-2.5">{lsn ? `${lsn.subject_name} (${lsn.stage_name} - ${lsn.day_of_week} ${lsn.start_time})` : bk.stage_name}</td>
                    <td className="p-2.5 text-xs text-gray-600">{bk.notes || '—'}</td>
                    {canEditEdu && (
                      <td className="p-2.5 flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setStuAttForm(prev => ({
                              ...prev,
                              lesson_id: bk.lesson_id || '',
                              student_name: bk.student_name,
                              student_phone: bk.student_phone,
                              paid_amount: Number(lsn?.lesson_price || 0)
                            }));
                            setTab('student_att');
                          }}
                          className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                        >
                          تحضير الطالب
                        </button>
                        <button type="button" onClick={async () => { await supabase.from('edu_bookings').delete().eq('id', bk.id); setBookings(bookings.filter(x => x.id !== bk.id)); }} className="p-1.5 bg-red-50 text-red-700 rounded-lg cursor-pointer"><Trash2 size={14} /></button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. حضور وانصراف الطلاب */}
      {tab === 'student_att' && canViewStudentAtt && (
        <div className="space-y-4">
          {canEditEdu && (
            <form onSubmit={handleSaveStudentAttendance} className="bg-white p-5 rounded-3xl border space-y-3 font-bold">
              <h4 className="font-black text-[#7a1c24] flex items-center gap-1.5"><UserCheck size={17} /> تسجيل حضور وانصراف طالب</h4>
              <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-2">
                <select
                  required
                  className="p-2.5 border rounded-xl bg-white w-full min-w-0"
                  value={stuAttForm.lesson_id}
                  onChange={e => {
                    const lsn = lessons.find(x => x.id === e.target.value);
                    setStuAttForm({ ...stuAttForm, lesson_id: e.target.value, paid_amount: Number(lsn?.lesson_price || 0) });
                  }}
                >
                  <option value="">-- اختر الدرس * --</option>
                  {lessons.map(l => <option key={l.id} value={l.id}>{l.subject_name} ({l.stage_name} - {l.day_of_week})</option>)}
                </select>
                <input required placeholder="اسم الطالب *" className="p-2.5 border rounded-xl w-full min-w-0" value={stuAttForm.student_name} onChange={e => setStuAttForm({ ...stuAttForm, student_name: e.target.value })} />
                <input placeholder="تليفون الطالب" className="p-2.5 border rounded-xl w-full min-w-0" value={stuAttForm.student_phone} onChange={e => setStuAttForm({ ...stuAttForm, student_phone: e.target.value })} />
                <input type="date" className="p-2.5 border rounded-xl w-full min-w-0" value={stuAttForm.lesson_date} onChange={e => setStuAttForm({ ...stuAttForm, lesson_date: e.target.value })} />
              </div>
              <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-2">
                <select className="p-2.5 border rounded-xl bg-white w-full min-w-0" value={stuAttForm.status} onChange={e => setStuAttForm({ ...stuAttForm, status: e.target.value })}>
                  <option value="حاضر">✅ حاضر (وصل)</option>
                  <option value="انصراف">👋 انصراف</option>
                  <option value="غائب">❌ غائب</option>
                </select>
                <input type="time" placeholder="ساعة الوصول" className="p-2.5 border rounded-xl w-full min-w-0" value={stuAttForm.arrival_time} onChange={e => setStuAttForm({ ...stuAttForm, arrival_time: e.target.value })} />
                <input type="time" placeholder="ساعة الانصراف" className="p-2.5 border rounded-xl w-full min-w-0" value={stuAttForm.departure_time} onChange={e => setStuAttForm({ ...stuAttForm, departure_time: e.target.value })} />
                {(canViewPrices || canViewRevenue) && (
                  <input type="number" min="0" placeholder="المدفوع (ج.م)" className="p-2.5 border rounded-xl w-full min-w-0" value={stuAttForm.paid_amount} onChange={e => setStuAttForm({ ...stuAttForm, paid_amount: e.target.value })} />
                )}
                <button type="submit" className="bg-[#7a1c24] text-white rounded-xl p-2.5 cursor-pointer">+ تسجيل</button>
              </div>
            </form>
          )}

          <div className="bg-white p-4 rounded-3xl border overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="p-2">التاريخ</th>
                  <th className="p-2">الطالب</th>
                  <th className="p-2">الدرس</th>
                  <th className="p-2">الحالة</th>
                  <th className="p-2">الوصول</th>
                  <th className="p-2">الانصراف</th>
                  {(canViewPrices || canViewRevenue) && <th className="p-2">المدفوع</th>}
                  {canEditEdu && <th className="p-2">إجراء</th>}
                </tr>
              </thead>
              <tbody>
                {studentAtt.map(r => {
                  const lsn = lessons.find(x => x.id === r.lesson_id);
                  return (
                    <tr key={r.id} className="border-b">
                      <td className="p-2">{r.lesson_date}</td>
                      <td className="p-2 font-bold">{r.student_name}</td>
                      <td className="p-2">{lsn ? `${lsn.subject_name} (${lsn.stage_name})` : '—'}</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded font-bold ${r.status === 'حاضر' ? 'bg-green-100 text-green-800' : r.status === 'انصراف' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="p-2">{r.arrival_time || '—'}</td>
                      <td className="p-2">{r.departure_time || '—'}</td>
                      {(canViewPrices || canViewRevenue) && (
                        <td className="p-2 font-bold text-emerald-700">{r.paid_amount} ج.م</td>
                      )}
                      {canEditEdu && (
                        <td className="p-2 flex gap-1">
                          {r.status === 'حاضر' && !r.departure_time && (
                            <button type="button" onClick={() => markStudentDeparture(r)} className="px-2 py-1 bg-blue-600 text-white rounded-lg cursor-pointer">
                              تسجيل انصراف
                            </button>
                          )}
                          <button type="button" onClick={async () => { await supabase.from('edu_student_attendance').delete().eq('id', r.id); setStudentAtt(studentAtt.filter(x => x.id !== r.id)); }} className="p-1 bg-red-50 text-red-700 rounded cursor-pointer"><Trash2 size={13} /></button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. حضور وانصراف المدرسين */}
      {tab === 'teacher_att' && canViewTeacherAtt && (
        <div className="space-y-4">
          {canEditEdu && (
            <form onSubmit={handleSaveTeacherAttendance} className="bg-white p-5 rounded-3xl border space-y-3 font-bold">
              <h4 className="font-black text-[#7a1c24] flex items-center gap-1.5"><Clock size={17} /> تسجيل حضور وانصراف المدرس (المواعيد والتأخير والغياب)</h4>
              <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-2">
                <select
                  className="p-2.5 border rounded-xl bg-blue-50 w-full min-w-0"
                  value={tAttForm.teacher_id}
                  onChange={e => {
                    const tc = teachers.find(x => x.id === e.target.value);
                    setTAttForm({ ...tAttForm, teacher_id: e.target.value, teacher_name: tc?.teacher_name || tAttForm.teacher_name });
                  }}
                >
                  <option value="">-- اختر من قائمة المدرسين --</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.teacher_name} ({t.subject_name})</option>)}
                </select>
                <input required placeholder="اسم المدرس *" className="p-2.5 border rounded-xl w-full min-w-0" value={tAttForm.teacher_name} onChange={e => setTAttForm({ ...tAttForm, teacher_name: e.target.value })} />
                <select
                  className="p-2.5 border rounded-xl bg-white w-full min-w-0"
                  value={tAttForm.lesson_id}
                  onChange={e => {
                    const lsn = lessons.find(x => x.id === e.target.value);
                    setTAttForm({ ...tAttForm, lesson_id: e.target.value, scheduled_time: lsn?.start_time || tAttForm.scheduled_time });
                  }}
                >
                  <option value="">-- الدرس (اختياري) --</option>
                  {lessons.map(l => <option key={l.id} value={l.id}>{l.subject_name} ({l.stage_name} - {l.day_of_week} {l.start_time})</option>)}
                </select>
                <input type="date" className="p-2.5 border rounded-xl w-full min-w-0" value={tAttForm.lesson_date} onChange={e => setTAttForm({ ...tAttForm, lesson_date: e.target.value })} />
              </div>

              <div className="grid sm:grid-cols-3 md:grid-cols-6 gap-2">
                <select className="p-2.5 border rounded-xl bg-white w-full min-w-0" value={tAttForm.status} onChange={e => setTAttForm({ ...tAttForm, status: e.target.value })}>
                  <option value="في الموعد">✅ حضر في الموعد</option>
                  <option value="متأخر">⏰ حضر متأخر</option>
                  <option value="غائب">❌ غائب</option>
                </select>
                <div>
                  <label className="block text-[10px] text-gray-500">الميعاد المقرر</label>
                  <input type="time" className="w-full p-2 border rounded-xl" value={tAttForm.scheduled_time} onChange={e => setTAttForm({ ...tAttForm, scheduled_time: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500">الحضور الفعلي</label>
                  <input type="time" className="w-full p-2 border rounded-xl" value={tAttForm.actual_arrival_time} onChange={e => setTAttForm({ ...tAttForm, actual_arrival_time: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500">دقائق التأخير</label>
                  <input type="number" min="0" className="w-full p-2 border rounded-xl" value={tAttForm.late_minutes} onChange={e => setTAttForm({ ...tAttForm, late_minutes: e.target.value })} />
                </div>
                {canViewRevenue && (
                  <>
                    <div>
                      <label className="block text-[10px] text-emerald-700">مكافأة (ج.م)</label>
                      <input type="number" min="0" className="w-full p-2 border rounded-xl bg-emerald-50" value={tAttForm.bonus_amount} onChange={e => setTAttForm({ ...tAttForm, bonus_amount: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-red-700">خصم (ج.م)</label>
                      <input type="number" min="0" className="w-full p-2 border rounded-xl bg-red-50" value={tAttForm.deduction_amount} onChange={e => setTAttForm({ ...tAttForm, deduction_amount: e.target.value })} />
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <input placeholder="ملاحظات الحضور / سبب الغياب..." className="flex-1 min-w-0 p-2.5 border rounded-xl font-normal text-xs" value={tAttForm.notes} onChange={e => setTAttForm({ ...tAttForm, notes: e.target.value })} />
                <button type="submit" className="px-6 py-2.5 bg-[#7a1c24] text-white rounded-xl cursor-pointer shrink-0">+ حفظ حضور المدرس</button>
              </div>
            </form>
          )}

          <div className="bg-white p-4 rounded-3xl border overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="p-2">التاريخ</th>
                  <th className="p-2">المدرس</th>
                  <th className="p-2">الحالة</th>
                  <th className="p-2">المقرر / الفعلي</th>
                  <th className="p-2">الانصراف</th>
                  {canViewRevenue && <th className="p-2">مكافأة / خصم</th>}
                  {canEditEdu && <th className="p-2">إجراء</th>}
                </tr>
              </thead>
              <tbody>
                {teacherAtt.map(r => (
                  <tr key={r.id} className="border-b">
                    <td className="p-2">{r.lesson_date}</td>
                    <td className="p-2 font-bold">{r.teacher_name}</td>
                    <td className="p-2">
                      <span className={`px-2 py-0.5 rounded font-bold ${r.status === 'في الموعد' ? 'bg-green-100 text-green-800' : r.status === 'متأخر' ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-800'}`}>
                        {r.status} {r.late_minutes > 0 ? `(${r.late_minutes} د)` : ''}
                      </span>
                    </td>
                    <td className="p-2">{r.scheduled_time} ← {r.actual_arrival_time || '—'}</td>
                    <td className="p-2">{r.departure_time || '—'}</td>
                    {canViewRevenue && (
                      <td className="p-2">
                        {Number(r.bonus_amount) > 0 && <span className="text-emerald-700 font-bold ml-1">+{r.bonus_amount}ج</span>}
                        {Number(r.deduction_amount) > 0 && <span className="text-red-700 font-bold">-{r.deduction_amount}ج</span>}
                      </td>
                    )}
                    {canEditEdu && (
                      <td className="p-2 flex gap-1">
                        {r.status !== 'غائب' && !r.departure_time && (
                          <button type="button" onClick={() => markTeacherDeparture(r)} className="px-2 py-1 bg-blue-600 text-white rounded-lg cursor-pointer">انصراف</button>
                        )}
                        <button type="button" onClick={async () => { await supabase.from('edu_teacher_attendance').delete().eq('id', r.id); setTeacherAtt(teacherAtt.filter(x => x.id !== r.id)); }} className="p-1 bg-red-50 text-red-700 rounded cursor-pointer"><Trash2 size={13} /></button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. شيت إيراد ومحاسبة المدرسين */}
      {tab === 'revenue_sheet' && canViewRevenue && (
        <div className="space-y-4">
          <div className="flex justify-between items-center print:hidden">
            <strong className="text-emerald-900">💰 حسابات وإيرادات المدرسين</strong>
            <button type="button" onClick={() => window.print()} className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer">
              <Printer size={14} /> طباعة شيت المحاسبة
            </button>
          </div>

          {canEditEdu && (
            <form onSubmit={handleSaveTeacher} className="bg-white p-5 rounded-3xl border space-y-3 font-bold print:hidden">
              <h4 className="font-black text-[#7a1c24] flex items-center gap-1.5"><DollarSign size={17} /> {teacherForm.id ? 'تعديل اتفاق مدرس' : 'إضافة مدرس وتحديد نظام المحاسبة'}</h4>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                <input required placeholder="اسم المدرس *" className="p-2.5 border rounded-xl w-full min-w-0" value={teacherForm.teacher_name} onChange={e => setTeacherForm({ ...teacherForm, teacher_name: e.target.value })} />
                <input placeholder="رقم التليفون" className="p-2.5 border rounded-xl w-full min-w-0" value={teacherForm.phone} onChange={e => setTeacherForm({ ...teacherForm, phone: e.target.value })} />
                <input placeholder="المادة" className="p-2.5 border rounded-xl w-full min-w-0" value={teacherForm.subject_name} onChange={e => setTeacherForm({ ...teacherForm, subject_name: e.target.value })} />
                <select className="p-2.5 border rounded-xl bg-white w-full min-w-0" value={teacherForm.pay_cycle} onChange={e => setTeacherForm({ ...teacherForm, pay_cycle: e.target.value })}>
                  <option value="بالحصة">المحاسبة: بالحصة</option>
                  <option value="أسبوعي">المحاسبة: أسبوعياً</option>
                  <option value="شهري">المحاسبة: شهرياً</option>
                </select>
                <select className="p-2.5 border rounded-xl bg-white w-full min-w-0" value={teacherForm.pay_mode} onChange={e => setTeacherForm({ ...teacherForm, pay_mode: e.target.value })}>
                  <option value="نسبة %">نظام: نسبة مئوية من دخل الحصص (%)</option>
                  <option value="ثابت للحصة">نظام: مبلغ ثابت لكل حصة (ج.م)</option>
                </select>
                <input type="number" min="0" required placeholder="النسبة % أو المبلغ" className="p-2.5 border rounded-xl bg-amber-50 w-full min-w-0" value={teacherForm.pay_rate} onChange={e => setTeacherForm({ ...teacherForm, pay_rate: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-6 py-2.5 bg-[#7a1c24] text-white rounded-xl cursor-pointer">{teacherForm.id ? 'حفظ التعديل' : '+ حفظ نظام المدرس'}</button>
                {teacherForm.id && <button type="button" onClick={() => setTeacherForm({ id: null, teacher_name: '', phone: '', subject_name: '', pay_cycle: 'شهري', pay_mode: 'نسبة %', pay_rate: 50, notes: '' })} className="px-4 py-2 border rounded-xl">إلغاء</button>}
              </div>
            </form>
          )}

          <div className="bg-white p-4 rounded-3xl border overflow-x-auto">
            <table className="w-full text-right border-collapse border border-gray-300 text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2">المدرس والمادة</th>
                  <th className="border p-2">الاتفاق / الدورة</th>
                  <th className="border p-2">حضور / تأخير / غياب</th>
                  <th className="border p-2">دخل دروسه</th>
                  <th className="border p-2">مكافأة / خصم</th>
                  <th className="border p-2">المستحق له</th>
                  <th className="border p-2">المدفوع</th>
                  <th className="border p-2">المتبقي (حسابه)</th>
                  {canEditEdu && <th className="border p-2 print:hidden">إجراءات</th>}
                </tr>
              </thead>
              <tbody>
                {teachers.map(t => {
                  const fin = computeTeacherFinance(t);
                  return (
                    <tr key={t.id}>
                      <td className="border p-2 font-bold">{t.teacher_name}<span className="block text-gray-500 font-normal">{t.subject_name} • {t.phone}</span></td>
                      <td className="border p-2">{t.pay_cycle} • {t.pay_rate}{t.pay_mode === 'نسبة %' ? '%' : 'ج/حصة'}</td>
                      <td className="border p-2">✅ {fin.presentSessions} • ⏰ {fin.lateCount} • ❌ {fin.absentSessions}</td>
                      <td className="border p-2 font-bold">{fin.tStudentFees} ج.م</td>
                      <td className="border p-2">+{fin.totalBonus} / -{fin.totalDeduction}</td>
                      <td className="border p-2 font-black text-blue-800">{fin.totalDue} ج.م</td>
                      <td className="border p-2 font-bold text-emerald-700">{fin.totalPaid} ج.م</td>
                      <td className={`border p-2 font-black ${fin.remaining > 0 ? 'text-red-700 bg-red-50' : 'text-emerald-800 bg-emerald-50'}`}>
                        {fin.remaining > 0 ? `${fin.remaining} ج.م` : 'خالص ✅'}
                      </td>
                      {canEditEdu && (
                        <td className="border p-2 print:hidden flex flex-wrap gap-1">
                          <button type="button" onClick={() => { setPayoutModalTeacher(t); setPayoutForm({ payout_date: todayISO, amount: String(fin.remaining), notes: '' }); }} className="px-2.5 py-1 bg-emerald-700 text-white rounded-lg cursor-pointer">صرف دفعة</button>
                          <button type="button" onClick={() => setTeacherForm(t)} className="p-1 bg-gray-100 rounded cursor-pointer"><Edit3 size={13} /></button>
                          <button type="button" onClick={async () => { await supabase.from('edu_teachers').delete().eq('id', t.id); setTeachers(teachers.filter(x => x.id !== t.id)); }} className="p-1 bg-red-50 text-red-700 rounded cursor-pointer"><Trash2 size={13} /></button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* مودال حجز مكان في الدرس */}
      {bookModalLesson && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 z-70">
          <form onSubmit={handleBookLessonSeat} className="bg-white rounded-3xl w-full max-w-md p-6 space-y-3 font-bold text-sm">
            <div className="flex justify-between items-center border-b pb-2">
              <h4 className="text-base font-black text-[#7a1c24]">📌 حجز مكان: {bookModalLesson.subject_name}</h4>
              <button type="button" onClick={() => setBookModalLesson(null)} className="p-1.5 bg-gray-100 rounded-xl"><X size={16} /></button>
            </div>
            <div className="p-3 bg-indigo-50 rounded-2xl text-xs text-indigo-950 space-y-0.5">
              <p>📚 المرحلة: <strong>{bookModalLesson.stage_name}</strong> • 👨‍🏫 {bookModalLesson.teacher_name || '—'}</p>
              <p>
                📅 الميعاد: <strong>{bookModalLesson.day_of_week}</strong> الساعة <strong>{bookModalLesson.start_time}</strong>
                {canViewPrices && <> • 💰 {Number(bookModalLesson.lesson_price || 0) === 0 ? 'مجاني' : `${bookModalLesson.lesson_price} ج.م`}</>}
              </p>
            </div>
            <input required placeholder="اسم الطالب بالكامل *" className="w-full p-2.5 border rounded-xl" value={bookForm.student_name} onChange={e => setBookForm({ ...bookForm, student_name: e.target.value })} />
            <input required type="tel" placeholder="رقم التليفون / الواتساب *" className="w-full p-2.5 border rounded-xl" value={bookForm.student_phone} onChange={e => setBookForm({ ...bookForm, student_phone: e.target.value })} />
            <input placeholder="ملاحظات (اختياري)" className="w-full p-2.5 border rounded-xl font-normal text-xs" value={bookForm.notes} onChange={e => setBookForm({ ...bookForm, notes: e.target.value })} />
            <button type="submit" className="w-full py-3 bg-[#7a1c24] text-white rounded-xl cursor-pointer">تأكيد الحجز ✅</button>
          </form>
        </div>
      )}

      {/* مودال صرف دفعة للمدرس */}
      {payoutModalTeacher && canViewRevenue && canEditEdu && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 z-70">
          <form onSubmit={handleSavePayout} className="bg-white rounded-3xl w-full max-w-md p-6 space-y-3 font-bold text-sm">
            <div className="flex justify-between items-center border-b pb-2">
              <h4 className="text-base font-black text-emerald-800">💵 صرف مستحقات: {payoutModalTeacher.teacher_name}</h4>
              <button type="button" onClick={() => setPayoutModalTeacher(null)} className="p-1.5 bg-gray-100 rounded-xl"><X size={16} /></button>
            </div>
            <input type="date" required className="w-full p-2.5 border rounded-xl" value={payoutForm.payout_date} onChange={e => setPayoutForm({ ...payoutForm, payout_date: e.target.value })} />
            <input type="number" min="1" required placeholder="المبلغ المصروف (ج.م) *" className="w-full p-2.5 border rounded-xl" value={payoutForm.amount} onChange={e => setPayoutForm({ ...payoutForm, amount: e.target.value })} />
            <input placeholder="ملاحظات (مثال: حساب شهر مارس)" className="w-full p-2.5 border rounded-xl font-normal text-xs" value={payoutForm.notes} onChange={e => setPayoutForm({ ...payoutForm, notes: e.target.value })} />
            <button type="submit" className="w-full py-3 bg-emerald-700 text-white rounded-xl cursor-pointer">تأكيد الصرف ✅</button>
          </form>
        </div>
      )}
    </div>
  );
}