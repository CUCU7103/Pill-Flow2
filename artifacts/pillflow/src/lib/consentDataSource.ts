import * as apiRepository from "@/lib/consentApiRepository";
import * as supabaseRepository from "@/lib/consentRepository";
import { isApiMode } from "@/lib/apiClient";

const repository = isApiMode ? apiRepository : supabaseRepository;

export const fetchConsentStatus = repository.fetchConsentStatus;
export const recordConsents = repository.recordConsents;
