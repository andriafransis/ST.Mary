import { Printer, X } from 'lucide-react';
import { logActivity } from '../../lib/activityLogger';
import {
  getSeatPositionLabel,
  getSeatFinancials,
  getTripSourceInfo
} from './BusTripManager';

export function PrintBusModal({ printBusState, setPrintBusState, priest, todayISO }) {
  if (!printBusState) return null;

  const sourceInfo = getTripSourceInfo(printBusState.trip || {});

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 z-70 overflow-y-auto print:static print:bg-white print:p-0 print:block">
      <div className="bg-white rounded-3xl w-full max-w-5xl p-6 space-y-5 shadow-2xl print:shadow-none print:rounded-none print:p-0 print:max-w-none">
        <div className="flex flex-wrap justify-between items-center gap-2 border-b pb-3 print:hidden">
          <div>
            <h3 className="text-lg font-black text-[#7a1c24]">🖨️ معاينة طباعة كشوفات الأتوبيسات ({printBusState.buses.length} كشف)</h3>
            <p className="text-sm text-gray-600">
              المصدر: <strong>{sourceInfo.label}</strong> • كل أتوبيس يطبع في صفحة مستقلة مع اسم المشرف وحالة الدفع
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                logActivity({
                  user: priest,
                  actionType: 'طباعة_كشف_أتوبيس',
                  targetTable: 'church_trips',
                  targetId: printBusState.trip?.id,
                  description: `طبع كشف أتوبيس رحلة: ${printBusState.trip?.title} (${sourceInfo.label})`
                });
                window.print();
              }}
              className="px-4 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Printer size={16} /> طباعة / حفظ PDF
            </button>
            <button type="button" onClick={() => setPrintBusState(null)} className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold flex items-center gap-1 cursor-pointer">
              <X size={16} /> إغلاق
            </button>
          </div>
        </div>

        <div className="space-y-8 print:space-y-0">
          {printBusState.buses.map((bus, bIdx) => {
            const busSeats = (bus.seats || []).filter(s => !s.isDoor);
            const tripCost = Number(printBusState.trip?.trip_cost ?? printBusState.trip?.cost_per_person ?? 0);
            const booked = busSeats.filter(s => s.occupant).length;
            const busPaid = busSeats.filter(s => s.occupant).reduce((sum, s) => sum + getSeatFinancials(s, tripCost).paid, 0);
            const busRem = busSeats.filter(s => s.occupant).reduce((sum, s) => sum + getSeatFinancials(s, tripCost).remaining, 0);
            const isLast = bIdx === printBusState.buses.length - 1;

            return (
              <div key={bus.id || bIdx} className={`border-2 border-gray-300 rounded-2xl p-5 space-y-3 print:border-0 print:p-2 ${!isLast ? 'print:break-after-page' : ''}`}>
                <div className="text-center border-b-2 border-[#7a1c24] pb-3 space-y-1">
                  <div className="flex justify-between items-center text-xs text-gray-600">
                    <span>المسؤول: <strong>{priest?.full_name || 'مسؤول الرحلات'}</strong></span>
                    <span>تاريخ الطباعة: {todayISO}</span>
                  </div>
                  <h2 className="text-2xl font-black text-[#7a1c24]">🚌 كشف ركاب: {bus.name}</h2>
                  <p className="text-base font-black text-gray-900">
                    {printBusState.trip?.activity_kind || 'رحلة'}: {printBusState.trip?.title} — <span className="text-[#7a1c24]">{sourceInfo.label}</span>
                  </p>
                  <div className="flex flex-wrap justify-center gap-3 text-xs md:text-sm text-gray-800 pt-1">
                    <span>📅 التاريخ: <strong>{printBusState.trip?.event_date || printBusState.trip?.trip_date || '—'}</strong></span>
                    {(printBusState.trip?.event_time || printBusState.trip?.departure_time) && (
                      <span>⏰ التحرك: <strong>{printBusState.trip?.event_time || printBusState.trip?.departure_time}</strong></span>
                    )}
                    <span>💰 الاشتراك: <strong>{tripCost} ج.م</strong></span>
                    <span>💺 المحجوز: <strong>{booked}/{busSeats.length}</strong></span>
                    <span>💵 المحصل: <strong>{busPaid} ج.م</strong></span>
                    <span>⚠️ المتبقي: <strong>{busRem} ج.م</strong></span>
                  </div>
                </div>

                <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-3 flex justify-between items-center text-sm font-black text-amber-950">
                  <span>🎖️ مشرف الأتوبيس: {bus.supervisor_name || '............................................'}</span>
                  <span>ذهاب ☐ &nbsp;&nbsp; عودة ☐</span>
                </div>

                <table className="w-full border-collapse border border-gray-400 text-xs md:text-sm text-right">
                  <thead>
                    <tr className="bg-gray-100 text-gray-900">
                      <th className="border border-gray-400 p-1.5 w-14 text-center">كرسي</th>
                      <th className="border border-gray-400 p-1.5 w-36">الموقع</th>
                      <th className="border border-gray-400 p-1.5">الاسم والانتماء</th>
                      <th className="border border-gray-400 p-1.5 w-28">التليفون</th>
                      <th className="border border-gray-400 p-1.5 w-36">الدفع / المتبقي</th>
                      <th className="border border-gray-400 p-1.5 w-28 text-center">الحضور</th>
                    </tr>
                  </thead>
                  <tbody>
                    {busSeats.map(seat => {
                      const fin = seat.occupant ? getSeatFinancials(seat, tripCost) : null;
                      const methods = fin?.payments?.length ? [...new Set(fin.payments.map(p => p.method))].join('+') : '';
                      return (
                        <tr key={seat.id} className={seat.occupant ? 'bg-white' : 'bg-gray-50/50'}>
                          <td className="border border-gray-400 p-1.5 text-center font-black">{seat.number}</td>
                          <td className="border border-gray-400 p-1.5 text-gray-700 text-xs">{getSeatPositionLabel(seat)}</td>
                          <td className={`border border-gray-400 p-1.5 font-bold ${seat.occupant ? 'text-gray-900' : 'text-gray-400'}`}>
                            {seat.occupant ? (
                              <>
                                {seat.occupant}{' '}
                                <span className="text-[11px] font-normal text-gray-600">
                                  ({seat.is_member_in_meeting === false ? 'خارج الاجتماع' : seat.meeting_label || 'داخل الاجتماع'})
                                </span>
                              </>
                            ) : '— متاح —'}
                          </td>
                          <td className="border border-gray-400 p-1.5 text-xs">{seat.phone || '—'}</td>
                          <td className="border border-gray-400 p-1.5 text-xs font-bold">
                            {seat.occupant ? (
                              fin.remaining > 0
                                ? <span className="text-red-700">دفع {fin.paid} {methods && `(${methods})`} • باقي {fin.remaining}ج</span>
                                : <span className="text-emerald-800">خالص {fin.paid}ج {methods && `(${methods})`} ✅</span>
                            ) : '—'}
                          </td>
                          <td className="border border-gray-400 p-1.5 text-center text-xs">ذهاب ☐ &nbsp; عودة ☐</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default PrintBusModal;