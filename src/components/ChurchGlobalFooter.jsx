import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Eye, ShieldCheck, Heart } from 'lucide-react';

export default function ChurchGlobalFooter({ churchName = 'كنيسة السيدة العذراء مريم بالمطرية' }) {
  const [visitorNumber, setVisitorNumber] = useState(null);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const trackVisitor = async () => {
      try {
        const hasCountedSession = sessionStorage.getItem('church_counted_visit');

        if (!hasCountedSession) {
          // أول مرة يدخل في هذه الجلسة -> زيادة العداد
          const { data, error } = await supabase.rpc('increment_site_visits');
          if (!error && data) {
            sessionStorage.setItem('church_counted_visit', 'true');
            sessionStorage.setItem('church_cached_vis_num', String(data));
            setVisitorNumber(data);
            return;
          }
        }

        // لو كان مسجل بالفعل في هذه الجلسة أو تعذر الـ RPC -> قراءة الرقم الحالي فقط
        const cached = sessionStorage.getItem('church_cached_vis_num');
        if (cached) {
          setVisitorNumber(Number(cached));
          return;
        }

        const { data: row } = await supabase
          .from('site_visitor_stats')
          .select('total_visits')
          .eq('id', 'main_counter')
          .single();

        if (row?.total_visits) {
          setVisitorNumber(row.total_visits);
          sessionStorage.setItem('church_cached_vis_num', String(row.total_visits));
        }
      } catch {
        // في حالة عدم توفر الاتصال
        setVisitorNumber(1);
      }
    };

    trackVisitor();
  }, []);

  return (
    <footer className="w-full bg-[#2a0609] text-white/80 border-t-2 border-amber-400/40 py-4 px-4 text-xs select-none print:hidden" dir="rtl">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-right">
        
        {/* بيانات الملكية الفكرية */}
        <div className="space-y-1">
          <div className="flex items-center justify-center sm:justify-start gap-1.5 text-amber-200 font-bold">
            <span>✝</span>
            <strong>{churchName}</strong>
            <span className="text-white/40">•</span>
            <span className="text-[11px] font-normal text-white/70">جميع الحقوق الفكرية والبرمجية محفوظة © {currentYear}</span>
          </div>
          <p className="text-[10px] text-white/50 flex items-center justify-center sm:justify-start gap-1">
            <ShieldCheck size={12} className="text-emerald-400" />
            منظومة الرعاية والخدمة الكنسية الموحدة • للاستخدام والتوثيق الكنسي
          </p>
        </div>

        {/* كارت عداد الزوار المهندم */}
        <div className="flex items-center gap-2 bg-white/5 border border-amber-400/30 px-3.5 py-1.5 rounded-2xl shadow-inner">
          <Eye size={15} className="text-amber-300 animate-pulse" />
          <span className="text-[11px] text-gray-300">أنت الزائر رقم:</span>
          <strong className="text-xs font-black text-amber-300 font-mono tracking-wider bg-black/40 px-2 py-0.5 rounded-lg border border-amber-400/20">
            {visitorNumber ? visitorNumber.toLocaleString('ar-EG') : '...'}
          </strong>
        </div>

      </div>
    </footer>
  );
}