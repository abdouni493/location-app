
import React, { useState, useMemo } from 'react';
import { Language, Expense, Maintenance, Vehicle } from '../types';
import { supabase } from '../lib/supabase';
import GradientButton from '../components/GradientButton';

interface ExpensesPageProps { 
  lang: Language; 
  initialExpenses: Expense[];
  initialMaintenances: Maintenance[];
  initialVehicles: Vehicle[];
  onUpdate: () => void;
}

const ExpensesPage: React.FC<ExpensesPageProps> = ({ lang, initialExpenses, initialMaintenances, initialVehicles, onUpdate }) => {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [maintenances, setMaintenances] = useState<Maintenance[]>(initialMaintenances);
  const [activeTab, setActiveTab] = useState<'store' | 'vehicle'>('store');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [maintenanceType, setMaintenanceType] = useState<string>('vidange');
  const [vehicleFilter, setVehicleFilter] = useState<string>('');

  const isRtl = lang === 'ar';

  const t = {
    fr: {
      storeTitle: 'Dépenses du Magasin',
      vehicleTitle: 'Entretien & Frais Véhicules',
      addExpense: 'Nouvelle Dépense',
      addMaintenance: 'Nouvel Entretien',
      expenseName: 'Nom de la dépense',
      cost: 'Coût',
      date: 'Date',
      expiryDate: 'Date d\'expiration',
      vehicle: 'Véhicule',
      type: 'Type',
      note: 'Note (optionnel)',
      save: 'Enregistrer',
      cancel: 'Annuler',
      edit: 'Modifier',
      delete: 'Supprimer',
      currency: 'DZ',
      vidange: 'Vidange',
      assurance: 'Assurance',
      ct: 'Contrôle Technique',
      other: 'Autre',
      confirmDelete: 'Voulez-vous supprimer cette entrée ?'
    },
    ar: {
      storeTitle: 'مصاريف المحل',
      vehicleTitle: 'صيانة ومصاريف السيارات',
      addExpense: 'مصروف جديد',
      addMaintenance: 'صيانة جديدة',
      expenseName: 'اسم المصروف',
      cost: 'التكلفة',
      date: 'التاريخ',
      expiryDate: 'تاريخ الانتهاء',
      vehicle: 'المركبة',
      type: 'النوع',
      note: 'ملاحظة (اختياري)',
      save: 'حفظ',
      cancel: 'إلغاء',
      edit: 'تعديل',
      delete: 'حذف',
      currency: 'دج',
      vidange: 'تغيير الزيت',
      assurance: 'التأمين',
      ct: 'الفحص التقني',
      other: 'أخرى',
      confirmDelete: 'هل أنت متأكد من الحذف؟'
    }
  };

  const currentT = t[lang];

  const handleOpenForm = (item: any = null) => {
    setEditingItem(item);
    setMaintenanceType(item?.type || 'vidange');
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingItem(null);
  };

  const handleDelete = async (id: string, tab: 'store' | 'vehicle') => {
    if (confirm(currentT.confirmDelete)) {
      try {
        const tableName = tab === 'store' ? 'expenses' : 'maintenance';
        const { error } = await supabase.from(tableName).delete().eq('id', id);
        
        if (!error) {
          if (tab === 'store') {
            setExpenses(expenses.filter(e => e.id !== id));
          } else {
            setMaintenances(maintenances.filter(m => m.id !== id));
          }
          onUpdate();
        } else {
          console.error('Error deleting:', error);
        }
      } catch (err) {
        console.error('Error deleting item:', err);
      }
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      if (activeTab === 'store') {
        const expenseData = {
          name: data.name as string,
          cost: Number(data.cost),
          date: data.date as string
        };

        if (editingItem?.id) {
          const { error } = await supabase
            .from('expenses')
            .update(expenseData)
            .eq('id', editingItem.id);
          
          if (!error) {
            setExpenses(expenses.map(exp => exp.id === editingItem.id ? { ...exp, ...expenseData } : exp));
          }
        } else {
          const { data: newExpense, error } = await supabase
            .from('expenses')
            .insert([expenseData])
            .select()
            .single();
          
          if (!error && newExpense) {
            setExpenses([...expenses, newExpense]);
          }
        }
      } else {
        const type = data.type as any;
        const maintenanceData = {
          vehicle_id: data.vehicleId as string,
          type: type,
          name: type === 'other' ? (data.name as string) : (currentT[type as keyof typeof currentT] as string),
          cost: Number(data.cost),
          date: data.date as string,
          expiry_date: type !== 'other' ? (data.expiryDate as string) : null,
          note: data.note as string
        };

        if (editingItem?.id) {
          const { error } = await supabase
            .from('maintenance')
            .update(maintenanceData)
            .eq('id', editingItem.id);
          
          if (!error) {
            setMaintenances(maintenances.map(m => m.id === editingItem.id ? { ...m, ...maintenanceData } : m));
          }
        } else {
          const { data: newMaintenance, error } = await supabase
            .from('maintenance')
            .insert([maintenanceData])
            .select()
            .single();
          
          if (!error && newMaintenance) {
            setMaintenances([...maintenances, newMaintenance]);
          }
        }
      }
      
      handleCloseForm();
      onUpdate();
    } catch (err) {
      console.error('Error saving:', err);
    }
  };

  const filteredMaintenances = useMemo(() => {
    if (!vehicleFilter || vehicleFilter.trim() === '') return maintenances;
    const q = vehicleFilter.toLowerCase();
    const matchedVehicleIds = initialVehicles
      .filter(v => {
        const name = `${v.brand} ${v.model}`.toLowerCase();
        const plate = (v.immatriculation || '').toLowerCase();
        const chassis = ((v as any).chassisNumber || '').toLowerCase();
        return name.includes(q) || plate.includes(q) || chassis.includes(q);
      })
      .map(v => v.id);
    return maintenances.filter(m => matchedVehicleIds.includes(m.vehicleId));
  }, [vehicleFilter, maintenances, initialVehicles]);

  const totalForVehicle = useMemo(() => filteredMaintenances.reduce((s, m) => s + (m.cost || 0), 0), [filteredMaintenances]);

  return (
    <div className={`p-8 ${isRtl ? 'font-arabic text-right' : ''}`}>
      <div className="flex gap-4 mb-12">
        <button onClick={() => setActiveTab('store')} className={`px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${activeTab === 'store' ? 'bg-blue-600 text-white shadow-xl' : 'bg-white text-gray-400 border border-gray-100'}`}>
          🏪 {currentT.storeTitle}
        </button>
        <button onClick={() => setActiveTab('vehicle')} className={`px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${activeTab === 'vehicle' ? 'bg-blue-600 text-white shadow-xl' : 'bg-white text-gray-400 border border-gray-100'}`}>
          🚗 {currentT.vehicleTitle}
        </button>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-4xl font-black text-gray-900">{activeTab === 'store' ? currentT.storeTitle : currentT.vehicleTitle}</h1>
        <GradientButton onClick={() => handleOpenForm()}>
          {activeTab === 'store' ? currentT.addExpense : currentT.addMaintenance}
        </GradientButton>
      </div>

      {activeTab === 'vehicle' && (
        <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <input
            type="text"
            placeholder="Rechercher véhicule (marque, modèle ou immatriculation)"
            value={vehicleFilter}
            onChange={e => setVehicleFilter(e.target.value)}
            className="w-full md:w-2/3 px-6 py-4 rounded-2xl bg-white border border-gray-100 outline-none font-bold"
          />

          <div className="w-full md:w-auto bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Total Dépenses</p>
            <p className="text-2xl font-black text-gray-900">{totalForVehicle.toLocaleString()} <span className="text-sm font-bold opacity-40">{currentT.currency}</span></p>
            <p className="text-xs text-gray-500 mt-1">Affiché: {filteredMaintenances.length} entrée(s)</p>
          </div>
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl p-10 overflow-y-auto max-h-[95vh]">
            <h2 className="text-2xl font-black text-gray-900 mb-8">{editingItem ? currentT.edit : (activeTab === 'store' ? currentT.addExpense : currentT.addMaintenance)}</h2>
            <form className="space-y-6" onSubmit={handleSave}>
              {activeTab === 'store' ? (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{currentT.expenseName}</label>
                    <input name="name" type="text" defaultValue={editingItem?.name} required className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none font-bold" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{currentT.cost}</label>
                      <input name="cost" type="number" defaultValue={editingItem?.cost} required className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none font-bold" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{currentT.date}</label>
                      <input name="date" type="date" defaultValue={editingItem?.date} required className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none font-bold" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{currentT.vehicle}</label>
                    <select name="vehicleId" defaultValue={editingItem?.vehicleId} className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none font-bold">
                      {initialVehicles.map(v => <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.immatriculation})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{currentT.type}</label>
                    <select name="type" defaultValue={maintenanceType} onChange={(e) => setMaintenanceType(e.target.value)} className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none font-bold">
                      <option value="vidange">{currentT.vidange}</option>
                      <option value="assurance">{currentT.assurance}</option>
                      <option value="ct">{currentT.ct}</option>
                      <option value="other">{currentT.other}</option>
                    </select>
                  </div>
                  {maintenanceType === 'other' ? (
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{currentT.expenseName}</label>
                      <input name="name" type="text" defaultValue={editingItem?.name} required className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none font-bold" />
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{currentT.cost}</label>
                      <input name="cost" type="number" defaultValue={editingItem?.cost} required className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none font-bold" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{currentT.date}</label>
                      <input name="date" type="date" defaultValue={editingItem?.date} required className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none font-bold" />
                    </div>
                  </div>
                  {maintenanceType !== 'other' && (
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{currentT.expiryDate}</label>
                      <input name="expiryDate" type="date" defaultValue={editingItem?.expiryDate} required className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none font-bold" />
                    </div>
                  )}
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{currentT.note}</label>
                    <textarea name="note" defaultValue={editingItem?.note} className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none font-bold h-24"></textarea>
                  </div>
                </>
              )}
              <div className="flex justify-end gap-4 pt-4">
                <button type="button" onClick={handleCloseForm} className="px-8 py-4 font-black text-gray-400 uppercase tracking-widest">{currentT.cancel}</button>
                <GradientButton type="submit">{currentT.save}</GradientButton>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {activeTab === 'store' ? (
          expenses.map(exp => (
            <div key={exp.id} className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm hover:shadow-xl transition-all group">
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner">💰</div>
                <div className="text-right">
                  <p className="text-2xl font-black text-gray-900">{exp.cost.toLocaleString()} <span className="text-sm font-bold opacity-40">{currentT.currency}</span></p>
                  <p className="text-xs font-bold text-gray-400">{exp.date}</p>
                </div>
              </div>
              <h3 className="text-lg font-black text-gray-800 mb-6">{exp.name}</h3>
              <div className="flex gap-4">
                <button onClick={() => handleOpenForm(exp)} className="flex-1 py-3 bg-gray-50 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all">✏️ {currentT.edit}</button>
                <button onClick={() => handleDelete(exp.id, 'store')} className="flex-1 py-3 bg-gray-50 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all">🗑️ {currentT.delete}</button>
              </div>
            </div>
          ))
        ) : (
          filteredMaintenances.map(m => {
            const v = initialVehicles.find(veh => veh.id === m.vehicleId);
            return (
              <div key={m.id} className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm hover:shadow-xl transition-all group">
                <div className="flex justify-between items-start mb-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${m.type === 'vidange' ? 'bg-orange-50 text-orange-600' : m.type === 'assurance' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                    {m.type === 'vidange' ? '🛢️' : m.type === 'assurance' ? '🛡️' : '🛠️'}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-gray-900">{m.cost.toLocaleString()} <span className="text-sm font-bold opacity-40">{currentT.currency}</span></p>
                    <p className="text-xs font-bold text-gray-400">{m.date}</p>
                  </div>
                </div>
                <h3 className="text-lg font-black text-gray-800 mb-2">{m.name}</h3>
                <p className="text-blue-600 font-bold uppercase text-[10px] tracking-widest mb-4">🚗 {v?.brand} {v?.model}</p>
                {m.expiryDate && <p className="text-[10px] font-black text-red-600 uppercase mb-4">⌛ Exp: {m.expiryDate}</p>}
                <div className="flex gap-4">
                  <button onClick={() => handleOpenForm(m)} className="flex-1 py-3 bg-gray-50 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all">✏️ {currentT.edit}</button>
                  <button onClick={() => handleDelete(m.id, 'vehicle')} className="flex-1 py-3 bg-gray-50 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all">🗑️ {currentT.delete}</button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ExpensesPage;
