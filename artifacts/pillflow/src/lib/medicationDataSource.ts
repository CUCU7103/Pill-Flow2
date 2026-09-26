import * as apiRepository from "@/lib/medicationApiRepository";
import * as supabaseRepository from "@/lib/medicationRepository";

const repository = import.meta.env.VITE_API_BASE_URL ? apiRepository : supabaseRepository;

export const fetchMedications = repository.fetchMedications;
export const addMedication = repository.addMedication;
export const deleteMedication = repository.deleteMedication;
export const toggleMedicationLog = repository.toggleMedicationLog;
export const resetAllMedications = repository.resetAllMedications;
