package com.pillflow.consent

import com.pillflow.common.BusinessException
import com.pillflow.common.ErrorCode
import java.util.UUID
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

const val CURRENT_POLICY_VERSION = "2026-09-27"

enum class ConsentType(val databaseValue: String) {
    AGE_OVER_14("age_over_14"),
    SENSITIVE_HEALTH("sensitive_health"),
    PHOTO_ANALYSIS("photo_analysis");

    companion object {
        fun fromDatabaseValue(value: String): ConsentType? = entries.firstOrNull { it.databaseValue == value }
    }
}

@Service
class ConsentService(private val repository: ConsentRepository) {
    fun getStatus(userId: UUID): ConsentStatusResponse {
        val types = repository.findTypes(userId, CURRENT_POLICY_VERSION)
        return ConsentStatusResponse(
            policyVersion = CURRENT_POLICY_VERSION,
            ageOver14 = ConsentType.AGE_OVER_14.databaseValue in types,
            sensitiveHealth = ConsentType.SENSITIVE_HEALTH.databaseValue in types,
            photoAnalysis = ConsentType.PHOTO_ANALYSIS.databaseValue in types,
        )
    }

    @Transactional
    fun record(userId: UUID, request: ConsentRequest): ConsentStatusResponse {
        if (request.policyVersion != CURRENT_POLICY_VERSION) {
            throw BusinessException(ErrorCode.CONSENT_VERSION_MISMATCH)
        }
        val types = request.types?.map { value ->
            value?.let(ConsentType::fromDatabaseValue) ?: throw BusinessException(ErrorCode.INVALID_CONSENT)
        }?.toSet()
        if (types.isNullOrEmpty()) throw BusinessException(ErrorCode.INVALID_CONSENT)

        if (
            ConsentType.SENSITIVE_HEALTH in types &&
            ConsentType.AGE_OVER_14 !in types &&
            !repository.hasConsent(userId, ConsentType.AGE_OVER_14, CURRENT_POLICY_VERSION)
        ) {
            throw BusinessException(ErrorCode.INVALID_CONSENT)
        }

        types.forEach { repository.insert(userId, it, CURRENT_POLICY_VERSION) }
        return getStatus(userId)
    }
}
