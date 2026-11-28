import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { TASK_KINDS, kindMeta, splitCsv, isMissingTable, SQL_MISSING_HINT } from '../../lib/growth';

function AudiencePicker({ options, value, onChange, canAll }) {
  const sel = splitCsv(value);
  const toggle = (n) => onChange((sel.includes(n) ? sel.filter(x => x !== n) : [...sel, n]).join(', '));
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1.5">
        {options.map(n => (
          <button key={n} type="button" onClick={() => toggle(n)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-black border cursor-pointer ${sel.includes(n) ? 'bg-[#7a1c24] text-white border-[#7a1c24]' : 'bg-white text-gray-700 border-gray-300'}`}>
            {sel.includes(n) ? '✓ ' : ''}{n}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-gray-500">{sel.length === 0 ? (canAll ? 'من غير اختيار = كل المخدومين.' : 'من غير اختيار = خدمتك إنت.') : `موجّه لـ: ${sel.join('، ')}`}</p>
    </div>
  );
}

// إدارة النمو الروحي للخادم/الأمين/الكاهن/الأدمن
export default function GrowthServantPanel({ servant, stageOptions = [], defaultStages = [], elevated = false }) {
  const [sub, setSub] = useState('verse');
  const [missing, setMissing] = useState(false);
  const [msg, setMsg] = useState('');
  const [verses, setVerses] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [names, setNames] = useState({});
  const [loading, setLoading] = useState(true);

  const [vForm, setVForm] = useState({ verse_text: '', reference: '', target_stage: '' });
  const [tForm, setTForm] = useState({ title: '', kind: 'gospel', description: '', due_date: '', points: 1, target_stage: '' });
  const emptyQuiz = { title: '', description: '', points_per_correct: 1, pass_percent: 60, bonus_points: 5, reward_text: '', due_date: '', target_stage: '', questions: [{ q: '', options: ['', '', '', ''], answer: 0 }] };
  const [qForm, setQForm] = useState(emptyQuiz);

  const me = { created_by: servant?.id || null, created_by_name: servant?.full_name || servant?.username || '' };
  const audience = (v) => {
    const sel = splitCsv(v);
    if (sel.length > 0) return sel.join(', ');
    return elevated ? '' : (defaultStages || []).join(', ');
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [v, t, l, q, a] = await Promise.all([
        supabase.from('daily_verses').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('spiritual_tasks').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('spiritual_task_logs').select('*'),
        supabase.from('spiritual_quizzes').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('spiritual_quiz_attempts').select('*')
      ]);
      const err = [v, t, l, q, a].find(r => r.error)?.error;
      if (err) { setMissing(isMissingTable(err)); setLoading(false); return; }
      setMissing(false);
      setVerses(v.data || []); setTasks(t.data || []); setLogs(l.data || []); setQuizzes(q.data || []); setAttempts(a.data || []);
      const ids = [...new Set([...(l.data || []).map(x => x.member_id), ...(a.data || []).map(x => x.member_id)])];
      if (ids.length > 0) {
        const { data: us } = await supabase.from('church_users').select('id, full_name').in('id', ids.slice(0, 300));
        setNames(Object.fromEntries((us || []).map(u => [u.id, u.full_name])));
      }
    } catch (e) { setMissing(isMissingTable(e)); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 3500); };
  const run = async (fn) => {
    const { error } = await fn();
    if (error) { flash('تعذر الحفظ: ' + error.message); return false; }
    await load(); return true;
  };

  const addVerse = async (e) => {
    e.preventDefault();
    if (!vForm.verse_text.trim()) return;
    if (await run(() => supabase.from('daily_verses').insert({ ...vForm, verse_text: vForm.verse_text.trim(), target_stage: audience(vForm.target_stage), ...me }))) {
      setVForm({ verse_text: '', reference: '', target_stage: '' }); flash('اتنشرت الآية ✓');
    }
  };
  const addTask = async (e) => {
    e.preventDefault();
    if (!tForm.title.trim()) return;
    if (await run(() => supabase.from('spiritual_tasks').insert({
      ...tForm, title: tForm.title.trim(), points: Number(tForm.points) || 0, due_date: tForm.due_date || null, target_stage: audience(tForm.target_stage), ...me
    }))) { setTForm({ title: '', kind: 'gospel', description: '', due_date: '', points: 1, target_stage: '' }); flash('اتضافت المهمة ✓'); }
  };
  const setQ = (i, patch) => setQForm(f => ({ ...f, questions: f.questions.map((q, qi) => qi === i ? { ...q, ...patch } : q) }));
  const addQuiz = async (e) => {
    e.preventDefault();
    const qs = qForm.questions
      .map(q => ({ q: q.q.trim(), options: q.options.map(o => o.trim()).filter(Boolean), answer: q.answer }))
      .filter(q => q.q && q.options.length >= 2);
    if (!qForm.title.trim() || qs.length === 0) { flash('اكتب عنوان وسؤال واحد على الأقل بإجابتين.'); return; }
    const fixed = qs.map(q => ({ ...q, answer: Math.min(q.answer, q.options.length - 1) }));
    if (await run(() => supabase.from('spiritual_quizzes').insert({
      title: qForm.title.trim(), description: qForm.description, points_per_correct: Number(qForm.points_per_correct) || 0,
      pass_percent: Number(qForm.pass_percent) || 0, bonus_points: Number(qForm.bonus_points) || 0, reward_text: qForm.reward_text,
      due_date: qForm.due_date || null, target_stage: audience(qForm.target_stage), questions: fixed, ...me
    }))) { setQForm(emptyQuiz); flash('اتنشرت المسابقة ✓'); }
  };
  const del = async (table, id) => {
    if (!window.confirm('متأكد من الحذف؟')) return;
    await run(() => supabase.from(table).delete().eq('id', id));
  };
  const toggleActive = (table, row) => run(() => supabase.from(table).update({ active: !row.active }).eq('id', row.id));

  const taskPoints = useMemo(() => new Map(tasks.map(t => [t.id, t.points || 0])), [tasks]);
  const board = useMemo(() => {
    const pts = new Map();
    logs.forEach(r => pts.set(r.member_id, (pts.get(r.member_id) || 0) + (taskPoints.get(r.task_id) || 0)));
    attempts.forEach(r => pts.set(r.member_id, (pts.get(r.member_id) || 0) + (r.points_awarded || 0)));
    return [...pts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  }, [logs, attempts, taskPoints]);

  if (loading) return <div className="py-10 text-center text-xs font-bold text-gray-500">جاري التحميل...</div>;
  if (missing) return <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-xs font-bold text-amber-950">{SQL_MISSING_HINT}</div>;

  const inp = 'w-full p-2.5 border rounded-xl bg-white';
  const subTabs = [['verse', '✝ آية اليوم'], ['tasks', '📿 قانون روحي'], ['quiz', '🏆 مسابقات'], ['board', '⭐ النقاط والترتيب']];

  return (
    <div className="space-y-3 text-xs font-bold">
      <div className="app-tabs bg-white p-1.5 rounded-2xl border flex items-center gap-1.5 overflow-x-auto">
        {subTabs.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setSub(k)} className={`px-3.5 py-2 rounded-xl cursor-pointer ${sub === k ? 'bg-[#7a1c24] text-white' : 'bg-gray-50 text-gray-700'}`}>{l}</button>
        ))}
      </div>
      {msg && <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl">{msg}</div>}

      {sub === 'verse' && (
        <div className="space-y-3">
          <form onSubmit={addVerse} className="bg-white p-3.5 rounded-2xl border space-y-2">
            <h4 className="font-black text-sm text-[#7a1c24]">نشر آية تشجيعية للمخدومين</h4>
            <textarea className={inp} rows={3} placeholder="اكتب الآية هنا..." value={vForm.verse_text} onChange={e => setVForm({ ...vForm, verse_text: e.target.value })} />
            <input className={inp} placeholder="المرجع (مثال: فيلبي ٤: ١٣)" value={vForm.reference} onChange={e => setVForm({ ...vForm, reference: e.target.value })} />
            <AudiencePicker options={stageOptions} value={vForm.target_stage} onChange={v => setVForm({ ...vForm, target_stage: v })} canAll={elevated} />
            <button type="submit" className="px-4 py-2.5 bg-[#7a1c24] text-white rounded-xl font-black cursor-pointer">نشر</button>
          </form>
          {verses.map(v => (
            <div key={v.id} className={`bg-white p-3 rounded-2xl border flex items-start justify-between gap-2 ${v.active ? '' : 'opacity-50'}`}>
              <div className="min-w-0"><p className="text-sm font-black">«{v.verse_text}»</p><p className="text-gray-500 mt-0.5">{v.reference} {v.target_stage ? `• ${v.target_stage}` : '• الكل'} • {v.created_by_name}</p></div>
              <div className="flex gap-1.5 shrink-0">
                <button type="button" onClick={() => toggleActive('daily_verses', v)} className="px-2.5 py-1.5 bg-gray-100 rounded-lg cursor-pointer">{v.active ? 'إخفاء' : 'إظهار'}</button>
                <button type="button" onClick={() => del('daily_verses', v.id)} className="px-2.5 py-1.5 bg-red-50 text-red-700 rounded-lg cursor-pointer">حذف</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {sub === 'tasks' && (
        <div className="space-y-3">
          <form onSubmit={addTask} className="bg-white p-3.5 rounded-2xl border space-y-2">
            <h4 className="font-black text-sm text-[#7a1c24]">إضافة مهمة / قانون روحي</h4>
            <input className={inp} placeholder="عنوان المهمة (مثال: اقرأ إنجيل يوحنا أصحاح ٣)" value={tForm.title} onChange={e => setTForm({ ...tForm, title: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <select className={inp} value={tForm.kind} onChange={e => setTForm({ ...tForm, kind: e.target.value })}>{TASK_KINDS.map(k => <option key={k.key} value={k.key}>{k.icon} {k.label}</option>)}</select>
              <input type="number" min="0" className={inp} placeholder="النقاط" value={tForm.points} onChange={e => setTForm({ ...tForm, points: e.target.value })} />
            </div>
            <input className={inp} placeholder="تفاصيل (اختياري)" value={tForm.description} onChange={e => setTForm({ ...tForm, description: e.target.value })} />
            <div><label className="block mb-1">آخر موعد (اختياري)</label><input type="date" className={inp} value={tForm.due_date} onChange={e => setTForm({ ...tForm, due_date: e.target.value })} /></div>
            <AudiencePicker options={stageOptions} value={tForm.target_stage} onChange={v => setTForm({ ...tForm, target_stage: v })} canAll={elevated} />
            <button type="submit" className="px-4 py-2.5 bg-[#7a1c24] text-white rounded-xl font-black cursor-pointer">إضافة المهمة</button>
          </form>
          {tasks.map(t => {
            const done = logs.filter(l => l.task_id === t.id);
            return (
              <div key={t.id} className={`bg-white p-3 rounded-2xl border space-y-1.5 ${t.active ? '' : 'opacity-50'}`}>
                <div className="flex items-start justify-between gap-2">
                  <strong className="text-sm font-black">{kindMeta(t.kind).icon} {t.title}</strong>
                  <div className="flex gap-1.5 shrink-0">
                    <button type="button" onClick={() => toggleActive('spiritual_tasks', t)} className="px-2.5 py-1.5 bg-gray-100 rounded-lg cursor-pointer">{t.active ? 'إيقاف' : 'تفعيل'}</button>
                    <button type="button" onClick={() => del('spiritual_tasks', t.id)} className="px-2.5 py-1.5 bg-red-50 text-red-700 rounded-lg cursor-pointer">حذف</button>
                  </div>
                </div>
                <p className="text-gray-500">{t.target_stage || 'الكل'} • +{t.points} نقطة {t.due_date ? `• لحد ${t.due_date}` : ''} • ✅ {done.length} خلّصوها</p>
                {done.length > 0 && <details><summary className="cursor-pointer text-[#7a1c24]">مين خلّصها</summary><p className="mt-1 text-gray-700 leading-relaxed">{done.map(d => names[d.member_id] || '—').join('، ')}</p></details>}
              </div>
            );
          })}
        </div>
      )}

      {sub === 'quiz' && (
        <div className="space-y-3">
          <form onSubmit={addQuiz} className="bg-white p-3.5 rounded-2xl border space-y-2">
            <h4 className="font-black text-sm text-[#7a1c24]">إنشاء مسابقة</h4>
            <input className={inp} placeholder="عنوان المسابقة" value={qForm.title} onChange={e => setQForm({ ...qForm, title: e.target.value })} />
            <input className={inp} placeholder="وصف (اختياري)" value={qForm.description} onChange={e => setQForm({ ...qForm, description: e.target.value })} />
            <div className="grid grid-cols-3 gap-2">
              <div><label className="block mb-1 text-[10px]">نقطة لكل إجابة</label><input type="number" min="0" className={inp} value={qForm.points_per_correct} onChange={e => setQForm({ ...qForm, points_per_correct: e.target.value })} /></div>
              <div><label className="block mb-1 text-[10px]">نسبة النجاح %</label><input type="number" min="0" max="100" className={inp} value={qForm.pass_percent} onChange={e => setQForm({ ...qForm, pass_percent: e.target.value })} /></div>
              <div><label className="block mb-1 text-[10px]">بونص النجاح</label><input type="number" min="0" className={inp} value={qForm.bonus_points} onChange={e => setQForm({ ...qForm, bonus_points: e.target.value })} /></div>
            </div>
            <input className={inp} placeholder="الهدية / المكافأة (مثال: خصم ١٠٪ على رحلة الدير)" value={qForm.reward_text} onChange={e => setQForm({ ...qForm, reward_text: e.target.value })} />
            <div><label className="block mb-1">آخر موعد (اختياري)</label><input type="date" className={inp} value={qForm.due_date} onChange={e => setQForm({ ...qForm, due_date: e.target.value })} /></div>
            <AudiencePicker options={stageOptions} value={qForm.target_stage} onChange={v => setQForm({ ...qForm, target_stage: v })} canAll={elevated} />
            <div className="space-y-2 pt-1">
              {qForm.questions.map((q, i) => (
                <div key={i} className="bg-gray-50 rounded-2xl p-2.5 space-y-1.5">
                  <div className="flex gap-1.5">
                    <input className={inp} placeholder={`السؤال ${i + 1}`} value={q.q} onChange={e => setQ(i, { q: e.target.value })} />
                    {qForm.questions.length > 1 && <button type="button" onClick={() => setQForm(f => ({ ...f, questions: f.questions.filter((_, qi) => qi !== i) }))} className="px-2.5 bg-red-50 text-red-700 rounded-xl cursor-pointer">✕</button>}
                  </div>
                  {q.options.map((o, oi) => (
                    <div key={oi} className="flex items-center gap-1.5">
                      <input type="radio" name={`ans${i}`} checked={q.answer === oi} onChange={() => setQ(i, { answer: oi })} className="accent-emerald-700" title="الإجابة الصح" />
                      <input className={inp} placeholder={`اختيار ${oi + 1}${q.answer === oi ? ' (الصح)' : ''}`} value={o} onChange={e => setQ(i, { options: q.options.map((x, xi) => xi === oi ? e.target.value : x) })} />
                    </div>
                  ))}
                </div>
              ))}
              <button type="button" onClick={() => setQForm(f => ({ ...f, questions: [...f.questions, { q: '', options: ['', '', '', ''], answer: 0 }] }))} className="px-3 py-2 bg-gray-100 rounded-xl cursor-pointer">+ سؤال جديد</button>
            </div>
            <button type="submit" className="w-full py-2.5 bg-[#7a1c24] text-white rounded-xl font-black cursor-pointer">نشر المسابقة</button>
          </form>
          {quizzes.map(q => {
            const att = attempts.filter(a => a.quiz_id === q.id);
            return (
              <div key={q.id} className={`bg-white p-3 rounded-2xl border space-y-1.5 ${q.active ? '' : 'opacity-50'}`}>
                <div className="flex items-start justify-between gap-2">
                  <strong className="text-sm font-black">🏆 {q.title}</strong>
                  <div className="flex gap-1.5 shrink-0">
                    <button type="button" onClick={() => toggleActive('spiritual_quizzes', q)} className="px-2.5 py-1.5 bg-gray-100 rounded-lg cursor-pointer">{q.active ? 'إيقاف' : 'تفعيل'}</button>
                    <button type="button" onClick={() => del('spiritual_quizzes', q.id)} className="px-2.5 py-1.5 bg-red-50 text-red-700 rounded-lg cursor-pointer">حذف</button>
                  </div>
                </div>
                <p className="text-gray-500">{(q.questions || []).length} سؤال • {q.target_stage || 'الكل'} • شارك {att.length} {q.reward_text ? `• 🎁 ${q.reward_text}` : ''}</p>
                {att.length > 0 && (
                  <details><summary className="cursor-pointer text-[#7a1c24]">النتائج</summary>
                    <div className="mt-1 space-y-1">{[...att].sort((a, b) => b.score - a.score).map(a => (
                      <div key={a.id} className="flex justify-between bg-gray-50 rounded-lg px-2 py-1"><span>{names[a.member_id] || '—'}</span><b>{a.score}/{a.total} {a.passed ? '✅' : ''}</b></div>
                    ))}</div>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}

      {sub === 'board' && (
        <div className="bg-white p-3.5 rounded-2xl border space-y-1.5">
          <h4 className="font-black text-sm text-[#7a1c24]">⭐ ترتيب النقاط (أعلى ٢٠)</h4>
          <p className="text-gray-500">استخدمه تحدد مين يستاهل هدية أو خصم رحلة. النقاط = المهام + المسابقات.</p>
          {board.length === 0 && <p className="text-gray-400 py-3 text-center">لسه مفيش نقاط.</p>}
          {board.map(([id, p], i) => (
            <div key={id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2"><span>{['🥇', '🥈', '🥉'][i] || `${i + 1}.`} {names[id] || '—'}</span><b className="text-[#7a1c24]">{p}</b></div>
          ))}
        </div>
      )}
    </div>
  );
}
