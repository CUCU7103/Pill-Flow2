package com.pillflow.consent

data class ConsentRequest(
    val policyVersion: String? = null,
    val types: List<String?>? = null,
)

data class ConsentStatusResponse(
    val policyVersion: String,
    val ageOver14: Boolean,
    val sensitiveHealth: Boolean,
    val photoAnalysis: Boolean,
)
