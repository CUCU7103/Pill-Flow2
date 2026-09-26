package com.pillflow.stats

data class DailyStatsResponse(
    val date: String,
    val scheduled: Int,
    val taken: Int,
    val rate: Int?,
)

data class WeeklyStatsResponse(val days: List<DailyStatsResponse>)
