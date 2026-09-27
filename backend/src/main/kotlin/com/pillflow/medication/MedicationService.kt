package com.pillflow.medication

import com.pillflow.common.BusinessException
import com.pillflow.common.ErrorCode
import com.pillflow.common.parseApiDate
import com.pillflow.common.parseApiUuid
import com.pillflow.consent.ConsentRepository
import com.pillflow.intake.MedicationLogRepository
import java.util.UUID
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

private val TIME_PATTERN = Regex("(?:[01]\\d|2[0-3]):[0-5]\\d")
private val VALID_DAYS = setOf("mon", "tue", "wed", "thu", "fri", "sat", "sun")
private val COLOR_PATTERN = Regex("#[0-9A-Fa-f]{6}")

// 입력 크기 상한 — V4__medication_input_limits.sql의 DB 제약, 프론트 constants.ts의 MED_INPUT_LIMITS와 같은 값을 유지한다.
internal const val MAX_NAME_LENGTH = 100
internal const val MAX_DOSAGE_LENGTH = 50
internal const val MAX_MEMO_LENGTH = 1000
internal const val MAX_MEDICATIONS_PER_USER = 50

@Service
class MedicationService(
    private val medications: MedicationRepository,
    private val logs: MedicationLogRepository,
    private val consents: ConsentRepository,
) {
    @Transactional(readOnly = true)
    fun findAll(userId: UUID, dateValue: String): List<MedicationResponse> {
        val date = parseApiDate(dateValue)
        val completedIds = logs.findAllByUserIdAndTakenOn(userId, date).map { it.medicationId }.toSet()
        return medications.findAllByUserIdOrderByCreatedAtAsc(userId).map { it.toResponse(it.id!! in completedIds) }
    }

    @Transactional
    fun create(userId: UUID, request: MedicationRequest): MedicationResponse {
        consents.lockAndRequireCurrentConsent(userId)
        val input = request.validate()
        // lockAndRequireCurrentConsent의 사용자별 advisory lock으로 같은 사용자의 추가 요청이 직렬화되므로
        // 개수 확인과 저장 사이에 경합이 없다.
        if (medications.countByUserId(userId) >= MAX_MEDICATIONS_PER_USER) {
            throw BusinessException(ErrorCode.MEDICATION_LIMIT_EXCEEDED)
        }
        val medication = medications.saveAndFlush(
            Medication(
                userId = userId,
                name = input.name,
                dosage = input.dosage,
                memo = input.memo,
                type = input.type,
                color = input.color,
                times = input.times.toTypedArray(),
                days = input.days.toTypedArray(),
            ),
        )
        return medication.toResponse(completed = false)
    }

    @Transactional
    fun delete(userId: UUID, idValue: String) {
        val id = parseApiUuid(idValue)
        requireOwned(userId, id)
        medications.deleteByIdAndUserId(id, userId)
    }

    @Transactional
    fun deleteAll(userId: UUID) {
        consents.lockUserForDataReset(userId)
        medications.deleteAllByUserId(userId)
        consents.deleteSensitiveConsents(userId)
    }

    fun requireOwned(userId: UUID, medicationId: UUID): Medication =
        medications.findByIdAndUserId(medicationId, userId).orElseThrow { BusinessException(ErrorCode.MEDICATION_NOT_FOUND) }

    private fun Medication.toResponse(completed: Boolean) = MedicationResponse(
        id = id!!.toString(),
        name = name,
        dosage = dosage,
        memo = memo,
        times = times.toList(),
        type = type.name,
        color = color,
        days = days.toList(),
        completed = completed,
    )

    private fun MedicationRequest.validate(): ValidatedMedication {
        val validatedName = name?.trim()
        val validatedDosage = dosage?.trim()
        if (validatedName.isNullOrEmpty() || validatedDosage.isNullOrEmpty()) {
            throw BusinessException(ErrorCode.INVALID_MEDICATION)
        }
        if (validatedName.length > MAX_NAME_LENGTH || validatedDosage.length > MAX_DOSAGE_LENGTH) {
            throw BusinessException(ErrorCode.INVALID_MEDICATION)
        }
        val validatedMemo = memo ?: ""
        if (validatedMemo.length > MAX_MEMO_LENGTH) {
            throw BusinessException(ErrorCode.INVALID_MEDICATION)
        }
        val validatedColor = color ?: "#6C63FF"
        if (!COLOR_PATTERN.matches(validatedColor)) {
            throw BusinessException(ErrorCode.INVALID_MEDICATION)
        }

        val validatedTimes = times
        if (validatedTimes == null || validatedTimes.size !in 1..4 || validatedTimes.any { it == null || !TIME_PATTERN.matches(it) }) {
            throw BusinessException(ErrorCode.INVALID_MEDICATION)
        }

        val validatedDays = days
        if (
            validatedDays == null || validatedDays.isEmpty() || validatedDays.any { it == null || it !in VALID_DAYS } ||
            validatedDays.toSet().size != validatedDays.size
        ) {
            throw BusinessException(ErrorCode.INVALID_MEDICATION)
        }

        val validatedType = type?.let { value ->
            try {
                MedicationType.valueOf(value)
            } catch (_: IllegalArgumentException) {
                null
            }
        } ?: throw BusinessException(ErrorCode.INVALID_MEDICATION)

        return ValidatedMedication(
            name = validatedName,
            dosage = validatedDosage,
            memo = validatedMemo,
            times = validatedTimes.filterNotNull(),
            type = validatedType,
            color = validatedColor,
            days = validatedDays.filterNotNull(),
        )
    }

    private data class ValidatedMedication(
        val name: String,
        val dosage: String,
        val memo: String,
        val times: List<String>,
        val type: MedicationType,
        val color: String,
        val days: List<String>,
    )
}
