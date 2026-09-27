package com.pillflow.intake

import com.pillflow.common.parseApiDate
import com.pillflow.common.parseApiUuid
import com.pillflow.medication.MedicationService
import java.util.UUID
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class IntakeService(
    private val medicationService: MedicationService,
    private val logs: MedicationLogRepository,
) {
    @Transactional
    fun take(userId: UUID, medicationIdValue: String, dateValue: String) {
        val medicationId = parseApiUuid(medicationIdValue)
        val date = parseApiDate(dateValue)
        medicationService.requireOwned(userId, medicationId)
        logs.insertIfAbsent(medicationId, userId, date)
    }

    @Transactional
    fun cancel(userId: UUID, medicationIdValue: String, dateValue: String) {
        val medicationId = parseApiUuid(medicationIdValue)
        val date = parseApiDate(dateValue)
        medicationService.requireOwned(userId, medicationId)
        logs.deleteByMedicationIdAndUserIdAndTakenOn(medicationId, userId, date)
    }
}
