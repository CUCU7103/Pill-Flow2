package com.pillflow

import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.ECDSASigner
import com.nimbusds.jose.jwk.Curve
import com.nimbusds.jose.jwk.ECKey
import com.nimbusds.jose.jwk.JWKSet
import com.nimbusds.jose.jwk.gen.ECKeyGenerator
import com.nimbusds.jose.jwk.source.JWKSource
import com.nimbusds.jose.proc.SecurityContext
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import com.pillflow.intake.MedicationLogRepository
import com.pillflow.medication.MedicationRepository
import com.pillflow.security.supabaseJwtValidator
import java.time.Instant
import java.util.Date
import java.util.UUID
import org.junit.jupiter.api.BeforeEach
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.context.annotation.Primary
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import org.springframework.test.context.ActiveProfiles
import org.testcontainers.junit.jupiter.Testcontainers
import org.springframework.test.web.servlet.MockMvc

@Testcontainers
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@Import(ApiSecurityTestConfiguration::class)
abstract class ApiIntegrationTestSupport {
    @Autowired
    protected lateinit var mockMvc: MockMvc

    @Autowired
    protected lateinit var jdbc: JdbcTemplate

    @Autowired
    protected lateinit var medications: MedicationRepository

    @Autowired
    protected lateinit var logs: MedicationLogRepository

    @BeforeEach
    fun ensureDefaultUser() {
        jdbc.update("INSERT INTO auth.users(id) VALUES (?) ON CONFLICT (id) DO NOTHING", UUID.fromString(ApiTestJwt.defaultUserId))
    }

    protected fun authorization(userId: UUID = UUID.fromString(ApiTestJwt.defaultUserId)): String =
        "Bearer ${ApiTestJwt.token(userId)}"

    protected fun addUser(userId: UUID) {
        jdbc.update("INSERT INTO auth.users(id) VALUES (?) ON CONFLICT (id) DO NOTHING", userId)
    }

    protected fun grantConsent(userId: UUID) {
        addUser(userId)
        jdbc.update(
            """
            INSERT INTO public.user_consents(user_id, consent_type, policy_version)
            VALUES (?, 'age_over_14', '2026-09-27'), (?, 'sensitive_health', '2026-09-27')
            ON CONFLICT (user_id, consent_type, policy_version) DO NOTHING
            """.trimIndent(),
            userId,
            userId,
        )
    }

}

@TestConfiguration
class ApiSecurityTestConfiguration {
    @Bean
    @Primary
    fun testJwtDecoder(): JwtDecoder {
        val source = JWKSource<SecurityContext> { selector, _ ->
            selector.select(JWKSet(ApiTestJwt.signingKey.toPublicJWK()))
        }
        val decoder = NimbusJwtDecoder.withJwkSource(source)
            .jwsAlgorithm(SignatureAlgorithm.ES256)
            .build()
        decoder.setJwtValidator(supabaseJwtValidator(ApiTestJwt.issuer, "authenticated"))
        return decoder
    }
}

object ApiTestJwt {
    const val issuer = "https://supabase.test/auth/v1"
    const val defaultUserId = "bcb4126d-c4f3-4d57-a0ba-2e24897a1d0f"
    val signingKey: ECKey = ECKeyGenerator(Curve.P_256).keyID("api-test-key").generate()

    fun token(userId: UUID, expiresAt: Instant = Instant.now().plusSeconds(300)): String {
        val claims = JWTClaimsSet.Builder()
            .issuer(issuer)
            .subject(userId.toString())
            .audience("authenticated")
            .issueTime(Date.from(Instant.now().minusSeconds(5)))
            .expirationTime(Date.from(expiresAt))
            .build()
        val signedJwt = SignedJWT(JWSHeader.Builder(JWSAlgorithm.ES256).keyID("api-test-key").build(), claims)
        signedJwt.sign(ECDSASigner(signingKey))
        return signedJwt.serialize()
    }
}
