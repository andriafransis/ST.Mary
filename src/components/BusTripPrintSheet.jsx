import { Printer, X } from 'lucide-react';
import {
  normalizeBuses,
  getSeatFinancialInfo,
  buildBusFinancialSummary
} from './BusBookingAndTripsManager';

export default function BusTripPrintSheet({ printPayload, setPrintPayload, currentUser, todayISO }) {
  if (!printPayload?.trip) return null;

  const { trip, buses: rawBuses } = printPayload;
  const buses = normalizeBuses(rawBuses);
  const tripCost = Number(trip.cost_per_person || 0);
  const overallFin = buildBusFinancialSummary(buses, tripCost);

  const isGeneralOffice =
    trip.origin_mode === 'general_office' ||
    (!trip.target_service || trip.target_service === 'مكتب الرحلات العام');
  const originLabel = isGeneralOffice
    ? 'مكتب الرحلات العام'
    : `خدمة: ${trip.target_service}`;

  const triggerPrint = () => {
    setTimeout(() => {
      window.print();
    }, 100);
  };

  return (
    <>
      {/* معاينة قبل الطباعة تظهر على الشاشة فقط وتختفي في الورق */}
      <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-55 print:hidden" dir="rtl">
        <div className="bg-white rounded-3xl w-full max-w-4xl p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto text-xs">
          <div className="flex justify-between items-center border-b pb-3">
            <div>
              <h3 className="text-base font-black text-[#7a1c24]">🖨️ معاينة طباعة كشف الرحلة والأتوبيسات</h3>
              <p className="text-[11px] text-gray-500">
                الرحلة: <strong>{trip.title}</strong> • المصدر: <strong>{originLabel}</strong>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={triggerPrint}
                className="px-4 py-2 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={15} /> طباعة الآن
              </button>
              <button
                type="button"
                onClick={() => setPrintPayload(null)}
                className="p-2 bg-gray-100 rounded-xl cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-black">
            <div className="p-3 rounded-2xl bg-gray-50 border">المحجوز: {overallFin.bookedCount} مقعد</div>
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900">دفع كل حاجة: {overallFin.paidAllCount}</div>
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900">عليه فلوس: {overallFin.hasDueCount}</div>
            <div className="p-3 rounded-2xl bg-sky-50 border border-sky-200 text-sky-900">معاهوش / معفى: {overallFin.exemptCount}</div>
          </div>

          <p className="text-[11px] text-gray-600">
            عند الضغط على «طباعة الآن» سيخرج كل أتوبيس بكشف الركاب، رقم المقعد، المشرف، والحالة المالية (المحصل والمتبقي) ومصدر الرحلة.
          </p>
        </div>
      </div>

      {/* النسخة المخصصة للطباعة الفعلية */}
      <div className="hidden print:block w-full text-black space-y-6" dir="rtl">
        <style>{`
          @media print {
            @page {
              size: portrait;
              margin: 10mm;
            }
            .bus-print-page {
              page-break-after: always;
              break-after: page;
            }
            .bus-print-page:last-child {
              page-break-after: auto;
              break-after: auto;
            }
          }
        `}</style>

        {buses.map((bus, bIdx) => {
          const bookedSeats = (bus.seats || []).filter(s => s.occupant);
          const busFin = buildBusFinancialSummary([bus], tripCost);

          return (
            <div key={bus.id || bIdx} className="bus-print-page w-full space-y-3">
              <div className="border-b-2 border-black pb-2 text-center space-y-1">
                <h2 className="text-base font-black">
                  {trip.title} — {bus.name}
                </h2>
                <p className="text-[11px] font-bold">
                  المصدر: {originLabel} • التاريخ: {trip.trip_date || '—'} • التكلفة للفرد: {tripCost} ج.م • تاريخ الطباعة: {todayISO}
                </p>
                <p className="text-[11px]">
                  المشرف على الأتوبيس: <strong>{bus.supervisor_name || '—'}</strong>
                  {bus.supervisor_phone ? ` (${bus.supervisor_phone})` : ''}
                  {trip.supervisors ? ` • مشرفو الرحلة: ${trip.supervisors}` : ''}
                </p>
              </div>

              <div className="flex flex-wrap justify-between text-[10px] font-bold border border-black px-3 py-1.5 bg-gray-100">
                <span>عدد الركاب: {busFin.bookedCount}</span>
                <span>دفع كل حاجة: {busFin.paidAllCount}</span>
                <span>عليه فلوس: {busFin.hasDueCount}</span>
                <span>معاهوش / معفى: {busFin.exemptCount}</span>
                <span>المحصل: {busFin.totalPaid} ج.م</span>
                <span>المتبقي: {busFin.totalRemaining} ج.م</span>
              </div>

              <table className="w-full border-collapse border border-black text-[10px]">
                <thead>
                  <tr className="bg-gray-200 font-black">
                    <th className="border border-black p-1.5 text-center w-10">م</th>
                    <th className="border border-black p-1.5 text-center w-16">المقعد</th>
                    <th className="border border-black p-1.5 text-right">اسم الراكب</th>
                    <th className="border border-black p-1.5 text-center">الموبايل</th>
                    <th className="border border-black p-1.5 text-center">الحالة المالية</th>
                    <th className="border border-black p-1.5 text-center">المدفوع</th>
                    <th className="border border-black p-1.5 text-center">المتبقي</th>
                    <th className="border border-black p-1.5 text-right">ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {bookedSeats.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="border border-black p-3 text-center">
                        لا يوجد ركاب مسجلون على هذا الأتوبيس بعد.
                      </td>
                    </tr>
                  ) : (
                    bookedSeats.map((seat, idx) => {
                      const fin = getSeatFinancialInfo(seat, tripCost);
                      return (
                        <tr key={seat.id || idx} className="break-inside-avoid">
                          <td className="border border-black p-1.5 text-center font-bold">{idx + 1}</td>
                          <td className="border border-black p-1.5 text-center font-black">{seat.code}</td>
                          <td className="border border-black p-1.5 font-bold">{seat.occupant.passenger_name}</td>
                          <td className="border border-black p-1.5 text-center">{seat.occupant.passenger_phone || '—'}</td>
                          <td className="border border-black p-1.5 text-center font-bold">{fin.label}</td>
                          <td className="border border-black p-1.5 text-center">{fin.paid} ج.م</td>
                          <td className="border border-black p-1.5 text-center">{fin.remaining} ج.م</td>
                          <td className="border border-black p-1.5">{seat.occupant.notes || ''}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              {(trip.daily_program || trip.monasteries) && (
                <div className="border border-black p-2.5 text-[10px] space-y-1 break-inside-avoid">
                  {trip.monasteries && <div><strong>الأماكن والمزارات:</strong> {trip.monasteries}</div>}
                  {trip.daily_program && <div className="whitespace-pre-line"><strong>البرنامج:</strong> {trip.daily_program}</div>}
                  <div className="text-gray-700 pt-1">طُبع بواسطة: {currentUser?.full_name || 'مسؤول الرحلات'}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}