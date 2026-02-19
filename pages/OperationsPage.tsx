
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Language, Inspection, Reservation, Vehicle, Customer, Damage } from '../types';
import { MOCK_RESERVATIONS, MOCK_CUSTOMERS, MOCK_VEHICLES, DEFAULT_TEMPLATES } from '../constants';
import { supabase } from '../lib/supabase';
import GradientButton from '../components/GradientButton';
import DocumentPersonalizer from '../components/DocumentPersonalizer';

interface OperationsPageProps {
  lang: Language;
  vehicles: Vehicle[];
  inspections: Inspection[];
  damages: Damage[];
  templates: any[];
  onUpdateTemplates?: (tpls: any[]) => void;
  onAddInspection: (insp: Inspection) => void;
  onUpdateInspection: (insp: Inspection) => void;
  onDeleteInspection: (id: string) => void;
  onUpdateVehicleMileage: (vehicleId: string, newMileage: number) => void;
  onAddDamage: (dmg: Damage) => void;
  onUpdateDamage: (dmg: Damage) => void;
  onDeleteDamage: (id: string) => void;
}

type OperationTab = 'inspection' | 'dommages';
type InspectionStep = 1 | 2 | 3;

interface ChecklistItemProps {
  checked: boolean;
  label: string;
  onToggle?: () => void;
}

const ChecklistItem: React.FC<ChecklistItemProps> = ({ checked, label, onToggle }) => (
  <button 
    type="button" 
    onClick={onToggle}
    disabled={!onToggle}
    className={`flex items-center justify-between p-5 rounded-3xl border-2 transition-all group ${checked ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-gray-100 text-gray-400 hover:border-blue-200'} ${!onToggle ? 'cursor-default' : ''}`}
  >
    <span className="text-[11px] font-black uppercase tracking-widest">{label}</span>
    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm ${checked ? 'bg-white text-blue-600' : 'bg-gray-100'}`}>
      {checked ? '✓' : '✕'}
    </div>
  </button>
);

const FuelSelector: React.FC<{ value: string, onChange: (v: string) => void, lang: Language }> = ({ value, onChange, lang }) => {
  const levels = [
    { id: 'plein', label: '8/8', icon: '⛽', color: 'bg-blue-600' },
    { id: '1/2', label: '1/2', icon: '🌗', color: 'bg-blue-500' },
    { id: '1/4', label: '1/4', icon: '🌘', color: 'bg-blue-400' },
    { id: '1/8', label: '1/8', icon: '🚨', color: 'bg-orange-500' },
    { id: 'vide', label: '0/0', icon: '⚠️', color: 'bg-red-600' }
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {levels.map((l) => (
        <button
          key={l.id}
          type="button"
          onClick={() => onChange(l.id)}
          className={`flex flex-col items-center p-4 rounded-3xl border-2 transition-all group ${value === l.id ? `${l.color} border-transparent text-white shadow-xl scale-105` : 'bg-white border-gray-100 text-gray-400 hover:border-blue-200'}`}
        >
          <span className="text-2xl group-hover:scale-125 transition-transform">{l.icon}</span>
          <span className="text-[9px] font-black mt-2 uppercase tracking-widest">{l.label}</span>
        </button>
      ))}
    </div>
  );
};

const SignaturePad: React.FC<{ onSave: (dataUrl: string) => void, isRtl: boolean, initialValue?: string }> = ({ onSave, isRtl, initialValue }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        if (initialValue) {
          const img = new Image();
          img.onload = () => ctx.drawImage(img, 0, 0);
          img.src = initialValue;
        }
      }
    }
  }, [initialValue]);

  const startDrawing = (e: any) => { setIsDrawing(true); draw(e); };
  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) onSave(canvas.toDataURL());
  };
  const draw = (e: any) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y);
  };
  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); onSave(''); }
  };

  return (
    <div className="relative group">
      <canvas ref={canvasRef} width={800} height={300} className="w-full bg-white border-4 border-dashed border-gray-200 rounded-[3rem] cursor-crosshair touch-none shadow-inner" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseOut={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
      <button type="button" onClick={clear} className="absolute bottom-6 right-6 px-8 py-3 bg-red-50 text-red-600 rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-sm">Effacer</button>
    </div>
  );
};

const OperationsPage: React.FC<OperationsPageProps> = ({ 
  lang, vehicles, inspections, damages, templates, onUpdateTemplates,
  onAddInspection, onUpdateInspection, onDeleteInspection, onUpdateVehicleMileage,
  onAddDamage, onUpdateDamage, onDeleteDamage
}) => {
  const [activeTab, setActiveTab] = useState<OperationTab>('inspection');
  const [isCreatingInsp, setIsCreatingInsp] = useState(false);
  const [editingInspId, setEditingInspId] = useState<string | null>(null);
  const [stepInsp, setStepInsp] = useState<InspectionStep>(1);
  const [searchResQuery, setSearchResQuery] = useState('');
  const [viewingInsp, setViewingInsp] = useState<Inspection | null>(null);
  const [allReservations, setAllReservations] = useState<Reservation[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);

  // Print State
  const [activePrintModal, setActivePrintModal] = useState<'print-view' | null>(null);
  const [printRes, setPrintRes] = useState<Reservation | null>(null);
  const [printTemplate, setPrintTemplate] = useState<any>(null);
  const [activeModal, setActiveModal] = useState<'print-choice' | 'personalize' | null>(null);
  const [selectedInspForPrint, setSelectedInspForPrint] = useState<Inspection | null>(null);

  // Damages State
  const [isCreatingDmg, setIsCreatingDmg] = useState(false);
  const [editingDmgId, setEditingDmgId] = useState<string | null>(null);
  const [viewingDmg, setViewingDmg] = useState<Damage | null>(null);
  const [searchDmgQuery, setSearchDmgQuery] = useState('');
  const [dmgFormData, setDmgFormData] = useState<Partial<Damage>>({
    severity: 'moyen',
    status: 'signale',
    location: '',
    description: '',
    estimatedCost: 0,
    notes: ''
  });

  const initialInspForm: Partial<Inspection> = {
    type: 'depart', 
    date: new Date().toISOString().split('T')[0], 
    fuel: 'plein',
    security: { lights: false, tires: false, brakes: false, wipers: false, mirrors: false, belts: false, horn: false },
    equipment: { spareWheel: false, jack: false, triangles: false, firstAid: false, docs: false },
    comfort: { ac: false }, 
    cleanliness: { interior: false, exterior: false },
    exteriorPhotos: [], 
    interiorPhotos: [], 
    signature: '',
    notes: ''
  };

  const [inspFormData, setInspFormData] = useState<Partial<Inspection>>(initialInspForm);
  const isRtl = lang === 'ar';

  const t = {
    fr: {
      inspection: 'Inspection', dommages: 'Dommages', history: 'Historique des Inspections',
      newBtn: 'Nouvelle Inspection',
      type: 'Type', date: 'Date', mileage: 'Kilométrage', fuel: 'Niveau Carburant',
      checkIn: 'Départ (Check-in)', checkOut: 'Retour (Check-out)',
      general: 'Informations Générales',
      security: 'Contrôle Sécurité',
      equipment: 'Équipements Obligatoires',
      comfort: 'Confort',
      cleanliness: 'État & Propreté',
      secItems: { lights: 'Feux & Phares', tires: 'Pneus (Usure/Pression)', brakes: 'Freins', wipers: 'Essuie-glaces', mirrors: 'Rétroviseurs', belts: 'Ceintures', horn: 'Klaxon' },
      eqItems: { spareWheel: 'Roue de secours', jack: 'Cric', triangles: 'Triangles', firstAid: 'Trousse secours', docs: 'Docs véhicule' },
      validate: 'Valider l\'inspection',
      next: 'Suivant', back: 'Retour',
      summary: 'Résumé de l\'inspection',
      photos: 'Photos & Validation',
      extPics: 'Photos Extérieur',
      intPics: 'Photos Intérieur',
      signature: 'Signature du Client',
      searchRes: 'Rechercher une réservation (Client)',
      vehicle: 'Véhicule',
      client: 'Locataire',
      printTitle: 'Aperçu Impression Document',
      damageHistory: 'Historique des Dommages',
      newDamage: 'Signaler un Dommage',
      location: 'Position sur le véhicule',
      description: 'Description du dommage',
      severity: 'Gravité',
      severe: 'Grave',
      medium: 'Moyen',
      light: 'Léger',
      cost: 'Coût estimé (DA)',
      status: 'Statut',
      reported: 'Signalé',
      inRepair: 'En réparation',
      repaired: 'Réparé',
      markRepaired: 'Marquer comme réparé'
    },
    ar: {
      inspection: 'معاينة', dommages: 'أضرار', history: 'سجل المعاينات',
      newBtn: 'معاينة جديدة',
      type: 'النوع', date: 'التاريخ', mileage: 'المسافة المقطوعة', fuel: 'مستوى الوقود',
      checkIn: 'انطلاق (Check-in)', checkOut: 'عودة (Check-out)',
      general: 'معلومات عامة',
      security: 'مراقبة الأمن',
      equipment: 'المعدات الإلزامية',
      comfort: 'الراحة',
      cleanliness: 'الحالة والنظافة',
      secItems: { lights: 'الأضواء', tires: 'الإطارات', brakes: 'المكابح', wipers: 'المساحات', mirrors: 'المرايا', belts: 'أحزمة الأمان', horn: 'المنبه' },
      eqItems: { spareWheel: 'عجلة احتياطية', jack: 'رافعة', triangles: 'مثلثات التحذير', firstAid: 'صيدلية', docs: 'وثائق المركبة' },
      validate: 'تأكيد المعاينة',
      next: 'التالي', back: 'رجوع',
      summary: 'ملخص المعاينة',
      photos: 'الصور والتأكيد',
      extPics: 'صور خارجية',
      intPics: 'صور داخلية',
      signature: 'توقيع الزبون',
      searchRes: 'بحث عن حجز (الزبون)',
      vehicle: 'المركبة',
      client: 'الزبون',
      printTitle: 'معاينة طباعة الوثيقة',
      damageHistory: 'سجل الأضرار',
      newDamage: 'الإبلاغ عن ضرر',
      location: 'الموقع على المركبة',
      description: 'وصف الضرر',
      severity: 'درجة الخطورة',
      severe: 'شديد',
      medium: 'متوسط',
      light: 'خفيف',
      cost: 'التكلفة المقدرة (دج)',
      status: 'الحالة',
      reported: 'مُبلّغ عنه',
      inRepair: 'تحت الإصلاح',
      repaired: 'تم إصلاحه',
      markRepaired: 'وضع علامة مصلح'
    }
  }[lang];

  // Fetch reservations and customers from Supabase
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resData, custData] = await Promise.all([
          supabase.from('reservations').select('*'),
          supabase.from('customers').select('*')
        ]);
        if (resData.data) setAllReservations(resData.data as any);
        if (custData.data) setAllCustomers(custData.data as any);
      } catch (err) {
        console.error('Error fetching data:', err);
        setAllReservations(MOCK_RESERVATIONS);
        setAllCustomers(MOCK_CUSTOMERS);
      }
    };
    fetchData();
  }, []);

  // Auto-search with database
  const filteredReservations = useMemo(() => {
    if (!searchResQuery.trim()) return [];
    const query = searchResQuery.toLowerCase();
    const results = allReservations.filter(res => {
      const customer = allCustomers.find(c => c.id === res.customer_id);
      if (!customer) return false;
      const name = `${customer.first_name} ${customer.last_name}`.toLowerCase();
      const resNum = (res.reservation_number || '').toLowerCase();
      return name.includes(query) || resNum.includes(query);
    }).slice(0, 8);
    return results;
  }, [searchResQuery, allReservations, allCustomers]);

  // Auto-search for damages form
  const filteredReservationsForDmg = useMemo(() => {
    if (!searchDmgQuery.trim()) return [];
    const query = searchDmgQuery.toLowerCase();
    const results = allReservations.filter(res => {
      const customer = allCustomers.find(c => c.id === res.customer_id);
      if (!customer) return false;
      const name = `${customer.first_name} ${customer.last_name}`.toLowerCase();
      const resNum = (res.reservation_number || '').toLowerCase();
      return name.includes(query) || resNum.includes(query);
    }).slice(0, 8);
    return results;
  }, [searchDmgQuery, allReservations, allCustomers]);

  const handleToggleCheck = (category: keyof Inspection, field: string) => {
    setInspFormData(prev => ({
      ...prev,
      [category]: { ...(prev[category] as any), [field]: !(prev[category] as any)[field] }
    }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'exteriorPhotos' | 'interiorPhotos') => {
    if (e.target.files) {
      const files = Array.from(e.target.files).map((file: File) => URL.createObjectURL(file));
      setInspFormData(prev => ({
        ...prev, [type]: [...(prev[type] || []), ...files]
      }));
    }
  };

  const handleFinishInsp = () => {
    const finalData = { ...inspFormData as Inspection, id: editingInspId || `insp-${Date.now()}` };
    if (editingInspId) onUpdateInspection(finalData);
    else onAddInspection(finalData);
    setIsCreatingInsp(false); setEditingInspId(null); setStepInsp(1); setInspFormData(initialInspForm);
  };

  const buildInspectionTemplate = (insp: Inspection, res: any, typeLabel: string) => {
    const lines: string[] = [];
    const sec = insp.security || {};
    const eq = insp.equipment || {};
    const conf = insp.comfort || {};
    const clean = insp.cleanliness || {};

    lines.push('🛡️\nContrôle Sécurité\n');
    const secItems = ['lights','tires','brakes','wipers','mirrors','belts','horn'];
    const secLabels: Record<string,string> = { lights: 'Feux & Phares', tires: 'Pneus (Usure/Pression)', brakes: 'Freins', wipers: 'Essuie-glaces', mirrors: 'Rétroviseurs', belts: 'Ceintures', horn: 'Klaxon' };
    secItems.forEach(k => lines.push(`${secLabels[k]}: ${sec[k] ? '✔' : '✘'}`));

    lines.push('\n🧰\nÉquipements Obligatoires\n');
    const eqItems = ['spareWheel','jack','triangles','firstAid','docs'];
    const eqLabels: Record<string,string> = { spareWheel: 'Roue de secours', jack: 'Cric', triangles: 'Triangles', firstAid: 'Trousse secours', docs: 'Docs véhicule' };
    eqItems.forEach(k => lines.push(`${eqLabels[k]}: ${eq[k] ? '✔' : '✘'}`));

    lines.push('\nConfort\n');
    lines.push(`Climatisation (A/C): ${conf?.ac ? '✔' : '✘'}`);

    lines.push('\nÉtat & Propreté\n');
    lines.push(`Intérieur Propre: ${clean?.interior ? '✔' : '✘'}`);
    lines.push(`Extérieur Propre: ${clean?.exterior ? '✔' : '✘'}`);

    const content = lines.join('\n');

    return {
      id: `insp-tpl-${Date.now()}`,
      name: `${typeLabel} - P.V d'Inspection #${res?.reservation_number || res?.reservationNumber || ''}`,
      category: typeLabel.toLowerCase().includes('départ') ? 'checkin' : 'checkout',
      canvasWidth: 595,
      canvasHeight: 842,
      elements: [
        { id: 'title', type: 'static', content: `${typeLabel} - Rapport d'Inspection`, x: 40, y: 40, fontSize: 20, fontWeight: '900', color: '#111827' },
        { id: 'meta', type: 'static', content: `Dossier: ${res?.reservation_number || res?.reservationNumber || ''}\nClient: ${res?.customer_name || ''}\nDate: ${insp.date}`, x: 40, y: 80, fontSize: 10, fontWeight: '700' },
        { id: 'checklist', type: 'static', content, x: 40, y: 140, fontSize: 11, fontWeight: '700' }
      ]
    };
  };

  const handlePrint = (resId: string, category: string) => {
    const res = allReservations.find(r => r.id === resId);
    // try find template by exact category or aliases
    const aliasMap: Record<string, string[]> = {
      invoice: ['invoice', 'facture', 'invoice'],
      contract: ['contract', 'contrat'],
      devis: ['devis', 'quote'],
      checkin: ['checkin', 'pv_depart', 'pv-depart'],
      checkout: ['checkout', 'pv_retour', 'pv-retour'],
      versement: ['versement', 'payment', 'receipt']
    };

    const tryFind = (cat: string) => {
      let found = templates.find((t: any) => t.category === cat);
      if (found) return found;
      const aliases = aliasMap[cat] || [];
      for (const a of aliases) {
        found = templates.find((t: any) => t.category === a);
        if (found) return found;
      }
      return null;
    };

    let tpl = tryFind(category) || tryFind(category.toLowerCase());

    // if printing checkin/checkout and we have a selected inspection, create a dynamic template containing checklist
    if ((!tpl) && (category === 'checkin' || category === 'checkout') && selectedInspForPrint) {
      tpl = buildInspectionTemplate(selectedInspForPrint, res, selectedInspForPrint.type === 'depart' ? 'DÉPART' : 'RETOUR');
    }

    // fallback to a default invoice template if nothing found
    if (!tpl && DEFAULT_TEMPLATES && DEFAULT_TEMPLATES.length > 0) {
      tpl = DEFAULT_TEMPLATES.find((t:any) => t.category === 'invoice') || DEFAULT_TEMPLATES[0];
    }

    if (res && tpl) {
      setPrintRes(res);
      setPrintTemplate(tpl);
      setActivePrintModal('print-view');
      setActiveModal(null);
      setSelectedInspForPrint(null);
    }
  };

  // Helpers to normalize raw DB rows to the shapes used elsewhere
  const normalizeReservation = (r: any) => {
    if (!r) return null;
    return {
      id: r.id,
      reservationNumber: r.reservation_number || r.reservationNumber || '',
      customerId: r.customer_id || r.customerId || '',
      vehicleId: r.vehicle_id || r.vehicleId || '',
      startDate: r.start_date || r.startDate || '',
      endDate: r.end_date || r.endDate || '',
      status: r.status,
      totalAmount: r.total_amount || r.totalAmount || 0,
      paidAmount: r.paid_amount || r.paidAmount || 0,
      pickupAgencyId: r.pickup_agency_id || r.pickupAgencyId || '',
      returnAgencyId: r.return_agency_id || r.returnAgencyId || '',
      driverId: r.driver_id || r.driverId,
      cautionAmount: r.caution_amount || r.cautionAmount || 0,
      discount: r.discount || 0,
      withTVA: r.with_tva || r.withTVA || false,
      options: r.options || []
    } as Reservation;
  };

  const normalizeCustomer = (c: any) => {
    if (!c) return null;
    return {
      id: c.id,
      firstName: c.first_name || c.firstName || '',
      lastName: c.last_name || c.lastName || '',
      phone: c.phone || '',
      email: c.email || '',
      idCardNumber: c.id_card_number || c.idCardNumber || '',
      wilaya: c.wilaya || '',
      address: c.address || '',
      licenseNumber: c.license_number || c.licenseNumber || '',
      licenseExpiry: c.license_expiry || c.licenseExpiry || '',
      profilePicture: c.profile_picture || c.profilePicture || '',
      documentImages: c.document_images || c.documentImages || []
    } as Customer;
  };

  const replaceVariables = (content: string, res: any) => {
    const client = allCustomers.find(c => c.id === res.customer_id);
    const vehicle = vehicles.find(v => v.id === res.vehicle_id);
    return content
      .replace('{{client_name}}', `${client?.first_name} ${client?.last_name}`)
      .replace('{{client_phone}}', client?.phone || '')
      .replace('{{res_number}}', res.reservation_number)
      .replace('{{total_amount}}', (res.total_amount || 0).toLocaleString())
      .replace('{{vehicle_name}}', `${vehicle?.brand} ${vehicle?.model}`)
      .replace('{{vehicle_plate}}', vehicle?.immatriculation || '')
      .replace('{{current_date}}', new Date().toLocaleDateString());
  };

  const currentRes = allReservations.find(r => r.id === inspFormData.reservationId);
  const currentVeh = currentRes ? vehicles.find(v => v.id === currentRes.vehicle_id) : null;

  if (isCreatingInsp) {
    return (
      <div className={`p-4 md:p-8 animate-fade-in ${isRtl ? 'font-arabic text-right' : ''}`}>
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-10">
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">{editingInspId ? 'Modifier' : t.newBtn} <span className="text-blue-600">/ Étape {stepInsp} sur 3</span></h1>
            <button onClick={() => { setIsCreatingInsp(false); setEditingInspId(null); setInspFormData(initialInspForm); }} className="w-12 h-12 flex items-center justify-center bg-white rounded-2xl text-gray-400 hover:text-red-500 shadow-sm transition-all text-xl">✕</button>
          </div>

          <div className="bg-white rounded-[4rem] shadow-2xl border border-gray-100 overflow-hidden">
             
             {stepInsp === 1 && (
                <div className="p-10 md:p-16 space-y-12 animate-fade-in">
                   <div className="space-y-6">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-4">{t.searchRes}</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-8 flex items-center text-3xl opacity-30">{isLoadingSearch ? '⏳' : '🔍'}</span>
                        <input type="text" placeholder="Rechercher par nom ou numéro..." value={searchResQuery} onChange={(e) => setSearchResQuery(e.target.value)} className="w-full pl-20 pr-8 py-7 bg-gray-50 border-4 border-transparent focus:bg-white focus:border-blue-600 rounded-[3rem] outline-none font-black text-2xl transition-all shadow-inner" />
                        {filteredReservations.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-4 bg-white rounded-[3rem] shadow-2xl z-50 overflow-hidden border border-gray-100 max-h-96 overflow-y-auto">
                            {filteredReservations.map(res => {
                              const customer = allCustomers.find(c => c.id === res.customer_id);
                              return (
                              <button key={res.id} onClick={() => { setInspFormData({...inspFormData, reservationId: res.id}); setSearchResQuery(''); }} className="w-full text-left p-8 hover:bg-blue-50 border-b last:border-none flex justify-between items-center group">
                                <div className="flex items-center gap-6">
                                   <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center text-2xl group-hover:bg-blue-600 group-hover:text-white transition-all">👤</div>
                                   <div>
                                     <p className="font-black text-gray-900 text-lg">{customer?.first_name} {customer?.last_name}</p>
                                     <p className="text-xs font-bold text-gray-400 tracking-widest uppercase">Réservation: #{res.reservation_number}</p>
                                   </div>
                                </div>
                                <span className="px-4 py-2 bg-gray-100 rounded-full text-[10px] font-black uppercase text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-600">Sélectionner</span>
                              </button>
                            );
                            })}

                            
                          </div>
                        )}
                      </div>
                   </div>

                   {currentRes && (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-scale-in">
                        <div className="p-8 bg-blue-50 rounded-[3rem] flex items-center gap-6 border-2 border-blue-100">
                           <img src={currentVeh?.mainImage} className="w-24 h-16 rounded-2xl object-cover shadow-xl border-4 border-white" />
                           <div><h4 className="text-xl font-black text-gray-900 uppercase leading-none mb-1">{currentVeh?.brand} {currentVeh?.model}</h4><p className="text-xs font-black text-blue-600 tracking-tighter">{currentVeh?.immatriculation}</p></div>
                        </div>
                        <div className="p-8 bg-gray-50 rounded-[3rem] flex items-center gap-6 border-2 border-gray-100">
                           <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-3xl shadow-sm">🏁</div>
                           <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{t.type}</p>
                              <div className="flex bg-white p-1 rounded-xl">
                                 <button onClick={() => setInspFormData({...inspFormData, type: 'depart'})} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${inspFormData.type === 'depart' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>Check-in</button>
                                 <button onClick={() => setInspFormData({...inspFormData, type: 'retour'})} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${inspFormData.type === 'retour' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}>Check-out</button>
                              </div>
                           </div>
                        </div>
                     </div>
                   )}

                   <div className="pt-12 border-t border-gray-50">
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.4em] mb-10 text-center">--- {t.general} ---</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                         <div className="space-y-4">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-4">Odomètre (KM)</label>
                            <input type="number" value={inspFormData.mileage || ''} onChange={e => setInspFormData({...inspFormData, mileage: parseInt(e.target.value)})} className="w-full px-8 py-6 bg-gray-50 rounded-[2rem] font-black text-4xl outline-none shadow-inner text-gray-900" placeholder="00000" />
                         </div>
                         <div className="space-y-4">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-4">{t.fuel}</label>
                            <FuelSelector value={inspFormData.fuel!} onChange={v => setInspFormData({...inspFormData, fuel: v})} lang={lang} />
                         </div>
                      </div>
                   </div>
                </div>
             )}

             {stepInsp === 2 && (
                <div className="p-10 md:p-16 space-y-16 animate-fade-in bg-gray-50/30">
                   <div>
                      <h3 className="text-xs font-black text-blue-600 uppercase tracking-[0.3em] mb-8 flex items-center gap-4"><span className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-xl">🛡️</span> {t.security}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {(Object.keys(t.secItems) as (keyof typeof t.secItems & string)[]).map(k => (
                          <ChecklistItem key={k} checked={!!(inspFormData.security && inspFormData.security[k as keyof typeof t.secItems])} label={t.secItems[k as keyof typeof t.secItems] as string} onToggle={() => handleToggleCheck('security', k)} />
                        ))}
                      </div>
                   </div>
                   <div>
                      <h3 className="text-xs font-black text-orange-600 uppercase tracking-[0.3em] mb-8 flex items-center gap-4"><span className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-xl">🧰</span> {t.equipment}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {(Object.keys(t.eqItems) as (keyof typeof t.eqItems & string)[]).map(k => (
                          <ChecklistItem key={k} checked={!!(inspFormData.equipment && inspFormData.equipment[k as keyof typeof t.eqItems])} label={t.eqItems[k as keyof typeof t.eqItems] as string} onToggle={() => handleToggleCheck('equipment', k)} />
                        ))}
                      </div>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div>
                        <h3 className="text-xs font-black text-green-600 uppercase tracking-[0.3em] mb-6">{t.comfort}</h3>
                        <ChecklistItem checked={inspFormData.comfort?.ac || false} label="Climatisation (A/C)" onToggle={() => handleToggleCheck('comfort', 'ac')} />
                      </div>
                      <div>
                        <h3 className="text-xs font-black text-purple-600 uppercase tracking-[0.3em] mb-6">{t.cleanliness}</h3>
                        <div className="grid grid-cols-2 gap-4">
                           <ChecklistItem checked={inspFormData.cleanliness?.interior || false} label="Intérieur Propre" onToggle={() => handleToggleCheck('cleanliness', 'interior')} />
                           <ChecklistItem checked={inspFormData.cleanliness?.exterior || false} label="Extérieur Propre" onToggle={() => handleToggleCheck('cleanliness', 'exterior')} />
                        </div>
                      </div>
                   </div>
                   <div className="pt-8 border-t border-gray-100">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-4 mb-4 block">Note générale / Observations (Optionnel)</label>
                      <textarea value={inspFormData.notes} onChange={e => setInspFormData({...inspFormData, notes: e.target.value})} className="w-full px-8 py-6 bg-white border-2 border-gray-100 rounded-[2.5rem] outline-none font-bold text-gray-700 h-32 resize-none focus:border-blue-500 transition-all shadow-sm" />
                   </div>
                </div>
             )}

             {stepInsp === 3 && (
                <div className="p-10 md:p-16 space-y-16 animate-fade-in bg-gray-50/20">
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                      <div className="space-y-8">
                         <div className="bg-white rounded-[3rem] p-10 shadow-xl border border-gray-100">
                            <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-8 border-b pb-4">{t.summary}</h4>
                            <div className="space-y-6">
                               <div className="flex justify-between items-center"><span className="text-sm font-bold text-gray-400">Kilométrage:</span><span className="text-2xl font-black text-gray-900">{inspFormData.mileage?.toLocaleString()} KM</span></div>
                               <div className="flex justify-between items-center"><span className="text-sm font-bold text-gray-400">Carburant:</span><span className="text-xl font-black text-blue-600 uppercase">{inspFormData.fuel}</span></div>
                            </div>
                         </div>
                         <div className="bg-white rounded-[3rem] p-10 shadow-xl border border-gray-100">
                            <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-8 border-b pb-4">{t.signature}</h4>
                            <SignaturePad isRtl={isRtl} initialValue={inspFormData.signature} onSave={s => setInspFormData({...inspFormData, signature: s})} />
                         </div>
                      </div>
                      <div className="space-y-8">
                         <div className="bg-white rounded-[3rem] p-10 shadow-xl border border-gray-100">
                            <div className="flex justify-between items-center mb-6">
                               <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest">{t.extPics}</h4>
                               <button onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.multiple = true; input.onchange = (e) => handlePhotoUpload(e as any, 'exteriorPhotos'); input.click(); }} className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-4 py-2 rounded-full">+ Ajouter</button>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                               {inspFormData.exteriorPhotos?.length === 0 ? <div className="col-span-3 py-10 text-center border-2 border-dashed rounded-3xl text-gray-300 font-black uppercase text-[10px]">Aucune photo</div> : inspFormData.exteriorPhotos?.map((p, i) => <img key={i} src={p} className="w-full aspect-square object-cover rounded-2xl" />)}
                            </div>
                         </div>
                         <div className="bg-white rounded-[3rem] p-10 shadow-xl border border-gray-100">
                            <div className="flex justify-between items-center mb-6">
                               <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest">{t.intPics}</h4>
                               <button onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.multiple = true; input.onchange = (e) => handlePhotoUpload(e as any, 'interiorPhotos'); input.click(); }} className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-4 py-2 rounded-full">+ Ajouter</button>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                               {inspFormData.interiorPhotos?.length === 0 ? <div className="col-span-3 py-10 text-center border-2 border-dashed rounded-3xl text-gray-300 font-black uppercase text-[10px]">Aucune photo</div> : inspFormData.interiorPhotos?.map((p, i) => <img key={i} src={p} className="w-full aspect-square object-cover rounded-2xl" />)}
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
             )}

             <div className="p-10 md:p-14 border-t border-gray-100 bg-white flex justify-between items-center">
                <button 
                  onClick={() => setStepInsp((stepInsp - 1) as InspectionStep)} 
                  className={`px-12 py-5 font-black uppercase text-xs tracking-widest text-gray-400 hover:text-gray-900 transition-all ${stepInsp === 1 ? 'opacity-0 pointer-events-none' : ''}`}
                >
                   {t.back}
                </button>
                <div className="flex gap-4">
                   {stepInsp < 3 ? (
                      <GradientButton onClick={() => setStepInsp((stepInsp + 1) as InspectionStep)} disabled={stepInsp === 1 && !inspFormData.reservationId} className="!px-16 !py-6 text-xl !rounded-[2rem]">
                         {t.next} →
                      </GradientButton>
                   ) : (
                      <GradientButton onClick={handleFinishInsp} className="!px-24 !py-7 text-2xl !rounded-[2.5rem] shadow-2xl shadow-green-100">
                         ✅ {t.validate}
                      </GradientButton>
                   )}
                </div>
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 md:p-8 animate-fade-in ${isRtl ? 'font-arabic text-right' : ''}`}>
      {/* Global Print / Personalize Modals for inspections */}
      {activeModal === 'print-choice' && selectedInspForPrint && (
        <div className="fixed inset-0 z-[350] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-black mb-4">Choisir une action</h3>
            <p className="text-sm text-gray-500 mb-6">Voulez-vous personnaliser le document ou imprimer directement avec le modèle enregistré ?</p>
            <div className="flex gap-3">
              <button onClick={() => { setActiveModal('personalize'); }} className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-2xl font-black">Personnaliser</button>
              <button onClick={() => {
                const cat = selectedInspForPrint?.type === 'depart' ? 'checkin' : 'checkout';
                const res = allReservations.find(r => r.id === selectedInspForPrint?.reservationId);
                if (res) handlePrint(res.id, cat);
              }} className="flex-1 px-4 py-3 bg-green-600 text-white rounded-2xl font-black">Imprimer avec le modèle</button>
            </div>
            <div className="mt-4">
              <button onClick={() => { setActiveModal(null); setSelectedInspForPrint(null); }} className="w-full px-4 py-2 bg-gray-100 rounded-2xl">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'personalize' && selectedInspForPrint && (() => {
        const rawRes = allReservations.find(r => r.id === selectedInspForPrint.reservationId);
        const reservationObject = normalizeReservation(rawRes);
        const customerObject = normalizeCustomer(allCustomers.find(c => c.id === rawRes?.customer_id));
        const vehicleObject = vehicles.find(v => v.id === rawRes?.vehicle_id || rawRes?.vehicleId);
        if (!reservationObject || !customerObject || !vehicleObject) {
          return (
            <div className="fixed inset-0 z-[350] bg-black/60 flex items-center justify-center p-4">
              <div className="bg-white p-8 rounded-2xl">Données manquantes pour la personnalisation.</div>
            </div>
          );
        }

        return (
          <DocumentPersonalizer
            lang={lang}
            reservation={reservationObject}
            customer={customerObject}
            vehicle={vehicleObject}
            docType={(selectedInspForPrint.type === 'depart' ? 'checkin' : 'checkout') as any}
            storeLogo={undefined}
            storeInfo={undefined}
            onSaveTemplate={(template) => {
              if (onUpdateTemplates) {
                const updated = templates.filter(t => t.category !== template.category);
                onUpdateTemplates([...updated, template]);
              }
              setActiveModal(null);
              setSelectedInspForPrint(null);
            }}
            onClose={() => { setActiveModal(null); setSelectedInspForPrint(null); }}
          />
        );
      })()}
      <div className="flex gap-4 mb-16">
        <button onClick={() => setActiveTab('inspection')} className={`px-12 py-5 rounded-[2.5rem] font-black text-sm uppercase tracking-widest transition-all ${activeTab === 'inspection' ? 'bg-blue-600 text-white shadow-xl shadow-blue-100' : 'bg-white text-gray-400 border border-gray-100'}`}>🔍 {t.inspection}</button>
        <button onClick={() => setActiveTab('dommages')} className={`px-12 py-5 rounded-[2.5rem] font-black text-sm uppercase tracking-widest transition-all ${activeTab === 'dommages' ? 'bg-red-600 text-white shadow-xl shadow-red-100' : 'bg-white text-gray-400 border border-gray-100'}`}>💥 {t.dommages}</button>
      </div>

      {activeTab === 'inspection' ? (
        <div className="space-y-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-10">
            <div>
              <h1 className="text-6xl font-black text-gray-900 tracking-tighter mb-4">{t.history}</h1>
              <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Base de données des états des lieux</p>
            </div>
            <GradientButton onClick={() => setIsCreatingInsp(true)} className="!px-14 !py-7 text-2xl shadow-2xl">+ {t.newBtn}</GradientButton>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-10">
            {inspections.map(insp => {
              const res = allReservations.find(r => r.id === insp.reservationId);
              const veh = vehicles.find(v => v.id === res?.vehicle_id);
              const client = allCustomers.find(c => c.id === res?.customer_id);
              return (
                <div key={insp.id} className="group bg-white rounded-[4rem] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden hover:shadow-[0_40px_100px_-25px_rgba(59,130,246,0.15)] hover:-translate-y-4 transition-all duration-700">
                  <div className="relative h-60 overflow-hidden">
                    <img src={veh?.mainImage} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[2s]" />
                    <div className="absolute top-6 left-6 right-6 flex justify-between items-center">
                       <span className={`px-5 py-2 rounded-2xl text-[9px] font-black uppercase text-white shadow-xl ${insp.type === 'depart' ? 'bg-blue-600' : 'bg-indigo-600'}`}>{insp.type === 'depart' ? 'DÉPART' : 'RETOUR'}</span>
                       <span className="bg-white/90 backdrop-blur-md text-gray-900 font-black text-[10px] uppercase px-4 py-2 rounded-xl shadow-lg">{insp.date}</span>
                    </div>
                  </div>
                  <div className="p-10 space-y-8">
                     <div className="flex items-center gap-6">
                        <img src={client?.profile_picture || 'https://via.placeholder.com/64'} onError={(e) => {e.currentTarget.src = 'https://via.placeholder.com/64'}} className="w-16 h-16 rounded-full bg-gray-100 object-cover border-4 border-gray-50 shadow-sm" />
                        <div className="flex-1 overflow-hidden">
                           <p className="text-[10px] font-black text-blue-600 uppercase mb-1 tracking-widest">Client</p>
                           <h4 className="text-xl font-black text-gray-900 truncate">{client?.first_name || ''} {client?.last_name || ''}</h4>
                        </div>
                     </div>
                     <div className="grid grid-cols-2 gap-6 bg-gray-50/50 p-6 rounded-[2.5rem] border border-gray-50">
                        <div>
                           <p className="text-[9px] font-black text-gray-400 uppercase mb-1 tracking-widest">Véhicule</p>
                           <p className="text-sm font-black text-gray-800">{veh?.brand} {veh?.model}</p>
                        </div>
                        <div className="text-right">
                           <p className="text-[9px] font-black text-gray-400 uppercase mb-1 tracking-widest">KM</p>
                           <p className="text-xl font-black text-gray-900">{insp.mileage.toLocaleString()}</p>
                        </div>
                     </div>
                    <div className="grid grid-cols-3 gap-3">
                      <button onClick={() => setViewingInsp(insp)} className="p-4 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"><span className="text-xl">👁️</span></button>
                      <button onClick={() => { setSelectedInspForPrint(insp); setActiveModal('print-choice'); }} className="p-4 bg-gray-50 text-gray-400 rounded-2xl hover:bg-gray-900 hover:text-white transition-all shadow-sm"><span className="text-xl">🖨️</span></button>
                      <button onClick={() => onDeleteInspection(insp.id)} className="p-4 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all shadow-sm"><span className="text-xl">🗑️</span></button>
                    </div>
                    {/* Removed separate Facture/Contrat/Devis buttons to keep a single print action */}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-10">
            <div>
              <h1 className="text-6xl font-black text-gray-900 tracking-tighter mb-4">{t.damageHistory}</h1>
              <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Gestion des dommages véhicules</p>
            </div>
            <GradientButton onClick={() => { setIsCreatingDmg(true); setDmgFormData({severity: 'moyen', status: 'signale', location: '', description: '', estimatedCost: 0, notes: ''}); setEditingDmgId(null); }} className="!px-14 !py-7 text-2xl shadow-2xl bg-red-600 hover:bg-red-700">+ {t.newDamage}</GradientButton>
          </div>

          {isCreatingDmg && (
            <div className="bg-white rounded-[4rem] shadow-2xl border border-gray-100 overflow-hidden p-10 md:p-16 space-y-10 animate-scale-in">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black text-gray-900">{editingDmgId ? 'Modifier' : 'Signaler'} Dommage</h2>
                <button onClick={() => { setIsCreatingDmg(false); setEditingDmgId(null); }} className="w-12 h-12 flex items-center justify-center bg-white rounded-2xl text-gray-400 hover:text-red-500 shadow-sm transition-all text-xl">✕</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4 md:col-span-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-4">Rechercher Réservation (Client)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-8 flex items-center text-3xl opacity-30">🔍</span>
                    <input type="text" placeholder="Rechercher par nom ou numéro de réservation..." value={searchDmgQuery} onChange={(e) => setSearchDmgQuery(e.target.value)} className="w-full pl-20 pr-8 py-5 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-blue-600 rounded-[2.5rem] outline-none font-black text-lg transition-all shadow-inner" />
                    {filteredReservationsForDmg.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-4 bg-white rounded-[2.5rem] shadow-2xl z-50 overflow-hidden border border-gray-100 max-h-80 overflow-y-auto">
                        {filteredReservationsForDmg.map(res => {
                          const customer = allCustomers.find(c => c.id === res.customer_id);
                          return (
                          <button key={res.id} onClick={() => { setDmgFormData({...dmgFormData, reservationId: res.id, vehicleId: res.vehicle_id}); setSearchDmgQuery(''); }} className="w-full text-left p-6 hover:bg-blue-50 border-b last:border-none flex justify-between items-center group">
                            <div className="flex items-center gap-4">
                               <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-xl group-hover:bg-blue-600 group-hover:text-white transition-all">👤</div>
                               <div>
                                 <p className="font-black text-gray-900 text-base">{customer?.first_name} {customer?.last_name}</p>
                                 <p className="text-xs font-bold text-gray-400 tracking-widest uppercase">Réservation: #{res.reservation_number}</p>
                               </div>
                            </div>
                            <span className="px-4 py-2 bg-gray-100 rounded-full text-[10px] font-black uppercase text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-600">Sélectionner</span>
                          </button>
                        );
                        })}
                      </div>
                    )}
                  </div>
                  {dmgFormData.reservationId && (
                    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-sm font-black text-blue-700">
                      ✅ Réservation sélectionnée: #{allReservations.find(r => r.id === dmgFormData.reservationId)?.reservation_number}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-4">Sélectionner Véhicule</label>
                  <select onChange={(e) => setDmgFormData({...dmgFormData, vehicleId: e.target.value})} className="w-full px-8 py-5 bg-gray-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-[2.5rem] outline-none font-black text-lg transition-all shadow-inner">
                    <option value="">-- Choisir un véhicule --</option>
                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.brand} {v.model} - {v.immatriculation}</option>)}
                  </select>
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-4">{t.location}</label>
                  <input type="text" placeholder="Ex: Porte avant droite, pare-brise..." value={dmgFormData.location || ''} onChange={(e) => setDmgFormData({...dmgFormData, location: e.target.value})} className="w-full px-8 py-5 bg-gray-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-[2.5rem] outline-none font-black text-lg transition-all shadow-inner" />
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-4">{t.severity}</label>
                  <select value={dmgFormData.severity || 'moyen'} onChange={(e) => setDmgFormData({...dmgFormData, severity: e.target.value})} className="w-full px-8 py-5 bg-gray-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-[2.5rem] outline-none font-black text-lg transition-all shadow-inner">
                    <option value="leger">{t.light}</option>
                    <option value="moyen">{t.medium}</option>
                    <option value="grave">{t.severe}</option>
                  </select>
                </div>

                <div className="space-y-4 md:col-span-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-4">{t.description}</label>
                  <textarea placeholder="Décrivez le dommage en détail..." value={dmgFormData.description || ''} onChange={(e) => setDmgFormData({...dmgFormData, description: e.target.value})} rows={4} className="w-full px-8 py-5 bg-gray-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-[2.5rem] outline-none font-black text-lg transition-all shadow-inner resize-none" />
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-4">{t.cost}</label>
                  <input type="number" min="0" step="1000" value={dmgFormData.estimatedCost || 0} onChange={(e) => setDmgFormData({...dmgFormData, estimatedCost: parseFloat(e.target.value)})} className="w-full px-8 py-5 bg-gray-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-[2.5rem] outline-none font-black text-lg transition-all shadow-inner" />
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-4">Notes</label>
                  <input type="text" placeholder="Notes additionnelles..." value={dmgFormData.notes || ''} onChange={(e) => setDmgFormData({...dmgFormData, notes: e.target.value})} className="w-full px-8 py-5 bg-gray-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-[2.5rem] outline-none font-black text-lg transition-all shadow-inner" />
                </div>
              </div>

              <div className="flex gap-6 pt-6 border-t border-gray-100">
                <button onClick={() => { setIsCreatingDmg(false); setEditingDmgId(null); }} className="flex-1 px-8 py-5 bg-gray-100 text-gray-900 font-black rounded-[2.5rem] hover:bg-gray-200 transition-all">Annuler</button>
                <button onClick={() => {
                  if (editingDmgId) onUpdateDamage({...dmgFormData, id: editingDmgId} as any);
                  else onAddDamage(dmgFormData as any);
                  setIsCreatingDmg(false);
                  setEditingDmgId(null);
                  setDmgFormData({severity: 'moyen', status: 'signale', location: '', description: '', estimatedCost: 0, notes: ''});
                }} className="flex-1 px-8 py-5 bg-red-600 text-white font-black rounded-[2.5rem] hover:bg-red-700 transition-all">💾 Enregistrer</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-10">
            {damages.map(dmg => {
              const res = allReservations.find(r => r.id === dmg.reservationId);
              const veh = vehicles.find(v => v.id === dmg.vehicleId || v.id === res?.vehicle_id);
              const client = allCustomers.find(c => c.id === res?.customer_id);
              const severityColor = dmg.severity === 'grave' ? 'bg-red-600' : dmg.severity === 'moyen' ? 'bg-yellow-600' : 'bg-green-600';
              const statusColor = dmg.status === 'signale' ? 'bg-blue-100 text-blue-600' : dmg.status === 'reparation' ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600';
              
              return (
                <div key={dmg.id} className="group bg-white rounded-[4rem] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden hover:shadow-[0_40px_100px_-25px_rgba(220,38,38,0.15)] hover:-translate-y-4 transition-all duration-700">
                  <div className={`h-32 ${severityColor} flex items-center justify-center relative overflow-hidden`}>
                    <span className={`text-[3rem] group-hover:scale-125 transition-transform duration-300 ${dmg.severity === 'grave' ? '💥' : dmg.severity === 'moyen' ? '⚠️' : '📌'}`} />
                    <div className="absolute top-4 right-4">
                      <span className={`px-4 py-2 rounded-full text-[9px] font-black uppercase text-white shadow-xl ${statusColor}`}>{dmg.status === 'signale' ? t.reported : dmg.status === 'reparation' ? t.inRepair : t.repaired}</span>
                    </div>
                  </div>
                  <div className="p-10 space-y-6">
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase mb-2 tracking-widest">Position</p>
                      <h3 className="text-xl font-black text-gray-900">{dmg.location}</h3>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase mb-2 tracking-widest">Description</p>
                      <p className="text-sm text-gray-600 line-clamp-2">{dmg.description}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-4 rounded-2xl">
                        <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Véhicule</p>
                        <p className="text-sm font-black text-gray-900">{veh?.brand} {veh?.model}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-2xl">
                        <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Coût</p>
                        <p className="text-sm font-black text-gray-900">{dmg.estimatedCost?.toLocaleString()} DA</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 bg-blue-50 p-4 rounded-2xl border border-blue-100">
                      <img src={client?.profile_picture || 'https://via.placeholder.com/40'} onError={(e) => {e.currentTarget.src = 'https://via.placeholder.com/40'}} className="w-10 h-10 rounded-full object-cover" />
                      <div>
                        <p className="text-[9px] font-black text-blue-600 uppercase">Client</p>
                        <p className="text-sm font-black text-gray-900">{client?.first_name} {client?.last_name}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <button onClick={() => setViewingDmg(dmg)} className="p-3 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"><span className="text-xl">👁️</span></button>
                      <button onClick={() => { setEditingDmgId(dmg.id); setDmgFormData(dmg); setIsCreatingDmg(true); }} className="p-3 bg-yellow-50 text-yellow-600 rounded-2xl hover:bg-yellow-600 hover:text-white transition-all shadow-sm"><span className="text-xl">✏️</span></button>
                      <button onClick={() => onDeleteDamage(dmg.id)} className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all shadow-sm"><span className="text-xl">🗑️</span></button>
                    </div>
                    {dmg.status !== 'repaire' && (
                      <button onClick={() => onUpdateDamage({...dmg, status: 'repaire'} as any)} className="w-full px-4 py-3 bg-green-600 text-white font-black rounded-2xl hover:bg-green-700 transition-all text-[10px] uppercase tracking-widest shadow-sm">✅ {t.markRepaired}</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {damages.length === 0 && !isCreatingDmg && (
            <div className="flex flex-col items-center justify-center py-40 text-center">
              <span className="text-9xl mb-10 opacity-20">📋</span>
              <h2 className="text-4xl font-black uppercase tracking-tighter text-gray-300">Aucun dommage signalé</h2>
            </div>
          )}
        </div>
      )}

      {/* --- Damage Details Modal --- */}
      {viewingDmg && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white w-full max-w-4xl rounded-[4rem] shadow-2xl animate-scale-in overflow-hidden p-10 md:p-16 border border-white/20">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">Détails du Dommage</h2>
              <button onClick={() => setViewingDmg(null)} className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-xl hover:bg-red-600 hover:text-white transition-all">✕</button>
            </div>

            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-8">
                <div className="p-6 bg-red-50 rounded-[2.5rem] border border-red-100">
                  <p className="text-[9px] font-black text-red-600 uppercase mb-2">Position</p>
                  <p className="text-2xl font-black text-gray-900">{viewingDmg.location}</p>
                </div>
                <div className="p-6 bg-yellow-50 rounded-[2.5rem] border border-yellow-100">
                  <p className="text-[9px] font-black text-yellow-600 uppercase mb-2">Gravité</p>
                  <p className="text-2xl font-black text-gray-900">{viewingDmg.severity === 'grave' ? t.severe : viewingDmg.severity === 'moyen' ? t.medium : t.light}</p>
                </div>
              </div>

              <div className="p-6 bg-gray-50 rounded-[2.5rem] border border-gray-100">
                <p className="text-[9px] font-black text-gray-600 uppercase mb-3">Description</p>
                <p className="text-lg text-gray-700 leading-relaxed">{viewingDmg.description}</p>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div className="p-6 bg-blue-50 rounded-[2.5rem] border border-blue-100">
                  <p className="text-[9px] font-black text-blue-600 uppercase mb-2">Coût Estimé</p>
                  <p className="text-2xl font-black text-gray-900">{viewingDmg.estimatedCost?.toLocaleString()} DA</p>
                </div>
                <div className="p-6 bg-indigo-50 rounded-[2.5rem] border border-indigo-100">
                  <p className="text-[9px] font-black text-indigo-600 uppercase mb-2">Statut</p>
                  <p className="text-lg font-black text-gray-900">{viewingDmg.status === 'signale' ? t.reported : viewingDmg.status === 'reparation' ? t.inRepair : t.repaired}</p>
                </div>
                <div className="p-6 bg-purple-50 rounded-[2.5rem] border border-purple-100">
                  <p className="text-[9px] font-black text-purple-600 uppercase mb-2">Véhicule</p>
                  <p className="text-lg font-black text-gray-900">{vehicles.find(v => v.id === viewingDmg.vehicleId)?.brand}</p>
                </div>
              </div>

              <div className="flex gap-4 pt-6 border-t border-gray-100">
                <button onClick={() => setViewingDmg(null)} className="flex-1 px-6 py-4 bg-gray-100 text-gray-900 font-black rounded-2xl hover:bg-gray-200 transition-all">Fermer</button>
                {viewingDmg.status !== 'repaire' && (
                  <button onClick={() => { onUpdateDamage({...viewingDmg, status: 'repaire'} as any); setViewingDmg(null); }} className="flex-1 px-6 py-4 bg-green-600 text-white font-black rounded-2xl hover:bg-green-700 transition-all">✅ {t.markRepaired}</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Detailed Document Print Preview --- */}
      {activePrintModal === 'print-view' && printRes && printTemplate && (
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-xl flex items-center justify-center p-8 animate-fade-in">
           <div className="bg-white rounded-[4rem] shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden border border-white/20">
              <div className="p-10 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                 <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-blue-600 text-white rounded-[1.5rem] flex items-center justify-center text-3xl shadow-xl">🖨️</div>
                    <div>
                      <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">{t.printTitle}</h2>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">{printTemplate.name} / #{printRes.reservationNumber}</p>
                    </div>
                 </div>
                 <div className="flex gap-4">
                    <GradientButton onClick={() => window.print()} className="!px-10 !py-4 shadow-xl">Imprimer</GradientButton>
                    <button onClick={() => setActivePrintModal(null)} className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-2xl shadow-sm hover:text-red-500 transition-all">✕</button>
                 </div>
              </div>
              <div className="flex-1 bg-gray-100 p-16 overflow-y-auto custom-scrollbar flex justify-center">
                 <div className="bg-white shadow-2xl relative" style={{ width: `${printTemplate.canvasWidth}px`, height: `${printTemplate.canvasHeight}px` }}>
                    {printTemplate.elements.map((el: any) => (
                      <div key={el.id} className="absolute" style={{
                         left: `${el.x}px`, top: `${el.y}px`, width: `${el.width}px`, height: el.type === 'divider' ? `${el.height}px` : 'auto',
                         minHeight: `${el.height}px`, fontSize: `${el.fontSize}px`, color: el.color, backgroundColor: el.backgroundColor,
                         fontFamily: el.fontFamily, fontWeight: el.fontWeight as any, textAlign: el.textAlign, borderRadius: `${el.borderRadius}px`,
                         padding: `${el.padding}px`, borderWidth: `${el.borderWidth}px`, borderColor: el.borderColor, opacity: el.opacity,
                         zIndex: el.zIndex, whiteSpace: 'pre-wrap', lineHeight: el.lineHeight
                      }}>
                         {el.type === 'logo' && <div className="w-full h-full flex items-center justify-center font-black opacity-30 uppercase">{el.content}</div>}
                         {el.type === 'qr_code' && <div className="w-10 h-10 border-2 border-gray-900 grid grid-cols-2 gap-0.5 p-0.5"><div className="bg-gray-900"></div><div className="bg-gray-900"></div><div className="bg-gray-900"></div><div></div></div>}
                         {el.type !== 'logo' && el.type !== 'qr_code' && replaceVariables(el.content, printRes)}
                      </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* --- Detailed Report View Modal --- */}
      {viewingInsp && (() => {
        const res = allReservations.find(r => r.id === viewingInsp.reservationId);
        const veh = vehicles.find(v => v.id === res?.vehicle_id);
        const client = allCustomers.find(c => c.id === res?.customer_id);
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
             <div className="bg-white w-full max-w-6xl rounded-[4rem] shadow-2xl animate-scale-in overflow-hidden max-h-[95vh] flex flex-col border border-white/20">
                <div className="p-10 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                   <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-blue-600 text-white rounded-[1.5rem] flex items-center justify-center text-3xl shadow-xl">📄</div>
                      <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">Rapport d'Inspection</h2>
                   </div>
                   <button onClick={() => setViewingInsp(null)} className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-2xl shadow-sm hover:text-red-500 transition-all">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto p-10 md:p-14 space-y-16 custom-scrollbar">
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                      <div className="p-8 bg-blue-50/50 rounded-[3rem] border border-blue-100 flex items-center gap-8 shadow-sm">
                         <img src={veh?.mainImage} className="w-40 h-28 object-cover rounded-[2rem] shadow-2xl border-4 border-white shrink-0" />
                         <div><h3 className="text-3xl font-black text-gray-900">{veh?.brand} {veh?.model}</h3><p className="text-sm font-black text-blue-700">{veh?.immatriculation}</p></div>
                      </div>
                      <div className="p-8 bg-gray-50/50 rounded-[3rem] border border-gray-100 flex items-center gap-8 shadow-sm">
                         <img src={client?.profile_picture || 'https://via.placeholder.com/96'} onError={(e) => {e.currentTarget.src = 'https://via.placeholder.com/96'}} className="w-24 h-24 object-cover rounded-full border-4 border-white shadow-xl shrink-0" />
                         <div><h3 className="text-2xl font-black text-gray-900">{client?.first_name} {client?.last_name}</h3><p className="text-xs font-bold text-gray-500">📞 {client?.phone}</p></div>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        );
      })()}
    </div>
  );
};

export default OperationsPage;
