package com.pillflow.medication

data class MedicationRequest(
    val name: String? = null,
    val dosage: String? = null,
    val memo: String? = null,
    val times: List<String?>? = null,
    val type: String? = null,
    val color: String? = null,
    val days: List<String?>? = null,
)

data class MedicationResponse(
    val id: String,
    val name: String,
    val dosage: String,
    val memo: String,
    val times: List<String>,
    val type: String,
    val color: String,
    val days: List<String>,
    val completed: Boolean,
)
