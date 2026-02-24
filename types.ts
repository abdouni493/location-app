
export type Role = 'admin' | 'worker' | 'driver';
export type Language = 'fr' | 'ar';

export interface User {
  username: string;
  role: Role;
}

export interface MenuItem {
  id: string;
  labelFr: string;
  labelAr: string;
  icon: string;
}

export interface TranslationSet {
  loginTitle: string;
  usernameLabel: string;
  passwordLabel: string;
  loginButton: string;
  autoFillLabel: string;
  logout: string;
  welcome: string;
  searchPlaceholder: string;
  emptyState: string;
  aiAnalyze: string;
}

export interface Agency {
  id: string;
  name: string;
  address: string;
  phone?: string;
}

export interface WorkerTransaction {
  id: string;
  type: 'payment' | 'advance' | 'absence';
  amount: number;
  date: string;
  note?: string;
}

export interface Worker {
  id: string;
  fullName: string;
  birthday: string;
  phone: string;
  email?: string;
  address: string;
  idCardNumber: string;
  photo?: string;
  role: Role;
  paymentType: 'day' | 'month';
  amount: number; // This is the salary (per day or month)
  username: string;
  password?: string;
  absences: number; // Count of days
  totalPaid: number;
  history: WorkerTransaction[];
}

export interface Expense {
  id: string;
  name: string;
  cost: number;
  date: string;
}

export interface Maintenance {
  id: string;
  vehicleId: string;
  type: 'vidange' | 'assurance' | 'ct' | 'other';
  name: string;
  cost: number;
  date: string;
  expiryDate?: string;
  note?: string;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  idCardNumber: string;
  wilaya: string;
  address: string;
  licenseNumber: string;
  licenseExpiry: string;
  // New document/passport fields
  documentType?: 'carte_identite' | 'passeport' | 'autre';
  documentNumber?: string;
  documentDeliveryDate?: string;
  documentDeliveryAddress?: string;
  documentExpiryDate?: string;
  // Driving licence extra info
  licenseIssueDate?: string;
  licenseIssuePlace?: string;
  profilePicture?: string;
  documentImages: string[];
  documentLeftAtStore?: string;
  totalReservations: number;
  totalSpent: number;
}

export interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  immatriculation: string;
  color: string;
  chassisNumber: string;
  fuelType: 'essence' | 'diesel' | 'gpl';
  transmission: 'manuelle' | 'automatique';
  seats: number;
  doors: number;
  dailyRate: number;
  weeklyRate: number;
  monthlyRate: number;
  deposit: number;
  status: 'disponible' | 'loué' | 'maintenance';
  currentLocation: string;
  mileage: number;
  insuranceExpiry: string;
  techControlDate: string;
  insuranceInfo: string;
  mainImage: string;
  secondaryImages: string[];
}

export type ReservationStatus = 'terminer' | 'annuler' | 'confermer' | 'en cours' | 'en attente';

export interface RentalOption {
  id: string;
  name: string;
  price: number;
  category: 'decoration' | 'equipment' | 'insurance' | 'service';
}

export interface LocationLog {
  mileage: number;
  fuel: 'plein' | '1/2' | '1/4' | '1/8' | 'vide';
  location: string;
  date: string;
  notes?: string;
}

export interface Reservation {
  id: string;
  reservationNumber: string;
  customerId: string;
  vehicleId: string;
  startDate: string;
  endDate: string;
  pickupAgencyId: string;
  returnAgencyId: string;
  driverId?: string;
  status: ReservationStatus;
  totalAmount: number;
  paidAmount: number;
  cautionAmount: number;
  discount: number;
  withTVA: boolean;
  options: RentalOption[];
  activationLog?: LocationLog;
  terminationLog?: LocationLog;
}

export interface Inspection {
  id: string;
  reservationId: string;
  type: 'depart' | 'retour';
  date: string;
  mileage: number;
  fuel: string;
  security: {
    lights: boolean;
    tires: boolean;
    brakes: boolean;
    wipers: boolean;
    mirrors: boolean;
    belts: boolean;
    horn: boolean;
  };
  equipment: {
    spareWheel: boolean;
    jack: boolean;
    triangles: boolean;
    firstAid: boolean;
    docs: boolean;
  };
  comfort: {
    ac: boolean;
  };
  cleanliness: {
    interior: boolean;
    exterior: boolean;
  };
  notes?: string;
  exteriorPhotos: string[];
  interiorPhotos: string[];
  signature?: string;
}

export interface Damage {
  id: string;
  name: string;
  description: string;
  vehicleId: string;
  reservationId: string;
  customerId: string;
  date: string;
  severity: 'leger' | 'moyen' | 'grave';
  position: string;
  costs: number;
  status: 'en attente' | 'réparé';
  repairDate?: string;
  photos: string[];
}
