package com.pillflow

import java.net.URI
import java.util.UUID
import org.hamcrest.Matchers.containsString
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.header
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import org.testcontainers.postgresql.PostgreSQLContainer

@Testcontainers
class ConsentApiIntegrationTest : ApiIntegrationTestSupport() {
    @Test
    fun `동의 전 상태는 모두 false이고 동의 기록은 멱등이다`() {
        val userId = UUID.randomUUID()
        addUser(userId)
        val authorization = authorization(userId)
        mockMvc.perform(get("/api/v1/consents").header("Authorization", authorization))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.policyVersion").value("2026-09-27"))
            .andExpect(jsonPath("$.ageOver14").value(false))
            .andExpect(jsonPath("$.sensitiveHealth").value(false))
            .andExpect(jsonPath("$.photoAnalysis").value(false))

        val body = """{"policyVersion":"2026-09-27","types":["age_over_14","sensitive_health"]}"""
        repeat(2) {
            mockMvc.perform(
                post("/api/v1/consents")
                    .header("Authorization", authorization)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body),
            )
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.ageOver14").value(true))
                .andExpect(jsonPath("$.sensitiveHealth").value(true))
                .andExpect(jsonPath("$.photoAnalysis").value(false))
        }
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM public.user_consents WHERE user_id=?", Int::class.java, userId))
    }

    @Test
    fun `버전과 동의 항목을 검증하고 민감정보에는 연령 확인이 필요하다`() {
        val userId = UUID.randomUUID()
        addUser(userId)
        val authorization = authorization(userId)
        fun invalid(body: String, expectedCode: String = "INVALID_CONSENT") {
            mockMvc.perform(
                post("/api/v1/consents")
                    .header("Authorization", authorization)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body),
            )
                .andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.code").value(expectedCode))
        }

        invalid("""{"policyVersion":"old","types":["age_over_14"]}""", "CONSENT_VERSION_MISMATCH")
        invalid("""{"policyVersion":"2026-09-27","types":[]}""")
        invalid("""{"policyVersion":"2026-09-27","types":["unknown"]}""")
        invalid("""{"policyVersion":"2026-09-27","types":[null]}""")
        invalid("""{"policyVersion":"2026-09-27","types":["sensitive_health"]}""")
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM public.user_consents WHERE user_id=?", Int::class.java, userId))

        mockMvc.perform(
            post("/api/v1/consents")
                .header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"policyVersion":"2026-09-27","types":["age_over_14"]}"""),
        ).andExpect(status().isOk).andExpect(jsonPath("$.ageOver14").value(true))
        mockMvc.perform(
            post("/api/v1/consents")
                .header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"policyVersion":"2026-09-27","types":["sensitive_health"]}"""),
        ).andExpect(status().isOk).andExpect(jsonPath("$.sensitiveHealth").value(true))
    }

    @Test
    fun `사진 분석 동의는 연령 확인 없이 별도로 기록한다`() {
        val userId = UUID.randomUUID()
        addUser(userId)

        mockMvc.perform(
            post("/api/v1/consents")
                .header("Authorization", authorization(userId))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"policyVersion":"2026-09-27","types":["photo_analysis"]}"""),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.ageOver14").value(false))
            .andExpect(jsonPath("$.sensitiveHealth").value(false))
            .andExpect(jsonPath("$.photoAnalysis").value(true))
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM public.user_consents WHERE user_id=?", Int::class.java, userId))
    }

    @Test
    fun `민감정보 동의가 필요한 경로만 사용자별로 차단한다`() {
        val userA = UUID.randomUUID()
        val userB = UUID.randomUUID()
        addUser(userA)
        addUser(userB)
        val authA = authorization(userA)
        val authB = authorization(userB)
        val medicationId = UUID.randomUUID()
        jdbc.update(
            "INSERT INTO public.medications(id,user_id,name,dosage,type,times,days) VALUES (?,?,'테스트','1','tablet','{08:00}','{mon}')",
            medicationId,
            userA,
        )

        mockMvc.perform(get("/api/v1/medications").param("date", "2026-09-27").header("Authorization", authA))
            .andExpect(status().isForbidden)
            .andExpect(content().contentType("application/json;charset=UTF-8"))
            .andExpect(content().string(containsString("복약 정보 처리에 대한 동의가 필요합니다.")))
            .andExpect(jsonPath("$.code").value("CONSENT_REQUIRED"))
            .andExpect(jsonPath("$.message").value("복약 정보 처리에 대한 동의가 필요합니다."))
        mockMvc.perform(
            get("/api/v1/stats/weekly").param("today", "2026-09-27").param("tz", "Asia/Seoul").header("Authorization", authA),
        ).andExpect(status().isForbidden).andExpect(jsonPath("$.code").value("CONSENT_REQUIRED"))
        mockMvc.perform(put("/api/v1/medications/$medicationId/intakes/2026-09-27").header("Authorization", authA))
            .andExpect(status().isForbidden).andExpect(jsonPath("$.code").value("CONSENT_REQUIRED"))

        mockMvc.perform(get("/api/v1/me").header("Authorization", authA)).andExpect(status().isOk)
        mockMvc.perform(get("/api/v1/consents").header("Authorization", authA))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.ageOver14").value(false))

        mockMvc.perform(
            post("/api/v1/consents")
                .header("Authorization", authA)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"policyVersion":"2026-09-27","types":["age_over_14","sensitive_health"]}"""),
        ).andExpect(status().isOk)
        mockMvc.perform(get("/api/v1/medications").param("date", "2026-09-27").header("Authorization", authA))
            .andExpect(status().isOk)
        mockMvc.perform(
            get("/api/v1/stats/weekly").param("today", "2026-09-27").param("tz", "Asia/Seoul").header("Authorization", authA),
        ).andExpect(status().isOk)
        mockMvc.perform(put("/api/v1/medications/$medicationId/intakes/2026-09-27").header("Authorization", authA))
            .andExpect(status().isNoContent)

        mockMvc.perform(get("/api/v1/medications").param("date", "2026-09-27").header("Authorization", authB))
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.code").value("CONSENT_REQUIRED"))
    }

    @Test
    fun `CORS 사전 요청은 동의 없이 통과한다`() {
        mockMvc.perform(
            options("/api/v1/medications")
                .header("Origin", "https://client.test")
                .header("Access-Control-Request-Method", "GET"),
        )
            .andExpect(status().isOk)
            .andExpect(header().string("Access-Control-Allow-Origin", "https://client.test"))
    }

    @Test
    fun `이전 버전의 동의만 있으면 복약 경로를 차단한다`() {
        val userId = UUID.randomUUID()
        addUser(userId)
        jdbc.update(
            """
            INSERT INTO public.user_consents(user_id, consent_type, policy_version)
            VALUES (?, 'age_over_14', '2026-01-01'), (?, 'sensitive_health', '2026-01-01')
            """.trimIndent(),
            userId,
            userId,
        )

        mockMvc.perform(
            get("/api/v1/medications").param("date", "2026-09-27").header("Authorization", authorization(userId)),
        )
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.code").value("CONSENT_REQUIRED"))
    }

    @Test
    fun `전체 초기화는 민감정보와 사진 동의를 철회하고 다른 사용자 동의와 연령 확인은 보존한다`() {
        val owner = UUID.randomUUID()
        val other = UUID.randomUUID()
        addUser(owner)
        addUser(other)
        jdbc.update(
            """
            INSERT INTO public.user_consents(user_id, consent_type, policy_version) VALUES
              (?, 'age_over_14', '2026-09-27'),
              (?, 'age_over_14', '2026-01-01'),
              (?, 'sensitive_health', '2026-09-27'),
              (?, 'sensitive_health', '2026-01-01'),
              (?, 'photo_analysis', '2026-09-27'),
              (?, 'photo_analysis', '2026-01-01')
            """.trimIndent(),
            owner, owner, owner, owner, owner, owner,
        )
        jdbc.update(
            """
            INSERT INTO public.user_consents(user_id, consent_type, policy_version) VALUES
              (?, 'age_over_14', '2026-09-27'),
              (?, 'sensitive_health', '2026-09-27'),
              (?, 'photo_analysis', '2026-09-27')
            """.trimIndent(),
            other, other, other,
        )
        jdbc.update(
            "INSERT INTO public.medications(user_id,name,dosage,type,times,days) VALUES (?,'초기화 약','1','tablet','{08:00}','{mon}')",
            owner,
        )

        mockMvc.perform(delete("/api/v1/medications").header("Authorization", authorization(owner)))
            .andExpect(status().isNoContent)

        mockMvc.perform(get("/api/v1/consents").header("Authorization", authorization(owner)))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.ageOver14").value(true))
            .andExpect(jsonPath("$.sensitiveHealth").value(false))
            .andExpect(jsonPath("$.photoAnalysis").value(false))
        mockMvc.perform(
            get("/api/v1/medications").param("date", "2026-09-27").header("Authorization", authorization(owner)),
        )
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.code").value("CONSENT_REQUIRED"))

        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM public.user_consents WHERE user_id=? AND consent_type='age_over_14'", Int::class.java, owner))
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM public.user_consents WHERE user_id=? AND consent_type IN ('sensitive_health','photo_analysis')", Int::class.java, owner))
        assertEquals(3, jdbc.queryForObject("SELECT count(*) FROM public.user_consents WHERE user_id=?", Int::class.java, other))
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM public.medications WHERE user_id=?", Int::class.java, owner))
    }

    @Test
    fun `health는 동의 없이 접근할 수 있다`() {
        mockMvc.perform(get("/actuator/health"))
            .andExpect(status().isOk)
    }

    @Test
    fun `퍼센트 인코딩된 민감정보 경로도 동의 없이 차단한다`() {
        val userId = UUID.randomUUID()
        addUser(userId)
        val authorization = authorization(userId)
        val uris = listOf(
            URI.create("http://localhost/api/v1/%6Dedications?date=2026-09-27"),
            URI.create("http://localhost/api/v1/stat%73/weekly?today=2026-09-27&tz=Asia%2FSeoul"),
        )

        val responses = uris.map { uri ->
            mockMvc.perform(get(uri).header("Authorization", authorization)).andReturn().response
        }
        assertEquals(listOf(403, 403), responses.map { it.status })
        responses.forEach { response ->
            assertTrue(response.contentAsString.contains("\"code\":\"CONSENT_REQUIRED\""))
        }
    }

    companion object {
        @Container
        @JvmStatic
        val postgres = PostgreSQLContainer("postgres:17-alpine")

        @JvmStatic
        @DynamicPropertySource
        fun properties(registry: DynamicPropertyRegistry) {
            registry.add("DB_URL") { postgres.jdbcUrl }
            registry.add("DB_USERNAME") { postgres.username }
            registry.add("DB_PASSWORD") { postgres.password }
            registry.add("spring.flyway.url") { postgres.jdbcUrl }
            registry.add("spring.flyway.user") { postgres.username }
            registry.add("spring.flyway.password") { postgres.password }
            registry.add("SUPABASE_URL") { ApiTestJwt.issuer.removeSuffix("/auth/v1") }
            registry.add("CORS_ALLOWED_ORIGINS") { "https://client.test" }
        }
    }
}
