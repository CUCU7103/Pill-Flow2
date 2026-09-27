package com.pillflow.consent

import java.util.UUID
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository

@Repository
class ConsentRepository(private val jdbc: JdbcTemplate) {
    fun findTypes(userId: UUID, policyVersion: String): Set<String> = jdbc.query(
        "SELECT consent_type FROM public.user_consents WHERE user_id = ? AND policy_version = ?",
        { result, _ -> result.getString("consent_type") },
        userId,
        policyVersion,
    ).toSet()

    fun hasConsent(userId: UUID, type: ConsentType, policyVersion: String): Boolean =
        jdbc.queryForObject(
            "SELECT EXISTS (SELECT 1 FROM public.user_consents WHERE user_id = ? AND consent_type = ? AND policy_version = ?)",
            Boolean::class.java,
            userId,
            type.databaseValue,
            policyVersion,
        ) ?: false

    // 보호 대상 요청마다 현재 버전의 필수 항목이 모두 있는지 한 번의 EXISTS 조회로 확인한다.
    fun hasRequiredConsents(userId: UUID, policyVersion: String): Boolean {
        val placeholders = REQUIRED_TYPES.joinToString(", ") { "?" }
        val sql = """
            SELECT EXISTS (
                SELECT 1
                FROM public.user_consents
                WHERE user_id = ?
                  AND policy_version = ?
                  AND consent_type IN ($placeholders)
                HAVING pg_catalog.count(DISTINCT consent_type) = ?
            )
        """.trimIndent()
        val parameters = arrayOf<Any>(userId, policyVersion, *REQUIRED_TYPES.toTypedArray(), REQUIRED_TYPES.size)
        return jdbc.queryForObject(sql, Boolean::class.java, *parameters) ?: false
    }

    fun insert(userId: UUID, type: ConsentType, policyVersion: String) {
        jdbc.update(
            """
            INSERT INTO public.user_consents(user_id, consent_type, policy_version)
            VALUES (?, ?, ?)
            ON CONFLICT (user_id, consent_type, policy_version) DO NOTHING
            """.trimIndent(),
            userId,
            type.databaseValue,
            policyVersion,
        )
    }

    fun deleteSensitiveConsents(userId: UUID) {
        jdbc.update(
            "DELETE FROM public.user_consents WHERE user_id = ? AND consent_type IN (?, ?)",
            userId,
            ConsentType.SENSITIVE_HEALTH.databaseValue,
            ConsentType.PHOTO_ANALYSIS.databaseValue,
        )
    }

    companion object {
        private val REQUIRED_TYPES = listOf(
            ConsentType.AGE_OVER_14.databaseValue,
            ConsentType.SENSITIVE_HEALTH.databaseValue,
        )
    }
}
