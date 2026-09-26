package com.pillflow.intake

import com.pillflow.security.CurrentUser
import java.util.UUID
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/medications/{id}/intakes")
class IntakeController(private val service: IntakeService) {
    @PutMapping("/{date}")
    fun take(@CurrentUser userId: UUID, @PathVariable id: String, @PathVariable date: String): ResponseEntity<Void> {
        service.take(userId, id, date)
        return ResponseEntity.noContent().build()
    }

    @DeleteMapping("/{date}")
    fun cancel(@CurrentUser userId: UUID, @PathVariable id: String, @PathVariable date: String): ResponseEntity<Void> {
        service.cancel(userId, id, date)
        return ResponseEntity.noContent().build()
    }
}
