package com.pillflow

import java.sql.Timestamp
import java.time.Instant
import java.time.LocalDate
import java.util.UUID
import org.hamcrest.Matchers.hasKey
import org.hamcrest.Matchers.nullValue
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import org.testcontainers.postgresql.PostgreSQLContainer

@Testcontainers
class StatsApiIntegrationTest : ApiIntegrationTestSupport() {
    @Test
    fun `통계는 약의 요일에 맞는 예정과 복용만 센다`() {
        val user = UUID.randomUUID()
        addUser(user)
        val medicationId = insertMedication(user, "월수금 약", arrayOf("mon", "wed", "fri"), Instant.parse("2026-09-01T00:00:00Z"))
        insertLog(user, medicationId, "2026-09-25")
        insertLog(user, medicationId, "2026-09-22")

        mockMvc.perform(
            get("/api/v1/stats/weekly")
                .param("today", "2026-09-25")
                .param("tz", "UTC")
                .header("Authorization", authorization(user)),
        )
            .andExpect(status().isOk)
            // 2026-09-21 월요일
            .andExpect(jsonPath("$.days[2].date").value("2026-09-21"))
            .andExpect(jsonPath("$.days[2].scheduled").value(1))
            .andExpect(jsonPath("$.days[2].taken").value(0))
            // 2026-09-22 화요일: 기록은 있지만 예정 요일이 아니다.
            .andExpect(jsonPath("$.days[3].date").value("2026-09-22"))
            .andExpect(jsonPath("$.days[3].scheduled").value(0))
            .andExpect(jsonPath("$.days[3].taken").value(0))
            .andExpect(jsonPath("$.days[3]", hasKey("rate")))
            .andExpect(jsonPath("$.days[3].rate").value(nullValue()))
            // 2026-09-23 수요일
            .andExpect(jsonPath("$.days[4].scheduled").value(1))
            // 2026-09-25 금요일
            .andExpect(jsonPath("$.days[6].scheduled").value(1))
            .andExpect(jsonPath("$.days[6].taken").value(1))
            .andExpect(jsonPath("$.days[6].rate").value(100))
    }

    @Test
    fun `생성일 이전에는 예정으로 세지 않는다`() {
        val user = UUID.randomUUID()
        addUser(user)
        insertMedication(user, "중간 생성 약", arrayOf("mon", "tue", "wed", "thu", "fri", "sat", "sun"), Instant.parse("2026-09-23T00:00:00Z"))

        mockMvc.perform(
            get("/api/v1/stats/weekly")
                .param("today", "2026-09-25")
                .param("tz", "UTC")
                .header("Authorization", authorization(user)),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.days[3].scheduled").value(0))
            .andExpect(jsonPath("$.days[4].scheduled").value(1))
            .andExpect(jsonPath("$.days[5].scheduled").value(1))
            .andExpect(jsonPath("$.days[6].scheduled").value(1))
    }

    @Test
    fun `통계는 오늘 포함 7일을 날짜 오름차순으로 반환하고 빈 날 rate는 null이다`() {
        val user = UUID.randomUUID()
        addUser(user)

        mockMvc.perform(
            get("/api/v1/stats/weekly")
                .param("today", "2026-09-25")
                .param("tz", "Asia/Seoul")
                .header("Authorization", authorization(user)),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.days.length()").value(7))
            .andExpect(jsonPath("$.days[0].date").value("2026-09-19"))
            .andExpect(jsonPath("$.days[6].date").value("2026-09-25"))
            .andExpect(jsonPath("$.days[0].scheduled").value(0))
            .andExpect(jsonPath("$.days[0].taken").value(0))
            .andExpect(jsonPath("$.days[0]", hasKey("rate")))
            .andExpect(jsonPath("$.days[0].rate").value(nullValue()))
    }

    @Test
    fun `통계는 다른 사용자를 섞지 않고 3개 중 2개 복용률을 67로 반올림한다`() {
        val user = UUID.randomUUID()
        val other = UUID.randomUUID()
        addUser(user)
        addUser(other)
        repeat(3) { index ->
            val medicationId = insertMedication(user, "내 약 $index", arrayOf("fri"), Instant.parse("2026-09-01T00:00:00Z"))
            if (index < 2) insertLog(user, medicationId, "2026-09-25")
        }
        val otherMedicationId = insertMedication(other, "다른 사용자 약", arrayOf("fri"), Instant.parse("2026-09-01T00:00:00Z"))
        insertLog(other, otherMedicationId, "2026-09-25")

        mockMvc.perform(
            get("/api/v1/stats/weekly")
                .param("today", "2026-09-25")
                .param("tz", "UTC")
                .header("Authorization", authorization(user)),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.days[6].scheduled").value(3))
            .andExpect(jsonPath("$.days[6].taken").value(2))
            .andExpect(jsonPath("$.days[6].rate").value(67))
    }

    @Test
    fun `생성 시각을 클라이언트 시간대로 변환해 경계 날짜를 판정한다`() {
        val user = UUID.randomUUID()
        addUser(user)
        insertMedication(user, "서울 경계 약", arrayOf("fri", "sat"), Instant.parse("2026-09-25T16:00:00Z"))

        mockMvc.perform(
            get("/api/v1/stats/weekly")
                .param("today", "2026-09-26")
                .param("tz", "Asia/Seoul")
                .header("Authorization", authorization(user)),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.days[5].date").value("2026-09-25"))
            .andExpect(jsonPath("$.days[5].scheduled").value(0))
            .andExpect(jsonPath("$.days[6].date").value("2026-09-26"))
            .andExpect(jsonPath("$.days[6].scheduled").value(1))
    }

    @Test
    fun `잘못된 통계 날짜와 시간대는 400이다`() {
        val authorization = authorization()
        mockMvc.perform(
            get("/api/v1/stats/weekly")
                .param("today", "2026-09-31")
                .param("tz", "Asia/Seoul")
                .header("Authorization", authorization),
        ).andExpect(status().isBadRequest).andExpect(jsonPath("$.code").isString).andExpect(jsonPath("$.message").isString)
        mockMvc.perform(
            get("/api/v1/stats/weekly")
                .param("today", "2026-9-25")
                .param("tz", "Asia/Seoul")
                .header("Authorization", authorization),
        ).andExpect(status().isBadRequest).andExpect(jsonPath("$.code").isString).andExpect(jsonPath("$.message").isString)
        mockMvc.perform(
            get("/api/v1/stats/weekly")
                .param("today", "2026-09-25")
                .param("tz", "Not/AZone")
                .header("Authorization", authorization),
        ).andExpect(status().isBadRequest).andExpect(jsonPath("$.code").isString).andExpect(jsonPath("$.message").isString)
    }

    private fun insertMedication(user: UUID, name: String, days: Array<String>, createdAt: Instant): UUID {
        val id = UUID.randomUUID()
        jdbc.update(
            """
            INSERT INTO public.medications(id,user_id,name,dosage,type,times,days,created_at,updated_at)
            VALUES (?, ?, ?, '1', 'tablet', '{08:00}'::text[], ?::text[], ?, ?)
            """.trimIndent(),
            id,
            user,
            name,
            "{" + days.joinToString(",") + "}",
            Timestamp.from(createdAt),
            Timestamp.from(createdAt),
        )
        return id
    }

    private fun insertLog(user: UUID, medicationId: UUID, date: String) {
        jdbc.update(
            "INSERT INTO public.medication_logs(medication_id,user_id,taken_on) VALUES (?, ?, ?)",
            medicationId,
            user,
            LocalDate.parse(date),
        )
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
