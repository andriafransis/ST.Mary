import { useState } from 'react';
import { GitBranch, Users, Phone, ChevronDown, ChevronUp, User, ArrowDown } from 'lucide-react';

export default function FamilyTree({ users = [] }) {
  const [expandedFamily, setExpandedFamily] = useState(null);

  // هيكلة البيانات لعائلات مبنية على الاسم الرباعي والترتيب الهرمي
  const familiesMap = {};

  users.forEach((user, index) => {
    const fName = (user.first_name || '').trim();
    const sName = (user.second_name || '').trim();
    const tName = (user.third_name || '').trim();
    const lName = (user.fourth_name || '').trim();

    let parts = [fName, sName, tName, lName].filter(Boolean);
    if (parts.length < 4 && user.full_name) {
      parts = user.full_name.trim().split(/\s+/);
    }

    if (parts.length >= 4) {
      const firstName = parts[0];   // الابن / الحفيد (القاع)
      const secondName = parts[1];  // الأب
      const thirdName = parts[2];   // الجد (فرع فرانسيس مثلاً)
      const fourthName = parts[3];  // الجد الأكبر / رأس العائلة (جاد)

      if (!familiesMap[fourthName]) {
        familiesMap[fourthName] = {
          familyName: fourthName,
          branches: {}
        };
      }

      if (!familiesMap[fourthName].branches[thirdName]) {
        familiesMap[fourthName].branches[thirdName] = {};
      }

      if (!familiesMap[fourthName].branches[thirdName][secondName]) {
        familiesMap[fourthName].branches[thirdName][secondName] = [];
      }

      familiesMap[fourthName].branches[thirdName][secondName].push({
        ...user,
        displayName: firstName,
        serialNumber: index + 1
      });
    }
  });

  const familiesList = Object.values(familiesMap);

  return (
    <div className="space-y-6" dir="rtl">
      {/* هيدر الصفحة */}
      <div className="bg-white p-5 rounded-3xl border shadow-sm flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-lg font-black text-[#7a1c24] flex items-center gap-2">
            <GitBranch size={22} /> الهيكل التنظيمي الشجري المتسلسل (Organization Chart)
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            رأس العائلة في الأعلى، وتتفرع منها الفروع (مثل فرانسيس) ثم الأبناء والأحفاد في خطوط شجرية متصلة.
          </p>
        </div>
        <div className="px-3 py-1.5 bg-amber-50 text-amber-900 rounded-xl text-xs font-bold border border-amber-200">
          إجمالي المسجلين: {users.length} فرد
        </div>
      </div>

      {/* عرض شجرات العائلات */}
      {familiesList.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border text-center text-gray-400 text-xs">
          لا توجد بيانات بأسماء رباعية مسجلة في الداتابيز لتكوين الهيكل الشجري. تأكد من إدخال الاسم الرباعي للمخدومين.
        </div>
      ) : (
        <div className="space-y-6">
          {familiesList.map((fam, idx) => {
            const isExpanded = expandedFamily === fam.familyName;
            const totalMembers = Object.values(fam.branches)
              .flatMap(branch => Object.values(branch))
              .flat().length;

            return (
              <div key={idx} className="bg-white rounded-3xl border-2 border-gray-200 overflow-hidden shadow-sm transition">
                
                {/* كارت رأس العائلة الأساسي (مثل عائلة جاد) */}
                <div 
                  onClick={() => setExpandedFamily(isExpanded ? null : fam.familyName)}
                  className="p-5 bg-gradient-to-l from-red-50/70 to-amber-50/70 cursor-pointer flex justify-between items-center transition hover:bg-red-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-[#7a1c24] text-white rounded-2xl shadow">
                      <Users size={22} />
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold text-[#7a1c24] block">رأس الشجرة (العائلة الكبرى)</span>
                      <h3 className="text-lg font-black text-gray-900">عائلة {fam.familyName}</h3>
                      <span className="text-xs text-gray-600 font-bold">{totalMembers} فرداً في الهيكل</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#7a1c24] bg-white px-3 py-1.5 rounded-xl border shadow-2xs">
                      {isExpanded ? 'إخفاء الشجرة الهرمية' : 'عرض الهيكل التنظيمي'}
                    </span>
                    <div className="p-2 bg-white rounded-xl border text-gray-700 shadow-2xs">
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                </div>

                {/* الهيكل التنظيمي الشجري المتصل عند فتح العائلة */}
                {isExpanded && (
                  <div className="p-8 space-y-8 bg-[#fbfaf7] border-t border-gray-200 animate-fadeIn">
                    
                    {/* المستوى الأول: رأس الشجرة في القمة */}
                    <div className="flex flex-col items-center">
                      <div className="bg-[#7a1c24] text-white px-8 py-4 rounded-2xl shadow-md text-center min-w-[240px] border-2 border-amber-300">
                        <span className="text-[10px] text-amber-200 block font-bold">الجد الأكبر (رأس الهيكل)</span>
                        <h4 className="text-lg font-black">عائلة {fam.familyName}</h4>
                      </div>
                      <div className="w-0.5 h-8 bg-[#7a1c24]"></div>
                      <ArrowDown size={16} className="text-[#7a1c24] -mt-2" />
                    </div>

                    {/* المستوى الثاني: الفروع المتفرعة (مثل بند فرانسيس وغيره) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {Object.entries(fam.branches).map(([thirdName, secondBranch], bIdx) => (
                        <div key={bIdx} className="bg-white rounded-2xl border-2 border-[#7a1c24]/30 p-4 shadow-sm space-y-4 relative">
                          
                          {/* كارت الفرع (مثل فرانسيس) */}
                          <div className="bg-red-50 p-3 rounded-xl border border-[#7a1c24] text-center">
                            <span className="text-[9px] text-gray-500 block font-bold">بند / فرع</span>
                            <strong className="text-sm font-black text-[#7a1c24]">{thirdName}</strong>
                          </div>

                          <div className="w-0.5 h-4 bg-gray-400 mx-auto"></div>

                          {/* المستوى الثالث والرابع: الأبناء والأحفاد (مثل أندريا وأولاده) */}
                          <div className="space-y-3">
                            {Object.entries(secondBranch).map(([fatherName, children], sIdx) => (
                              <div key={sIdx} className="bg-[#fbfaf7] p-3 rounded-xl border border-gray-200 space-y-2 shadow-2xs">
                                
                                <div className="text-xs font-black text-gray-800 border-b pb-1.5 flex justify-between items-center">
                                  <span className="flex items-center gap-1 text-[#7a1c24]">
                                    <User size={13} /> أبناء: {fatherName}
                                  </span>
                                  <span className="text-[9px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold">
                                    {children.length} أبناء
                                  </span>
                                </div>

                                <div className="space-y-1.5">
                                  {children.map((child, cIdx) => (
                                    <div key={cIdx} className="p-2.5 bg-white rounded-lg border border-gray-200 flex justify-between items-center text-xs shadow-3xs">
                                      <div>
                                        <div className="flex items-center gap-1.5">
                                          <span className="px-1.5 py-0.5 bg-[#7a1c24] text-white rounded text-[9px] font-black">
                                            #{child.serialNumber}
                                          </span>
                                          <strong className="text-gray-900">{child.displayName}</strong>
                                        </div>
                                        <span className="text-[10px] text-gray-500 block mt-0.5">
                                          ({child.detailed_stage || child.service_stage || child.role})
                                        </span>
                                      </div>
                                      {child.phone && (
                                        <span className="text-[10px] bg-gray-50 px-2 py-1 rounded border text-gray-700 font-bold flex items-center gap-1">
                                          <Phone size={10} className="text-[#7a1c24]" /> {child.phone}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>

                              </div>
                            ))}
                          </div>

                        </div>
                      ))}
                    </div>

                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}