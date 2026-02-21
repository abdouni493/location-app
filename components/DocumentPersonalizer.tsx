import React, { useState, useRef, useEffect } from 'react';
import { Language, Reservation, Customer, Vehicle } from '../types';
import GradientButton from './GradientButton';

interface PersonalizableElement {
  id: string;
  type: 'text' | 'logo' | 'signature' | 'image' | 'table' | 'divider' | 'checklist';
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight: string;
  textAlign: 'left' | 'center' | 'right';
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  opacity: number;
}

interface DocumentTemplate {
  id: string;
  name: string;
  category: 'devis' | 'contrat' | 'versement' | 'facture';
  elements: PersonalizableElement[];
  canvasWidth: number;
  canvasHeight: number;
}

interface DocumentPersonalizerProps {
  lang: Language;
  reservation: Reservation;
  customer: Customer;
  vehicle: Vehicle;
  // allow inspection doc types like 'checkin' and 'checkout'
  docType: string;
  initialTemplate?: DocumentTemplate;
  onSaveTemplate?: (template: DocumentTemplate) => void;
  onClose?: () => void;
  storeLogo?: string;
  storeInfo?: { name: string; phone: string; email: string; address: string };
}

const DocumentPersonalizer: React.FC<DocumentPersonalizerProps> = ({
  lang,
  reservation,
  customer,
  vehicle,
  docType,
  initialTemplate,
  onSaveTemplate,
  onClose,
  storeLogo,
  storeInfo,
}) => {
  const isRtl = lang === 'ar';
  const [template, setTemplate] = useState<DocumentTemplate>(
    initialTemplate || {
      id: `tpl-${Date.now()}`,
      name: `Modèle ${docType}`,
      category: docType,
      elements: getDefaultElements(docType, lang),
      canvasWidth: 800,
      canvasHeight: 1100,
    }
  );

  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  const t = {
    fr: {
      title: 'Personnaliser le Document',
      preview: 'Aperçu',
      dragText: 'Cliquez et glissez pour déplacer',
      doubleClickEdit: 'Double-cliquez pour éditer',
      color: 'Couleur',
      font: 'Police',
      size: 'Taille',
      bold: 'Gras',
      save: 'Enregistrer le modèle',
      print: 'Imprimer',
      cancel: 'Annuler',
    },
    ar: {
      title: 'تخصيص الوثيقة',
      preview: 'معاينة',
      dragText: 'انقر واسحب لنقل العنصر',
      doubleClickEdit: 'انقر مرتين للتحرير',
      color: 'اللون',
      font: 'الخط',
      size: 'الحجم',
      bold: 'غامق',
      save: 'حفظ النموذج',
      print: 'طباعة',
      cancel: 'إلغاء',
    },
  }[lang];

  const selectedElement = template.elements.find((el) => el.id === selectedElementId);

  const replaceVariables = (text: string): string => {
    const days = Math.ceil((new Date(reservation.endDate).getTime() - new Date(reservation.startDate).getTime()) / (1000 * 60 * 60 * 24));
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
      .replace('{{res_number}}', reservation.reservationNumber)
      .replace('{{res_date}}', new Date(reservation.startDate).toLocaleDateString(lang === 'ar' ? 'ar-DZ' : 'fr-FR'))
      .replace('{{start_date}}', new Date(reservation.startDate).toLocaleDateString(lang === 'ar' ? 'ar-DZ' : 'fr-FR'))
      .replace('{{end_date}}', new Date(reservation.endDate).toLocaleDateString(lang === 'ar' ? 'ar-DZ' : 'fr-FR'))
      .replace('{{duration}}', days.toString().padStart(2, '0'))
      .replace('{{total_amount}}', reservation.totalAmount.toLocaleString())
      .replace('{{total_ht}}', (reservation.totalAmount * 0.81).toLocaleString())
      .replace('{{unit_price}}', (reservation.totalAmount / days).toLocaleString())
      .replace('{{paid_amount}}', reservation.paidAmount.toLocaleString())
      .replace('{{remaining_amount}}', (reservation.totalAmount - reservation.paidAmount).toLocaleString())
      .replace('{{store_name}}', storeInfo?.name || 'DriveFlow')
      .replace('{{store_phone}}', storeInfo?.phone || '')
      .replace('{{store_email}}', storeInfo?.email || '')
      .replace('{{store_address}}', storeInfo?.address || '');
  };

  const handleMouseDown = (e: React.MouseEvent, elementId: string) => {
    setSelectedElementId(elementId);
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectedElementId || !canvasRef.current) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    setTemplate((prev) => ({
      ...prev,
      elements: prev.elements.map((el) =>
        el.id === selectedElementId
          ? { ...el, x: Math.max(0, el.x + deltaX), y: Math.max(0, el.y + deltaY) }
          : el
      ),
    }));

    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const updateElement = (updates: Partial<PersonalizableElement>) => {
    if (!selectedElementId) return;
    setTemplate((prev) => ({
      ...prev,
      elements: prev.elements.map((el) =>
        el.id === selectedElementId ? { ...el, ...updates } : el
      ),
    }));
  };

  const handleDoubleClick = (elementId: string) => {
    const element = template.elements.find((el) => el.id === elementId);
    if (!element) return;

    const newContent = prompt(`Éditer: ${element.content}`, element.content);
    if (newContent !== null) {
      updateElement({ content: newContent });
    }
  };

  return (
    <div className={`fixed inset-0 z-[400] bg-black/80 backdrop-blur-xl flex items-center justify-center p-8 animate-fade-in ${isRtl ? 'font-arabic' : ''}`}>
      <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-7xl max-h-[90vh] flex overflow-hidden">
        {/* Left Panel - Canvas */}
        <div className="flex-1 bg-gray-100 p-8 overflow-auto">
          <div
            ref={canvasRef}
            className="relative bg-white shadow-2xl mx-auto"
            style={{
              width: `${template.canvasWidth / 1.5}px`,
              height: `${template.canvasHeight / 1.5}px`,
              transform: 'scale(1)',
            }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {template.elements.map((element) => (
              <div
                key={element.id}
                className={`absolute group cursor-move border-2 transition-all ${
                  selectedElementId === element.id
                    ? 'border-blue-500 bg-blue-50/30'
                    : 'border-transparent hover:border-gray-300'
                }`}
                style={{
                  left: `${element.x / 1.5}px`,
                  top: `${element.y / 1.5}px`,
                  width: `${element.width / 1.5}px`,
                  height: `${element.height / 1.5}px`,
                  fontSize: `${element.fontSize / 1.5}px`,
                  color: element.color,
                  fontFamily: element.fontFamily,
                  fontWeight: element.fontWeight,
                  textAlign: element.textAlign,
                  backgroundColor: element.backgroundColor,
                  borderColor: element.borderColor,
                  borderWidth: `${element.borderWidth / 1.5}px`,
                  opacity: element.opacity,
                  padding: `${8 / 1.5}px`,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
                onMouseDown={(e) => handleMouseDown(e, element.id)}
                onClick={() => setSelectedElementId(element.id)}
                onDoubleClick={() => handleDoubleClick(element.id)}
                title={t.dragText}
              >
                {element.type === 'logo' && storeLogo ? (
                  <img src={storeLogo} alt="Logo" className="w-full h-full object-cover" />
                ) : element.type === 'signature' ? (
                  <div className="w-full h-full flex items-end justify-center border-b-2 border-gray-400">
                    <span className="text-[6px] opacity-30 mb-1">Signature</span>
                  </div>
                ) : element.type === 'table' ? (
                  <table className="w-full text-[8px] border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="p-1 text-left">Désignation</th>
                        <th className="p-1 text-center">Qté</th>
                        <th className="p-1 text-right">Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-1">{replaceVariables('Location {{vehicle_brand}} {{vehicle_model}}')}</td>
                        <td className="p-1 text-center">1</td>
                        <td className="p-1 text-right">{replaceVariables('{{total_amount}}')} DZ</td>
                      </tr>
                    </tbody>
                  </table>
                ) : element.type === 'divider' ? (
                  <div className="w-full h-full border-t-2 border-gray-400" />
                ) : element.type === 'checklist' ? (
                  // checklist rendering: content is stored as JSON string [{label:string, checked:boolean}]
                  (() => {
                    let items: { label: string; checked: boolean }[] = [];
                    try { items = JSON.parse(element.content || '[]'); } catch (e) { items = []; }
                    return (
                      <div className="w-full h-full p-2 text-[10px]">
                        {items.map((it, idx) => (
                          <div key={idx} className="flex items-center gap-3 py-1">
                            <label className={`w-4 h-4 rounded-sm border ${it.checked ? 'bg-green-600 border-green-600' : 'bg-white border-gray-300'}`} onClick={() => {
                              const newItems = items.map((x, i) => i === idx ? { ...x, checked: !x.checked } : x);
                              updateElement({ content: JSON.stringify(newItems) });
                            }} />
                            <div className={`${it.checked ? 'line-through text-gray-400' : ''}`}>{it.label}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })()
                ) : (
                  replaceVariables(element.content)
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel - Properties */}
        <div className="w-96 bg-white border-l border-gray-200 p-8 overflow-y-auto space-y-8">
          <div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">{t.title}</h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {docType.toUpperCase()} • {template.elements.length} éléments
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                const newEl: PersonalizableElement = {
                  id: `text-${Date.now()}`,
                  type: 'text',
                  content: 'Nouveau texte',
                  x: 80, y: 200, width: 300, height: 40, fontSize: 12, color: '#111827', fontFamily: 'Inter', fontWeight: '400', textAlign: 'left', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1
                };
                setTemplate(prev => ({ ...prev, elements: [...prev.elements, newEl] }));
                setSelectedElementId(newEl.id);
              }}
              className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-black hover:bg-gray-200"
            >
              ➕ Ajouter Texte
            </button>

            <button
              onClick={() => {
                const checklistItems = [
                  { label: 'Feux & Phares', checked: false },
                  { label: 'Pneus (Usure/Pression)', checked: false },
                  { label: 'Freins', checked: false },
                  { label: 'Essuie-glaces', checked: false },
                  { label: 'Rétroviseurs', checked: false },
                  { label: 'Ceintures', checked: false },
                  { label: 'Klaxon', checked: false },
                  { label: 'Roue de secours', checked: false },
                  { label: 'Cric', checked: false },
                  { label: 'Triangles', checked: false },
                  { label: 'Trousse secours', checked: false },
                  { label: 'Docs véhicule', checked: false },
                  { label: 'Climatisation (A/C)', checked: false },
                  { label: 'Intérieur Propre', checked: false },
                  { label: 'Extérieur Propre', checked: false }
                ];
                const newEl: PersonalizableElement = {
                  id: `checklist-${Date.now()}`,
                  type: 'checklist',
                  content: JSON.stringify(checklistItems),
                  x: 60, y: 300, width: 380, height: 220, fontSize: 12, color: '#111827', fontFamily: 'Inter', fontWeight: '400', textAlign: 'left', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1
                };
                setTemplate(prev => ({ ...prev, elements: [...prev.elements, newEl] }));
                setSelectedElementId(newEl.id);
              }}
              className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-black hover:bg-gray-200"
            >
              ➕ Ajouter Checklist
            </button>
          </div>

          {selectedElement && (
            <div className="space-y-6 pt-6 border-t border-gray-200">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-3">Contenu</label>
                <textarea
                  value={selectedElement.content}
                  onChange={(e) => updateElement({ content: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none resize-none"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">{t.color}</label>
                  <input
                    type="color"
                    value={selectedElement.color}
                    onChange={(e) => updateElement({ color: e.target.value })}
                    className="w-full h-10 rounded-lg cursor-pointer border border-gray-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">{t.font}</label>
                  <select
                    value={selectedElement.fontFamily}
                    onChange={(e) => updateElement({ fontFamily: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500"
                  >
                    <option>Inter</option>
                    <option>Arial</option>
                    <option>Times New Roman</option>
                    <option>Courier New</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">{t.size}</label>
                  <input
                    type="number"
                    value={selectedElement.fontSize}
                    onChange={(e) => updateElement({ fontSize: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500"
                    min="8"
                    max="48"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">{t.bold}</label>
                  <select
                    value={selectedElement.fontWeight}
                    onChange={(e) => updateElement({ fontWeight: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500"
                  >
                    <option value="400">Normal</option>
                    <option value="700">Gras</option>
                    <option value="900">Ultra</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">Alignement</label>
                <div className="flex gap-2">
                  {(['left', 'center', 'right'] as const).map((align) => (
                    <button
                      key={align}
                      onClick={() => updateElement({ textAlign: align })}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold transition-all ${
                        selectedElement.textAlign === align
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {align === 'left' ? '⬅' : align === 'center' ? '⬇' : '➡'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="pt-6 border-t border-gray-200 space-y-3">
            {onSaveTemplate && (
              <GradientButton
                onClick={() => {
                  if (onSaveTemplate) onSaveTemplate(template);
                }}
                className="!w-full"
              >
                💾 {t.save}
              </GradientButton>
            )}
            <button
              onClick={() => {
                if (!canvasRef.current) return;
                
                const printWindow = window.open('', '_blank');
                if (!printWindow) return;
                
                // Extract all elements from the canvas
                const elements = template.elements;
                
                // Build the HTML content with proper styling
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
                      .subtitle {
                        font-size: 14px;
                        font-weight: 900;
                        color: #1f2937;
                        margin-bottom: 8px;
                        text-transform: uppercase;
                        letter-spacing: 0.3px;
                      }
                      table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 9px;
                      }
                      td, th {
                        border: 1px solid #e5e7eb;
                        padding: 4px;
                        text-align: left;
                      }
                      th {
                        background-color: #f3f4f6;
                        font-weight: 600;
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
                        body {
                          margin: 0;
                          padding: 0;
                        }
                        .page {
                          page-break-after: always;
                          margin: 0;
                          padding: 20mm;
                          width: 100%;
                          height: auto;
                        }
                        .page:last-child {
                          page-break-after: avoid;
                        }
                      }
                    </style>
                  </head>
                  <body>
                    <!-- PAGE 1 -->
                    <div class="page">
                      <img src="${storeLogo || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%2250%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22100%22 height=%2250%22/%3E%3C/svg%3E'}" alt="Logo" class="logo">
                      
                      <div class="title">CONTRAT DE LOCATION DE VÉHICULE</div>
                      
                      <div class="two-column">
                        <div>
                          <div class="section-header">DÉTAILS DU CONTRAT</div>
                          <div class="content-box">
                            <strong>Date du contrat:</strong> ${replaceVariables('{{res_date}}')}<br>
                            <strong>Numéro du contrat:</strong> ${replaceVariables('{{res_number}}')}<br>
                          </div>
                        </div>
                        <div>
                          <div class="section-header">PÉRIODE DE LOCATION</div>
                          <div class="content-box">
                            <strong>Date de départ:</strong> ${replaceVariables('{{start_date}}')}<br>
                            <strong>Date de retour:</strong> ${replaceVariables('{{end_date}}')}<br>
                            <strong>Durée:</strong> ${replaceVariables('{{duration}}')} jours<br>
                          </div>
                        </div>
                      </div>
                      
                      <div class="section-header purple">INFORMATIONS DU CONDUCTEUR (Conducteur 01)</div>
                      <div class="content-box">
                        <strong>Nom:</strong> ${replaceVariables('{{client_name}}')}<br>
                        <strong>Date de naissance:</strong> ${replaceVariables('{{client_dob}}')}<br>
                        <strong>Lieu de naissance:</strong> ${replaceVariables('{{client_pob}}')}<br>
                        <strong>Type de document:</strong> Permis de conduire biométrique<br>
                        <strong>Numéro du document:</strong> ${replaceVariables('{{client_license}}')}<br>
                        <strong>Date d'émission:</strong> ${replaceVariables('{{license_issued}}')}<br>
                        <strong>Date d'expiration:</strong> ${replaceVariables('{{license_expiry}}')}<br>
                        <strong>Lieu d'émission:</strong> ${replaceVariables('{{license_place}}')}<br>
                      </div>
                      
                      <div class="section-header green">INFORMATIONS DU VÉHICULE</div>
                      <div class="content-box">
                        <strong>Modèle:</strong> ${replaceVariables('{{vehicle_model}}')}<br>
                        <strong>Couleur:</strong> ${replaceVariables('{{vehicle_color}}')}<br>
                        <strong>Immatriculation:</strong> ${replaceVariables('{{vehicle_plate}}')}<br>
                        <strong>Numéro de série:</strong> ${replaceVariables('{{vehicle_vin}}')}<br>
                        <strong>Type de carburant:</strong> ${replaceVariables('{{vehicle_fuel}}')}<br>
                        <strong>Kilométrage au départ:</strong> ${replaceVariables('{{vehicle_mileage}}')} km<br>
                      </div>
                      
                      <div class="section-header red">INFORMATIONS FINANCIÈRES</div>
                      <div class="content-box" style="background-color: #fee2e2; border-color: #fca5a5;">
                        <strong>Prix unitaire:</strong> ${replaceVariables('{{unit_price}}')} DZ<br>
                        <strong>Prix total (HT):</strong> ${replaceVariables('{{total_ht}}')} DZ<br>
                        <strong>Montant total du contrat:</strong> ${replaceVariables('{{total_amount}}')} DZ<br>
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
                    
                    <!-- PAGE 2 -->
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
              }}
              className="w-full px-6 py-3 bg-green-600 text-white font-black rounded-2xl hover:bg-green-700 transition-all shadow-lg"
            >
              🖨️ {t.print}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="w-full px-6 py-3 bg-gray-200 text-gray-900 font-black rounded-2xl hover:bg-gray-300 transition-all"
              >
                ✕ {t.cancel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function getDefaultElements(docType: string, lang: Language): PersonalizableElement[] {
  const isAr = lang === 'ar';

  const defaultElements: Record<string, PersonalizableElement[]> = {
    devis: [
      { id: '1', type: 'logo', content: 'LOGO', x: 50, y: 30, width: 100, height: 60, fontSize: 12, color: '#111827', fontFamily: 'Inter', fontWeight: '700', textAlign: 'center', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1 },
      { id: '2', type: 'text', content: 'DEVIS', x: 350, y: 50, width: 200, height: 40, fontSize: 32, color: '#1f2937', fontFamily: 'Inter', fontWeight: '900', textAlign: 'center', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1 },
      { id: '3', type: 'text', content: 'Adressé à:\n{{client_name}}\n{{client_phone}}', x: 50, y: 150, width: 300, height: 80, fontSize: 11, color: '#374151', fontFamily: 'Inter', fontWeight: '400', textAlign: 'left', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1 },
      { id: '4', type: 'text', content: 'Véhicule:\n{{vehicle_brand}} {{vehicle_model}}\n{{vehicle_plate}}', x: 450, y: 150, width: 300, height: 80, fontSize: 11, color: '#374151', fontFamily: 'Inter', fontWeight: '400', textAlign: 'left', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1 },
      { id: '5', type: 'divider', content: '', x: 50, y: 260, width: 700, height: 2, fontSize: 1, color: '#d1d5db', fontFamily: 'Inter', fontWeight: '400', textAlign: 'left', backgroundColor: '#d1d5db', borderColor: '#d1d5db', borderWidth: 0, opacity: 1 },
      { id: '6', type: 'table', content: '', x: 50, y: 290, width: 700, height: 150, fontSize: 10, color: '#111827', fontFamily: 'Inter', fontWeight: '600', textAlign: 'left', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1 },
      { id: '7', type: 'text', content: 'Montant Total: {{total_amount}} DZ', x: 450, y: 500, width: 300, height: 40, fontSize: 16, color: '#dc2626', fontFamily: 'Inter', fontWeight: '900', textAlign: 'right', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1 },
      { id: '8', type: 'signature', content: 'Cachet et signature du vendeur', x: 50, y: 600, width: 250, height: 150, fontSize: 10, color: '#6b7280', fontFamily: 'Inter', fontWeight: '400', textAlign: 'center', backgroundColor: 'transparent', borderColor: '#d1d5db', borderWidth: 1, opacity: 1 },
    ],
    contrat: [
      // PAGE 1 HEADER
      { id: '1', type: 'logo', content: 'LOGO', x: 50, y: 20, width: 100, height: 50, fontSize: 12, color: '#111827', fontFamily: 'Inter', fontWeight: '700', textAlign: 'center', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1 },
      { id: '2', type: 'text', content: 'CONTRAT DE LOCATION DE VÉHICULE', x: 200, y: 30, width: 550, height: 40, fontSize: 22, color: '#1f2937', fontFamily: 'Inter', fontWeight: '900', textAlign: 'center', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1 },
      
      // CONTRACT DETAILS SECTION
      { id: '3', type: 'text', content: 'DÉTAILS DU CONTRAT', x: 50, y: 80, width: 700, height: 25, fontSize: 12, color: '#fff', fontFamily: 'Inter', fontWeight: '900', textAlign: 'left', backgroundColor: '#2563eb', borderColor: '#2563eb', borderWidth: 0, opacity: 1 },
      { id: '4', type: 'text', content: 'Date du contrat: {{res_date}}\nNuméro du contrat: {{res_number}}', x: 50, y: 110, width: 350, height: 60, fontSize: 10, color: '#374151', fontFamily: 'Inter', fontWeight: '400', textAlign: 'left', backgroundColor: '#f3f4f6', borderColor: '#e5e7eb', borderWidth: 1, opacity: 1 },
      
      // RENTAL PERIOD SECTION
      { id: '5', type: 'text', content: 'PÉRIODE DE LOCATION', x: 420, y: 80, width: 330, height: 25, fontSize: 12, color: '#fff', fontFamily: 'Inter', fontWeight: '900', textAlign: 'left', backgroundColor: '#2563eb', borderColor: '#2563eb', borderWidth: 0, opacity: 1 },
      { id: '6', type: 'text', content: 'Date de départ: {{start_date}}\nDate de retour: {{end_date}}\nDurée: {{duration}} jours', x: 420, y: 110, width: 330, height: 60, fontSize: 10, color: '#374151', fontFamily: 'Inter', fontWeight: '400', textAlign: 'left', backgroundColor: '#f3f4f6', borderColor: '#e5e7eb', borderWidth: 1, opacity: 1 },
      
      // DRIVER INFORMATION SECTION
      { id: '7', type: 'text', content: 'INFORMATIONS DU CONDUCTEUR (Conducteur 01)', x: 50, y: 185, width: 700, height: 25, fontSize: 12, color: '#fff', fontFamily: 'Inter', fontWeight: '900', textAlign: 'left', backgroundColor: '#7c3aed', borderColor: '#7c3aed', borderWidth: 0, opacity: 1 },
      { id: '8', type: 'text', content: 'Nom: {{client_name}}\nDate de naissance: {{client_dob}}\nLieu de naissance: {{client_pob}}\nType de document: Permis de conduire biométrique\nNuméro du document: {{client_license}}\nDate d\'émission: {{license_issued}}\nDate d\'expiration: {{license_expiry}}\nLieu d\'émission: {{license_place}}', x: 50, y: 215, width: 700, height: 130, fontSize: 9, color: '#374151', fontFamily: 'Inter', fontWeight: '400', textAlign: 'left', backgroundColor: '#f3f4f6', borderColor: '#e5e7eb', borderWidth: 1, opacity: 1 },
      
      // VEHICLE INFORMATION SECTION
      { id: '9', type: 'text', content: 'INFORMATIONS DU VÉHICULE', x: 50, y: 360, width: 700, height: 25, fontSize: 12, color: '#fff', fontFamily: 'Inter', fontWeight: '900', textAlign: 'left', backgroundColor: '#059669', borderColor: '#059669', borderWidth: 0, opacity: 1 },
      { id: '10', type: 'text', content: 'Modèle: {{vehicle_model}}\nCouleur: {{vehicle_color}}\nImmatriculation: {{vehicle_plate}}\nNuméro de série: {{vehicle_vin}}\nType de carburant: {{vehicle_fuel}}\nKilométrage au départ: {{vehicle_mileage}} km', x: 50, y: 390, width: 700, height: 100, fontSize: 9, color: '#374151', fontFamily: 'Inter', fontWeight: '400', textAlign: 'left', backgroundColor: '#f3f4f6', borderColor: '#e5e7eb', borderWidth: 1, opacity: 1 },
      
      // FINANCIAL INFORMATION SECTION
      { id: '11', type: 'text', content: 'INFORMATIONS FINANCIÈRES', x: 50, y: 505, width: 700, height: 25, fontSize: 12, color: '#fff', fontFamily: 'Inter', fontWeight: '900', textAlign: 'left', backgroundColor: '#dc2626', borderColor: '#dc2626', borderWidth: 0, opacity: 1 },
      { id: '12', type: 'text', content: 'Prix unitaire: {{unit_price}} DZ\nPrix total (HT): {{total_ht}} DZ\nMontant total du contrat: {{total_amount}} DZ', x: 50, y: 535, width: 700, height: 75, fontSize: 10, color: '#374151', fontFamily: 'Inter', fontWeight: '600', textAlign: 'left', backgroundColor: '#fee2e2', borderColor: '#fca5a5', borderWidth: 1, opacity: 1 },
      
      // CHECKLIST HEADER
      { id: '13', type: 'text', content: 'LISTE DE VÉRIFICATION DE L\'ÉQUIPEMENT ET DE L\'INSPECTION', x: 50, y: 625, width: 700, height: 25, fontSize: 11, color: '#fff', fontFamily: 'Inter', fontWeight: '900', textAlign: 'left', backgroundColor: '#ea580c', borderColor: '#ea580c', borderWidth: 0, opacity: 1 },
      { id: '14', type: 'checklist', content: '☐ Pneus | ☐ Batterie | ☐ Freins | ☐ Phares | ☐ Essuie-glaces | ☐ Moteur\n☐ Ceintures | ☐ Intérieur propre | ☐ Réservoir plein | ☐ Fenêtres | ☐ Miroirs | ☐ Autres', x: 50, y: 655, width: 700, height: 80, fontSize: 9, color: '#374151', fontFamily: 'Inter', fontWeight: '400', textAlign: 'left', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1 },
      
      // SIGNATURES SECTION PAGE 1
      { id: '15', type: 'text', content: 'SIGNATURES', x: 50, y: 750, width: 700, height: 20, fontSize: 11, color: '#fff', fontFamily: 'Inter', fontWeight: '900', textAlign: 'left', backgroundColor: '#6366f1', borderColor: '#6366f1', borderWidth: 0, opacity: 1 },
      { id: '16', type: 'signature', content: 'Signature du locataire\net empreinte', x: 50, y: 780, width: 320, height: 100, fontSize: 9, color: '#6b7280', fontFamily: 'Inter', fontWeight: '400', textAlign: 'center', backgroundColor: 'transparent', borderColor: '#d1d5db', borderWidth: 1, opacity: 1 },
      { id: '17', type: 'signature', content: 'Signature de l\'agent\net cachet', x: 430, y: 780, width: 320, height: 100, fontSize: 9, color: '#6b7280', fontFamily: 'Inter', fontWeight: '400', textAlign: 'center', backgroundColor: 'transparent', borderColor: '#d1d5db', borderWidth: 1, opacity: 1 },
      
      // PAGE 2 - HEADER
      { id: '18', type: 'text', content: 'PAGE 2 - CONDITIONS ET TERMES DU CONTRAT', x: 50, y: 900, width: 700, height: 30, fontSize: 16, color: '#1f2937', fontFamily: 'Inter', fontWeight: '900', textAlign: 'center', backgroundColor: '#dbeafe', borderColor: '#0ea5e9', borderWidth: 2, opacity: 1 },
      
      // ARABIC TERMS SECTION
      { id: '19', type: 'text', content: 'يمكنك قراءة شروط العقد في الأسفل ومصادقة عليها\n\n1- السن: يجب أن يكون السائق يبلغ من العمر 20 عاماً على الأقل، وأن يكون حاصلاً على رخصة قيادة منذ سنتين على الأقل.\n\n2- جواز السفر: إيداع جواز السفر البيومتري الإلزامي، بالإضافة إلى دفع تأمين ابتدائي يبدأ من 30,000.00 دج حسب فئة المركبة، ويعد هذا بمثابة ضمان لطلبه.\n\n3- الوقود: الوقود يكون على نفقة الزبون.\n\n4- قانون ونظام: يتم الدفع نقداً عند تسليم السيارة.\n\n5- النظافة: تسلم السيارة نظيفة ويجب إرجاعها في نفس الحالة، وفي حال عدم ذلك، سيتم احتساب تكلفة الغسيل بمبلغ 1000 دج.', x: 50, y: 940, width: 700, height: 200, fontSize: 8, color: '#1f2937', fontFamily: 'Inter', fontWeight: '400', textAlign: 'right', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1 },
      
      { id: '20', type: 'text', content: '6- مكان التسليم: يتم تسليم السيارات في موقف السيارات التابع لوكالاتنا.\n\n7- جدول المواعيد: يجب على الزبون احترام المواعيد المحددة عند الحجز، يجب الإبلاغ مسبقاً عن أي تغيير. لا يمكن للزبون تمديد مدة الإيجار إلا بعد الحصول على إذن من وكالتنا للإيجار، وذلك بإشعار مسبق لا يقل عن 48 ساعة.\n\n8- الأضرار والخسائر: التأمين الأساسي: يلتزم الزبون بدفع جميع الأضرار التي تلحق بالمركبة سواء كان مخطئاً أو غير مخطئ. أي ضرر يلحق بالمركبة سيؤدي إلى خصم من مبلغ الضمان.\n\n9- عند السرقة: في حالة السرقة أو تضرر المركبة، يجب تقديم تصريح لدى مصالح الشرطة أو الدرك الوطني قبل أي تصريح، يجب على الزبون إبلاغ وكالة الكراء بشكل إلزامي.', x: 50, y: 1150, width: 700, height: 200, fontSize: 8, color: '#1f2937', fontFamily: 'Inter', fontWeight: '400', textAlign: 'right', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1 },
      
      { id: '21', type: 'text', content: '10- تأمين: يستفيد من التأمين فقط السائقون المذكورون في عقد الكراء، يُمنع منعاً باتاً إعارة أو تأجير المركبة من الباطن، وتكون جميع الأضرار الناتجة عن مثل هذه الحالات على عاتق الزبون بالكامل.\n\n11- عطل ميكانيكي: خلال فترة الإيجار، وبناءً على عدد الكيلومترات المقطوعة، يجب على الزبون إجراء الفحوصات اللازمة مثل مستوى الزيت، حالة المحرك، ضغط الإطارات، وغيرها في حال حدوث عطل ميكانيكي بسبب إهمال الزبون في إجراء هذه الفحوصات أو لأي سبب آخر ناتج عن مسؤولية الزبون (مثلاً: كسر حوض الزيت، العارضة السفلية، القفل أو غيرها)، فإن تكاليف الإصلاح والصيانة تكون على عاتق الزبون بالكامل.\n\n12- خسائر إضافية: الأضرار التي تلحق بالعجلات والإطارات، القيادة بالإطارات المفرغة من الهواء، التدهور، السرقة، نهب الملحقات، أعمال التخريب، الأضرار الميكانيكية الناتجة عن سوء استخدام المركبة، الأضرار التي تحدث أسفل المركبة (الصدام الأمامي، الجوانب، حوض الزيت، العادم) والأضرار الناتجة عن الاضطرابات والشغب، كلها سيتم تحميل تكلفتها على الزبون.', x: 50, y: 1360, width: 700, height: 200, fontSize: 8, color: '#1f2937', fontFamily: 'Inter', fontWeight: '400', textAlign: 'right', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1 },
      
      { id: '22', type: 'text', content: '13- ضريبة التأخير: مدة الإيجار تُحتسب على فترات كاملة مدتها 24 ساعة غير قابلة للتقسيم، بدءاً من وقت حجز المركبة وحتى الوقت المذكور في العقد، يجب على الزبون إعادة المركبة في نفس الوقت، وإلا سيتم احتساب تكلفة تأخير مقدارها 800 دينار لكل ساعة تأخير.\n\n14- عدد الأميال: عدد الكيلومترات محدود لجميع مركباتنا بـ 300 كم يومياً، ويفرض غرامة قدرها 30 دج عن كل كيلومتر زائد.\n\n15- شروط: يقر الزبون بأنه اطلع على شروط الإيجار هذه وقبلها دون أي تحفظ، ويتعهد بتوقيع هذا العقد.', x: 50, y: 1570, width: 700, height: 150, fontSize: 8, color: '#1f2937', fontFamily: 'Inter', fontWeight: '400', textAlign: 'right', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1 },
      
      // PAGE 2 FOOTER WITH SIGNATURE
      { id: '23', type: 'text', content: 'الموافقة والتوقيع', x: 50, y: 1730, width: 700, height: 25, fontSize: 12, color: '#fff', fontFamily: 'Inter', fontWeight: '900', textAlign: 'center', backgroundColor: '#6366f1', borderColor: '#6366f1', borderWidth: 0, opacity: 1 },
      { id: '24', type: 'signature', content: 'امضاء وبصمة الزبون\nSignature et Empreinte du Client', x: 50, y: 1765, width: 650, height: 100, fontSize: 10, color: '#6b7280', fontFamily: 'Inter', fontWeight: '400', textAlign: 'center', backgroundColor: 'transparent', borderColor: '#d1d5db', borderWidth: 2, opacity: 1 },
    ],
    // Inspection templates for check-in / check-out (historique des inspections)
    checkin: [
      { id: 'i1', type: 'text', content: "RAPPORT D'INSPECTION - CHECK-IN", x: 50, y: 20, width: 700, height: 40, fontSize: 20, color: '#111827', fontFamily: 'Inter', fontWeight: '900', textAlign: 'center', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1 },
      { id: 'i2', type: 'text', content: 'Dossier: {{res_number}}\nDate inspection: {{res_date}}\nType: Check-in', x: 50, y: 80, width: 700, height: 60, fontSize: 11, color: '#374151', fontFamily: 'Inter', fontWeight: '600', textAlign: 'left', backgroundColor: '#f3f4f6', borderColor: '#e5e7eb', borderWidth: 1, opacity: 1 },
      { id: 'i3', type: 'text', content: 'Client:\n{{client_name}}\n{{client_phone}}\n{{client_email}}', x: 50, y: 150, width: 340, height: 80, fontSize: 11, color: '#374151', fontFamily: 'Inter', fontWeight: '600', textAlign: 'left', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1 },
      { id: 'i4', type: 'text', content: 'INFORMATIONS DU VÉHICULE\nModèle: {{vehicle_brand}} {{vehicle_model}}\nCouleur: {{vehicle_color}}\nImmatriculation: {{vehicle_plate}}\nKilométrage: {{vehicle_mileage}} km', x: 410, y: 150, width: 340, height: 120, fontSize: 11, color: '#374151', fontFamily: 'Inter', fontWeight: '600', textAlign: 'left', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1 },
      { id: 'i5', type: 'checklist', content: JSON.stringify([
        { label: 'Feux & Phares', checked: false },
        { label: 'Pneus (Usure/Pression)', checked: false },
        { label: 'Freins', checked: false },
        { label: 'Essuie-glaces', checked: false },
        { label: 'Rétroviseurs', checked: false },
        { label: 'Ceintures', checked: false },
        { label: 'Klaxon', checked: false },
        { label: 'Roue de secours', checked: false },
        { label: 'Cric', checked: false },
        { label: 'Triangles', checked: false },
        { label: 'Trousse secours', checked: false },
        { label: 'Docs véhicule', checked: false },
        { label: 'Climatisation (A/C)', checked: false },
        { label: 'Intérieur Propre', checked: false },
        { label: 'Extérieur Propre', checked: false }
      ]), x: 50, y: 290, width: 700, height: 260, fontSize: 12, color: '#111827', fontFamily: 'Inter', fontWeight: '400', textAlign: 'left', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1 },
      { id: 'i6', type: 'signature', content: 'Signature client', x: 50, y: 930, width: 320, height: 100, fontSize: 11, color: '#6b7280', fontFamily: 'Inter', fontWeight: '400', textAlign: 'center', backgroundColor: 'transparent', borderColor: '#d1d5db', borderWidth: 1, opacity: 1 },
      { id: 'i7', type: 'signature', content: 'Signature agent / Cacher', x: 380, y: 930, width: 320, height: 100, fontSize: 11, color: '#6b7280', fontFamily: 'Inter', fontWeight: '400', textAlign: 'center', backgroundColor: 'transparent', borderColor: '#d1d5db', borderWidth: 1, opacity: 1 }
    ],
    checkout: [
      { id: 'o1', type: 'text', content: "RAPPORT D'INSPECTION - CHECK-OUT", x: 50, y: 20, width: 700, height: 40, fontSize: 20, color: '#111827', fontFamily: 'Inter', fontWeight: '900', textAlign: 'center', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1 },
      { id: 'o2', type: 'text', content: 'Dossier: {{res_number}}\nDate inspection: {{res_date}}\nType: Check-out', x: 50, y: 80, width: 700, height: 60, fontSize: 11, color: '#374151', fontFamily: 'Inter', fontWeight: '600', textAlign: 'left', backgroundColor: '#f3f4f6', borderColor: '#e5e7eb', borderWidth: 1, opacity: 1 },
      { id: 'o3', type: 'text', content: 'Client:\n{{client_name}}\n{{client_phone}}\n{{client_email}}', x: 50, y: 150, width: 340, height: 80, fontSize: 11, color: '#374151', fontFamily: 'Inter', fontWeight: '600', textAlign: 'left', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1 },
      { id: 'o4', type: 'text', content: 'INFORMATIONS DU VÉHICULE\nModèle: {{vehicle_brand}} {{vehicle_model}}\nCouleur: {{vehicle_color}}\nImmatriculation: {{vehicle_plate}}\nKilométrage: {{vehicle_mileage}} km', x: 410, y: 150, width: 340, height: 120, fontSize: 11, color: '#374151', fontFamily: 'Inter', fontWeight: '600', textAlign: 'left', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1 },
      { id: 'o5', type: 'checklist', content: JSON.stringify([
        { label: 'Feux & Phares', checked: false },
        { label: 'Pneus (Usure/Pression)', checked: false },
        { label: 'Freins', checked: false },
        { label: 'Essuie-glaces', checked: false },
        { label: 'Rétroviseurs', checked: false },
        { label: 'Ceintures', checked: false },
        { label: 'Klaxon', checked: false },
        { label: 'Roue de secours', checked: false },
        { label: 'Cric', checked: false },
        { label: 'Triangles', checked: false },
        { label: 'Trousse secours', checked: false },
        { label: 'Docs véhicule', checked: false },
        { label: 'Climatisation (A/C)', checked: false },
        { label: 'Intérieur Propre', checked: false },
        { label: 'Extérieur Propre', checked: false }
      ]), x: 50, y: 290, width: 700, height: 260, fontSize: 12, color: '#111827', fontFamily: 'Inter', fontWeight: '400', textAlign: 'left', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1 },
      { id: 'o6', type: 'signature', content: 'Signature client', x: 50, y: 930, width: 320, height: 100, fontSize: 11, color: '#6b7280', fontFamily: 'Inter', fontWeight: '400', textAlign: 'center', backgroundColor: 'transparent', borderColor: '#d1d5db', borderWidth: 1, opacity: 1 },
      { id: 'o7', type: 'signature', content: 'Signature agent / Cacher', x: 380, y: 930, width: 320, height: 100, fontSize: 11, color: '#6b7280', fontFamily: 'Inter', fontWeight: '400', textAlign: 'center', backgroundColor: 'transparent', borderColor: '#d1d5db', borderWidth: 1, opacity: 1 }
    ],
    versement: [
      { id: '1', type: 'logo', content: 'LOGO', x: 50, y: 30, width: 100, height: 60, fontSize: 12, color: '#111827', fontFamily: 'Inter', fontWeight: '700', textAlign: 'center', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1 },
      { id: '2', type: 'text', content: 'REÇU DE VERSEMENT', x: 250, y: 50, width: 300, height: 50, fontSize: 28, color: '#1f2937', fontFamily: 'Inter', fontWeight: '900', textAlign: 'center', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1 },
      { id: '3', type: 'text', content: 'Client: {{client_name}}\nDossier: {{res_number}}\nDate: {{res_date}}', x: 50, y: 140, width: 700, height: 60, fontSize: 11, color: '#374151', fontFamily: 'Inter', fontWeight: '400', textAlign: 'left', backgroundColor: '#f3f4f6', borderColor: '#e5e7eb', borderWidth: 1, opacity: 1 },
      { id: '4', type: 'text', content: 'Montant Total: {{total_amount}} DZ\nMontant Payé: {{paid_amount}} DZ\nReste à Payer: {{remaining_amount}} DZ', x: 50, y: 230, width: 700, height: 100, fontSize: 13, color: '#1f2937', fontFamily: 'Inter', fontWeight: '600', textAlign: 'left', backgroundColor: '#dbeafe', borderColor: '#0ea5e9', borderWidth: 2, opacity: 1 },
      { id: '5', type: 'text', content: 'Détails de la réservation:\nVéhicule: {{vehicle_brand}} {{vehicle_model}}\nImmatriculation: {{vehicle_plate}}', x: 50, y: 360, width: 700, height: 80, fontSize: 10, color: '#374151', fontFamily: 'Inter', fontWeight: '400', textAlign: 'left', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1 },
      { id: '6', type: 'signature', content: 'Cachet de la succursale', x: 50, y: 480, width: 300, height: 100, fontSize: 10, color: '#6b7280', fontFamily: 'Inter', fontWeight: '400', textAlign: 'center', backgroundColor: 'transparent', borderColor: '#d1d5db', borderWidth: 1, opacity: 1 },
      { id: '7', type: 'signature', content: 'Signature du client', x: 450, y: 480, width: 300, height: 100, fontSize: 10, color: '#6b7280', fontFamily: 'Inter', fontWeight: '400', textAlign: 'center', backgroundColor: 'transparent', borderColor: '#d1d5db', borderWidth: 1, opacity: 1 },
    ],
    facture: [
      { id: '1', type: 'logo', content: 'LOGO', x: 50, y: 30, width: 100, height: 60, fontSize: 12, color: '#111827', fontFamily: 'Inter', fontWeight: '700', textAlign: 'center', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1 },
      { id: '2', type: 'text', content: 'FACTURE', x: 400, y: 50, width: 250, height: 50, fontSize: 32, color: '#1f2937', fontFamily: 'Inter', fontWeight: '900', textAlign: 'center', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1 },
      { id: '3', type: 'text', content: '{{store_name}}\n{{store_address}}\n{{store_phone}} | {{store_email}}', x: 50, y: 120, width: 350, height: 80, fontSize: 9, color: '#6b7280', fontFamily: 'Inter', fontWeight: '400', textAlign: 'left', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1 },
      { id: '4', type: 'text', content: 'Facturé à:\n{{client_name}}\n{{client_phone}}', x: 450, y: 120, width: 300, height: 80, fontSize: 10, color: '#374151', fontFamily: 'Inter', fontWeight: '400', textAlign: 'left', backgroundColor: '#f3f4f6', borderColor: '#e5e7eb', borderWidth: 1, opacity: 1 },
      { id: '5', type: 'table', content: '', x: 50, y: 230, width: 700, height: 150, fontSize: 10, color: '#111827', fontFamily: 'Inter', fontWeight: '600', textAlign: 'left', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1 },
      { id: '6', type: 'text', content: 'TOTAL À PAYER: {{total_amount}} DZ', x: 450, y: 420, width: 300, height: 40, fontSize: 18, color: '#dc2626', fontFamily: 'Inter', fontWeight: '900', textAlign: 'right', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1 },
      { id: '7', type: 'text', content: 'Merci pour votre confiance', x: 50, y: 500, width: 700, height: 40, fontSize: 11, color: '#6b7280', fontFamily: 'Inter', fontWeight: '400', textAlign: 'center', backgroundColor: 'transparent', borderColor: '#e5e7eb', borderWidth: 0, opacity: 1 },
    ],
  };

  return defaultElements[docType] || [];
}

export default DocumentPersonalizer;
