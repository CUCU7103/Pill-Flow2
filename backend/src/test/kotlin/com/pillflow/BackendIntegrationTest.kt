package com.pillflow

import com.pillflow.intake.MedicationLog
import com.pillflow.intake.MedicationLogRepository
import com.pillflow.medication.Medication
import com.pillflow.medication.MedicationRepository
import com.pillflow.medication.MedicationType
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.context.annotation.Primary
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.*
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.core.ConnectionCallback
import org.springframework.jdbc.datasource.DriverManagerDataSource
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter
import org.springframework.dao.DataAccessException
import org.springframework.dao.DataIntegrityViolationException
import org.flywaydb.core.Flyway
import org.flywaydb.core.api.MigrationVersion
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import org.testcontainers.postgresql.PostgreSQLContainer
import java.time.LocalDate
import java.util.UUID
import java.time.Instant
import java.util.Date
import java.sql.SQLException
import java.sql.Timestamp
import java.sql.DriverManager
import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.ECDSASigner
import com.nimbusds.jose.jwk.Curve
import com.nimbusds.jose.jwk.ECKey
import com.nimbusds.jose.jwk.gen.ECKeyGenerator
import com.nimbusds.jose.jwk.JWKSet
import com.nimbusds.jose.jwk.source.JWKSource
import com.nimbusds.jose.proc.SecurityContext
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import com.pillflow.security.supabaseJwtValidator

@Testcontainers
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@Import(SecurityHttpTestConfiguration::class, BusinessExceptionTestController::class)
class BackendIntegrationTest @Autowired constructor(
    private val medications: MedicationRepository,
    private val logs: MedicationLogRepository,
    private val jdbc: JdbcTemplate,
    private val mockMvc: MockMvc,
) {
    companion object {
        @Container @JvmStatic val postgres = PostgreSQLContainer("postgres:17-alpine")
        @JvmStatic @DynamicPropertySource fun properties(registry: DynamicPropertyRegistry) {
            registry.add("DB_URL") { postgres.jdbcUrl }
            registry.add("DB_USERNAME") { postgres.username }
            registry.add("DB_PASSWORD") { postgres.password }
            registry.add("spring.flyway.url") { postgres.jdbcUrl }
            registry.add("spring.flyway.user") { postgres.username }
            registry.add("spring.flyway.password") { postgres.password }
            registry.add("SUPABASE_URL") { SecurityTestJwt.issuer.removeSuffix("/auth/v1") }
            registry.add("CORS_ALLOWED_ORIGINS") { "https://client.test" }
        }
    }
    @Test fun `엔티티 배열과 enum을 저장하고 조회한다`() {
        val user = UUID.randomUUID()
        jdbc.update("INSERT INTO auth.users (id) VALUES (?)", user)
        val saved = medications.saveAndFlush(Medication(userId=user, name="테스트", dosage="1정", type=MedicationType.tablet, times=arrayOf("08:00"), days=arrayOf("mon","fri")))
        val found = medications.findById(saved.id!!).orElseThrow()
        assertArrayEquals(arrayOf("08:00"), found.times)
        assertArrayEquals(arrayOf("mon","fri"), found.days)
        assertEquals(MedicationType.tablet, found.type)
    }
    @Test fun `같은 약의 같은 날짜 복용 로그는 중복될 수 없다`() {
        val user = UUID.randomUUID()
        jdbc.update("INSERT INTO auth.users (id) VALUES (?)", user)
        val med = medications.saveAndFlush(Medication(userId=user, name="중복", dosage="1정", type=MedicationType.syrup, times=arrayOf("09:00"), days=arrayOf("tue")))
        val date = LocalDate.of(2026, 9, 25)
        logs.saveAndFlush(MedicationLog(medicationId=med.id!!, userId=med.userId, takenOn=date))
        assertThrows<DataIntegrityViolationException> { logs.saveAndFlush(MedicationLog(medicationId=med.id!!, userId=med.userId, takenOn=date)) }
    }
    @Test fun `직접 SQL로 약을 수정하면 updated_at이 갱신된다`() {
        val user = UUID.randomUUID()
        val medication = UUID.randomUUID()
        val oldUpdatedAt = Instant.parse("2000-01-01T00:00:00Z")
        jdbc.update("INSERT INTO auth.users(id) VALUES (?)", user)
        jdbc.update(
            """
            INSERT INTO public.medications(id,user_id,name,dosage,type,times,days,updated_at)
            VALUES (?, ?, '수정 대상', '1정', 'tablet', '{08:00}', '{mon}', ?)
            """.trimIndent(),
            medication,
            user,
            Timestamp.from(oldUpdatedAt),
        )

        jdbc.update("UPDATE public.medications SET name='수정 완료' WHERE id=?", medication)

        val updatedAt = jdbc.queryForObject(
            "SELECT updated_at FROM public.medications WHERE id=?",
            Timestamp::class.java,
            medication,
        )
        assertTrue(updatedAt!!.toInstant().isAfter(oldUpdatedAt))
    }
    @Test fun `배열 제약과 Flyway 위치 및 권한을 검증한다`() {
        val user = UUID.randomUUID(); jdbc.update("INSERT INTO auth.users(id) VALUES (?)", user)
        fun invalid(times: String, days: String) { assertThrows<DataAccessException> { jdbc.update("INSERT INTO public.medications(user_id,name,dosage,type,times,days) VALUES (?, 'x','x','tablet',?::text[],?::text[])", user, times, days) } }
        invalid("{}", "{mon}"); invalid("{08:00,09:00,10:00,11:00,12:00}", "{mon}"); invalid("{25:00}", "{mon}"); invalid("{08:00}", "{}"); invalid("{08:00}", "{monday}")
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='flyway_schema_history'", Int::class.java))
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM information_schema.tables WHERE table_schema='flyway' AND table_name='flyway_schema_history'", Int::class.java))
        listOf("medications", "medication_logs").forEach { table ->
            listOf("SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER").forEach { privilege ->
                assertEquals(false, hasPrivilege("anon", table, privilege), "anon $privilege $table")
            }
            listOf("SELECT", "INSERT", "UPDATE", "DELETE").forEach { privilege ->
                assertEquals(true, hasPrivilege("authenticated", table, privilege), "authenticated $privilege $table")
                assertEquals(true, hasPrivilege("pillflow_api", table, privilege), "pillflow_api $privilege $table")
            }
            listOf("TRUNCATE", "REFERENCES", "TRIGGER").forEach { privilege ->
                assertEquals(false, hasPrivilege("authenticated", table, privilege), "authenticated $privilege $table")
                assertEquals(false, hasPrivilege("pillflow_api", table, privilege), "pillflow_api $privilege $table")
            }
        }
        listOf("anon", "authenticated", "service_role").forEach { role ->
            assertEquals(
                false,
                jdbc.queryForObject(
                    "SELECT has_function_privilege(?, 'public.set_medication_updated_at()', 'EXECUTE')",
                    Boolean::class.java,
                    role,
                ),
                "$role cannot execute the update trigger function directly",
            )
        }
        assertEquals(false, jdbc.queryForObject("SELECT has_schema_privilege('pillflow_api','public','CREATE')", Boolean::class.java))
        val ddlFailure = assertThrows<DataAccessException> {
            jdbc.execute(ConnectionCallback { connection ->
                connection.createStatement().use { statement ->
                    statement.execute("SET ROLE pillflow_api")
                    try {
                        statement.execute("CREATE TABLE public.pillflow_api_ddl_must_fail (id integer)")
                    } finally {
                        statement.execute("RESET ROLE")
                    }
                }
            })
        }
        assertEquals("42501", (ddlFailure.rootCause as SQLException).sqlState)
    }

    private fun hasPrivilege(role: String, table: String, privilege: String): Boolean =
        jdbc.queryForObject("SELECT has_table_privilege(?, ?, ?)", Boolean::class.java, role, "public.$table", privilege)!!

    @Test fun `ALTER 적용 운영 스키마를 baseline하면 V2만 적용되고 JPA 검증이 통과한다`() {
        val databaseName = "baseline_${UUID.randomUUID().toString().replace("-", "")}"
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            connection.createStatement().use { it.execute("CREATE DATABASE $databaseName") }
        }
        val databaseUrl = "${postgres.jdbcUrl.substringBeforeLast('/')}/$databaseName"
        val dataSource = DriverManagerDataSource(databaseUrl, postgres.username, postgres.password)

        try {
            val preparation = Flyway.configure()
                .dataSource(databaseUrl, postgres.username, postgres.password)
                .locations("classpath:db/supabase-stub", "classpath:db/baseline-fixture")
                .schemas("bootstrap_flyway")
                .defaultSchema("bootstrap_flyway")
                .createSchemas(true)
                .load()
            assertEquals(3, preparation.migrate().migrationsExecuted)

            val baselineJdbc = JdbcTemplate(dataSource)
            baselineJdbc.execute("DROP SCHEMA bootstrap_flyway CASCADE")

            val flyway = Flyway.configure()
                .dataSource(databaseUrl, postgres.username, postgres.password)
                .locations("classpath:db/migration")
                .schemas("flyway")
                .defaultSchema("flyway")
                .createSchemas(true)
                .baselineVersion(MigrationVersion.fromVersion("1"))
                .load()

            flyway.baseline()
            assertEquals(1, flyway.migrate().migrationsExecuted)
            assertEquals(
                listOf("1", "2"),
                baselineJdbc.queryForList(
                    "SELECT version FROM flyway.flyway_schema_history WHERE success AND version IS NOT NULL ORDER BY installed_rank",
                    String::class.java,
                ),
            )
            assertEquals(true, baselineJdbc.queryForObject("SELECT rolbypassrls FROM pg_roles WHERE rolname='pillflow_api'", Boolean::class.java))
            assertEquals(1, baselineJdbc.queryForObject("SELECT count(*) FROM public.medications", Int::class.java))
            assertEquals(1, baselineJdbc.queryForObject("SELECT count(*) FROM public.medication_logs", Int::class.java))
            // V1로 새로 만든 스키마와 운영(ALTER 적용 후 baseline) 스키마의 컬럼 정의(타입·NULL 허용·기본값)가 같아야 한다.
            // 컬럼 순서 차이는 허용하므로 ordinal_position이 아니라 컬럼 이름으로 정렬해 비교한다.
            val columnDefinitionsSql = """
                SELECT table_name, column_name, udt_name, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name IN ('medications', 'medication_logs')
                ORDER BY table_name, column_name
            """.trimIndent()
            assertEquals(jdbc.queryForList(columnDefinitionsSql), baselineJdbc.queryForList(columnDefinitionsSql))

            val entityManagerFactory = LocalContainerEntityManagerFactoryBean().apply {
                setDataSource(dataSource)
                setPackagesToScan("com.pillflow")
                jpaVendorAdapter = HibernateJpaVendorAdapter()
                setJpaPropertyMap(mapOf("hibernate.hbm2ddl.auto" to "validate"))
            }
            try {
                entityManagerFactory.afterPropertiesSet()
            } finally {
                entityManagerFactory.destroy()
            }
        } finally {
            DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                connection.createStatement().use { it.execute("DROP DATABASE $databaseName WITH (FORCE)") }
            }
        }
    }

    @Test
    @org.springframework.transaction.annotation.Transactional
    fun `RLS는 두 테이블에서 다른 사용자의 행을 격리한다`() {
        val owner = UUID.randomUUID()
        val other = UUID.randomUUID()
        jdbc.update("INSERT INTO auth.users(id) VALUES (?), (?)", owner, other)
        val ownerMedication = UUID.randomUUID()
        val otherMedication = UUID.randomUUID()
        jdbc.update("INSERT INTO public.medications(id,user_id,name,dosage,type,times,days) VALUES (?,?,'owner','1','tablet','{08:00}','{mon}'), (?,?,'other','1','tablet','{08:00}','{mon}')", ownerMedication, owner, otherMedication, other)
        val ownerLog = UUID.randomUUID()
        val otherLog = UUID.randomUUID()
        jdbc.update("INSERT INTO public.medication_logs(id,medication_id,user_id,taken_on) VALUES (?, ?, ?, '2026-09-25'), (?, ?, ?, '2026-09-25')", ownerLog, ownerMedication, owner, otherLog, otherMedication, other)

        jdbc.execute("SET LOCAL ROLE authenticated")
        jdbc.queryForObject("SELECT set_config('request.jwt.claim.sub', ?, true)", String::class.java, other.toString())

        assertEquals(listOf("other"), jdbc.queryForList("SELECT name FROM public.medications", String::class.java))
        assertEquals(0, jdbc.update("UPDATE public.medications SET name='changed' WHERE id=?", ownerMedication))
        assertEquals(1, jdbc.update("UPDATE public.medications SET name='changed' WHERE id=?", otherMedication))
        assertRlsViolation {
            jdbc.update("UPDATE public.medications SET user_id=? WHERE id=?", owner, otherMedication)
        }
        assertEquals(0, jdbc.update("DELETE FROM public.medications WHERE id=?", ownerMedication))
        assertEquals(listOf(other.toString()), jdbc.queryForList("SELECT user_id::text FROM public.medication_logs", String::class.java))
        assertEquals(0, jdbc.update("DELETE FROM public.medication_logs WHERE id=?", ownerLog))
        assertEquals(1, jdbc.update("DELETE FROM public.medication_logs WHERE id=?", otherLog))
        assertRlsViolation {
            jdbc.update(
                "INSERT INTO public.medication_logs(medication_id,user_id,taken_on) VALUES (?, ?, '2026-09-27')",
                ownerMedication,
                other,
            )
        }
    }

    private fun assertRlsViolation(action: () -> Unit) {
        val failure = assertThrows<DataAccessException> {
            jdbc.execute(ConnectionCallback { connection ->
                val savepoint = connection.setSavepoint()
                try {
                    action()
                } catch (exception: DataAccessException) {
                    connection.rollback(savepoint)
                    throw exception
                }
            })
        }
        assertEquals("42501", (failure.rootCause as SQLException).sqlState)
    }

    @Test fun `토큰이 없으면 JSON 401을 반환한다`() {
        mockMvc.perform(get("/api/v1/me"))
            .andExpect(status().isUnauthorized)
            .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
            .andExpect(jsonPath("$.message").isNotEmpty)
    }

    @Test fun `잘못된 서명 issuer audience와 만료 토큰은 거부한다`() {
        listOf(
            SecurityTestJwt.token(signingKey = SecurityTestJwt.otherSigningKey),
            SecurityTestJwt.token(issuer = "https://wrong.test/auth/v1"),
            SecurityTestJwt.token(audience = listOf("wrong")),
            SecurityTestJwt.token(expiresAt = Instant.now().minusSeconds(60)),
        ).forEach { token ->
            mockMvc.perform(get("/api/v1/me").header("Authorization", "Bearer $token"))
                .andExpect(status().isUnauthorized)
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.message").isNotEmpty)
        }
    }

    @Test fun `정상 JWT로 현재 사용자와 공개 health를 확인한다`() {
        mockMvc.perform(get("/api/v1/me").header("Authorization", "Bearer ${SecurityTestJwt.token()}"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.userId").value(SecurityTestJwt.userId))

        mockMvc.perform(get("/actuator/health"))
            .andExpect(status().isOk)
    }

    @Test fun `BusinessException은 표준 오류 응답으로 변환된다`() {
        mockMvc.perform(get("/test/business-error").header("Authorization", "Bearer ${SecurityTestJwt.token()}"))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
            .andExpect(jsonPath("$.message").value("잘못된 요청입니다."))
    }

    @Test fun `접근 거부도 표준 JSON 403으로 반환한다`() {
        mockMvc.perform(get("/test/forbidden").header("Authorization", "Bearer ${SecurityTestJwt.token()}"))
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.code").value("FORBIDDEN"))
            .andExpect(jsonPath("$.message").value("접근 권한이 없습니다."))
    }

    @Test fun `Spring MVC 표준 예외는 500이 아니라 원래 상태 코드로 반환한다`() {
        val authorization = "Bearer ${SecurityTestJwt.token()}"
        mockMvc.perform(get("/api/v1/does-not-exist").header("Authorization", authorization))
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.code").value("NOT_FOUND"))
            .andExpect(jsonPath("$.message").isNotEmpty)
        mockMvc.perform(post("/api/v1/me").header("Authorization", authorization))
            .andExpect(status().isMethodNotAllowed)
            .andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"))
    }



}

@TestConfiguration
class SecurityHttpTestConfiguration {
    @Bean
    @Primary
    fun testJwtDecoder(): JwtDecoder {
        val source = JWKSource<SecurityContext> { selector, _ ->
            selector.select(JWKSet(SecurityTestJwt.signingKey.toPublicJWK()))
        }
        val decoder = NimbusJwtDecoder.withJwkSource(source)
            .jwsAlgorithm(SignatureAlgorithm.ES256)
            .build()
        decoder.setJwtValidator(supabaseJwtValidator(SecurityTestJwt.issuer, "authenticated"))
        return decoder
    }
}

@RestController
class BusinessExceptionTestController {
    @GetMapping("/test/business-error")
    fun businessError(): Nothing = throw com.pillflow.common.BusinessException(com.pillflow.common.ErrorCode.INVALID_REQUEST)

    @PreAuthorize("denyAll()")
    @GetMapping("/test/forbidden")
    fun forbidden(): Nothing = error("테스트 경로가 접근 제어를 우회했습니다.")
}

private object SecurityTestJwt {
    const val issuer = "https://supabase.test/auth/v1"
    const val userId = "bcb4126d-c4f3-4d57-a0ba-2e24897a1d0f"
    val signingKey: ECKey = ECKeyGenerator(Curve.P_256).keyID("test-key").generate()
    val otherSigningKey: ECKey = ECKeyGenerator(Curve.P_256).keyID("test-key").generate()

    fun token(
        signingKey: ECKey = this.signingKey,
        issuer: String = this.issuer,
        audience: List<String> = listOf("authenticated"),
        expiresAt: Instant = Instant.now().plusSeconds(300),
    ): String {
        val claims = JWTClaimsSet.Builder()
            .issuer(issuer)
            .subject(userId)
            .audience(audience)
            .issueTime(Date.from(Instant.now().minusSeconds(5)))
            .expirationTime(Date.from(expiresAt))
            .build()
        val signedJwt = SignedJWT(JWSHeader.Builder(JWSAlgorithm.ES256).keyID("test-key").build(), claims)
        signedJwt.sign(ECDSASigner(signingKey))
        return signedJwt.serialize()
    }
}
