package com.pillflow.stats

import com.pillflow.common.parseApiDate
import com.pillflow.common.parseApiTimezone
import com.pillflow.medication.Medication
import com.pillflow.medication.MedicationRepository
import com.pillflow.intake.MedicationLogRepository
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID
import kotlin.math.floor
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class StatsService(
    private val medications: MedicationRepository,
    private val logs: MedicationLogRepository,
) {
    @Transactional(readOnly = true)
    fun weekly(userId: UUID, todayValue: String, timezoneValue: String): WeeklyStatsResponse {
        val today = parseApiDate(todayValue)
        val timezone = parseApiTimezone(timezoneValue)
        val firstDate = today.minusDays(6)
        val userMedications = medications.findAllByUserIdOrderByCreatedAtAsc(userId)
        val takenLogs = logs.findAllByUserIdAndTakenOnBetween(userId, firstDate, today)
        val takenByDate = takenLogs.groupBy { it.takenOn }

        val days = (0L..6L).map { offset ->
            val date = firstDate.plusDays(offset)
            val scheduled = userMedications.filter { it.isScheduledOn(date, timezone) }
            val scheduledIds = scheduled.mapNotNull { it.id }.toSet()
            val taken = takenByDate[date].orEmpty().asSequence()
                .map { it.medicationId }
                .filter { it in scheduledIds }
                .toSet()
                .size
            DailyStatsResponse(
                date = date.toString(),
                scheduled = scheduled.size,
                taken = taken,
                rate = if (scheduled.isEmpty()) null else floor(taken * 100.0 / scheduled.size + 0.5).toInt(),
            )
        }
        return WeeklyStatsResponse(days)
    }

    private fun Medication.isScheduledOn(date: LocalDate, timezone: ZoneId): Boolean {
        val createdDate = createdAt?.atZoneSameInstant(timezone)?.toLocalDate() ?: LocalDate.MIN
        return createdDate <= date && days.contains(date.dayOfWeek.apiValue)
    }

    private val DayOfWeek.apiValue: String
        get() = when (this) {
            DayOfWeek.MONDAY -> "mon"
            DayOfWeek.TUESDAY -> "tue"
            DayOfWeek.WEDNESDAY -> "wed"
            DayOfWeek.THURSDAY -> "thu"
            DayOfWeek.FRIDAY -> "fri"
            DayOfWeek.SATURDAY -> "sat"
            DayOfWeek.SUNDAY -> "sun"
        }
}
