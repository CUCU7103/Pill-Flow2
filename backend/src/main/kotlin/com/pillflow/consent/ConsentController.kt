package com.pillflow.consent

import com.pillflow.security.CurrentUser
import java.util.UUID
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/consents")
class ConsentController(private val service: ConsentService) {
    @GetMapping
    fun status(@CurrentUser userId: UUID): ConsentStatusResponse = service.getStatus(userId)

    @PostMapping
    fun record(@CurrentUser userId: UUID, @RequestBody request: ConsentRequest): ConsentStatusResponse =
        service.record(userId, request)
}
