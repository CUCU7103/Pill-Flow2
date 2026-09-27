package com.pillflow.stats

import com.pillflow.security.CurrentUser
import java.util.UUID
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/stats")
class StatsController(private val service: StatsService) {
    @GetMapping("/weekly")
    fun weekly(
        @CurrentUser userId: UUID,
        @RequestParam today: String,
        @RequestParam tz: String,
    ): WeeklyStatsResponse = service.weekly(userId, today, tz)
}
