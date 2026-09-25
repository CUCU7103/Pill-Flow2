package com.pillflow.intake
import jakarta.persistence.*
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID
@Entity @Table(name="medication_logs", schema="public", uniqueConstraints=[UniqueConstraint(name="uq_medication_logs_medication_date", columnNames=["medication_id","taken_on"])])
class MedicationLog(
 @Id @GeneratedValue(strategy=GenerationType.UUID) var id: UUID? = null,
 @Column(name="medication_id", nullable=false) var medicationId: UUID,
 @Column(name="user_id", nullable=false) var userId: UUID,
 @Column(name="taken_on", nullable=false) var takenOn: LocalDate,
 @Column(name="taken_at", nullable=false) var takenAt: OffsetDateTime? = null,
)
 { @PrePersist fun onCreate() { takenAt = OffsetDateTime.now() } }
interface MedicationLogRepository : org.springframework.data.jpa.repository.JpaRepository<MedicationLog, UUID>
