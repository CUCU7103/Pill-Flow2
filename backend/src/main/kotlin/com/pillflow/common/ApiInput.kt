package com.pillflow.common

import java.time.DateTimeException
import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID

private val ISO_DATE_PATTERN = Regex("\\d{4}-\\d{2}-\\d{2}")
private val UUID_PATTERN = Regex("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")

fun parseApiDate(value: String): LocalDate {
    if (!ISO_DATE_PATTERN.matches(value)) {
        throw BusinessException(ErrorCode.INVALID_DATE)
    }
    return try {
        LocalDate.parse(value)
    } catch (_: DateTimeException) {
        throw BusinessException(ErrorCode.INVALID_DATE)
    }
}

fun parseApiTimezone(value: String): ZoneId = try {
    ZoneId.of(value)
} catch (_: DateTimeException) {
    throw BusinessException(ErrorCode.INVALID_TIMEZONE)
}

fun parseApiUuid(value: String): UUID {
    if (!UUID_PATTERN.matches(value)) {
        throw BusinessException(ErrorCode.INVALID_REQUEST)
    }
    return try {
        UUID.fromString(value)
    } catch (_: IllegalArgumentException) {
        throw BusinessException(ErrorCode.INVALID_REQUEST)
    }
}
