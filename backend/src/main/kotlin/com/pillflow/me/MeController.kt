package com.pillflow.me
import com.pillflow.security.CurrentUser
import java.util.UUID
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
@RestController
@RequestMapping("/api/v1/me")
class MeController { @GetMapping fun me(@CurrentUser userId: UUID) = mapOf("userId" to userId.toString()) }
