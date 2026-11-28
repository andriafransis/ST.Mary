import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { audienceMatches } from '../../lib/growth';

// آية اليوم: بتظهر للمخدوم أول ما يفتح التطبيق
export default function VerseBanner({ member }) {
  const [verse, setVerse] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('daily_verses')
          .select('*')
          .eq('active', true)
          .order('created_at', { ascending: false })
          .limit(30);
        if (error || !alive) return;
        const mine = (data || []).find(v => audienceMatches(v, member));
        setVerse(mine || null);
      } catch {
        // الجدول لسه مش متعمل: مفيش آية
      }
    })();
    return () => { alive = false; };
  }, [member?.id, member?.detailed_stage, member?.service_stage, member?.assigned_class]);

  if (!verse) return null;
  return (
    <div className="app-hero bg-linear-to-l from-[#5c1319] via-[#7a1c24] to-[#91212b] text-white rounded-3xl p-4 md:p-5 text-center shadow">
      <div className="text-[11px] font-black text-amber-200 mb-1">✝ آية اليوم</div>
      <p className="text-base md:text-lg font-black leading-relaxed">«{verse.verse_text}»</p>
      {verse.reference && <div className="text-xs font-bold text-amber-100 mt-1.5">{verse.reference}</div>}
      {verse.created_by_name && <div className="text-[10px] text-white/70 mt-1">من {verse.created_by_name}</div>}
    </div>
  );
}
