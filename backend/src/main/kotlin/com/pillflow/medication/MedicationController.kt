package com.pillflow.medication

import com.pillflow.security.CurrentUser
import java.util.UUID
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/medications")
class MedicationController(private val service: MedicationService) {
    @GetMapping
    fun findAll(@CurrentUser userId: UUID, @RequestParam date: String): List<MedicationResponse> = service.findAll(userId, date)

    @PostMapping
    fun create(@CurrentUser userId: UUID, @RequestBody request: MedicationRequest): ResponseEntity<MedicationResponse> =
        ResponseEntity.status(HttpStatus.CREATED).body(service.create(userId, request))

    @DeleteMapping("/{id}")
    fun delete(@CurrentUser userId: UUID, @PathVariable id: String): ResponseEntity<Void> {
        service.delete(userId, id)
        return ResponseEntity.noContent().build()
    }

    @DeleteMapping
    fun deleteAll(@CurrentUser userId: UUID): ResponseEntity<Void> {
        service.deleteAll(userId)
        return ResponseEntity.noContent().build()
    }
}
