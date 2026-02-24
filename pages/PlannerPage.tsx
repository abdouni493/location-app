
import React, { useState, useMemo, useRef } from 'react';
import { 
  Language, Reservation, ReservationStatus, Customer, Vehicle, 
  RentalOption, Worker, Agency, LocationLog 
} from '../types';
import { ALGERIAN_WILAYAS } from '../constants';
import { supabase } from '../lib/supabase';
import GradientButton from '../components/GradientButton';
import DocumentPersonalizer from '../components/DocumentPersonalizer';
interface PlannerPageProps { 
  lang: Language; 
  customers: Customer[];
  vehicles: Vehicle[];
  agencies: Agency[];
  workers: Worker[];
  reservations: Reservation[];
  onUpdateReservation: () => void;
  onAddReservation: () => void;
  onDeleteReservation: () => void;
  storeLogo?: string;
  storeInfo?: { name: string; phone: string; email: string; address: string };
  onUpdateTemplates?: (tpls: any[]) => void;
  templates?: any[];
}

type ActionModal = 'details' | 'pay' | 'activate' | 'terminate' | 'delete' | 'add-option' | 'personalize' | null;

const ModalBase: React.FC<{ title: string, children?: React.ReactNode, onClose: () => void, maxWidth?: string }> = ({ title, children, onClose, maxWidth = "max-w-4xl" }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
    <div className={`bg-white w-full ${maxWidth} rounded-[3.5rem] shadow-2xl animate-scale-in p-10 overflow-y-auto max-h-[95vh] border border-white/20`}>
      <div className="flex justify-between items-center mb-8 border-b border-gray-50 pb-6">
        <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">{title}</h2>
        <button onClick={onClose} className="w-12 h-12 flex items-center justify-center bg-gray-50 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all text-xl">✕</button>
      </div>
      {children}
    </div>
  </div>
);

const FuelSelector: React.FC<{ value: string, onChange: (v: any) => void }> = ({ value, onChange }) => (
  <div className="grid grid-cols-5 gap-2">
    {['PLEIN', '1/2', '1/4', '1/8', 'VIDE'].map(level => (
      <button
        key={level}
        type="button"
        onClick={() => onChange(level.toLowerCase())}
        className={`py-6 rounded-3xl font-black text-[10px] transition-all border-2 ${value === level.toLowerCase() ? 'bg-blue-600 border-blue-600 text-white shadow-xl scale-105' : 'bg-gray-50 border-transparent text-gray-400 hover:border-blue-200'}`}
      >
        {level}
      </button>
    ))}
  </div>
);

const PlannerPage: React.FC<PlannerPageProps> = ({ 
  lang, customers, vehicles, agencies, workers, reservations, 
  onUpdateReservation, onAddReservation, onDeleteReservation,
  storeLogo, storeInfo, onUpdateTemplates, templates = []
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [creationStep, setCreationStep] = useState(1);
  const [searchQuery, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<ReservationStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  
  
  // Creation form state
  const [formData, setFormData] = useState<Partial<Reservation> & {
    startTime: string; endTime: string; differentReturn: boolean;
    tempOptions: RentalOption[]; isWithDriver: boolean; paidAmount: number;
    discount: number; withTVA: boolean;
  }>({
    startTime: '10:00', endTime: '10:00', differentReturn: false, tempOptions: [],
    isWithDriver: false, paidAmount: 0, status: 'confermer',
    cautionAmount: 0, discount: 0, withTVA: false
  });

  const [isCreatingNewClient, setIsCreatingNewClient] = useState(false);
  const [newClientData, setNewClientData] = useState<Partial<Customer>>({
    wilaya: '16 - Alger',
    documentImages: [],
    profilePicture: 'https://via.placeholder.com/200'
  });
  const [profilePreviewNew, setProfilePreviewNew] = useState<string | null>(null);
  const [docPreviewsNew, setDocPreviewsNew] = useState<string[]>([]);
  const fileInputRefNew = useRef<HTMLInputElement | null>(null);
  const docInputRefNew = useRef<HTMLInputElement | null>(null);

  const handleImageUploadNew = (e: React.ChangeEvent<HTMLInputElement>, target: 'profile' | 'docs') => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          if (target === 'profile') setProfilePreviewNew(base64);
          else setDocPreviewsNew(prev => [...prev, base64]);
        };
        reader.readAsDataURL(file);
      });
    }
  };
  
  const [tempOptionCat, setTempOptionCat] = useState<RentalOption['category'] | null>(null);
  const [activeModal, setActiveModal] = useState<ActionModal>(null);
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null);
  const [openRowActions, setOpenRowActions] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);

  const [logData, setLogData] = useState<Partial<LocationLog>>({ fuel: 'plein', location: '' });
  const [termData, setTermData] = useState({
    mileage: 0, fuel: 'plein' as any, date: new Date().toISOString().slice(0, 16),
    location: '', notes: '', extraKmCost: 0, extraFuelCost: 0, withTva: false
  });
  const [selectedDocType, setSelectedDocType] = useState<'devis'|'contrat'|'versement'|'facture'|null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [termDocsLeft, setTermDocsLeft] = useState<{ label: string; url?: string; left: boolean }[]>([]);

  const replaceVariables = (content: string, res: Reservation) => {
    const client = customers.find(c => c.id === res.customerId);
    const vehicle = vehicles.find(v => v.id === res.vehicleId);
    return content
      .replace(/{{client_name}}/g, `${client?.firstName} ${client?.lastName}`)
      .replace(/{{client_phone}}/g, client?.phone || '')
      .replace(/{{client_email}}/g, client?.email || '')
      .replace(/{{vehicle_brand}}/g, vehicle?.brand || '')
      .replace(/{{vehicle_model}}/g, vehicle?.model || '')
      .replace(/{{vehicle_plate}}/g, vehicle?.immatriculation || '')
      .replace(/{{res_number}}/g, res.reservationNumber)
      .replace(/{{res_date}}/g, new Date(res.startDate).toLocaleDateString())
      .replace(/{{total_amount}}/g, res.totalAmount.toLocaleString())
      .replace(/{{paid_amount}}/g, res.paidAmount.toLocaleString())
      .replace(/{{remaining_amount}}/g, (res.totalAmount - res.paidAmount).toLocaleString())
      .replace(/{{store_name}}/g, storeInfo?.name || 'DriveFlow')
      .replace(/{{store_phone}}/g, storeInfo?.phone || '')
      .replace(/{{store_email}}/g, storeInfo?.email || '')
      .replace(/{{store_address}}/g, storeInfo?.address || '');
  };

  const isRtl = lang === 'ar';
  const t = {
    fr: {
      title: 'Planificateur',
      status: { all: 'Tous', confermer: 'Confirmé', 'en cours': 'En Cours', terminer: 'Terminé', annuler: 'Annulé', 'en attente': 'En Attente' }
    },
    ar: {
      title: 'المخطط',
      status: { all: 'الكل', confermer: 'مؤكد', 'en cours': 'قيد التنفيذ', terminer: 'منتهي', annuler: 'ملغي', 'en attente': 'في الانتظار' }
    }
  }[lang];

  const getVehicle = (id: string) => vehicles.find(v => v.id === id);
  const getCustomer = (id: string) => customers.find(c => c.id === id);
  
  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 1;
    const s = new Date(start); const e = new Date(end);
    const diff = e.getTime() - s.getTime();
    const d = Math.ceil(diff / (1000 * 3600 * 24));
    return d > 0 ? d : 1;
  };

  // Calculate invoice totals
  const invoice = useMemo(() => {
    const v = getVehicle(formData.vehicleId || '');
    const days = calculateDays(formData.startDate || '', formData.endDate || '');
    const baseTotal = (v?.dailyRate || 0) * days;
    const optionsTotal = formData.tempOptions.reduce((acc, o) => acc + o.price, 0);
    const subtotal = baseTotal + optionsTotal - (formData.discount || 0);
    const computedFinal = formData.withTVA ? subtotal * 1.19 : subtotal;
    const override = (formData as any).totalAmount;
    const finalTotal = typeof override === 'number' && !isNaN(override) ? override : computedFinal;
    const rest = finalTotal - (formData.paidAmount || 0);
    return { days, baseTotal, optionsTotal, subtotal, finalTotal, rest };
  }, [formData]);

  const resetForm = () => {
    setIsCreating(false);
    setCreationStep(1);
    setFormData({
      startTime: '10:00', endTime: '10:00', differentReturn: false, tempOptions: [],
      isWithDriver: false, paidAmount: 0, status: 'confermer',
      cautionAmount: 0, discount: 0, withTVA: false
    });
    setIsCreatingNewClient(false);
    setNewClientData({
      wilaya: '16 - Alger',
      documentImages: [],
      profilePicture: 'https://via.placeholder.com/200'
    });
  };

  const handleSaveReservation = async () => {
    if (!formData.customerId || !formData.vehicleId || !formData.startDate || !formData.endDate || !formData.pickupAgencyId) {
      alert('Veuillez remplir tous les champs requis');
      return;
    }

    setLoading(true);
    try {
      const resData = {
        customer_id: formData.customerId,
        vehicle_id: formData.vehicleId,
        start_date: `${formData.startDate}T${formData.startTime}`,
        end_date: `${formData.endDate}T${formData.endTime}`,
        pickup_agency_id: formData.pickupAgencyId,
        return_agency_id: formData.differentReturn ? formData.returnAgencyId : formData.pickupAgencyId,
        driver_id: formData.isWithDriver ? formData.driverId : null,
        status: 'confermer',
        total_amount: (formData as any).totalAmount ?? invoice.finalTotal,
        paid_amount: formData.paidAmount,
        caution_amount: formData.cautionAmount || 0,
        discount: formData.discount || 0,
        with_tva: formData.withTVA || false,
        options: formData.tempOptions
      };

      const { error } = await supabase.from('reservations').insert([resData]);
      if (error) throw error;

      // Update vehicle status to 'loué'
      await supabase.from('vehicles').update({ status: 'loué' }).eq('id', formData.vehicleId);

      onAddReservation();
      resetForm();
    } catch (err: any) {
      alert(`Erreur: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredReservations = useMemo(() => {
    return reservations.filter(res => {
      const c = getCustomer(res.customerId);
      const q = searchQuery.toLowerCase();
      const customerName = c ? `${c.firstName} ${c.lastName}`.toLowerCase() : '';
      const reservationNum = res.reservationNumber ? res.reservationNumber.toLowerCase() : '';
      const matchSearch = reservationNum.includes(q) || 
                          customerName.includes(q);
      const matchStatus = filterStatus === 'all' || res.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [reservations, searchQuery, filterStatus, customers]);

  const handleActivate = async () => {
    if (!selectedRes) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('reservations').update({
        status: 'en cours',
        activation_log: { ...logData, date: new Date().toISOString() }
      }).eq('id', selectedRes.id);
      
      if (error) throw error;
      
      await supabase.from('vehicles').update({ status: 'loué', mileage: logData.mileage }).eq('id', selectedRes.vehicleId);
      onUpdateReservation();
      setActiveModal(null);
    } catch (err: any) { alert(`Erreur d'activation: ${err.message}`); } finally { setLoading(false); }
  };

  const handleTerminate = async () => {
    if (!selectedRes) return;
    setLoading(true);
    try {
      const extraTotal = (termData.extraKmCost + termData.extraFuelCost) * (termData.withTva ? 1.19 : 1);
      const { error } = await supabase.from('reservations').update({
        status: 'terminer',
        termination_log: { ...termData, documentsLeft: termDocsLeft },
        total_amount: selectedRes.totalAmount + extraTotal
      }).eq('id', selectedRes.id);
      
      if (error) throw error;
      await supabase.from('vehicles').update({ status: 'disponible', mileage: termData.mileage }).eq('id', selectedRes.vehicleId);
      onUpdateReservation();
      setActiveModal(null);
    } catch (err: any) { alert(`Erreur de clôture: ${err.message}`); } finally { setLoading(false); }
  };

  const createClientAlert = async (customerId: string, reservationId: string, message: string) => {
    try {
      // try to store in a server table 'client_alerts' if available
      const { error } = await supabase.from('client_alerts').insert([{ customer_id: customerId, reservation_id: reservationId, message, read: false }]);
      if (error) throw error;
      return true;
    } catch (err) {
      // fallback to localStorage
      try {
        const key = `clientAlerts_${customerId}`;
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        existing.push({ reservationId, message, read: false, createdAt: new Date().toISOString() });
        localStorage.setItem(key, JSON.stringify(existing));
        return true;
      } catch (e) {
        console.error('Failed to save client alert:', e);
        return false;
      }
    }
  };

  const removeClientAlertsForReservation = async (customerId: string, reservationId: string) => {
    try {
      await supabase.from('client_alerts').delete().eq('customer_id', customerId).eq('reservation_id', reservationId);
    } catch (err) {
      const key = `clientAlerts_${customerId}`;
      try {
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        const filtered = existing.filter((a:any) => a.reservationId !== reservationId);
        localStorage.setItem(key, JSON.stringify(filtered));
      } catch (e) { console.error(e); }
    }
  };

  const markDocumentsTaken = async (taken: boolean) => {
    if (!selectedRes) return;
    try {
      // try to persist flag on reservation
      await supabase.from('reservations').update({ documents_taken: taken }).eq('id', selectedRes.id);
    } catch (err) {
      // ignore failure - local fallback
      const key = `reservation_docs_${selectedRes.id}`;
      localStorage.setItem(key, JSON.stringify({ taken, docs: termDocsLeft }));
    }

    if (taken) {
      // remove alerts for this reservation
      await removeClientAlertsForReservation(selectedRes.customerId, selectedRes.id);
      alert('Marqué comme récupéré.');
    } else {
      // create client alert
      await createClientAlert(selectedRes.customerId, selectedRes.id, 'Vos documents sont restés à l\'agence. Veuillez les récupérer.');
      alert('Le client sera notifié que ses documents sont toujours en agence.');
    }
  };

  const handlePayment = async () => {
    if (!selectedRes || paymentAmount <= 0) return;
    setLoading(true);
    try {
      const newPaidAmount = Number(selectedRes.paidAmount) + Number(paymentAmount);
      const { error } = await supabase.from('reservations').update({
        paid_amount: newPaidAmount
      }).eq('id', selectedRes.id);
      
      if (error) throw error;
      onUpdateReservation();
      setActiveModal(null);
    } catch (err: any) { 
      console.error("Payment Error:", err);
      alert(lang === 'fr' 
        ? `Échec du versement: ${err.message}` 
        : `فشل الدفع: ${err.message}`); 
    } finally { setLoading(false); }
  };

  const handleDeleteRes = async (id: string) => {
    if(!confirm('Supprimer ce dossier ?')) return;
    setLoading(true);
    try {
      await supabase.from('reservations').delete().eq('id', id);
      onUpdateReservation();
      setActiveModal(null);
    } catch (err) { alert("Erreur suppression"); } finally { setLoading(false); }
  };

  const handleEditReservation = (res: Reservation) => {
    // Populate the creation form with reservation data so user can edit step-by-step
    try {
      const s = new Date(res.startDate);
      const e = new Date(res.endDate);
      const startDate = s.toISOString().slice(0,10);
      const startTime = s.toISOString().slice(11,16);
      const endDate = e.toISOString().slice(0,10);
      const endTime = e.toISOString().slice(11,16);

      setFormData({
        ...formData,
        customerId: res.customerId,
        vehicleId: res.vehicleId,
        startDate,
        startTime,
        endDate,
        endTime,
        pickupAgencyId: (res as any).pickupAgencyId || (res as any).pickup_agency_id || undefined,
        returnAgencyId: (res as any).returnAgencyId || (res as any).return_agency_id || undefined,
        differentReturn: ((res as any).returnAgencyId || (res as any).return_agency_id) && ((res as any).returnAgencyId || (res as any).return_agency_id) !== ((res as any).pickupAgencyId || (res as any).pickup_agency_id),
        driverId: (res as any).driverId || (res as any).driver_id || undefined,
        isWithDriver: !!((res as any).driverId || (res as any).driver_id),
        paidAmount: (res as any).paidAmount || (res as any).paid_amount || 0,
        discount: (res as any).discount || res.discount || 0,
        withTVA: (res as any).with_tva || res.withTVA || false,
        tempOptions: (res as any).options || res.options || [],
        cautionAmount: (res as any).cautionAmount || (res as any).caution_amount || 0,
        status: res.status,
        // allow overriding total
        totalAmount: (res as any).totalAmount || (res as any).total_amount || undefined
      });

      setIsCreating(true);
      setCreationStep(1);
      setIsCreatingNewClient(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Failed to populate reservation for edit', err);
      alert('Impossible d\'ouvrir la réservation pour modification.');
    }
  };

  return (
    <div className={`p-4 md:p-12 animate-fade-in ${isRtl ? 'font-arabic text-right' : ''}`}>
      <div className="flex justify-between items-center mb-16">
        <h1 className="text-6xl font-black text-gray-900 tracking-tighter">{t.title}</h1>
        {!isCreating && (
          <GradientButton onClick={() => setIsCreating(true)} className="!py-6 !px-12 text-2xl shadow-2xl">
            + Nouveau Dossier
          </GradientButton>
        )}
        {isCreating && (
          <button onClick={resetForm} className="px-10 py-5 bg-gray-100 rounded-3xl font-black text-gray-400 hover:text-red-500 uppercase text-xs tracking-widest transition-all">Annuler</button>
        )}
      </div>

      {isCreating ? (
        <div className="max-w-6xl mx-auto">
          {/* Step Indicator */}
          <div className="flex items-center justify-between mb-12 max-w-4xl mx-auto px-4">
            {[1, 2, 3, 4, 5].map((s) => (
              <React.Fragment key={s}>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black transition-all ${creationStep >= s ? 'bg-blue-600 text-white shadow-xl' : 'bg-gray-100 text-gray-300'}`}>
                  {creationStep > s ? '✓' : s}
                </div>
                {s < 5 && <div className={`flex-1 h-1 mx-2 rounded-full transition-all ${creationStep > s ? 'bg-blue-600' : 'bg-gray-100'}`}></div>}
              </React.Fragment>
            ))}
          </div>

          <div className="bg-white rounded-[4rem] shadow-2xl border border-gray-100 p-10 md:p-16 min-h-[700px] flex flex-col relative overflow-hidden">
            {/* STEP 1: Dates & Agencies */}
            {creationStep === 1 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-fade-in">
                <div className="p-10 bg-blue-50/50 rounded-[3.5rem] border border-blue-100 space-y-8 shadow-inner">
                  <h3 className="text-sm font-black text-blue-600 uppercase tracking-[0.3em] flex items-center gap-4">🛫 DÉPART</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <input type="date" value={formData.startDate || ''} onChange={e => setFormData({...formData, startDate: e.target.value})} className="px-6 py-4 rounded-2xl font-bold bg-white shadow-sm outline-none focus:ring-2 ring-blue-300" />
                    <input type="time" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} className="px-6 py-4 rounded-2xl font-bold bg-white shadow-sm outline-none focus:ring-2 ring-blue-300" />
                  </div>
                  <select value={formData.pickupAgencyId || ''} onChange={e => setFormData({...formData, pickupAgencyId: e.target.value})} className="w-full px-6 py-4 rounded-2xl font-bold bg-white shadow-sm outline-none appearance-none cursor-pointer focus:ring-2 ring-blue-300">
                    <option value="">Sélectionner une agence de départ</option>
                    {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div className="p-10 bg-indigo-50/50 rounded-[3.5rem] border border-indigo-100 space-y-8 shadow-inner">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-black text-indigo-600 uppercase tracking-[0.3em]">🛬 RETOUR</h3>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formData.differentReturn} onChange={e => setFormData({...formData, differentReturn: e.target.checked})} className="w-6 h-6 rounded-lg text-indigo-600" />
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Agence différente</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <input type="date" value={formData.endDate || ''} onChange={e => setFormData({...formData, endDate: e.target.value})} className="px-6 py-4 rounded-2xl font-bold bg-white shadow-sm outline-none focus:ring-2 ring-indigo-300" />
                    <input type="time" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} className="px-6 py-4 rounded-2xl font-bold bg-white shadow-sm outline-none focus:ring-2 ring-indigo-300" />
                  </div>
                  {formData.differentReturn && (
                    <select value={formData.returnAgencyId || ''} onChange={e => setFormData({...formData, returnAgencyId: e.target.value})} className="w-full px-6 py-4 rounded-2xl font-bold bg-white shadow-sm outline-none appearance-none cursor-pointer focus:ring-2 ring-indigo-300">
                      <option value="">Sélectionner agence de retour</option>
                      {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: Vehicle Selection */}
            {creationStep === 2 && (
              <div className="animate-fade-in">
                <h3 className="text-2xl font-black text-gray-900 mb-10 uppercase">Sélectionnez un véhicule</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-h-[500px] overflow-y-auto pr-4">
                  {vehicles.map(v => (
                    <button key={v.id} onClick={() => setFormData({...formData, vehicleId: v.id})} className={`group p-8 rounded-[3.5rem] border-4 transition-all text-left relative overflow-hidden ${formData.vehicleId === v.id ? 'border-blue-600 bg-blue-50 shadow-2xl scale-105' : 'border-gray-50 bg-gray-50/50 hover:border-blue-200'}`}>
                      <div className="relative h-40 rounded-[2rem] overflow-hidden mb-6 shadow-xl">
                        <img src={v.mainImage} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                      </div>
                      <h4 className="text-xl font-black text-gray-900 truncate uppercase">{v.brand} {v.model}</h4>
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-2">{v.immatriculation} • {v.fuelType}</p>
                      <div className="flex justify-between items-center mt-6 pt-6 border-t border-gray-100">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Tarif/J</p>
                        <p className="text-2xl font-black text-gray-900">{v.dailyRate.toLocaleString()} <span className="text-xs opacity-40">DZ</span></p>
                      </div>
                      <div className="text-[9px] font-bold text-gray-500 mt-4 pt-4 border-t border-gray-100">
                        <p>📍 {v.currentLocation}</p>
                        <p className="mt-1">📊 {v.status}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 3: Customer Selection */}
            {creationStep === 3 && (
              <div className="animate-fade-in space-y-10">
                {!isCreatingNewClient ? (
                  <>
                    <div className="relative group max-w-2xl mx-auto">
                      <span className="absolute inset-y-0 left-8 flex items-center text-3xl opacity-20">🔍</span>
                      <input type="text" placeholder="Rechercher client..." className="w-full pl-24 pr-8 py-7 bg-gray-50 border-4 border-transparent focus:bg-white focus:border-blue-600 rounded-[3rem] outline-none font-black text-2xl transition-all shadow-inner" onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {customers.filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery)).slice(0, 6).map(c => (
                        <button key={c.id} onClick={() => setFormData({...formData, customerId: c.id})} className={`flex items-center gap-7 p-8 rounded-[3.5rem] border-2 transition-all ${formData.customerId === c.id ? 'bg-blue-600 border-blue-600 text-white shadow-2xl scale-[1.02]' : 'bg-gray-50 border-transparent hover:border-blue-400'}`}>
                          <img src={c.profilePicture} className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-xl" />
                          <div className="text-left overflow-hidden flex-1">
                            <p className={`text-xl font-black truncate ${formData.customerId === c.id ? 'text-white' : 'text-gray-900'}`}>{c.firstName} {c.lastName}</p>
                            <p className={`text-xs font-bold ${formData.customerId === c.id ? 'text-blue-100' : 'text-gray-400'}`}>📞 {c.phone}</p>
                            <p className={`text-xs font-bold mt-1 ${formData.customerId === c.id ? 'text-blue-100' : 'text-gray-500'}`}>🆔 {c.idCardNumber || 'N/A'}</p>
                          </div>
                        </button>
                      ))}
                      <button onClick={() => setIsCreatingNewClient(true)} className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-[3.5rem] border-4 border-dashed border-gray-200 hover:border-blue-400 hover:bg-white transition-all group col-span-1 md:col-span-2">
                        <span className="text-5xl mb-4">👤+</span>
                        <span className="font-black text-gray-400 uppercase tracking-widest group-hover:text-blue-600">Créer un nouveau client</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 bg-gray-50/50 p-12 rounded-[4rem] border border-gray-100 animate-scale-in">
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase">Prénom</label>
                          <input type="text" placeholder="Prénom" value={newClientData.firstName || ''} onChange={e => setNewClientData({...newClientData, firstName: e.target.value})} className="px-6 py-4 rounded-2xl bg-white shadow-sm outline-none font-bold focus:ring-2 ring-blue-300" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase">Nom</label>
                          <input type="text" placeholder="Nom" value={newClientData.lastName || ''} onChange={e => setNewClientData({...newClientData, lastName: e.target.value})} className="px-6 py-4 rounded-2xl bg-white shadow-sm outline-none font-bold focus:ring-2 ring-blue-300" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase">Numéro de téléphone</label>
                        <input type="tel" placeholder="Téléphone" value={newClientData.phone || ''} onChange={e => setNewClientData({...newClientData, phone: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-white shadow-sm outline-none font-bold focus:ring-2 ring-blue-300" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase">E-mail (optionnel)</label>
                        <input type="email" placeholder="Email" value={newClientData.email || ''} onChange={e => setNewClientData({...newClientData, email: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-white shadow-sm outline-none font-bold focus:ring-2 ring-blue-300" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase">Wilaya</label>
                          <select value={newClientData.wilaya} onChange={e => setNewClientData({...newClientData, wilaya: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-white shadow-sm outline-none font-bold appearance-none cursor-pointer focus:ring-2 ring-blue-300">
                            {ALGERIAN_WILAYAS.map(w => <option key={w} value={w}>{w}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase">Document déposé à l'agence</label>
                          <select value={newClientData.documentLeftAtStore || 'Aucun'} onChange={e => setNewClientData({...newClientData, documentLeftAtStore: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-white shadow-sm outline-none font-bold appearance-none cursor-pointer focus:ring-2 ring-blue-300">
                            {['Aucun', 'Passeport', 'Carte d\'identité', 'Permis de conduire', 'Chèque de garantie', 'Autre'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <textarea placeholder="Adresse complète" value={newClientData.address || ''} onChange={e => setNewClientData({...newClientData, address: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-white shadow-sm outline-none font-bold h-24 resize-none focus:ring-2 ring-blue-300" />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase">Type Document</label>
                          <select value={newClientData.documentType || ''} onChange={e => setNewClientData({...newClientData, documentType: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-white shadow-sm outline-none font-bold focus:ring-2 ring-blue-300">
                            <option value="">Aucun</option>
                            <option value="carte_identite">Carte d'identité</option>
                            <option value="passeport">Passeport</option>
                            <option value="autre">Autre</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase">Numéro Document</label>
                          <input type="text" placeholder="Numéro Document" value={newClientData.documentNumber || newClientData.idCardNumber || ''} onChange={e => setNewClientData({...newClientData, documentNumber: e.target.value})} className="px-6 py-4 rounded-2xl bg-white shadow-sm outline-none font-bold focus:ring-2 ring-blue-300" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase">Date délivrance</label>
                          <input type="date" placeholder="Date délivrance" value={newClientData.documentDeliveryDate || ''} onChange={e => setNewClientData({...newClientData, documentDeliveryDate: e.target.value})} className="px-6 py-4 rounded-2xl bg-white shadow-sm outline-none font-bold focus:ring-2 ring-blue-300" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase">Date expiration</label>
                          <input type="date" placeholder="Date expiration" value={newClientData.documentExpiryDate || ''} onChange={e => setNewClientData({...newClientData, documentExpiryDate: e.target.value})} className="px-6 py-4 rounded-2xl bg-white shadow-sm outline-none font-bold focus:ring-2 ring-blue-300" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase">Adresse délivrance</label>
                          <input type="text" placeholder="Adresse délivrance" value={newClientData.documentDeliveryAddress || ''} onChange={e => setNewClientData({...newClientData, documentDeliveryAddress: e.target.value})} className="px-6 py-4 rounded-2xl bg-white shadow-sm outline-none font-bold focus:ring-2 ring-blue-300" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase">N° CNI</label>
                          <input type="text" placeholder="N° CNI" value={newClientData.idCardNumber || ''} onChange={e => setNewClientData({...newClientData, idCardNumber: e.target.value})} className="px-6 py-4 rounded-2xl bg-white shadow-sm outline-none font-bold focus:ring-2 ring-blue-300" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase">N° Permis</label>
                          <input type="text" placeholder="N° Permis" value={newClientData.licenseNumber || ''} onChange={e => setNewClientData({...newClientData, licenseNumber: e.target.value})} className="px-6 py-4 rounded-2xl bg-white shadow-sm outline-none font-bold focus:ring-2 ring-blue-300" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase">Expiration Permis</label>
                          <input type="date" placeholder="Expiration Permis" value={newClientData.licenseExpiry || ''} onChange={e => setNewClientData({...newClientData, licenseExpiry: e.target.value})} className="px-6 py-4 rounded-2xl bg-white shadow-sm outline-none font-bold focus:ring-2 ring-blue-300" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 items-center">
                        <div className="bg-gray-50 p-6 rounded-2xl text-center">
                          <div className="w-24 h-24 rounded-full overflow-hidden mx-auto mb-4">
                            {profilePreviewNew ? <img src={profilePreviewNew} className="w-full h-full object-cover" /> : <img src={newClientData.profilePicture} className="w-full h-full object-cover" />}
                          </div>
                          <button type="button" onClick={() => fileInputRefNew.current?.click()} className="px-4 py-2 bg-white rounded-2xl font-black">Photo de profil</button>
                          <input type="file" ref={fileInputRefNew} className="hidden" accept="image/*" onChange={(e) => handleImageUploadNew(e, 'profile')} />
                        </div>
                        <div className="bg-gray-50 p-6 rounded-2xl">
                          <div className="grid grid-cols-3 gap-2 mb-4">
                            {docPreviewsNew.map((doc, i) => (
                              <div key={i} className="relative aspect-[4/3] rounded-lg overflow-hidden">
                                <img src={doc} className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                          <button type="button" onClick={() => docInputRefNew.current?.click()} className="w-full px-4 py-3 bg-white rounded-2xl font-black">+ Documents numérisés</button>
                          <input type="file" ref={docInputRefNew} className="hidden" multiple accept="image/*" onChange={(e) => handleImageUploadNew(e, 'docs')} />
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <button onClick={() => setIsCreatingNewClient(false)} className="flex-1 py-4 text-gray-400 font-black uppercase text-[10px]">Annuler</button>
                        <GradientButton onClick={async () => {
                          if (!newClientData.firstName || !newClientData.lastName || !newClientData.phone) {
                            alert('Veuillez remplir les champs requis');
                            return;
                          }
                          setLoading(true);
                          try {
                            const dbData: any = {
                              first_name: newClientData.firstName,
                              last_name: newClientData.lastName,
                              phone: newClientData.phone,
                              email: newClientData.email || null,
                              id_card_number: newClientData.idCardNumber || null,
                              document_type: newClientData.documentType || null,
                              document_number: newClientData.documentNumber || null,
                              document_delivery_date: newClientData.documentDeliveryDate || null,
                              document_delivery_address: newClientData.documentDeliveryAddress || null,
                              document_expiry_date: newClientData.documentExpiryDate || null,
                              wilaya: newClientData.wilaya || '16 - Alger',
                              address: newClientData.address || null,
                              license_number: newClientData.licenseNumber || null,
                              license_expiry: newClientData.licenseExpiry || null,
                              license_issue_date: newClientData.licenseIssueDate || null,
                              license_issue_place: newClientData.licenseIssuePlace || null,
                              profile_picture: profilePreviewNew || newClientData.profilePicture || null,
                              document_images: docPreviewsNew || [],
                              document_left_at_store: newClientData.documentLeftAtStore || 'Aucun'
                            };

                            const { data: inserted, error } = await supabase.from('customers').insert([dbData]).select().single();
                            if (error || !inserted) throw error || new Error('Insertion failed');
                            setFormData({...formData, customerId: inserted.id});
                            setIsCreatingNewClient(false);
                            setNewClientData({ wilaya: '16 - Alger', documentImages: [], profilePicture: 'https://via.placeholder.com/200' });
                            setProfilePreviewNew(null);
                            setDocPreviewsNew([]);
                            alert('Client créé et sélectionné pour la réservation.');
                          } catch (err: any) {
                            console.error(err);
                            alert('Erreur lors de la création du client: ' + (err?.message || err));
                          } finally { setLoading(false); }
                        }} className="flex-[2] !py-4 rounded-2xl shadow-xl">Valider</GradientButton>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 4: Services & Options */}
            {creationStep === 4 && (
              <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-10">
                  <div className="p-10 bg-gray-50 rounded-[3.5rem] border border-gray-100 shadow-inner">
                    <div className="flex justify-between items-center mb-8">
                      <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">🤵‍♂️ Avec Chauffeur</h3>
                      <input type="checkbox" checked={formData.isWithDriver} onChange={e => setFormData({...formData, isWithDriver: e.target.checked})} className="w-8 h-8 rounded-xl text-blue-600" />
                    </div>
                    {formData.isWithDriver && (
                      <select value={formData.driverId || ''} onChange={e => setFormData({...formData, driverId: e.target.value})} className="w-full px-6 py-4 rounded-2xl font-bold bg-white shadow-sm outline-none appearance-none cursor-pointer focus:ring-2 ring-blue-300">
                        <option value="">Choisir un chauffeur</option>
                        {workers.filter(w => w.role === 'driver').map(d => <option key={d.id} value={d.id}>{d.fullName}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="p-10 bg-blue-50/50 rounded-[3.5rem] border border-blue-100 shadow-inner">
                    <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4 px-4">💎 Caution (Montant)</label>
                    <input type="number" value={formData.cautionAmount || ''} onChange={e => setFormData({...formData, cautionAmount: Number(e.target.value)})} className="w-full px-8 py-6 rounded-[2rem] bg-white font-black text-4xl text-blue-600 shadow-xl text-center outline-none focus:ring-2 ring-blue-300" placeholder="0" />
                  </div>
                </div>
                <div className="p-10 bg-white border border-gray-100 rounded-[3.5rem] shadow-xl space-y-10 flex flex-col overflow-hidden">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] border-b pb-6">Services & Options Additionnels</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {(['decoration', 'equipment', 'insurance', 'service'] as const).map(cat => (
                      <button key={cat} onClick={() => { setTempOptionCat(cat); setActiveModal('add-option'); }} className="px-6 py-4 bg-gray-50 rounded-2xl text-[10px] font-black uppercase text-gray-500 hover:bg-blue-600 hover:text-white transition-all shadow-sm">+ {cat}</button>
                    ))}
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                    {formData.tempOptions.map((o, idx) => (
                      <div key={idx} className="flex justify-between items-center p-6 bg-gray-50 rounded-[2rem] border border-gray-100 animate-scale-in">
                        <div><p className="text-[9px] font-black text-gray-400 uppercase leading-none mb-1">{o.category}</p><p className="font-black text-gray-900 text-lg leading-none">{o.name}</p></div>
                        <button onClick={() => setFormData({...formData, tempOptions: formData.tempOptions.filter((_, i) => i !== idx)})} className="text-red-600 hover:text-red-800 font-black">✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: Payment Summary */}
            {creationStep === 5 && (
              <div className="animate-fade-in space-y-12">
                <div className="bg-gray-900 rounded-[4.5rem] p-12 text-white shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-12 opacity-5 text-[15rem] font-black rotate-12 leading-none">BILL</div>
                  <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-12">
                    <div className="flex items-center gap-10">
                      <img src={getVehicle(formData.vehicleId!)?.mainImage} className="w-32 h-32 rounded-full border-4 border-white/20 p-2 bg-white/5 shadow-2xl object-cover" />
                      <div>
                        <h4 className="text-4xl font-black uppercase leading-none mb-3">{getVehicle(formData.vehicleId!)?.brand} {getVehicle(formData.vehicleId!)?.model}</h4>
                        <p className="text-blue-400 font-black text-sm tracking-[0.3em] uppercase">{getVehicle(formData.vehicleId!)?.immatriculation}</p>
                        <div className="flex gap-4 mt-8">
                          <span className="px-6 py-2 bg-white/10 rounded-full text-xs font-black uppercase">{invoice.days} Jours</span>
                          <span className="px-6 py-2 bg-white/10 rounded-full text-xs font-black uppercase">{getVehicle(formData.vehicleId!)?.dailyRate.toLocaleString()} DZ/J</span>
                        </div>
                      </div>
                    </div>
                      <div className="w-full text-center">
                        <p className="text-[10px] font-black uppercase opacity-40 mb-4 tracking-[0.4em]">TOTAL GÉNÉRAL À PAYER</p>
                        <div className="flex items-center justify-center gap-4">
                          <input
                            type="number"
                            step="0.01"
                            value={((formData as any).totalAmount ?? invoice.finalTotal) as any}
                            onChange={e => setFormData({...formData, totalAmount: e.target.value === '' ? undefined : Number(e.target.value)})}
                            className="w-full max-w-[420px] text-center text-7xl font-black text-blue-400 leading-none tracking-tighter px-6 py-3 rounded-xl bg-white/5"
                          />
                          <span className="text-3xl font-bold uppercase">DZ</span>
                        </div>
                      </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="p-12 bg-white border border-gray-100 rounded-[4.5rem] shadow-sm space-y-10">
                    <div className="flex items-center justify-between border-b border-gray-50 pb-6">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Décomposition du tarif</h4>
                      <label className="flex items-center gap-4 cursor-pointer">
                        <input type="checkbox" checked={formData.withTVA} onChange={e => setFormData({...formData, withTVA: e.target.checked})} className="w-8 h-8 rounded-xl text-blue-600" />
                        <span className="text-[10px] font-black text-gray-400 uppercase">Appliquer TVA (19%)</span>
                      </label>
                    </div>
                    <div className="space-y-6 font-bold text-gray-700">
                      <div className="flex justify-between items-center text-xl"><span>Base location ({invoice.days}j × {getVehicle(formData.vehicleId!)?.dailyRate.toLocaleString()} DZ)</span><span className="font-black text-gray-900">{invoice.baseTotal.toLocaleString()} DZ</span></div>
                      {formData.tempOptions.length > 0 && <div className="flex justify-between items-center text-lg"><span>Options & Services</span><span className="font-black text-gray-900">{invoice.optionsTotal.toLocaleString()} DZ</span></div>}
                      {(formData.cautionAmount || 0) > 0 && <div className="flex justify-between items-center text-lg"><span>Caution</span><span className="font-black text-gray-900">{(formData.cautionAmount || 0).toLocaleString()} DZ</span></div>}
                      <div className="flex justify-between items-center pt-8 border-t-2 border-dashed border-gray-50">
                        <span className="text-red-500 text-[10px] font-black uppercase">Remise exceptionnelle</span>
                        <input type="number" value={formData.discount || ''} onChange={e => setFormData({...formData, discount: Number(e.target.value)})} className="w-44 px-6 py-4 bg-red-50 rounded-[1.5rem] text-right font-black text-red-600 outline-none focus:ring-2 ring-red-300" placeholder="0" />
                      </div>
                    </div>
                  </div>
                  <div className="p-12 bg-blue-50/20 border border-blue-100 rounded-[4.5rem] shadow-inner space-y-12">
                    <div className="space-y-6">
                      <label className="block text-[11px] font-black text-blue-600 uppercase tracking-[0.3em] px-6">💰 Acompte versé aujourd'hui</label>
                      <input type="number" value={formData.paidAmount || ''} onChange={e => setFormData({...formData, paidAmount: Number(e.target.value)})} className="w-full px-10 py-10 rounded-[3rem] bg-white font-black text-7xl text-blue-600 shadow-2xl text-center outline-none focus:ring-4 ring-blue-200 transition-all" />
                    </div>
                    <div className="p-10 bg-white/80 rounded-[3.5rem] border border-blue-200 flex justify-between items-center shadow-xl">
                      <div><p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 leading-none">Reste à payer</p></div>
                      <p className={`text-6xl font-black ${invoice.rest > 0 ? 'text-red-600' : 'text-green-600'} tracking-tighter`}>{invoice.rest.toLocaleString()} <span className="text-2xl font-bold">DZ</span></p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="mt-auto pt-16 flex justify-between items-center">
              <button disabled={creationStep === 1} onClick={() => setCreationStep(creationStep - 1)} className={`px-14 py-6 font-black uppercase text-xs tracking-[0.3em] text-gray-300 hover:text-gray-900 transition-all ${creationStep === 1 ? 'opacity-0 pointer-events-none' : ''}`}>← RETOUR</button>
              <div className="flex gap-4">
                {creationStep < 5 ? (
                  <GradientButton onClick={() => setCreationStep(creationStep + 1)} className="!px-24 !py-7 text-2xl rounded-[2.5rem] shadow-2xl shadow-blue-100">Suivant →</GradientButton>
                ) : (
                  <GradientButton onClick={handleSaveReservation} disabled={loading} className="!px-32 !py-9 text-4xl rounded-[3.5rem] shadow-2xl shadow-green-100">✅ {loading ? 'Enregistrement...' : 'CONFIRMER'}</GradientButton>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-12 flex flex-col lg:flex-row gap-8 items-center justify-between">
            <div className="flex flex-wrap gap-4">
              {(['all', 'confermer', 'en cours', 'terminer'] as const).map((s) => (
                <button key={s} onClick={() => setFilterStatus(s)} className={`px-10 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all border-2 ${filterStatus === s ? 'bg-blue-600 border-blue-600 text-white shadow-xl' : 'bg-white border-gray-100 text-gray-400 hover:border-blue-600'}`}>
                  {t.status[s as keyof typeof t.status]}
                </button>
              ))}
            </div>
            
            <div className="flex gap-4 items-center flex-wrap">
              {/* View Mode Toggle */}
              <div className="flex gap-2 bg-white rounded-[1.5rem] p-1 border-2 border-gray-100 shadow-sm">
                <button 
                  onClick={() => setViewMode('cards')}
                  className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] transition-all ${viewMode === 'cards' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}
                  title="Affichage Cartes"
                >
                  ⊞ Cartes
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}
                  title="Affichage Lignes"
                >
                  ≡ Lignes
                </button>
              </div>
              
              <input type="text" placeholder="Rechercher..." value={searchQuery} onChange={(e) => setSearchTerm(e.target.value)} className="w-full lg:w-[300px] px-8 py-4 bg-white border-2 border-gray-100 rounded-[1.5rem] font-bold outline-none focus:border-blue-600 transition-all" />
            </div>
          </div>

          {/* Cards View */}
          {viewMode === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredReservations.map(res => {
              const c = getCustomer(res.customerId);
              const v = getVehicle(res.vehicleId);
              const days = calculateDays(res.startDate, res.endDate);
              const rest = res.totalAmount - res.paidAmount;
              const statusColors = {
                'en cours': 'bg-green-600',
                'confermer': 'bg-blue-600',
                'terminer': 'bg-gray-600',
                'annuler': 'bg-red-600',
                'en attente': 'bg-yellow-600'
              };
              
              return (
                <div key={res.id} className="bg-white rounded-[2.5rem] shadow-lg border border-gray-100 overflow-hidden hover:shadow-2xl hover:scale-105 transition-all duration-300 flex flex-col h-full">
                  {/* Image Header */}
                  <div className="relative w-full h-48 bg-gray-100 overflow-hidden group">
                    <img src={v?.mainImage} alt={v?.brand} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                    {/* Status Badge */}
                    <span className={`absolute top-3 right-3 px-4 py-2 rounded-[1.5rem] text-[10px] font-black uppercase text-white shadow-lg ${statusColors[res.status as keyof typeof statusColors] || 'bg-gray-600'}`}>{res.status}</span>
                    {/* Delete Button */}
                    <button onClick={() => handleDeleteRes(res.id)} title="Supprimer" className="absolute top-3 left-3 bg-white/95 text-red-600 hover:bg-red-600 hover:text-white rounded-full p-2 shadow-md transition-colors">
                      🗑️
                    </button>
                    {/* Edit Button removed from image area - moved into header below */}
                    {/* Client Avatar */}
                    <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-white/95 backdrop-blur rounded-full pr-3 shadow-lg">
                      {c?.profilePicture ? (
                        <img src={c.profilePicture} alt="Client" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-white flex items-center justify-center font-black text-sm">{(c?.firstName || 'C')[0]}</div>
                      )}
                      <span className="text-xs font-black text-gray-900 whitespace-nowrap">{c?.firstName}</span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-5 flex flex-col flex-1">
                    {/* Header Info */}
                    <div className="mb-4 relative">
                      <div className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1">Réservation #{res.reservationNumber}</div>
                      <button onClick={() => handleEditReservation(res)} title="Modifier" className="absolute top-0 right-0 bg-white/95 text-gray-600 hover:bg-blue-600 hover:text-white rounded-full p-2 shadow-md transition-colors z-30">✏️</button>
                      <h3 className="text-lg font-black text-gray-900 leading-tight">{v?.brand} {v?.model}</h3>
                      <p className="text-[11px] text-gray-500 font-bold">{v?.immatriculation}</p>
                    </div>

                    {/* Duration & Dates */}
                    <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-black text-gray-500 uppercase">Durée</span>
                        <span className="text-2xl font-black text-blue-600">{days}j</span>
                      </div>
                      <div className="text-[10px] text-gray-600 space-y-1">
                        <div>📍 Départ: {new Date(res.startDate).toLocaleDateString('fr-FR', {day:'2-digit', month:'short'})}</div>
                        <div>📍 Retour: {new Date(res.endDate).toLocaleDateString('fr-FR', {day:'2-digit', month:'short'})}</div>
                      </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="mb-4 space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600 font-bold">Total:</span>
                        <span className="font-black text-blue-600">{res.totalAmount.toLocaleString()} DZ</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600 font-bold">Payé:</span>
                        <span className="font-black text-green-600">{res.paidAmount.toLocaleString()} DZ</span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-t border-gray-100 pt-2">
                        <span className="text-gray-600 font-bold">Reste:</span>
                        <span className={`font-black text-lg ${rest>0? 'text-red-600':'text-green-600'}`}>{rest.toLocaleString()} DZ</span>
                      </div>
                    </div>

                    {/* Action Buttons - Responsive Grid */}
                    <div className="mt-auto pt-4 border-t border-gray-100 space-y-2">
                      {/* Primary Actions */}
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => { setSelectedRes(res); setActiveModal('details'); }} className="px-3 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-black hover:bg-blue-600 hover:text-white transition-all whitespace-nowrap">🔍 Détails</button>
                        <button onClick={() => { setSelectedRes(res); setPaymentAmount(0); setActiveModal('pay'); }} className={`px-3 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all ${rest>0 ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`} disabled={rest === 0}>💰 Payer</button>
                      </div>
                      
                      {/* Status Actions */}
                      <div className="grid grid-cols-2 gap-2">
                        {res.status === 'confermer' && (<button onClick={() => { setSelectedRes(res); setLogData({ mileage: v?.mileage, fuel: 'plein', location: agencies[0]?.name }); setActiveModal('activate'); }} className="px-3 py-2 bg-green-600 text-white rounded-xl text-xs font-black hover:bg-green-700 transition-all">🏁 Activer</button>)}
                        {res.status === 'en cours' && (<button onClick={() => { setSelectedRes(res); setTermData({ mileage:(v?.mileage||0)+100, fuel:'plein', date:new Date().toISOString().slice(0,16), location:agencies[0]?.name, notes:'', extraKmCost:0, extraFuelCost:0, withTva:false }); const cust = customers.find(c=>c.id===res.customerId); const docs = (cust?.documentImages||[]).map((d:any,i:number)=>({label:`Document ${i+1}`, url:d, left:true})); setTermDocsLeft(docs); setActiveModal('terminate'); }} className="px-3 py-2 bg-orange-600 text-white rounded-xl text-xs font-black hover:bg-orange-700 transition-all col-span-2">🔒 Terminer</button>)}
                        {res.status !== 'en cours' && res.status !== 'confermer' && (<div className="col-span-2"></div>)}
                      </div>

                      {/* Document Actions */}
                      <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => { setSelectedRes(res); setSelectedDocType('devis'); const tpl = templates?.find(t=>t.category==='devis'); if(tpl){ setSelectedTemplate(tpl); setActiveModal('print-choice'); } else { setSelectedTemplate(null); setActiveModal('personalize'); } }} className="px-2 py-2 bg-purple-50 text-purple-600 rounded-lg text-[9px] font-black hover:bg-purple-600 hover:text-white transition-all">📋 Devis</button>
                        <button onClick={() => { setSelectedRes(res); setSelectedDocType('contrat'); const tpl = templates?.find(t=>t.category==='contract'||t.category==='contrat'); if(tpl){ setSelectedTemplate(tpl); setActiveModal('print-choice'); } else { setSelectedTemplate(null); setActiveModal('personalize'); } }} className="px-2 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black hover:bg-indigo-600 hover:text-white transition-all">📄 Contrat</button>
                        <button onClick={() => { setSelectedRes(res); setSelectedDocType('versement'); const tpl = templates?.find(t=>t.category==='versement'); if(tpl){ setSelectedTemplate(tpl); setActiveModal('print-choice'); } else { setSelectedTemplate(null); setActiveModal('personalize'); } }} className="px-2 py-2 bg-cyan-50 text-cyan-600 rounded-lg text-[9px] font-black hover:bg-cyan-600 hover:text-white transition-all">🧾 Versement</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>          )}

          {/* List View */}
          {viewMode === 'list' && (
            <div className="space-y-3">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-gradient-to-r from-gray-900 to-gray-800 rounded-[2rem] text-white font-black uppercase text-[10px] sticky top-0 z-10 shadow-lg">
                <div className="col-span-1">🔢 #</div>
                <div className="col-span-2">🚗 Véhicule</div>
                <div className="col-span-2">👤 Client</div>
                <div className="col-span-1 text-center">📅 Départ</div>
                <div className="col-span-1 text-center">📅 Retour</div>
                <div className="col-span-1 text-center">💰 Montant</div>
                <div className="col-span-1 text-center">💳 Payé</div>
                <div className="col-span-1 text-center">🔄 Reste</div>
                <div className="col-span-1 text-center">📊 Statut</div>
                <div className="col-span-1 text-center">•</div>
              </div>

              {/* Table Rows */}
              {filteredReservations.map((res, idx) => {
                const c = getCustomer(res.customerId);
                const v = getVehicle(res.vehicleId);
                const days = calculateDays(res.startDate, res.endDate);
                const rest = res.totalAmount - res.paidAmount;
                const statusColors = {
                  'en cours': 'bg-green-100 text-green-800 border-green-300',
                  'confermer': 'bg-blue-100 text-blue-800 border-blue-300',
                  'terminer': 'bg-gray-100 text-gray-800 border-gray-300',
                  'annuler': 'bg-red-100 text-red-800 border-red-300',
                  'en attente': 'bg-yellow-100 text-yellow-800 border-yellow-300'
                };

                return (
                  <div key={res.id} className="grid grid-cols-12 gap-4 px-6 py-4 bg-white rounded-xl border border-gray-100 hover:border-blue-300 hover:shadow-lg transition-all items-center group">
                    {/* Index */}
                    <div className="col-span-1 text-[11px] font-black text-gray-400">
                      {idx + 1}
                    </div>

                    {/* Vehicle */}
                    <div className="col-span-2">
                      <p className="text-sm font-black text-gray-900 uppercase truncate">{v?.brand} {v?.model}</p>
                      <p className="text-[9px] font-bold text-gray-500">{v?.immatriculation}</p>
                    </div>

                    {/* Customer */}
                    <div className="col-span-2">
                      <p className="text-sm font-black text-gray-900 truncate">{c?.firstName} {c?.lastName}</p>
                      <p className="text-[9px] font-bold text-gray-500">{c?.phone}</p>
                    </div>

                    {/* Start Date */}
                    <div className="col-span-1 text-center">
                      <p className="text-sm font-black text-gray-900">{new Date(res.startDate).toLocaleDateString('fr-FR', { month: 'short', day: '2-digit' })}</p>
                      <p className="text-[8px] font-bold text-gray-500">{new Date(res.startDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>

                    {/* End Date */}
                    <div className="col-span-1 text-center">
                      <p className="text-sm font-black text-gray-900">{new Date(res.endDate).toLocaleDateString('fr-FR', { month: 'short', day: '2-digit' })}</p>
                      <p className="text-[8px] font-bold text-gray-500">{days}j</p>
                    </div>

                    {/* Total Amount */}
                    <div className="col-span-1 text-center">
                      <p className="text-sm font-black text-blue-600">{res.totalAmount.toLocaleString()}</p>
                      <p className="text-[8px] font-bold text-gray-400">DZ</p>
                    </div>

                    {/* Paid Amount */}
                    <div className="col-span-1 text-center">
                      <p className="text-sm font-black text-green-600">{res.paidAmount.toLocaleString()}</p>
                      <p className="text-[8px] font-bold text-gray-400">DZ</p>
                    </div>

                    {/* Remaining */}
                    <div className="col-span-1 text-center">
                      <p className={`text-sm font-black ${rest > 0 ? 'text-red-600' : 'text-green-600'}`}>{rest.toLocaleString()}</p>
                      <p className="text-[8px] font-bold text-gray-400">DZ</p>
                    </div>

                    {/* Status */}
                    <div className="col-span-1 text-center">
                      <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase border inline-block ${statusColors[res.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800 border-gray-300'}`}>
                        {res.status}
                      </span>
                    </div>

                    {/* Actions column (three-dots menu) - list view only */}
                    <div className="col-span-1 text-right relative">
                      <button onClick={() => setOpenRowActions(openRowActions === res.id ? null : res.id)} className="px-3 py-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-all">⋯</button>
                      {openRowActions === res.id && (
                        <div className="absolute right-0 mt-2 w-52 bg-white rounded-lg shadow-lg border p-2 z-40">
                          <div className="flex flex-col gap-2">
                            <button onClick={() => { setSelectedRes(res); handleEditReservation(res); setOpenRowActions(null); }} className="text-left px-2 py-2 rounded-md hover:bg-gray-50">✏️ Modifier</button>
                            <button onClick={() => { setSelectedRes(res); setActiveModal('details'); setOpenRowActions(null); }} className="text-left px-2 py-2 rounded-md hover:bg-gray-50">🔍 Détails</button>
                            {rest > 0 && <button onClick={() => { setSelectedRes(res); setPaymentAmount(0); setActiveModal('pay'); setOpenRowActions(null); }} className="text-left px-2 py-2 rounded-md hover:bg-gray-50">💰 Payer</button>}
                            <button onClick={() => { setSelectedRes(res); setSelectedDocType('devis'); const tpl = templates?.find(t=>t.category==='devis'); if(tpl){ setSelectedTemplate(tpl); setActiveModal('print-choice'); } else { setSelectedTemplate(null); setActiveModal('personalize'); } setOpenRowActions(null); }} className="text-left px-2 py-2 rounded-md hover:bg-gray-50">📋 Devis</button>
                            <button onClick={() => { setSelectedRes(res); setSelectedDocType('contrat'); const tpl = templates?.find(t=>t.category==='contract'||t.category==='contrat'); if(tpl){ setSelectedTemplate(tpl); setActiveModal('print-choice'); } else { setSelectedTemplate(null); setActiveModal('personalize'); } setOpenRowActions(null); }} className="text-left px-2 py-2 rounded-md hover:bg-gray-50">📄 Contrat</button>
                            <button onClick={() => { setSelectedRes(res); setSelectedDocType('versement'); const tpl = templates?.find(t=>t.category==='versement'); if(tpl){ setSelectedTemplate(tpl); setActiveModal('print-choice'); } else { setSelectedTemplate(null); setActiveModal('personalize'); } setOpenRowActions(null); }} className="text-left px-2 py-2 rounded-md hover:bg-gray-50">🧾 Versement</button>
                            {res.status === 'confermer' && <button onClick={() => { setSelectedRes(res); setLogData({ mileage: v?.mileage, fuel: 'plein', location: agencies[0]?.name }); setActiveModal('activate'); setOpenRowActions(null); }} className="text-left px-2 py-2 rounded-md hover:bg-green-50">🏁 Activer</button>}
                            {res.status === 'en cours' && <button onClick={() => { setSelectedRes(res); setTermData({ mileage: (v?.mileage || 0) + 100, fuel: 'plein', date: new Date().toISOString().slice(0, 16), location: agencies[0]?.name, notes: '', extraKmCost: 0, extraFuelCost: 0, withTva: false }); setActiveModal('terminate'); setOpenRowActions(null); }} className="text-left px-2 py-2 rounded-md hover:bg-orange-50">🔒 Terminer</button>}
                            <button onClick={() => { handleDeleteRes(res.id); setOpenRowActions(null); }} className="text-left px-2 py-2 rounded-md hover:bg-red-50">🗑️ Supprimer</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      {/* --- PRINT CHOICE MODAL --- */}
      {activeModal === 'print-choice' && selectedRes && selectedDocType && (
        <div className="fixed inset-0 z-[350] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-black mb-4">Choisir une action</h3>
            <p className="text-sm text-gray-500 mb-6">Voulez-vous personnaliser le document ou imprimer directement avec le modèle enregistré ?</p>
            <div className="flex gap-3">
              <button onClick={() => { setActiveModal('personalize'); }} className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-2xl font-black">Personnaliser</button>
              <button onClick={() => { setActiveModal('print-preview'); }} className="flex-1 px-4 py-3 bg-green-600 text-white rounded-2xl font-black">Imprimer avec le modèle</button>
            </div>
            <div className="mt-4">
              <button onClick={() => setActiveModal(null)} className="w-full px-4 py-2 bg-gray-100 rounded-2xl">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* --- PERSONALIZE DOCUMENT MODAL --- */}
      {activeModal === 'personalize' && selectedRes && selectedDocType && (
        <DocumentPersonalizer
          lang={lang}
          reservation={selectedRes}
          customer={customers.find(c => c.id === selectedRes.customerId)!}
          vehicle={vehicles.find(v => v.id === selectedRes.vehicleId)!}
          docType={selectedDocType}
          storeLogo={storeLogo}
          storeInfo={storeInfo}
          onSaveTemplate={(template) => {
            if (onUpdateTemplates) {
              const updatedTemplates = templates.filter(t => t.category !== template.category);
              onUpdateTemplates([...updatedTemplates, template]);
              setActiveModal(null);
            }
          }}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* --- PRINT PREVIEW MODAL --- */}
      {activeModal === 'print-preview' && selectedRes && selectedTemplate && (
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-xl flex items-center justify-center p-8 animate-fade-in">
           <div className="bg-white rounded-[4rem] shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
              <div className="p-10 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                 <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-blue-600 text-white rounded-[1.5rem] flex items-center justify-center text-3xl shadow-xl">🖨️</div>
                    <div>
                      <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">Aperçu Impression</h2>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Dossier: {selectedRes.reservationNumber} • Modèle: {selectedTemplate.name}</p>
                    </div>
                 </div>
                 <div className="flex gap-4">
                    <GradientButton onClick={() => {
                      if (!selectedRes || !selectedTemplate) return;
                      
                      const printWindow = window.open('', '_blank');
                      if (!printWindow) return;
                      
                      const customer = customers.find(c => c.id === selectedRes.customerId);
                      const vehicle = vehicles.find(v => v.id === selectedRes.vehicleId);
                      if (!customer || !vehicle) return;
                      
                      // Helper to replace variables
                      const replaceVars = (text: string): string => {
                        const days = Math.ceil((new Date(selectedRes.endDate).getTime() - new Date(selectedRes.startDate).getTime()) / (1000 * 60 * 60 * 24));
                        return text
                          .replace('{{client_name}}', `${customer.firstName} ${customer.lastName}`)
                          .replace('{{client_phone}}', customer.phone || '')
                          .replace('{{client_email}}', customer.email || '')
                          .replace('{{client_dob}}', customer.dateOfBirth ? new Date(customer.dateOfBirth).toLocaleDateString(lang === 'ar' ? 'ar-DZ' : 'fr-FR') : '')
                          .replace('{{client_pob}}', customer.placeOfBirth || '')
                          .replace('{{client_license}}', customer.licenseNumber || '')
                          .replace('{{license_issued}}', customer.licenseIssueDate ? new Date(customer.licenseIssueDate).toLocaleDateString(lang === 'ar' ? 'ar-DZ' : 'fr-FR') : '')
                          .replace('{{license_expiry}}', customer.licenseExpiryDate ? new Date(customer.licenseExpiryDate).toLocaleDateString(lang === 'ar' ? 'ar-DZ' : 'fr-FR') : '')
                          .replace('{{license_place}}', customer.licensePlace || '')
                          .replace('{{vehicle_brand}}', vehicle.brand)
                          .replace('{{vehicle_model}}', vehicle.model)
                          .replace('{{vehicle_color}}', vehicle.color || '')
                          .replace('{{vehicle_plate}}', vehicle.immatriculation || '')
                          .replace('{{vehicle_vin}}', vehicle.vin || '')
                          .replace('{{vehicle_fuel}}', vehicle.fuelType || '')
                          .replace('{{vehicle_mileage}}', vehicle.mileage?.toString() || '0')
                          .replace('{{res_number}}', selectedRes.reservationNumber)
                          .replace('{{res_date}}', new Date(selectedRes.startDate).toLocaleDateString(lang === 'ar' ? 'ar-DZ' : 'fr-FR'))
                          .replace('{{start_date}}', new Date(selectedRes.startDate).toLocaleDateString(lang === 'ar' ? 'ar-DZ' : 'fr-FR'))
                          .replace('{{end_date}}', new Date(selectedRes.endDate).toLocaleDateString(lang === 'ar' ? 'ar-DZ' : 'fr-FR'))
                          .replace('{{duration}}', days.toString().padStart(2, '0'))
                          .replace('{{total_amount}}', selectedRes.totalAmount.toLocaleString())
                          .replace('{{total_ht}}', (selectedRes.totalAmount * 0.81).toLocaleString())
                          .replace('{{unit_price}}', (selectedRes.totalAmount / days).toLocaleString())
                          .replace('{{paid_amount}}', selectedRes.paidAmount.toLocaleString())
                          .replace('{{remaining_amount}}', (selectedRes.totalAmount - selectedRes.paidAmount).toLocaleString())
                          .replace('{{store_name}}', storeInfo?.name || 'DriveFlow')
                          .replace('{{store_phone}}', storeInfo?.phone || '')
                          .replace('{{store_email}}', storeInfo?.email || '')
                          .replace('{{store_address}}', storeInfo?.address || '');
                      };
                      
                      const htmlContent = `
                        <!DOCTYPE html>
                        <html>
                        <head>
                          <meta charset="UTF-8">
                          <meta name="viewport" content="width=device-width, initial-scale=1.0">
                          <title>Contrat de Location de Véhicule</title>
                          <style>
                            * {
                              margin: 0;
                              padding: 0;
                              box-sizing: border-box;
                            }
                            html, body {
                              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                              background: white;
                              padding: 0;
                              margin: 0;
                            }
                            .page {
                              width: 210mm;
                              height: 297mm;
                              padding: 15mm;
                              background: white;
                              position: relative;
                              page-break-after: always;
                              overflow: hidden;
                            }
                            .section-header {
                              background-color: #2563eb;
                              color: white;
                              padding: 8px 12px;
                              font-weight: 900;
                              font-size: 11px;
                              margin-top: 8px;
                              margin-bottom: 6px;
                              border-radius: 3px;
                              text-transform: uppercase;
                              letter-spacing: 0.5px;
                            }
                            .section-header.purple { background-color: #7c3aed; }
                            .section-header.green { background-color: #059669; }
                            .section-header.red { background-color: #dc2626; }
                            .section-header.orange { background-color: #ea580c; }
                            .section-header.indigo { background-color: #6366f1; }
                            
                            .content-box {
                              background-color: #f3f4f6;
                              border: 1px solid #e5e7eb;
                              padding: 8px;
                              margin-bottom: 8px;
                              border-radius: 3px;
                              font-size: 9px;
                              line-height: 1.5;
                            }
                            .two-column {
                              display: grid;
                              grid-template-columns: 1fr 1fr;
                              gap: 10px;
                            }
                            .signature-box {
                              border: 2px solid #d1d5db;
                              padding: 10px;
                              height: 60px;
                              text-align: center;
                              font-size: 8px;
                              font-weight: 600;
                              display: flex;
                              align-items: center;
                              justify-content: center;
                            }
                            .logo {
                              max-width: 80px;
                              max-height: 40px;
                              margin-bottom: 10px;
                            }
                            .title {
                              font-size: 18px;
                              font-weight: 900;
                              text-align: center;
                              margin-bottom: 10px;
                              color: #1f2937;
                              letter-spacing: 0.5px;
                            }
                            .checklist {
                              display: grid;
                              grid-template-columns: repeat(4, 1fr);
                              gap: 6px;
                              font-size: 8px;
                            }
                            .checklist-item {
                              display: flex;
                              align-items: center;
                              gap: 3px;
                            }
                            .arabic-text {
                              text-align: right;
                              direction: rtl;
                              font-size: 8px;
                              line-height: 1.6;
                            }
                            @page {
                              size: A4;
                              margin: 0;
                            }
                            @media print {
                              body { margin: 0; padding: 0; }
                              .page { page-break-after: always; margin: 0; padding: 15mm; width: 100%; height: auto; }
                              .page:last-child { page-break-after: avoid; }
                            }
                          </style>
                        </head>
                        <body>
                          <div class="page">
                            <img src="${storeLogo || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%2250%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22100%22 height=%2250%22/%3E%3C/svg%3E'}" alt="Logo" class="logo">
                            <div class="title">CONTRAT DE LOCATION DE VÉHICULE</div>
                            <div class="two-column">
                              <div>
                                <div class="section-header">DÉTAILS DU CONTRAT</div>
                                <div class="content-box">
                                  <strong>Date du contrat:</strong> ${replaceVars('{{res_date}}')}<br>
                                  <strong>Numéro du contrat:</strong> ${replaceVars('{{res_number}}')}<br>
                                </div>
                              </div>
                              <div>
                                <div class="section-header">PÉRIODE DE LOCATION</div>
                                <div class="content-box">
                                  <strong>Date de départ:</strong> ${replaceVars('{{start_date}}')}<br>
                                  <strong>Date de retour:</strong> ${replaceVars('{{end_date}}')}<br>
                                  <strong>Durée:</strong> ${replaceVars('{{duration}}')} jours<br>
                                </div>
                              </div>
                            </div>
                            <div class="section-header purple">INFORMATIONS DU CONDUCTEUR (Conducteur 01)</div>
                            <div class="content-box">
                              <strong>Nom:</strong> ${replaceVars('{{client_name}}')}<br>
                              <strong>Date de naissance:</strong> ${replaceVars('{{client_dob}}')}<br>
                              <strong>Lieu de naissance:</strong> ${replaceVars('{{client_pob}}')}<br>
                              <strong>Type de document:</strong> Permis de conduire biométrique<br>
                              <strong>Numéro du document:</strong> ${replaceVars('{{client_license}}')}<br>
                              <strong>Date d'émission:</strong> ${replaceVars('{{license_issued}}')}<br>
                              <strong>Date d'expiration:</strong> ${replaceVars('{{license_expiry}}')}<br>
                              <strong>Lieu d'émission:</strong> ${replaceVars('{{license_place}}')}<br>
                            </div>
                            <div class="section-header green">INFORMATIONS DU VÉHICULE</div>
                            <div class="content-box">
                              <strong>Modèle:</strong> ${replaceVars('{{vehicle_model}}')}<br>
                              <strong>Couleur:</strong> ${replaceVars('{{vehicle_color}}')}<br>
                              <strong>Immatriculation:</strong> ${replaceVars('{{vehicle_plate}}')}<br>
                              <strong>Numéro de série:</strong> ${replaceVars('{{vehicle_vin}}')}<br>
                              <strong>Type de carburant:</strong> ${replaceVars('{{vehicle_fuel}}')}<br>
                              <strong>Kilométrage au départ:</strong> ${replaceVars('{{vehicle_mileage}}')} km<br>
                            </div>
                            <div class="section-header red">INFORMATIONS FINANCIÈRES</div>
                            <div class="content-box" style="background-color: #fee2e2; border-color: #fca5a5;">
                              <strong>Prix unitaire:</strong> ${replaceVars('{{unit_price}}')} DZ<br>
                              <strong>Prix total (HT):</strong> ${replaceVars('{{total_ht}}')} DZ<br>
                              <strong>Montant total du contrat:</strong> ${replaceVars('{{total_amount}}')} DZ<br>
                            </div>
                            <div class="section-header orange">LISTE DE VÉRIFICATION DE L'ÉQUIPEMENT ET DE L'INSPECTION</div>
                            <div class="content-box">
                              <div class="checklist">
                                <div class="checklist-item">☐ Pneus</div>
                                <div class="checklist-item">☐ Batterie</div>
                                <div class="checklist-item">☐ Freins</div>
                                <div class="checklist-item">☐ Phares</div>
                                <div class="checklist-item">☐ Essuie-glaces</div>
                                <div class="checklist-item">☐ Moteur</div>
                                <div class="checklist-item">☐ Ceintures</div>
                                <div class="checklist-item">☐ Intérieur propre</div>
                                <div class="checklist-item">☐ Réservoir plein</div>
                                <div class="checklist-item">☐ Fenêtres</div>
                                <div class="checklist-item">☐ Miroirs</div>
                                <div class="checklist-item">☐ Autres</div>
                              </div>
                            </div>
                            <div class="section-header indigo">SIGNATURES</div>
                            <div class="two-column">
                              <div class="signature-box">
                                <strong>Signature du locataire<br>et empreinte</strong><br><br>
                              </div>
                              <div class="signature-box">
                                <strong>Signature de l'agent<br>et cachet</strong><br><br>
                              </div>
                            </div>
                          </div>
                          <div class="page">
                            <div class="title">CONDITIONS ET TERMES DU CONTRAT</div>
                            <div style="background-color: #dbeafe; border: 2px solid #0ea5e9; padding: 15px; margin-bottom: 15px; border-radius: 4px;">
                              <strong style="font-size: 11px;">يمكنك قراءة شروط العقد في الأسفل ومصادقة عليها</strong>
                            </div>
                            <div class="arabic-text">
                              <strong>1- السن:</strong> يجب أن يكون السائق يبلغ من العمر 20 عاماً على الأقل، وأن يكون حاصلاً على رخصة قيادة منذ سنتين على الأقل.<br><br>
                              <strong>2- جواز السفر:</strong> إيداع جواز السفر البيومتري الإلزامي، بالإضافة إلى دفع تأمين ابتدائي يبدأ من 30,000.00 دج حسب فئة المركبة، ويعد هذا بمثابة ضمان لطلبه.<br><br>
                              <strong>3- الوقود:</strong> الوقود يكون على نفقة الزبون.<br><br>
                              <strong>4- قانون ونظام:</strong> يتم الدفع نقداً عند تسليم السيارة.<br><br>
                              <strong>5- النظافة:</strong> تسلم السيارة نظيفة ويجب إرجاعها في نفس الحالة، وفي حال عدم ذلك، سيتم احتساب تكلفة الغسيل بمبلغ 1000 دج.<br><br>
                              <strong>6- مكان التسليم:</strong> يتم تسليم السيارات في موقف السيارات التابع لوكالاتنا.<br><br>
                              <strong>7- جدول المواعيد:</strong> يجب على الزبون احترام المواعيد المحددة عند الحجز، يجب الإبلاغ مسبقاً عن أي تغيير. لا يمكن للزبون تمديد مدة الإيجار إلا بعد الحصول على إذن من وكالتنا للإيجار، وذلك بإشعار مسبق لا يقل عن 48 ساعة.<br><br>
                              <strong>8- الأضرار والخسائر:</strong> التأمين الأساسي: يلتزم الزبون بدفع جميع الأضرار التي تلحق بالمركبة سواء كان مخطئاً أو غير مخطئ. أي ضرر يلحق بالمركبة سيؤدي إلى خصم من مبلغ الضمان.<br><br>
                              <strong>9- عند السرقة:</strong> في حالة السرقة أو تضرر المركبة، يجب تقديم تصريح لدى مصالح الشرطة أو الدرك الوطني قبل أي تصريح، يجب على الزبون إبلاغ وكالة الكراء بشكل إلزامي.<br><br>
                              <strong>10- تأمين:</strong> يستفيد من التأمين فقط السائقون المذكورون في عقد الكراء، يُمنع منعاً باتاً إعارة أو تأجير المركبة من الباطن، وتكون جميع الأضرار الناتجة عن مثل هذه الحالات على عاتق الزبون بالكامل.<br><br>
                              <strong>11- عطل ميكانيكي:</strong> خلال فترة الإيجار، وبناءً على عدد الكيلومترات المقطوعة، يجب على الزبون إجراء الفحوصات اللازمة مثل مستوى الزيت، حالة المحرك، ضغط الإطارات. في حال حدوث عطل ميكانيكي بسبب إهمال الزبون، فإن تكاليف الإصلاح والصيانة تكون على عاتق الزبون بالكامل.<br><br>
                              <strong>12- خسائر إضافية:</strong> الأضرار التي تلحق بالعجلات والإطارات، القيادة بالإطارات المفرغة من الهواء، التدهور، السرقة، نهب الملحقات، أعمال التخريب، كلها سيتم تحميل تكلفتها على الزبون.<br><br>
                              <strong>13- ضريبة التأخير:</strong> مدة الإيجار تُحتسب على فترات كاملة مدتها 24 ساعة غير قابلة للتقسيم. يجب على الزبون إعادة المركبة في نفس الوقت، وإلا سيتم احتساب تكلفة تأخير مقدارها 800 دينار لكل ساعة تأخير.<br><br>
                              <strong>14- عدد الأميال:</strong> عدد الكيلومترات محدود بـ 300 كم يومياً، ويفرض غرامة قدرها 30 دج عن كل كيلومتر زائد.<br><br>
                              <strong>15- شروط:</strong> يقر الزبون بأنه اطلع على شروط الإيجار هذه وقبلها دون أي تحفظ، ويتعهد بتوقيع هذا العقد.<br>
                            </div>
                            <div class="section-header indigo">الموافقة والتوقيع</div>
                            <div class="signature-box" style="text-align: center;">
                              <strong>امضاء وبصمة الزبون<br>Signature et Empreinte du Client</strong><br><br>
                            </div>
                          </div>
                        </body>
                        </html>
                      `;
                      
                      printWindow.document.write(htmlContent);
                      printWindow.document.close();
                      
                      setTimeout(() => {
                        printWindow.focus();
                        printWindow.print();
                      }, 500);
                    }} className="!px-10 !py-4 shadow-xl">Imprimer Document</GradientButton>
                    <button onClick={() => setActiveModal(null)} className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-2xl shadow-sm hover:text-red-500 transition-all">✕</button>
                 </div>
              </div>
              
              <div className="flex-1 bg-gray-100 p-16 overflow-y-auto custom-scrollbar flex justify-center">
                 <div className="bg-white shadow-2xl relative" style={{ width: `${selectedTemplate.canvasWidth}px`, height: `${selectedTemplate.canvasHeight}px` }}>
                    {selectedTemplate.elements.map((el: any) => (
                      <div key={el.id} className="absolute" style={{
                         left: `${el.x}px`, top: `${el.y}px`, width: `${el.width}px`, height: el.type === 'divider' ? `${el.height}px` : 'auto',
                         minHeight: `${el.height}px`, fontSize: `${el.fontSize}px`, color: el.color, backgroundColor: el.backgroundColor,
                         fontFamily: el.fontFamily, fontWeight: el.fontWeight as any, textAlign: el.textAlign, borderRadius: `${el.borderRadius}px`,
                         padding: `${el.padding}px`, borderWidth: `${el.borderWidth}px`, borderColor: el.borderColor, opacity: el.opacity,
                         zIndex: el.zIndex, whiteSpace: 'pre-wrap', lineHeight: el.lineHeight
                      }}>
                         {/* Variable Replacement Logic */}
                         {el.type === 'logo' && <div className="w-full h-full flex items-center justify-center font-black opacity-30 uppercase tracking-tighter">{el.content}</div>}
                         {el.type === 'table' && (
                           <div className="w-full border-t-2 border-gray-900 mt-4 overflow-hidden">
                              <table className="w-full text-[9px] font-black uppercase">
                                 <thead className="bg-gray-50/50"><tr className="border-b"><th className="p-2 text-left">Désignation</th><th className="p-2 text-center">Qté</th><th className="p-2 text-right">Total HT</th></tr></thead>
                                 <tbody className="opacity-40">
                                   <tr><td className="p-2 border-b">{replaceVariables("LOCATION VÉHICULE {{vehicle_brand}} {{vehicle_model}}", selectedRes)}</td><td className="p-2 border-b text-center">--</td><td className="p-2 border-b text-right">{replaceVariables("{{total_amount}}", selectedRes)} DZ</td></tr>
                                 </tbody>
                              </table>
                           </div>
                         )}
                         {el.type === 'signature' && <div className="w-full h-full flex flex-col justify-between"><span className="text-[8px] font-black uppercase text-gray-300 border-b border-gray-100 pb-1">{el.content}</span><div className="flex-1 py-8 flex items-center justify-center opacity-10"><span className="text-4xl italic">Signature</span></div></div>}
                         {el.type === 'checklist' && (() => {
                           let items: { label: string; checked: boolean }[] = [];
                           try { items = JSON.parse(el.content || '[]'); } catch (e) { items = []; }
                           return (
                             <div className="p-4 text-[10px]">
                               {items.map((it:any, idx:number) => (
                                 <div key={idx} className="flex items-center gap-3 py-1"><div className={`w-4 h-4 rounded-sm border ${it.checked ? 'bg-green-600 border-green-600' : 'bg-white border-gray-300'}`} /> <div className={`${it.checked ? 'line-through text-gray-400' : ''}`}>{it.label}</div></div>
                               ))}
                             </div>
                           );
                         })()}
                         {el.type !== 'logo' && el.type !== 'table' && el.type !== 'signature' && el.type !== 'checklist' && replaceVariables(el.content, selectedRes)}
                      </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* --- DETAILS MODAL (Détails de Réservation) --- */}
      {activeModal === 'details' && selectedRes && (
        <ModalBase title="Détails Complets de la Réservation" onClose={() => setActiveModal(null)} maxWidth="max-w-4xl">
          <div className="space-y-8">
            {/* Header with Vehicle and Status */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Vehicle Image */}
              <div className="lg:col-span-1">
                <img src={getVehicle(selectedRes.vehicleId)?.mainImage} alt="vehicle" className="w-full h-64 object-cover rounded-[2.5rem] shadow-xl border-4 border-gray-100" />
              </div>

              {/* Vehicle & Reservation Info */}
              <div className="lg:col-span-2 space-y-6">
                {/* Reservation Number & Status */}
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <p className="text-[11px] font-black text-blue-600 uppercase tracking-widest mb-2">Numéro Dossier</p>
                    <p className="text-3xl font-black text-gray-900">#{selectedRes.reservationNumber}</p>
                  </div>
                  <span className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase text-white shadow-xl ${
                    selectedRes.status === 'en cours' ? 'bg-green-600' :
                    selectedRes.status === 'confermer' ? 'bg-blue-600' :
                    selectedRes.status === 'terminer' ? 'bg-gray-600' :
                    selectedRes.status === 'annuler' ? 'bg-red-600' :
                    'bg-yellow-600'
                  }`}>{selectedRes.status}</span>
                </div>

                {/* Vehicle Info */}
                <div className="p-6 bg-blue-50 rounded-[2rem] border border-blue-100">
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3">Véhicule</p>
                  <p className="text-2xl font-black text-gray-900 mb-2">{getVehicle(selectedRes.vehicleId)?.brand} {getVehicle(selectedRes.vehicleId)?.model}</p>
                  <div className="grid grid-cols-2 gap-4 text-[10px] font-bold text-gray-600 pt-4 border-t border-blue-200">
                    <div><span className="text-blue-600 font-black">Immatriculation:</span> {getVehicle(selectedRes.vehicleId)?.immatriculation}</div>
                    <div><span className="text-blue-600 font-black">Année:</span> {getVehicle(selectedRes.vehicleId)?.year}</div>
                    <div><span className="text-blue-600 font-black">Couleur:</span> {getVehicle(selectedRes.vehicleId)?.color}</div>
                    <div><span className="text-blue-600 font-black">Type Carburant:</span> {getVehicle(selectedRes.vehicleId)?.fuelType}</div>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="p-6 bg-green-50 rounded-[2rem] border border-green-100">
                  <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-3">Locataire</p>
                  <p className="text-2xl font-black text-gray-900 mb-2">{getCustomer(selectedRes.customerId)?.firstName} {getCustomer(selectedRes.customerId)?.lastName}</p>
                  <div className="grid grid-cols-2 gap-4 text-[10px] font-bold text-gray-600 pt-4 border-t border-green-200">
                    <div><span className="text-green-600 font-black">Téléphone:</span> {getCustomer(selectedRes.customerId)?.phone}</div>
                    <div><span className="text-green-600 font-black">Email:</span> {getCustomer(selectedRes.customerId)?.email}</div>
                    <div><span className="text-green-600 font-black">Permis:</span> {getCustomer(selectedRes.customerId)?.licenseNumber}</div>
                    <div><span className="text-green-600 font-black">Expiration:</span> {new Date(getCustomer(selectedRes.customerId)?.licenseExpiry || '').toLocaleDateString()}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Dates & Duration */}
            <div className="grid grid-cols-3 gap-6">
              <div className="p-6 bg-purple-50 rounded-[2rem] border border-purple-100 text-center">
                <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-3">Date Départ</p>
                <p className="text-2xl font-black text-gray-900">{new Date(selectedRes.startDate).toLocaleDateString('fr-FR', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</p>
                <p className="text-[9px] font-bold text-gray-500 mt-2">{new Date(selectedRes.startDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <div className="p-6 bg-orange-50 rounded-[2rem] border border-orange-100 text-center flex flex-col justify-center">
                <p className="text-4xl font-black text-orange-600 mb-2">→</p>
                <p className="text-2xl font-black text-gray-900">{calculateDays(selectedRes.startDate, selectedRes.endDate)} jours</p>
              </div>
              <div className="p-6 bg-pink-50 rounded-[2rem] border border-pink-100 text-center">
                <p className="text-[10px] font-black text-pink-600 uppercase tracking-widest mb-3">Date Retour</p>
                <p className="text-2xl font-black text-gray-900">{new Date(selectedRes.endDate).toLocaleDateString('fr-FR', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</p>
                <p className="text-[9px] font-bold text-gray-500 mt-2">{new Date(selectedRes.endDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>

            {/* Pickup & Return Agencies */}
            <div className="grid grid-cols-2 gap-6">
              <div className="p-6 bg-indigo-50 rounded-[2rem] border border-indigo-100">
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-3">📍 Lieu de Prise en Charge</p>
                <p className="text-lg font-black text-gray-900">{agencies.find(a => a.id === selectedRes.pickupAgencyId)?.name || 'Non défini'}</p>
                <p className="text-[9px] font-bold text-gray-600 mt-2">{agencies.find(a => a.id === selectedRes.pickupAgencyId)?.address}</p>
              </div>
              <div className="p-6 bg-cyan-50 rounded-[2rem] border border-cyan-100">
                <p className="text-[10px] font-black text-cyan-600 uppercase tracking-widest mb-3">📍 Lieu de Retour</p>
                <p className="text-lg font-black text-gray-900">{agencies.find(a => a.id === selectedRes.returnAgencyId)?.name || 'Non défini'}</p>
                <p className="text-[9px] font-bold text-gray-600 mt-2">{agencies.find(a => a.id === selectedRes.returnAgencyId)?.address}</p>
              </div>
            </div>

            {/* Check-in & Check-out Logs */}
            {(selectedRes.activationLog || selectedRes.terminationLog) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {selectedRes.activationLog && (
                  <div className="p-6 bg-yellow-50 rounded-[2rem] border-2 border-yellow-200">
                    <p className="text-[10px] font-black text-yellow-600 uppercase tracking-widest mb-4">✅ Check-in (Mise en Circulation)</p>
                    <div className="space-y-3 text-[10px]">
                      <div className="flex justify-between"><span className="font-black text-gray-600">Kilométrage:</span> <span className="font-black text-yellow-900">{selectedRes.activationLog.mileage} KM</span></div>
                      <div className="flex justify-between"><span className="font-black text-gray-600">Carburant:</span> <span className="font-black text-yellow-900">⛽ {selectedRes.activationLog.fuel?.toUpperCase()}</span></div>
                      <div className="flex justify-between"><span className="font-black text-gray-600">Localisation:</span> <span className="font-black text-yellow-900">{selectedRes.activationLog.location}</span></div>
                      <div className="flex justify-between"><span className="font-black text-gray-600">Date:</span> <span className="font-black text-yellow-900">{new Date(selectedRes.activationLog.date).toLocaleString()}</span></div>
                      {selectedRes.activationLog.notes && <div className="pt-2 border-t border-yellow-200"><span className="font-black text-gray-600">Notes:</span> <p className="text-yellow-900 mt-1">{selectedRes.activationLog.notes}</p></div>}
                    </div>
                  </div>
                )}
                {selectedRes.terminationLog && (
                  <div className="p-6 bg-red-50 rounded-[2rem] border-2 border-red-200">
                    <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-4">🔒 Check-out (Clôture)</p>
                    <div className="space-y-3 text-[10px]">
                      <div className="flex justify-between"><span className="font-black text-gray-600">Kilométrage:</span> <span className="font-black text-red-900">{(selectedRes.terminationLog as any)?.mileage} KM</span></div>
                      <div className="flex justify-between"><span className="font-black text-gray-600">Distance:</span> <span className="font-black text-red-900">{((selectedRes.terminationLog as any)?.mileage || 0) - (selectedRes.activationLog?.mileage || 0)} KM</span></div>
                      <div className="flex justify-between"><span className="font-black text-gray-600">Carburant:</span> <span className="font-black text-red-900">⛽ {(selectedRes.terminationLog as any)?.fuel?.toUpperCase()}</span></div>
                      <div className="flex justify-between"><span className="font-black text-gray-600">Localisation:</span> <span className="font-black text-red-900">{(selectedRes.terminationLog as any)?.location}</span></div>
                      {(selectedRes.terminationLog as any)?.notes && <div className="pt-2 border-t border-red-200"><span className="font-black text-gray-600">Notes:</span> <p className="text-red-900 mt-1">{(selectedRes.terminationLog as any)?.notes}</p></div>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Pricing & Payment */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-6 bg-blue-50 rounded-[2rem] border border-blue-100 text-center">
                <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-2">Montant Total</p>
                <p className="text-2xl font-black text-blue-900">{selectedRes.totalAmount.toLocaleString()}</p>
                <p className="text-[8px] font-bold text-blue-600 mt-1">DZ</p>
              </div>
              <div className="p-6 bg-green-50 rounded-[2rem] border border-green-100 text-center">
                <p className="text-[9px] font-black text-green-600 uppercase tracking-widest mb-2">Montant Payé</p>
                <p className="text-2xl font-black text-green-900">{selectedRes.paidAmount.toLocaleString()}</p>
                <p className="text-[8px] font-bold text-green-600 mt-1">DZ</p>
              </div>
              <div className={`p-6 rounded-[2rem] border text-center ${selectedRes.totalAmount - selectedRes.paidAmount > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                <p className={`text-[9px] font-black uppercase tracking-widest mb-2 ${selectedRes.totalAmount - selectedRes.paidAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>Reste à Payer</p>
                <p className={`text-2xl font-black ${selectedRes.totalAmount - selectedRes.paidAmount > 0 ? 'text-red-900' : 'text-green-900'}`}>{(selectedRes.totalAmount - selectedRes.paidAmount).toLocaleString()}</p>
                <p className={`text-[8px] font-bold mt-1 ${selectedRes.totalAmount - selectedRes.paidAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>DZ</p>
              </div>
              <div className="p-6 bg-purple-50 rounded-[2rem] border border-purple-100 text-center">
                <p className="text-[9px] font-black text-purple-600 uppercase tracking-widest mb-2">Caution</p>
                <p className="text-2xl font-black text-purple-900">{selectedRes.cautionAmount.toLocaleString()}</p>
                <p className="text-[8px] font-bold text-purple-600 mt-1">DZ</p>
              </div>
            </div>

            {/* Options & Extras */}
            {selectedRes.options && selectedRes.options.length > 0 && (
              <div className="p-6 bg-amber-50 rounded-[2rem] border border-amber-100">
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-4">🎁 Options & Services Additionnels</p>
                <div className="space-y-3">
                  {selectedRes.options.map((opt, idx) => (
                    <div key={idx} className="flex justify-between items-center py-2 border-b border-amber-200 last:border-b-0">
                      <span className="font-bold text-gray-700">{opt.name}</span>
                      <div className="flex gap-4 items-center">
                        <span className="text-[9px] bg-amber-200 text-amber-900 px-3 py-1 rounded-lg font-black">{opt.category}</span>
                        <span className="font-black text-amber-900">{opt.price.toLocaleString()} DZ</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Additional Info */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-4 bg-gray-50 rounded-[1.5rem] border border-gray-100 text-center">
                <p className="text-[9px] font-black text-gray-600 uppercase mb-1">Remise</p>
                <p className="text-xl font-black text-gray-900">{selectedRes.discount} DZ</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-[1.5rem] border border-gray-100 text-center">
                <p className="text-[9px] font-black text-gray-600 uppercase mb-1">TVA</p>
                <p className="text-xl font-black text-gray-900">{selectedRes.withTVA ? '19%' : 'Non'}</p>
              </div>
              {selectedRes.driverId && (
                <div className="p-4 bg-gray-50 rounded-[1.5rem] border border-gray-100 text-center">
                  <p className="text-[9px] font-black text-gray-600 uppercase mb-1">Chauffeur</p>
                  <p className="text-sm font-black text-gray-900">{workers.find(w => w.id === selectedRes.driverId)?.fullName || 'N/A'}</p>
                </div>
              )}
              <div className="p-4 bg-gray-50 rounded-[1.5rem] border border-gray-100 text-center">
                <p className="text-[9px] font-black text-gray-600 uppercase mb-1">Date Création</p>
                <p className="text-sm font-black text-gray-900">{new Date(selectedRes.startDate).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: '2-digit' })}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-6 border-t border-gray-100">
              <button onClick={() => setActiveModal(null)} className="flex-1 py-4 bg-gray-50 text-gray-600 rounded-2xl font-black uppercase text-[10px] hover:bg-gray-100 transition-all">
                Fermer
              </button>
              {(selectedRes.totalAmount - selectedRes.paidAmount) > 0 && (
                <button 
                  onClick={() => { setActiveModal('pay'); }}
                  className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg hover:shadow-xl transition-all">
                  💰 Régler Dette
                </button>
              )}
            </div>
          </div>
        </ModalBase>
      )}

      {/* --- PAY MODAL (Régler Dette) --- */}
      {activeModal === 'pay' && selectedRes && (
        <ModalBase title="Règlement de Dette" onClose={() => setActiveModal(null)} maxWidth="max-w-xl">
           <div className="flex flex-col items-center space-y-10 py-4">
              {/* Actual Debt Card */}
              <div className="w-full bg-red-50/40 rounded-[3.5rem] p-12 text-center border border-red-100/50 relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-full h-1 bg-red-200/20"></div>
                 <p className="text-red-400 font-black text-[11px] uppercase tracking-[0.2em] mb-4">DETTE ACTUELLE</p>
                 <p className="text-[5.5rem] font-black text-red-600 leading-none tracking-tighter">
                    {(selectedRes.totalAmount - selectedRes.paidAmount).toLocaleString()}
                 </p>
                 <p className="text-2xl font-black text-red-600 mt-6 tracking-widest uppercase opacity-60">DZ</p>
              </div>

              {/* Input Section */}
              <div className="w-full space-y-8">
                 <div className="flex items-center justify-between px-4">
                    <p className="text-gray-400 font-black text-[11px] uppercase tracking-[0.2em]">{lang === 'fr' ? "MONTANT À VERSER" : "المبلغ المراد دفعه"}</p>
                    <button 
                      onClick={() => setPaymentAmount(selectedRes.totalAmount - selectedRes.paidAmount)}
                      className="text-[10px] font-black text-blue-600 uppercase hover:underline flex items-center gap-2"
                    >
                      <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
                      Solder tout
                    </button>
                 </div>
                 
                 <div className="relative h-36 bg-[#0a0f1c] rounded-[3.5rem] flex items-center px-10 shadow-[0_30px_70px_-10px_rgba(0,0,0,0.5)] overflow-hidden border border-white/10 group">
                    <div className="text-3xl font-black text-gray-600 select-none mr-4">DZ</div>
                    
                    <input 
                       type="number" 
                       value={paymentAmount || ''} 
                       onChange={e => {
                         const val = Number(e.target.value);
                         const max = selectedRes.totalAmount - selectedRes.paidAmount;
                         setPaymentAmount(Math.min(val, max));
                       }} 
                       className="flex-1 bg-transparent text-white text-[4.5rem] font-black outline-none text-right pr-4 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                       placeholder="0"
                       autoFocus
                    />
                    
                    <div className="w-px h-16 bg-white/10 mx-6"></div>
                    
                    <div className="flex flex-col gap-3">
                       <button 
                         type="button" 
                         onClick={() => setPaymentAmount(prev => Math.min(prev + 1000, selectedRes.totalAmount - selectedRes.paidAmount))}
                         className="p-1 hover:text-white text-gray-500 transition-colors"
                       >
                         <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                       </button>
                       <button 
                         type="button" 
                         onClick={() => setPaymentAmount(prev => Math.max(0, prev - 1000))}
                         className="p-1 hover:text-white text-gray-500 transition-colors"
                       >
                         <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                       </button>
                    </div>
                 </div>

                 {/* Quick Action Presets */}
                 <div className="grid grid-cols-3 gap-3 px-2">
                    {[1000, 5000, 10000].map(val => (
                       <button 
                        key={val}
                        onClick={() => setPaymentAmount(prev => Math.min(prev + val, selectedRes.totalAmount - selectedRes.paidAmount))}
                        className="py-4 bg-gray-50 rounded-2xl font-black text-[10px] text-gray-500 hover:bg-blue-600 hover:text-white transition-all uppercase tracking-widest border border-transparent active:scale-95"
                       >
                        +{val.toLocaleString()} DZ
                       </button>
                    ))}
                 </div>
              </div>

              {/* Confirm Button */}
              <div className="w-full pt-4">
                <GradientButton 
                  onClick={handlePayment} 
                  disabled={loading || paymentAmount <= 0} 
                  className="w-full !py-10 text-2xl uppercase tracking-widest rounded-[2.5rem] shadow-2xl transition-all active:scale-[0.98]"
                >
                   {loading ? (lang === 'fr' ? 'Traitement...' : 'جاري المعالجة...') : (lang === 'fr' ? 'Confirmer le versement →' : 'تأكيد الدفع ←')}
                </GradientButton>
              </div>
           </div>
        </ModalBase>
      )}

      {/* --- ACTIVATE MODAL (CHECK-IN) --- */}
      {activeModal === 'activate' && selectedRes && (
        <ModalBase title="Mise en Circulation (Check-in)" onClose={() => setActiveModal(null)} maxWidth="max-w-2xl">
           <div className="space-y-12">
              <div className="flex items-center gap-8 p-10 bg-blue-50/50 rounded-[3rem] border border-blue-100">
                 <img src={getVehicle(selectedRes.vehicleId)?.mainImage} className="w-40 h-28 object-cover rounded-2xl shadow-xl border-4 border-white" />
                 <div>
                    <h4 className="text-2xl font-black text-gray-900 uppercase">{getVehicle(selectedRes.vehicleId)?.brand} {getVehicle(selectedRes.vehicleId)?.model}</h4>
                    <p className="text-blue-600 font-black tracking-widest">{getVehicle(selectedRes.vehicleId)?.immatriculation}</p>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-10">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-4">Kilométrage de départ</label>
                    <input type="number" value={logData.mileage || ''} onChange={e => setLogData({...logData, mileage: Number(e.target.value)})} className="w-full px-8 py-8 bg-gray-50 rounded-[2rem] font-black text-6xl outline-none shadow-inner text-center" />
                 </div>
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-4">Lieu de prise en charge</label>
                    <select value={logData.location} onChange={e => setLogData({...logData, location: e.target.value})} className="w-full px-8 py-8 bg-gray-50 rounded-[2rem] font-black text-xl outline-none shadow-inner appearance-none">
                       {agencies.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                       <option value="Aéroport">Aéroport</option>
                    </select>
                 </div>
              </div>

              <div className="space-y-6">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-4">Niveau de Carburant</label>
                 <FuelSelector value={logData.fuel || 'plein'} onChange={v => setLogData({...logData, fuel: v})} />
              </div>

              <textarea placeholder="Notes optionnelles sur l'état..." value={logData.notes} onChange={e => setLogData({...logData, notes: e.target.value})} className="w-full p-8 bg-gray-50 rounded-[2.5rem] outline-none font-bold shadow-inner h-32 resize-none" />

              <GradientButton onClick={handleActivate} disabled={loading} className="w-full !py-10 text-2xl uppercase tracking-widest rounded-[2.5rem] shadow-2xl">
                 {loading ? 'Activation...' : 'Confirmer le départ et Activer →'}
              </GradientButton>
           </div>
        </ModalBase>
      )}

      {/* --- TERMINATE MODAL (CHECK-OUT) --- */}
      {activeModal === 'terminate' && selectedRes && (
        <ModalBase title="Clôture de la Location (Check-out)" onClose={() => setActiveModal(null)} maxWidth="max-w-6xl">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
              {/* Left Column: KM Tracking */}
              <div className="space-y-12">
                 <div className="bg-gray-900 rounded-[4rem] p-12 text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 opacity-5 text-9xl font-black rotate-12">KM</div>
                    <SectionHeader icon="🗺️" text="Suivi Kilométrique" dark />
                    
                    {/* Departure Mileage (Read-only) */}
                    <div className="mt-10 p-8 bg-white/5 rounded-3xl border border-white/10">
                       <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-3">Kilométrage au Départ (Check-in)</p>
                       <p className="text-5xl font-black text-white">{selectedRes.activationLog?.mileage || 0} <span className="text-2xl text-gray-400">KM</span></p>
                    </div>

                    {/* Return Mileage (Input) */}
                    <div className="mt-8 p-8 bg-blue-600/20 rounded-3xl border-2 border-blue-400">
                       <label className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-4 block">Kilométrage de Retour (Entrée Requise)</label>
                       <input 
                          type="number" 
                          value={termData.mileage} 
                          onChange={e => setTermData({...termData, mileage: Number(e.target.value)})} 
                          placeholder="Saisissez le kilométrage du compteur"
                          className="w-full bg-white/10 p-6 rounded-2xl text-4xl font-black text-right outline-none border border-blue-400/50 focus:border-blue-300 focus:bg-white/15 transition-all placeholder-gray-400"
                       />
                    </div>

                    {/* Distance Calculation */}
                    <div className="mt-10 pt-10 border-t border-white/20 space-y-4">
                       <p className="text-xs font-black uppercase text-gray-400">Distance Totale Parcourue</p>
                       <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-3xl p-8 text-center">
                          <p className="text-7xl font-black text-white">{Math.max(0, termData.mileage - (selectedRes.activationLog?.mileage || 0))}</p>
                          <p className="text-2xl font-black text-blue-100 mt-2">KM</p>
                       </div>
                    </div>
                 </div>

                 <div className="p-10 bg-blue-50/50 rounded-[4rem] border border-blue-100">
                    <p className="text-[10px] font-black text-blue-600 uppercase mb-4 tracking-widest">⛽ Niveau Carburant (Départ: {selectedRes.activationLog?.fuel?.toUpperCase()})</p>
                    <FuelSelector value={termData.fuel} onChange={v => setTermData({...termData, fuel: v})} />
                 </div>
              </div>

              {/* Right Column: Fees & Finish */}
              <div className="space-y-12 bg-white p-12 rounded-[4rem] shadow-inner border border-gray-50 flex flex-col">
                 <div className="relative overflow-hidden p-8 border-2 border-dashed border-gray-100 rounded-[3rem]">
                    <div className="absolute -top-4 -right-4 opacity-5 text-7xl font-black rotate-12">FRAIS</div>
                    <SectionHeader icon="💸" text="Frais Supplémentaires de Clôture" />
                    <div className="space-y-6 mt-10">
                       <div className="flex justify-between items-center bg-red-50/50 p-6 rounded-3xl">
                          <div><p className="text-xs font-black text-gray-900 uppercase">Kilométrage Excédentaire</p><p className="text-[9px] font-bold text-gray-400">Facturé si dépassement forfait</p></div>
                          <input type="number" value={termData.extraKmCost} onChange={e => setTermData({...termData, extraKmCost: Number(e.target.value)})} className="w-32 bg-white p-4 rounded-2xl font-black text-2xl text-right text-red-600 outline-none shadow-sm" />
                       </div>
                       <div className="flex justify-between items-center bg-red-50/50 p-6 rounded-3xl">
                          <div><p className="text-xs font-black text-gray-900 uppercase">Carburant Manquant</p><p className="text-[9px] font-bold text-gray-400">Différence par rapport au check-in</p></div>
                          <input type="number" value={termData.extraFuelCost} onChange={e => setTermData({...termData, extraFuelCost: Number(e.target.value)})} className="w-32 bg-white p-4 rounded-2xl font-black text-2xl text-right text-red-600 outline-none shadow-sm" />
                       </div>
                    </div>
                    <div className="mt-10 flex items-center justify-between">
                       <label className="flex items-center gap-4 cursor-pointer">
                          <input type="checkbox" checked={termData.withTva} onChange={e => setTermData({...termData, withTva: e.target.checked})} className="w-8 h-8 rounded-xl text-blue-600" />
                          <span className="text-[9px] font-black text-gray-400 uppercase">Appliquer TVA (19%)</span>
                       </label>
                       <p className="text-4xl font-black text-gray-900">{(termData.extraKmCost + termData.extraFuelCost) * (termData.withTva ? 1.19 : 1)} <span className="text-xs">DZ</span></p>
                    </div>
                 </div>

                 {/* Documents déposés en agence */}
                 <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                    <p className="text-sm font-black uppercase text-gray-500">Documents laissés par le client</p>
                    {termDocsLeft.length === 0 && <p className="text-[13px] text-gray-400">Aucun document trouvé pour ce client.</p>}
                    {termDocsLeft.map((d, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <input type="checkbox" checked={d.left} onChange={() => {
                            setTermDocsLeft(prev => prev.map((p,i)=> i===idx ? { ...p, left: !p.left } : p));
                          }} className="w-5 h-5" />
                          <div className="text-sm font-bold">{d.label}{d.url ? (<a className="text-blue-500 underline ml-2" href={d.url} target="_blank" rel="noreferrer">Voir</a>) : null}</div>
                        </div>
                        <div className="text-sm text-gray-500">{d.left ? 'Conservé en agence' : 'Retiré'}</div>
                      </div>
                    ))}

                    <div className="flex gap-3 pt-3">
                      <button onClick={() => markDocumentsTaken(true)} className="flex-1 px-4 py-3 bg-green-600 text-white rounded-2xl font-black">Client a récupéré</button>
                      <button onClick={() => markDocumentsTaken(false)} className="flex-1 px-4 py-3 bg-amber-500 text-white rounded-2xl font-black">Notifier client (non récupéré)</button>
                    </div>
                 </div>

                 <textarea placeholder="Note de clôture: observations sur l'état général au retour..." value={termData.notes} onChange={e => setTermData({...termData, notes: e.target.value})} className="w-full p-8 bg-gray-50 rounded-[2.5rem] outline-none font-bold shadow-inner h-32 resize-none mt-auto" />

                 <GradientButton onClick={handleTerminate} disabled={loading} className="w-full !py-10 text-3xl uppercase tracking-tighter rounded-[2.5rem] shadow-2xl mt-8">
                    ✅ {loading ? 'Clôture...' : 'Clôturer le Dossier'}
                 </GradientButton>
              </div>
           </div>
        </ModalBase>
      )}
    </div>
  );
};

const SectionHeader = ({ icon, text, dark }: { icon: string, text: string, dark?: boolean }) => (
  <div className={`flex items-center gap-3 ${dark ? 'text-blue-400' : 'text-green-600'}`}>
    <span className="text-2xl">{icon}</span>
    <h3 className={`text-[11px] font-black uppercase tracking-widest ${dark ? 'text-gray-300' : 'text-gray-900'}`}>{text}</h3>
  </div>
);

export default PlannerPage;
