
import React, { useState, useRef } from 'react';
import { Language, Customer, Reservation, Vehicle } from '../types';
import { ALGERIAN_WILAYAS } from '../constants';
import { supabase } from '../lib/supabase';
import GradientButton from '../components/GradientButton';

interface CustomersPageProps {
  lang: Language;
  customers: Customer[];
  reservations: Reservation[];
  vehicles: Vehicle[];
  onRefresh: () => void;
}

type ModalType = 'details' | 'history' | 'delete' | null;

const CustomersPage: React.FC<CustomersPageProps> = ({ lang, customers, reservations, vehicles, onRefresh }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [activeModal, setActiveModal] = useState<{ type: ModalType; customer: Customer | null }>({ type: null, customer: null });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Form State for UI previews (Base64 strings)
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [docPreviews, setDocPreviews] = useState<string[]>([]);
  const [documentType, setDocumentType] = useState<string | null>(null);
  const [showRawCustomer, setShowRawCustomer] = useState(false);
  
  const isRtl = lang === 'ar';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const getField = (c: any, camel: string, snake: string) => {
    if (!c) return null;
    return c[camel] ?? c[snake] ?? null;
  };

  const normalizeCustomer = (c: any) => {
    if (!c) return c;
    return {
      ...c,
      id: getField(c, 'id', 'id'),
      firstName: getField(c, 'firstName', 'first_name') || getField(c, 'first_name', 'firstName'),
      lastName: getField(c, 'lastName', 'last_name') || getField(c, 'last_name', 'lastName'),
      phone: getField(c, 'phone', 'phone'),
      email: getField(c, 'email', 'email'),
      idCardNumber: getField(c, 'idCardNumber', 'id_card_number'),
      wilaya: getField(c, 'wilaya', 'wilaya'),
      address: getField(c, 'address', 'address'),
      licenseNumber: getField(c, 'licenseNumber', 'license_number'),
      licenseExpiry: getField(c, 'licenseExpiry', 'license_expiry'),
      profilePicture: getField(c, 'profilePicture', 'profile_picture'),
      documentImages: getField(c, 'documentImages', 'document_images') || [],
      documentLeftAtStore: getField(c, 'documentLeftAtStore', 'document_left_at_store'),
      documentType: getField(c, 'documentType', 'document_type'),
      documentNumber: getField(c, 'documentNumber', 'document_number'),
      documentDeliveryDate: getField(c, 'documentDeliveryDate', 'document_delivery_date'),
      documentDeliveryAddress: getField(c, 'documentDeliveryAddress', 'document_delivery_address'),
      documentExpiryDate: getField(c, 'documentExpiryDate', 'document_expiry_date'),
      licenseIssueDate: getField(c, 'licenseIssueDate', 'license_issue_date'),
      licenseIssuePlace: getField(c, 'licenseIssuePlace', 'license_issue_place'),
      totalReservations: getField(c, 'totalReservations', 'total_reservations') ?? 0,
      totalSpent: getField(c, 'totalSpent', 'total_spent') ?? 0,
    };
  };

  const openDetails = async (c: any) => {
    try {
      // Try to fetch fresh full row from DB to ensure new columns are present
      if (c && (c.id || c.id === 0)) {
        const id = c.id || c['id'];
        const { data, error } = await supabase.from('customers').select('*').eq('id', id).limit(1).single();
        if (!error && data) {
          setActiveModal({ type: 'details', customer: normalizeCustomer(data) });
          return;
        }
      }
    } catch (err) {
      console.error('Failed to fetch customer details', err);
    }
    // Fallback to normalized local object
    setActiveModal({ type: 'details', customer: normalizeCustomer(c) });
  };

  const isValidUrl = (u?: string | null) => {
    if (!u || typeof u !== 'string') return false;
    return /^data:|^https?:\/\//.test(u);
  };

  const t = {
    fr: {
      title: 'Répertoire Clients',
      addBtn: 'Nouveau Client',
      search: 'Rechercher par nom, téléphone...',
      firstName: 'Prénom',
      lastName: 'Nom',
      phone: 'Numéro de téléphone',
      email: 'E-mail (optionnel)',
      idCard: 'N° Carte d\'identité',
      wilaya: 'Wilaya',
      address: 'Adresse',
      license: 'N° Permis de conduire',
      licenseExp: 'Expiration Permis',
      reservations: 'Réservations',
      spending: 'Total Dépensé',
      details: 'Fiche Détails',
      edit: 'Modifier',
      delete: 'Supprimer',
      history: 'Historique',
      createTitle: 'Fiche Nouveau Client',
      editTitle: 'Modifier le Client',
      profilePic: 'Photo de profil',
      docs: 'Documents numérisés',
      docLeft: 'Document déposé à l\'agence',
      save: 'Enregistrer le client',
      cancel: 'Annuler',
      confirmDelete: 'Voulez-vous vraiment supprimer ce client ?',
      currency: 'DZ',
      personalInfo: 'Informations Personnelles',
      officialDocs: 'Documents Officiels',
      media: 'Photos & Scans',
      docOptions: ['Aucun', 'Passeport', 'Carte d\'identité', 'Permis de conduire', 'Chèque de garantie', 'Autre']
    },
    ar: {
      title: 'قائمة الزبائن',
      addBtn: 'زبون جديد',
      search: 'بحث بالاسم، الهاتف...',
      firstName: 'الاسم الأول',
      lastName: 'اللقب',
      phone: 'رقم الهاتف',
      email: 'البريد الإلكتروني',
      idCard: 'رقم بطاقة التعريف',
      wilaya: 'الولاية',
      address: 'العنوان',
      license: 'رقم رخصة السياقة',
      licenseExp: 'انتهاء الرخصة',
      reservations: 'الحجوزات',
      spending: 'إجمالي الإنفاق',
      details: 'تفاصيل الزبون',
      edit: 'تعديل',
      delete: 'حذف',
      history: 'السجل',
      createTitle: 'بطاقة زبون جديد',
      editTitle: 'تعديل الزبون',
      profilePic: 'صورة الملف',
      docs: 'المستندات الممسوحة',
      docLeft: 'الوثيقة المتروكة في الوكالة',
      save: 'حفظ الزبون',
      cancel: 'إلغاء',
      confirmDelete: 'هل أنت متأكد من حذف هذا الزبون؟',
      currency: 'دج',
      personalInfo: 'المعلومات الشخصية',
      officialDocs: 'الوثائق الرسمية',
      media: 'الصور والوثائق',
      docOptions: ['لا شيء', 'جواز سفر', 'بطاقة تعريف', 'رخصة سياقة', 'صك ضمان', 'أخرى']
    }
  }[lang];

  const handleOpenForm = (customer: Customer | null = null) => {
    if (customer) {
      const norm = normalizeCustomer(customer);
      setEditingCustomer(norm as Customer);
      setProfilePreview(norm.profilePicture || null);
      setDocPreviews(norm.documentImages || []);
      setDocumentType(norm.documentType || null);
    } else {
      setEditingCustomer(null);
      setProfilePreview(null);
      setDocPreviews([]);
      setDocumentType(null);
    }
    setIsFormOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'profile' | 'docs') => {
    const files = e.target.files;
    if (files) {
      // Fix: Added explicit type (file: File) to prevent 'unknown' type error in readAsDataURL
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          if (target === 'profile') setProfilePreview(base64);
          else setDocPreviews(prev => [...prev, base64]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    
    const dbData = {
      first_name: fd.get('first_name') as string,
      last_name: fd.get('last_name') as string,
      phone: fd.get('phone') as string,
      email: fd.get('email') as string,
      id_card_number: fd.get('id_card_number') as string,
      document_type: fd.get('document_type') as string || null,
      document_number: fd.get('document_number') as string || null,
      document_delivery_date: fd.get('document_delivery_date') as string || null,
      document_delivery_address: fd.get('document_delivery_address') as string || null,
      document_expiry_date: fd.get('document_expiry_date') as string || null,
      wilaya: fd.get('wilaya') as string,
      address: fd.get('address') as string,
      license_number: fd.get('license_number') as string,
      license_expiry: fd.get('license_expiry') as string,
      license_issue_date: fd.get('license_issue_date') as string || null,
      license_issue_place: fd.get('license_issue_place') as string || null,
      profile_picture: profilePreview,
      document_images: docPreviews,
      document_left_at_store: fd.get('document_left') as string
    };

    try {
      if (editingCustomer) {
        await supabase.from('customers').update(dbData).eq('id', editingCustomer.id);
      } else {
        await supabase.from('customers').insert([dbData]);
      }
      onRefresh();
      setIsFormOpen(false);
      setEditingCustomer(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.from('customers').delete().eq('id', id);
      onRefresh();
      setActiveModal({ type: null, customer: null });
    } catch (err) {
      console.error(err);
    }
  };

  const filteredCustomers = customers.filter(c => 
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  const SectionHeader = ({ title, icon, color }: { title: string; icon: string; color: string }) => (
    <div className={`flex items-center gap-4 border-b border-gray-100 pb-4 mb-8 ${color}`}>
      <span className="text-3xl">{icon}</span>
      <h3 className="text-xl font-black uppercase tracking-widest">{title}</h3>
    </div>
  );

  if (isFormOpen) {
    return (
      <div className={`p-4 md:p-8 animate-fade-in ${isRtl ? 'font-arabic text-right' : ''}`}>
        <div className="max-w-6xl mx-auto bg-white rounded-[4rem] shadow-2xl overflow-hidden border border-gray-100">
          <div className="p-8 md:p-16">
            <div className="flex items-center justify-between mb-16 border-b border-gray-50 pb-12">
              <h2 className="text-6xl font-black text-gray-900 tracking-tighter">
                {editingCustomer ? t.editTitle : t.createTitle}
              </h2>
              <button onClick={() => setIsFormOpen(false)} className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all text-3xl shadow-inner">✕</button>
            </div>
            
            <form className="space-y-16" onSubmit={handleSave}>
              <section>
                <SectionHeader title={t.personalInfo} icon="👤" color="text-blue-600" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase px-4">{t.firstName}</label>
                    <input name="first_name" defaultValue={editingCustomer?.firstName} className="w-full px-8 py-5 bg-gray-50 rounded-3xl outline-none font-black text-lg border-2 border-transparent focus:bg-white focus:border-blue-600 transition-all" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase px-4">{t.lastName}</label>
                    <input name="last_name" defaultValue={editingCustomer?.lastName} className="w-full px-8 py-5 bg-gray-50 rounded-3xl outline-none font-black text-lg border-2 border-transparent focus:bg-white focus:border-blue-600 transition-all" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase px-4">{t.phone}</label>
                    <input name="phone" defaultValue={editingCustomer?.phone} className="w-full px-8 py-5 bg-gray-50 rounded-3xl outline-none font-black text-lg border-2 border-transparent focus:bg-white focus:border-blue-600 transition-all" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase px-4">{t.email}</label>
                    <input name="email" defaultValue={editingCustomer?.email} className="w-full px-8 py-5 bg-gray-50 rounded-3xl outline-none font-black text-lg border-2 border-transparent focus:bg-white focus:border-blue-600 transition-all" />
                  </div>
                </div>
              </section>

              <section>
                <SectionHeader title={t.officialDocs} icon="📄" color="text-indigo-600" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase px-4">Type Document</label>
                    <select name="document_type" value={documentType || ''} onChange={(e) => setDocumentType(e.target.value || null)} className="w-full px-8 py-5 bg-gray-50 rounded-3xl font-black text-lg">
                      <option value="">Aucun</option>
                      <option value="carte_identite">Carte d'identité</option>
                      <option value="passeport">Passeport</option>
                      <option value="autre">Autre</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase px-4">Numéro Document</label>
                    <input name="document_number" defaultValue={editingCustomer?.documentNumber || editingCustomer?.idCardNumber} className="w-full px-8 py-5 bg-gray-50 rounded-3xl outline-none font-black text-lg" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase px-4">Date délivrance</label>
                    <input name="document_delivery_date" type="date" defaultValue={editingCustomer?.documentDeliveryDate} className="w-full px-8 py-5 bg-gray-50 rounded-3xl outline-none font-black text-lg" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase px-4">Adresse délivrance</label>
                    <input name="document_delivery_address" defaultValue={editingCustomer?.documentDeliveryAddress} className="w-full px-8 py-5 bg-gray-50 rounded-3xl outline-none font-black text-lg" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase px-4">Date expiration</label>
                    <input name="document_expiry_date" type="date" defaultValue={editingCustomer?.documentExpiryDate} className="w-full px-8 py-5 bg-gray-50 rounded-3xl outline-none font-black text-lg" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase px-4">{t.license}</label>
                    <input name="license_number" defaultValue={editingCustomer?.licenseNumber} className="w-full px-8 py-5 bg-gray-50 rounded-3xl outline-none font-black text-lg" required />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase px-4">{t.licenseExp}</label>
                    <input name="license_expiry" type="date" defaultValue={editingCustomer?.licenseExpiry} className="w-full px-8 py-5 bg-gray-50 rounded-3xl outline-none font-black text-lg" required />
                  </div>

                  <div className="space-y-2 md:col-span-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase px-4">Date délivrance Permis</label>
                    <input name="license_issue_date" type="date" defaultValue={editingCustomer?.licenseIssueDate} className="w-full px-8 py-5 bg-gray-50 rounded-3xl outline-none font-black text-lg" />
                  </div>

                  <div className="space-y-2 md:col-span-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase px-4">Adresse délivrance Permis</label>
                    <input name="license_issue_place" defaultValue={editingCustomer?.licenseIssuePlace} className="w-full px-8 py-5 bg-gray-50 rounded-3xl outline-none font-black text-lg" />
                  </div>

                  <div className="space-y-2 md:col-span-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase px-4">{t.wilaya}</label>
                    <select name="wilaya" defaultValue={editingCustomer?.wilaya || '16 - Alger'} className="w-full px-8 py-5 bg-gray-50 rounded-3xl font-black text-lg">
                       {ALGERIAN_WILAYAS.map(w => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2 md:col-span-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase px-4">{t.docLeft}</label>
                    <select name="document_left" defaultValue={editingCustomer?.documentLeftAtStore || 'Aucun'} className="w-full px-8 py-5 bg-gray-50 rounded-3xl font-black text-lg border-2 border-indigo-200">
                       {t.docOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                </div>
              </section>

              <section>
                <SectionHeader title={t.media} icon="📸" color="text-red-600" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="bg-gray-50 p-10 rounded-[3rem] text-center flex flex-col items-center">
                    <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-2xl bg-white mb-6">
                      {profilePreview ? <img src={profilePreview} className="w-full h-full object-cover" /> : <span className="text-5xl flex items-center justify-center h-full">👤</span>}
                    </div>
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="px-8 py-3 bg-white text-blue-600 rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-blue-600 hover:text-white transition-all">{t.profilePic}</button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'profile')} />
                  </div>
                  <div className="bg-gray-50 p-10 rounded-[3rem] border-4 border-dashed border-gray-200">
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      {docPreviews.map((doc, i) => (
                        <div key={i} className="relative aspect-square rounded-2xl overflow-hidden shadow-lg border-2 border-white group">
                          <img src={doc} className="w-full h-full object-cover" />
                          <button type="button" onClick={() => setDocPreviews(prev => prev.filter((_, idx) => idx !== i))} className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-black">X</button>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={() => docInputRef.current?.click()} className="w-full py-4 bg-white text-indigo-600 rounded-2xl text-[10px] font-black uppercase shadow-sm border border-indigo-100">+ {t.docs}</button>
                    <input type="file" ref={docInputRef} className="hidden" multiple accept="image/*" onChange={(e) => handleImageUpload(e, 'docs')} />
                  </div>
                </div>
              </section>

              <div className="flex justify-end gap-6 pt-12 border-t border-gray-100">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-14 py-5 text-sm font-black text-gray-400 uppercase tracking-widest hover:text-red-600 transition-all rounded-[1.5rem]">Annuler</button>
                <GradientButton type="submit" disabled={loading} className="!px-24 !py-7 text-3xl rounded-[2.5rem] shadow-2xl">
                  {loading ? '...' : t.save}
                </GradientButton>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 md:p-8 animate-fade-in ${isRtl ? 'font-arabic text-right' : ''}`}>
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-10 mb-20 ${isRtl ? 'flex-row-reverse' : ''}`}>
        <div>
          <h1 className="text-6xl font-black text-gray-900 tracking-tighter mb-4">{t.title}</h1>
          <div className="flex items-center gap-3 text-gray-500 font-bold uppercase text-xs tracking-widest">
            <span className="w-3 h-3 bg-blue-600 rounded-full animate-pulse"></span>
            {filteredCustomers.length} Clients en base de données
          </div>
        </div>
        <div className={`flex flex-col sm:flex-row items-center gap-6 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <input type="text" placeholder={t.search} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full sm:w-[450px] py-6 px-8 bg-white border-2 border-gray-100 focus:border-blue-600 rounded-[3rem] text-lg font-bold shadow-sm outline-none" />
          <GradientButton onClick={() => handleOpenForm()} className="w-full sm:w-auto !py-6 !px-14 text-2xl shadow-xl">+ {t.addBtn}</GradientButton>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-12">
        {filteredCustomers.map((c) => (
          <div key={c.id} className="group bg-white rounded-[4rem] shadow-[0_30px_100px_-20px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden hover:shadow-[0_50px_120px_-30px_rgba(59,130,246,0.15)] hover:-translate-y-4 transition-all duration-700 flex flex-col h-full">
            <div className="p-10 flex flex-col flex-1">
              <div className="flex items-center gap-8 mb-10">
                <div className="w-28 h-28 rounded-full border-4 border-white shadow-2xl overflow-hidden group-hover:rotate-3 group-hover:scale-105 transition-transform duration-500">
                  <img src={c.profilePicture || 'https://via.placeholder.com/200'} className="w-full h-full object-cover" alt="Profile" />
                </div>
                <div>
                  <h3 className="text-3xl font-black text-gray-900 leading-tight truncate">{c.firstName} {c.lastName}</h3>
                  <p className="text-lg font-black text-blue-600 mt-2">📞 {c.phone}</p>
                  {c.documentLeftAtStore && c.documentLeftAtStore !== 'Aucun' && (
                    <span className="mt-2 inline-flex items-center px-3 py-1 bg-red-50 text-red-600 text-[9px] font-black uppercase rounded-full border border-red-100">📄 Dépôt: {c.documentLeftAtStore}</span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-10">
                <div className="p-6 rounded-[2.5rem] bg-gray-50 flex flex-col items-center text-center shadow-inner"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Locations</p><p className="text-3xl font-black text-gray-900">{c.totalReservations}</p></div>
                <div className="p-6 rounded-[2.5rem] bg-gray-50 flex flex-col items-center text-center shadow-inner"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Investissement</p><p className="text-xl font-black text-green-600">{c.totalSpent.toLocaleString()} DZ</p></div>
              </div>
              <div className="mt-auto space-y-4 pt-4 border-t border-gray-50">
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => openDetails(c)} className="py-4.5 rounded-2xl bg-blue-50 text-blue-600 font-black uppercase text-[10px] tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-sm flex items-center justify-center gap-2">🔍 {t.details}</button>
                  <button onClick={() => setActiveModal({ type: 'history', customer: c })} className="py-4.5 rounded-2xl bg-gray-50 text-gray-500 font-black uppercase text-[10px] tracking-widest hover:bg-black hover:text-white transition-all shadow-sm flex items-center justify-center gap-2">📜 {t.history}</button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => handleOpenForm(c)} className="py-4.5 rounded-2xl bg-gray-50 text-gray-500 font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-2">✏️ {t.edit}</button>
                  <button onClick={() => setActiveModal({ type: 'delete', customer: c })} className="py-4.5 rounded-2xl bg-red-50 text-red-600 font-black uppercase text-[10px] tracking-widest hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2">🗑️ {t.delete}</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {activeModal.type === 'delete' && activeModal.customer && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
           <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-12 text-center">
              <h3 className="text-2xl font-black text-gray-900 mb-4">{t.confirmDelete}</h3>
              <div className="flex gap-4">
                <button onClick={() => setActiveModal({ type: null, customer: null })} className="flex-1 py-5 bg-gray-100 rounded-[1.5rem] font-black uppercase text-[10px]">Annuler</button>
                <button onClick={() => handleDelete(activeModal.customer!.id)} className="flex-1 py-5 bg-red-600 text-white rounded-[1.5rem] font-black uppercase text-[10px] shadow-xl">Supprimer</button>
              </div>
           </div>
        </div>
      )}

      {activeModal.type === 'details' && activeModal.customer && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white w-full max-w-6xl rounded-[4rem] overflow-hidden shadow-2xl animate-scale-in flex flex-col md:flex-row h-[90vh]">
            <div className="md:w-1/3 bg-gray-50 p-10 flex flex-col items-center border-r border-gray-100 overflow-y-auto custom-scrollbar">
                <div className="w-48 h-48 rounded-full border-8 border-white shadow-2xl overflow-hidden mb-8 flex-shrink-0">
                <img
                  src={
                    isValidUrl(getField(activeModal.customer, 'profilePicture', 'profile_picture'))
                      ? (getField(activeModal.customer, 'profilePicture', 'profile_picture') as string)
                      : 'https://via.placeholder.com/200'
                  }
                  className="w-full h-full object-cover"
                  alt="Profile"
                />
              </div>
              <h2 className="text-3xl font-black text-gray-900 text-center mb-10 leading-tight">{activeModal.customer.firstName}<br/>{activeModal.customer.lastName}</h2>
              <div className="w-full space-y-6">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Documents Scannés</p>
                <div className="grid grid-cols-1 gap-4">
                  {((getField(activeModal.customer, 'documentImages', 'document_images') as any[]) || [])
                    .filter(u => isValidUrl(u))
                    .map((url: string, i: number) => (
                      <img key={i} src={url} className="w-full rounded-2xl shadow-sm border-2 border-white" />
                    ))}
                </div>
              </div>
            </div>
            <div className="md:w-2/3 p-16 overflow-y-auto relative bg-white custom-scrollbar text-left">
              <div className="absolute top-8 right-8 flex items-center gap-3">
                <button onClick={() => setShowRawCustomer(s => !s)} className="w-10 h-10 bg-gray-50 rounded-full text-sm font-black">RAW</button>
                <button onClick={() => setActiveModal({ type: null, customer: null })} className="w-14 h-14 flex items-center justify-center bg-gray-50 rounded-full text-2xl">✕</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                <div><p className="text-[10px] font-black text-blue-600 uppercase mb-2">Téléphone</p><p className="text-2xl font-black">{getField(activeModal.customer, 'phone', 'phone') || 'N/A'}</p></div>
                <div><p className="text-[10px] font-black text-blue-600 uppercase mb-2">Email</p><p className="text-2xl font-black">{getField(activeModal.customer, 'email', 'email') || 'N/A'}</p></div>
                <div><p className="text-[10px] font-black text-gray-400 uppercase mb-2">Type Document</p><p className="text-xl font-bold">{getField(activeModal.customer, 'documentType', 'document_type') || 'N/A'}</p></div>
                <div><p className="text-[10px] font-black text-gray-400 uppercase mb-2">Wilaya</p><p className="text-xl font-bold">{getField(activeModal.customer, 'wilaya', 'wilaya') || 'N/A'}</p></div>
                <div className="sm:col-span-2"><p className="text-[10px] font-black text-gray-400 uppercase mb-2">Adresse</p><p className="text-xl font-bold">{getField(activeModal.customer, 'address', 'address') || 'N/A'}</p></div>
                <div><p className="text-[10px] font-black text-gray-400 uppercase mb-2">Numéro Document</p><p className="text-xl font-bold">{getField(activeModal.customer, 'documentNumber', 'document_number') || getField(activeModal.customer, 'idCardNumber', 'id_card_number') || 'N/A'}</p></div>
                <div><p className="text-[10px] font-black text-gray-400 uppercase mb-2">Date délivrance</p><p className="text-xl font-bold">{getField(activeModal.customer, 'documentDeliveryDate', 'document_delivery_date') || 'N/A'}</p></div>
                <div><p className="text-[10px] font-black text-gray-400 uppercase mb-2">Adresse délivrance</p><p className="text-xl font-bold">{getField(activeModal.customer, 'documentDeliveryAddress', 'document_delivery_address') || 'N/A'}</p></div>
                <div><p className="text-[10px] font-black text-gray-400 uppercase mb-2">Date expiration</p><p className="text-xl font-bold">{getField(activeModal.customer, 'documentExpiryDate', 'document_expiry_date') || 'N/A'}</p></div>
                <div><p className="text-[10px] font-black text-gray-400 uppercase mb-2">Permis</p><p className="text-xl font-bold">{getField(activeModal.customer, 'licenseNumber', 'license_number') || 'N/A'}</p></div>
                <div><p className="text-[10px] font-black text-gray-400 uppercase mb-2">Expiration Permis</p><p className="text-xl font-bold">{getField(activeModal.customer, 'licenseExpiry', 'license_expiry') || 'N/A'}</p></div>
                <div><p className="text-[10px] font-black text-gray-400 uppercase mb-2">Délivrance Permis</p><p className="text-xl font-bold">{(getField(activeModal.customer, 'licenseIssueDate', 'license_issue_date') || 'N/A') + (getField(activeModal.customer, 'licenseIssuePlace', 'license_issue_place') ? ` - ${getField(activeModal.customer, 'licenseIssuePlace', 'license_issue_place')}` : '')}</p></div>
                <div className="sm:col-span-2 p-6 bg-red-50 rounded-3xl border border-red-100 flex items-center justify-between">
                   <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">Document laissé à l'agence</p>
                   <p className="text-xl font-black text-red-900">{activeModal.customer.documentLeftAtStore || 'Aucun'}</p>
                </div>
              </div>
              <div className="mt-16 p-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[3rem] text-white shadow-2xl flex justify-between items-center">
                <div><p className="text-[10px] font-black uppercase opacity-60 mb-2">Valeur Client</p><p className="text-6xl font-black">{activeModal.customer.totalSpent.toLocaleString()} DZ</p></div>
                <div className="text-right"><p className="text-[10px] font-black uppercase opacity-60 mb-2">Total Locations</p><p className="text-6xl font-black">{activeModal.customer.totalReservations}</p></div>
              </div>
              {showRawCustomer && (
                <pre className="mt-6 p-6 bg-gray-100 rounded-lg text-sm overflow-auto max-h-60">
                  {JSON.stringify(activeModal.customer, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomersPage;
