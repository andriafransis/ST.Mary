import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { audienceMatches, isExpired, kindMeta, isMissingTable, SQL_MISSING_HINT } from '../../lib/growth';

// تاب المخدوم: القانون الروحي والمسابقات والنقاط
export default function GrowthMemberPanel({ member }) {
  const [tasks, setTasks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [board, setBoard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [quiz, setQuiz] = useState(null);       // المسابقة المفتوحة
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    if (!member?.id) return;
    setLoading(true);
    try {
      const [t, l, q, a, allL, allA] = await Promise.all([
        supabase.from('spiritual_tasks').select('*').eq('active', true).order('created_at', { ascending: false }),
        supabase.from('spiritual_task_logs').select('*').eq('member_id', member.id),
        supabase.from('spiritual_quizzes').select('*').eq('active', true).order('created_at', { ascending: false }),
        supabase.from('spiritual_quiz_attempts').select('*').eq('member_id', member.id),
        supabase.from('spiritual_task_logs').select('member_id, task_id'),
        supabase.from('spiritual_quiz_attempts').select('member_id, points_awarded')
      ]);
      const firstErr = [t, l, q, a].find(r => r.error)?.error;
      if (firstErr) {
        setMissing(isMissingTable(firstErr));
        setLoading(false);
        return;
      }
      setMissing(false);
      setTasks((t.data || []).filter(x => audienceMatches(x, member)));
      setLogs(l.data || []);
      setQuizzes((q.data || []).filter(x => audienceMatches(x, member)));
      setAttempts(a.data || []);

      // لوحة الشرف: مجموع النقاط لكل مخدوم (مهام + مسابقات)
      const pts = new Map();
      const taskPoints = new Map((t.data || []).map(x => [x.id, x.points || 0]));
      (allL.data || []).forEach(r => pts.set(r.member_id, (pts.get(r.member_id) || 0) + (taskPoints.get(r.task_id) || 0)));
      (allA.data || []).forEach(r => pts.set(r.member_id, (pts.get(r.member_id) || 0) + (r.points_awarded || 0)));
      const top = [...pts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5);
      if (top.length > 0) {
        const { data: names } = await supabase.from('church_users').select('id, full_name').in('id', top.map(x => x[0]));
        const nm = new Map((names || []).map(n => [n.id, n.full_name]));
        setBoard(top.map(([id, p]) => ({ id, name: nm.get(id) || '—', points: p })));
      } else {
        setBoard([]);
      }
    } catch (e) {
      setMissing(isMissingTable(e));
    }
    setLoading(false);
  }, [member]);

  useEffect(() => { load(); }, [load]);

  const doneSet = useMemo(() => new Set(logs.map(l => l.task_id)), [logs]);
  const attemptByQuiz = useMemo(() => new Map(attempts.map(a => [a.quiz_id, a])), [attempts]);

  const myPoints = useMemo(() => {
    const tp = tasks.filter(t => doneSet.has(t.id)).reduce((s, t) => s + (t.points || 0), 0);
    const qp = attempts.reduce((s, a) => s + (a.points_awarded || 0), 0);
    return tp + qp;
  }, [tasks, doneSet, attempts]);

  const markDone = async (task) => {
    setBusyId(task.id);
    setMsg('');
    const { error } = await supabase.from('spiritual_task_logs').insert({ task_id: task.id, member_id: member.id });
    if (error && error.code !== '23505') setMsg('تعذر الحفظ: ' + error.message);
    await load();
    setBusyId(null);
  };

  const undo = async (task) => {
    setBusyId(task.id);
    await supabase.from('spiritual_task_logs').delete().eq('task_id', task.id).eq('member_id', member.id);
    await load();
    setBusyId(null);
  };

  const openQuiz = (q) => { setQuiz(q); setAnswers({}); setResult(null); setMsg(''); };

  const submitQuiz = async () => {
    const qs = Array.isArray(quiz.questions) ? quiz.questions : [];
    if (qs.some((_, i) => answers[i] === undefined)) { setMsg('جاوب على كل الأسئلة الأول.'); return; }
    const score = qs.reduce((s, q, i) => s + (Number(answers[i]) === Number(q.answer) ? 1 : 0), 0);
    const percent = qs.length ? Math.round((score / qs.length) * 100) : 0;
    const passed = percent >= (quiz.pass_percent || 0);
    const points = score * (quiz.points_per_correct || 0) + (passed ? (quiz.bonus_points || 0) : 0);
    const { error } = await supabase.from('spiritual_quiz_attempts').insert({
      quiz_id: quiz.id, member_id: member.id, score, total: qs.length, points_awarded: points, passed
    });
    if (error) {
      setMsg(error.code === '23505' ? 'إنت جاوبت المسابقة دي قبل كده.' : 'تعذر الحفظ: ' + error.message);
      return;
    }
    setResult({ score, total: qs.length, percent, passed, points });
    load();
  };

  if (loading) return <div className="py-10 text-center text-xs font-bold text-gray-500">جاري التحميل...</div>;
  if (missing) return <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-xs font-bold text-amber-950">{SQL_MISSING_HINT}</div>;

  const openTasks = tasks.filter(t => !doneSet.has(t.id) && !isExpired(t));
  const doneTasks = tasks.filter(t => doneSet.has(t.id));

  return (
    <div className="space-y-3 text-xs">
      <div className="app-hero bg-linear-to-l from-[#5c1319] via-[#7a1c24] to-[#91212b] text-white rounded-3xl p-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-amber-200">🌱 نموّي الروحي</h3>
          <p className="text-[11px] text-white/85 mt-0.5">اعمل قانونك الروحي، وحلّ المسابقات، واجمع نقاط تبقى هدايا وخصومات رحلات.</p>
        </div>
        <div className="text-center bg-white/15 border border-white/25 rounded-2xl px-4 py-2 shrink-0">
          <b className="block text-2xl text-white leading-none">{myPoints}</b>
          <span className="text-[10px] text-amber-100 font-black">نقطة</span>
        </div>
      </div>

      {msg && <div className="p-2.5 bg-red-50 border border-red-200 text-red-800 rounded-xl font-bold">{msg}</div>}

      <section className="space-y-2">
        <h4 className="font-black text-sm text-[#7a1c24]">📿 قانوني الروحي ({openTasks.length} متبقي)</h4>
        {openTasks.length === 0 && <div className="bg-white p-4 rounded-2xl border text-center text-gray-500">مفيش مهام جديدة دلوقتي. ربنا يبارك فيك 🙏</div>}
        {openTasks.map(t => {
          const k = kindMeta(t.kind);
          return (
            <div key={t.id} className="bg-white p-3 rounded-2xl border flex items-start justify-between gap-3">
              <div className="min-w-0">
                <strong className="text-sm font-black text-gray-900">{k.icon} {t.title}</strong>
                {t.description && <p className="text-gray-600 mt-0.5">{t.description}</p>}
                <div className="flex flex-wrap gap-1.5 mt-1.5 text-[10px] font-black">
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200">+{t.points} نقطة</span>
                  {t.due_date && <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">لحد {t.due_date}</span>}
                  {t.created_by_name && <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">من {t.created_by_name}</span>}
                </div>
              </div>
              <button type="button" disabled={busyId === t.id} onClick={() => markDone(t)} className="shrink-0 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white rounded-xl font-black cursor-pointer">✓ عملتها</button>
            </div>
          );
        })}
        {doneTasks.length > 0 && (
          <details className="bg-white rounded-2xl border p-3">
            <summary className="cursor-pointer font-black text-emerald-800">✅ اللي خلصتها ({doneTasks.length})</summary>
            <div className="mt-2 space-y-1.5">
              {doneTasks.map(t => (
                <div key={t.id} className="flex items-center justify-between gap-2 bg-emerald-50/60 rounded-xl px-2.5 py-1.5">
                  <span className="font-bold">{kindMeta(t.kind).icon} {t.title} <span className="text-emerald-800">(+{t.points})</span></span>
                  <button type="button" onClick={() => undo(t)} className="text-[10px] text-gray-500 hover:text-red-700 cursor-pointer">تراجع</button>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      <section className="space-y-2">
        <h4 className="font-black text-sm text-[#7a1c24]">🏆 المسابقات</h4>
        {quizzes.length === 0 && <div className="bg-white p-4 rounded-2xl border text-center text-gray-500">مفيش مسابقات دلوقتي.</div>}
        {quizzes.map(q => {
          const att = attemptByQuiz.get(q.id);
          const expired = isExpired(q);
          return (
            <div key={q.id} className="bg-white p-3 rounded-2xl border space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <strong className="text-sm font-black text-gray-900">🏆 {q.title}</strong>
                {att ? (
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${att.passed ? 'bg-emerald-100 text-emerald-900' : 'bg-gray-100 text-gray-700'}`}>
                    {att.score}/{att.total} • +{att.points_awarded}
                  </span>
                ) : expired ? (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-gray-100 text-gray-600">انتهت</span>
                ) : (
                  <button type="button" onClick={() => openQuiz(q)} className="px-3 py-1.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black cursor-pointer">ابدأ</button>
                )}
              </div>
              {q.description && <p className="text-gray-600">{q.description}</p>}
              <div className="flex flex-wrap gap-1.5 text-[10px] font-black">
                <span className="px-2 py-0.5 rounded-full bg-gray-100">{(q.questions || []).length} سؤال</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200">{q.points_per_correct} نقطة للإجابة الصح</span>
                {q.bonus_points > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200">بونص +{q.bonus_points} لو جبت {q.pass_percent}%+</span>}
                {q.reward_text && <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200">🎁 {q.reward_text}</span>}
                {q.due_date && <span className="px-2 py-0.5 rounded-full bg-gray-100">لحد {q.due_date}</span>}
              </div>
            </div>
          );
        })}
      </section>

      {board.length > 0 && (
        <section className="bg-white rounded-2xl border p-3 space-y-1.5">
          <h4 className="font-black text-sm text-[#7a1c24]">⭐ لوحة الشرف</h4>
          {board.map((b, i) => (
            <div key={b.id} className={`flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 ${b.id === member.id ? 'bg-amber-50 border border-amber-300' : 'bg-gray-50'}`}>
              <span className="font-black">{['🥇', '🥈', '🥉'][i] || `${i + 1}.`} {b.name}</span>
              <b className="text-[#7a1c24]">{b.points}</b>
            </div>
          ))}
        </section>
      )}

      {quiz && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" dir="rtl">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[92dvh] overflow-y-auto p-4 md:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-black text-sm text-[#7a1c24]">🏆 {quiz.title}</h3>
              <button type="button" onClick={() => setQuiz(null)} className="px-3 py-1.5 bg-gray-100 rounded-xl font-black cursor-pointer">إغلاق</button>
            </div>
            {result ? (
              <div className="text-center space-y-2 py-4">
                <div className="text-4xl">{result.passed ? '🎉' : '🙂'}</div>
                <b className="block text-lg">{result.score} من {result.total} ({result.percent}%)</b>
                <p className="font-bold text-amber-800">اتضاف لك {result.points} نقطة</p>
                {result.passed && quiz.reward_text && <p className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl font-black text-emerald-900">🎁 {quiz.reward_text}</p>}
                <button type="button" onClick={() => setQuiz(null)} className="px-5 py-2 bg-[#7a1c24] text-white rounded-xl font-black cursor-pointer">تمام</button>
              </div>
            ) : (
              <>
                {(quiz.questions || []).map((q, i) => (
                  <div key={i} className="bg-gray-50 rounded-2xl p-3 space-y-1.5">
                    <strong className="block">{i + 1}. {q.q}</strong>
                    {(q.options || []).map((o, oi) => (
                      <label key={oi} className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer ${answers[i] === oi ? 'bg-[#f9ecee] border-[#7a1c24]' : 'bg-white'}`}>
                        <input type="radio" name={`q${i}`} checked={answers[i] === oi} onChange={() => setAnswers({ ...answers, [i]: oi })} className="accent-[#7a1c24]" />
                        <span className="font-bold">{o}</span>
                      </label>
                    ))}
                  </div>
                ))}
                {msg && <div className="p-2 bg-red-50 border border-red-200 text-red-800 rounded-xl font-bold">{msg}</div>}
                <button type="button" onClick={submitQuiz} className="w-full py-3 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black cursor-pointer">تسليم الإجابات</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
