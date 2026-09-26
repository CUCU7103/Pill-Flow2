import * as apiRepository from "@/lib/medicationApiRepository";
import * as supabaseRepository from "@/lib/medicationRepository";
import { isApiMode } from "@/lib/apiClient";

const repository = isApiMode ? apiRepository : supabaseRepository;

export const fetchMedications = repository.fetchMedications;
export const addMedication = repository.addMedication;
export const deleteMedication = repository.deleteMedication;
export const toggleMedicationLog = repository.toggleMedicationLog;
export const resetAllMedications = repository.resetAllMedications;
