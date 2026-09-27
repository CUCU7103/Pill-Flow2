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

    fun hasRequiredConsents(userId: UUID, policyVersion: String): Boolean =
        jdbc.queryForObject(
            """
            SELECT EXISTS (
                SELECT 1
                FROM public.user_consents
                WHERE user_id = ?
                  AND policy_version = ?
                  AND consent_type IN ('age_over_14', 'sensitive_health')
                HAVING pg_catalog.count(DISTINCT consent_type) = 2
            )
            """.trimIndent(),
            Boolean::class.java,
            userId,
            policyVersion,
        ) ?: false

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
}
