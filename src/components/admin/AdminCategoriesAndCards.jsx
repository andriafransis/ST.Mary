import { useState } from 'react';
import { FolderEdit, Sparkles, Edit3, Trash2 } from 'lucide-react';

export function AdminCategoriesSection({
  caseCategories = [],
  isAdmin,
  requireAdminGuard,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory
}) {
  const [catForm, setCatForm] = useState({ name: '', icon: '📂' });
  const [editingCat, setEditingCat] = useState(null);

  return (
    <div className="space-y-3 text-xs">
      {isAdmin && (
        <form
          onSubmit={e => {
            e.preventDefault();
            if (requireAdminGuard && !requireAdminGuard()) return;
            if (editingCat) {
              onUpdateCategory(editingCat.id, editingCat.name, catForm.name, catForm.icon);
              setEditingCat(null);
            } else {
              onAddCategory(catForm);
            }
            setCatForm({ name: '', icon: '📂' });
          }}
          className="bg-white p-4 rounded-2xl border space-y-2.5 font-bold shadow-2xs"
        >
          <h3 className="text-sm font-extrabold flex items-center gap-1 text-[#7a1c24]">
            <FolderEdit size={15} /> {editingCat ? `تعديل اسم كارت (${editingCat.name})` : 'تعديل وإضافة أسماء كروت تصنيفات الأسر'}
          </h3>
          <div className="grid md:grid-cols-3 gap-2">
            <input required placeholder="اسم الكارت / التصنيف *" className="p-2 border rounded-xl" value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} />
            <input placeholder="الأيقونة (🕊️ أو ❤️)" className="p-2 border rounded-xl" value={catForm.icon} onChange={e => setCatForm({ ...catForm, icon: e.target.value })} />
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-[#7a1c24] text-white rounded-xl p-2 cursor-pointer">{editingCat ? 'حفظ التعديل' : 'إضافة التصنيف'}</button>
              {editingCat && <button type="button" onClick={() => { setEditingCat(null); setCatForm({ name: '', icon: '📂' }); }} className="px-3 border rounded-xl">إلغاء</button>}
            </div>
          </div>
        </form>
      )}

      <div className="max-h-[45dvh] overflow-y-auto pr-1 grid sm:grid-cols-2 md:grid-cols-4 gap-2.5">
        {caseCategories.map(cat => (
          <div key={cat.id} className="bg-white p-3.5 rounded-2xl border flex justify-between items-center shadow-2xs">
            <div><span className="text-xl ml-2">{cat.icon}</span><strong className="text-sm">{cat.name}</strong></div>
            {isAdmin && (
              <div className="flex gap-1">
                <button onClick={() => { setEditingCat(cat); setCatForm({ name: cat.name, icon: cat.icon }); }} className="p-1.5 bg-gray-100 rounded-lg cursor-pointer"><Edit3 size={12} /></button>
                <button onClick={() => onDeleteCategory(cat.id)} className="p-1.5 bg-red-50 text-red-700 rounded-lg cursor-pointer"><Trash2 size={12} /></button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminPriestCustomCardsSection({
  customCards = [],
  priestsList = [],
  isAdmin,
  requireAdminGuard,
  onAddCustomCard,
  onDeleteCustomCard
}) {
  const [cardForm, setCardForm] = useState({ priest_id: '', card_title: '', card_icon: '📌', description: '' });

  return (
    <div className="space-y-3 text-xs">
      {isAdmin && (
        <form
          onSubmit={e => {
            e.preventDefault();
            if (requireAdminGuard && !requireAdminGuard()) return;
            onAddCustomCard({ ...cardForm, priest_id: cardForm.priest_id || null });
            setCardForm({ priest_id: '', card_title: '', card_icon: '📌', description: '' });
          }}
          className="bg-white p-4 rounded-2xl border space-y-2.5 font-bold shadow-2xs"
        >
          <h3 className="text-sm font-extrabold flex items-center gap-1 text-[#7a1c24]">
            <Sparkles size={15} /> إنشاء كارت جديد في صفحة الأب الكاهن
          </h3>
          <div className="grid md:grid-cols-4 gap-2">
            <select className="p-2 border rounded-xl" value={cardForm.priest_id} onChange={e => setCardForm({ ...cardForm, priest_id: e.target.value })}>
              <option value="">لكل الآباء الكهنة</option>
              {priestsList.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
            <input required placeholder="عنوان الكارت (مثال: الرحلات / المعموديات) *" className="p-2 border rounded-xl" value={cardForm.card_title} onChange={e => setCardForm({ ...cardForm, card_title: e.target.value })} />
            <input placeholder="الأيقونة (📌)" className="p-2 border rounded-xl" value={cardForm.card_icon} onChange={e => setCardForm({ ...cardForm, card_icon: e.target.value })} />
            <button type="submit" className="bg-[#7a1c24] text-white rounded-xl p-2 cursor-pointer">إنشاء الكارت</button>
          </div>
          <input placeholder="وصف مختصر للكارت..." className="w-full p-2 border rounded-xl" value={cardForm.description} onChange={e => setCardForm({ ...cardForm, description: e.target.value })} />
        </form>
      )}

      <div className="max-h-[45dvh] overflow-y-auto pr-1 grid md:grid-cols-2 gap-2.5">
        {customCards.map(cc => {
          const targetPriest = priestsList.find(p => p.id === cc.priest_id);
          return (
            <div key={cc.id} className="bg-white p-3.5 rounded-2xl border flex justify-between items-center shadow-2xs">
              <div>
                <span className="text-xl ml-2">{cc.card_icon}</span>
                <strong className="text-sm">{cc.card_title}</strong>
                <span className="mr-2 px-2 py-0.5 bg-amber-50 text-amber-900 rounded text-[10px] font-bold">{targetPriest ? targetPriest.full_name : 'لكل الكهنة'}</span>
                <p className="text-gray-500 mt-0.5">{cc.description}</p>
              </div>
              {isAdmin && (
                <button onClick={() => onDeleteCustomCard(cc.id)} className="p-2 bg-red-50 text-red-700 rounded-xl cursor-pointer"><Trash2 size={13} /></button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}